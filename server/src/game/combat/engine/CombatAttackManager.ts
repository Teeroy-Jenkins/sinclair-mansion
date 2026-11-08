import { NpcState } from "../../npc";
import { PlayerState } from "../../player";
import { AttackType } from "../AttackType";
import type { CombatAttack, CombatAttackTraits } from "../model/CombatAttack";
import { npcCombatEntityRef, playerCombatEntityRef } from "../model/CombatEntityRef";
import { CombatAttributes } from "../state/CombatAttributes";
import type { CombatEntity } from "./CombatTargetResolver";

export interface PreparedCombatAttack {
    readonly attack: CombatAttack;
    readonly nextAttackClock: number;
}

export interface PrepareCombatAttackOptions {
    /** Used only by instant specials such as Granite maul's Quick Smash. */
    readonly bypassAttackDelay?: boolean;
    /** Instant specials do not move or replace the existing weapon deadline. */
    readonly preserveAttackDelay?: boolean;
}

/** Owns the absolute attack deadline and prepares legal attack cycles. */
export class CombatAttackManager {
    isAttackReady(attacker: CombatEntity, currentMapClock: number): boolean {
        return (
            this.mapClock(currentMapClock) >=
            attacker.combatAttributes.get(CombatAttributes.ATTACK_DELAY)
        );
    }

    remainingDelay(attacker: CombatEntity, currentMapClock: number): number {
        return Math.max(
            0,
            attacker.combatAttributes.get(CombatAttributes.ATTACK_DELAY) -
                this.mapClock(currentMapClock),
        );
    }

    prepareAttack(
        attacker: CombatEntity,
        target: CombatEntity,
        traits: CombatAttackTraits,
        currentMapClock: number,
        options: PrepareCombatAttackOptions = {},
    ): PreparedCombatAttack | null {
        const clock = this.mapClock(currentMapClock);
        // Manual spell clicks retain the combat target solely so the shared
        // interaction processor can path into range. Their one-shot execution
        // remains owned by SpellActionHandler, which validates and consumes runes.
        if (attacker instanceof PlayerState && attacker.combat.pendingManualCombatSpell) {
            return null;
        }
        if (!options.bypassAttackDelay && !this.isAttackReady(attacker, clock)) {
            return null;
        }

        const resolvedTraits = this.resolveAutocastTraits(attacker, traits);
        const speedTicks = this.attackSpeed(resolvedTraits.speedTicks);
        const previousAttackClock = attacker.combatAttributes.get(CombatAttributes.ATTACK_DELAY);
        const nextAttackClock = options.preserveAttackDelay
            ? previousAttackClock
            : clock + speedTicks;
        if (!options.preserveAttackDelay) {
            attacker.combatAttributes.set(CombatAttributes.ATTACK_DELAY, nextAttackClock);
        }
        attacker.combatAttributes.set(CombatAttributes.LAST_ATTACK_CLOCK, clock);
        attacker.combatAttributes.set(CombatAttributes.LAST_COMBAT_CLOCK, clock);
        target.combatAttributes.set(CombatAttributes.LAST_COMBAT_CLOCK, clock);

        const attack: CombatAttack = Object.freeze({
            attacker:
                attacker instanceof PlayerState
                    ? playerCombatEntityRef(attacker.id)
                    : npcCombatEntityRef((attacker as NpcState).id),
            target:
                target instanceof PlayerState
                    ? playerCombatEntityRef(target.id)
                    : npcCombatEntityRef((target as NpcState).id),
            attackClock: clock,
            traits: Object.freeze({ ...resolvedTraits, speedTicks }),
        });
        return { attack, nextAttackClock };
    }

    private mapClock(value: number): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Current map clock must be finite; received ${value}`);
        }
        return Math.trunc(value);
    }

    private attackSpeed(value: number): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Attack speed must be finite; received ${value}`);
        }
        return Math.max(1, Math.trunc(value));
    }

    private resolveAutocastTraits(
        attacker: CombatEntity,
        traits: CombatAttackTraits,
    ): CombatAttackTraits {
        if (!(attacker instanceof PlayerState)) return traits;
        if (attacker.combat.pendingManualCombatSpell !== undefined) return traits;

        const spellId = attacker.combatAttributes.get(CombatAttributes.AUTOCAST_SPELL_ID);
        if (spellId === null || !Number.isSafeInteger(spellId) || spellId <= 0) {
            return traits;
        }

        return {
            ...traits,
            type: AttackType.Magic,
            rangeTiles: Math.max(10, Math.trunc(traits.rangeTiles)),
            speedTicks: 5,
            spellId,
            autocast: true,
        };
    }
}
