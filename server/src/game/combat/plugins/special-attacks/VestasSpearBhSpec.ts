import { AttackType } from "../../AttackType";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import type { AppliedCombatHit } from "../../engine/DeferredHitQueue";
import { npcCombatEntityRef, playerCombatEntityRef } from "../../model/CombatEntityRef";
import { CombatAttributes } from "../../state/CombatAttributes";
import { SpecialAttackTiming, type WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const VESTAS_SPEAR_BH_ITEM_ID = 27900;
const SPEAR_WALL_ENERGY_COST = 50;
const SPEAR_WALL_SECOND_HIT_DELAY_TICKS = 2;
const SPEAR_WALL_IMMUNITY_TICKS = 8;
export const VESTAS_SPEAR_BH_SECOND_HIT_PROFILE_ID = "core:vestas_spear_bh_second_hit";

interface VestasSpearBhSecondHit { attacker: PlayerState; target: PlayerState | NpcState; damage: number; resolveAtMapClock: number; }
const pendingSecondHits: VestasSpearBhSecondHit[] = [];

export function queueVestasSpearBhSecondHit(attacker: PlayerState, target: PlayerState | NpcState, firstDamage: number, clock: number): void {
    const applied = Math.max(0, Math.floor(firstDamage));
    if (applied <= 0) return;
    pendingSecondHits.push(Object.freeze({ attacker, target, damage: applied, resolveAtMapClock: Math.floor(clock) + SPEAR_WALL_SECOND_HIT_DELAY_TICKS }));
}
export function takeDueVestasSpearBhSecondHits(clock: number): readonly VestasSpearBhSecondHit[] {
    const due: VestasSpearBhSecondHit[] = [];
    for (let index = pendingSecondHits.length - 1; index >= 0; index--) if (pendingSecondHits[index].resolveAtMapClock <= Math.floor(clock)) due.push(pendingSecondHits.splice(index, 1)[0]);
    return Object.freeze(due.reverse());
}
export function createVestasSpearBhSecondHitAttack(attacker: PlayerState, target: PlayerState | NpcState, clock: number): CombatAttack {
    return Object.freeze({ attacker: playerCombatEntityRef(attacker.id), target: target instanceof PlayerState ? playerCombatEntityRef(target.id) : npcCombatEntityRef(target.id), attackClock: Math.floor(clock), traits: Object.freeze({ type: AttackType.Melee, style: null, rangeTiles: 0, speedTicks: 0, specialAttack: false }) });
}
export function rollVestasSpearBhSecondHitDamage(firstDamage: number, random: () => number = Math.random): number {
    return Math.floor(Math.max(0, Math.floor(firstDamage)) * (0.5 + Math.max(0, Math.min(0.999999999, random())) * 0.25));
}

/**
 * Spear Wall's primary hit is an ordinary melee roll. The combat engine uses
 * the profile identity to schedule its dependent second hit and defensive
 * window once that primary roll has resolved.
 */
export const VESTAS_SPEAR_BH_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:vestas_spear_bh",
    itemIds: Object.freeze([VESTAS_SPEAR_BH_ITEM_ID]),
    specialAttackEnergyCost: SPEAR_WALL_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () =>
        Object.freeze({
            energyCostPercent: SPEAR_WALL_ENERGY_COST,
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            rollAttackType: AttackType.Melee,
            damageType: AttackType.Melee,
            attackAnimation: 7515,
            castGraphic: Object.freeze({ id: 1194 }),
            attackSoundId: 3853,
        }),
    onHitApplied: (hit: AppliedCombatHit) => {
        if (!hit.pending.landed || !(hit.source instanceof PlayerState)) return;
        if (!(hit.target instanceof PlayerState) && !(hit.target instanceof NpcState)) return;
        queueVestasSpearBhSecondHit(hit.source, hit.target, hit.amount, hit.appliedClock);
        hit.source.combatAttributes.set(CombatAttributes.ATTACK_DELAY, Math.max(hit.appliedClock, hit.source.combatAttributes.get(CombatAttributes.ATTACK_DELAY) - 1));
    },
});

/** Bounty Hunter Spear Wall's initial ordinary melee hit. */
export class VestasSpearBhSpec implements WeaponSpecialAttackScript {
    readonly itemId = VESTAS_SPEAR_BH_ITEM_ID;
    readonly energyCost = SPEAR_WALL_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            rollAttackType: AttackType.Melee,
            damageType: AttackType.Melee,
        });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): void {
        void target;
        if (attacker instanceof PlayerState) attacker.combatAttributes.set(CombatAttributes.VESTAS_SPEAR_WALL_UNTIL_CLOCK, Math.floor(currentMapClock) + SPEAR_WALL_IMMUNITY_TICKS);
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void attacker;
        void target;
        void damageCalculated;
        void currentMapClock;
    }
}

export const VESTAS_SPEAR_BH_SPEC = Object.freeze(new VestasSpearBhSpec());
