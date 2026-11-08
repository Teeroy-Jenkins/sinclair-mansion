import { SkillId } from "../../../../../../client/rs/skill/skills";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type CombatEntityRef,
    npcCombatEntityRef,
    playerCombatEntityRef,
} from "../../model/CombatEntityRef";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ANCIENT_GODSWORD_ITEM_ID = 26233;
const ANCIENT_GODSWORD_ENERGY_COST = 50;
const BLOOD_SACRIFICE_DELAY_TICKS = 8;
const BLOOD_SACRIFICE_ESCAPE_DISTANCE = 5;
const BLOOD_SACRIFICE_DAMAGE = 25;
const BLOOD_SACRIFICE_HEAL_FRACTION = 0.15;
const BLOOD_SACRIFICE_NPC_HEAL_CAP = 25;
const BLOOD_SACRIFICE_PLAYER_HEAL_CAP = 15;

export const ANCIENT_GODSWORD_BLOOD_SACRIFICE_PROFILE_ID = "core:ancient_godsword_blood_sacrifice";

export interface AncientGodswordBloodSacrifice {
    readonly attacker: PlayerState;
    readonly target: PlayerState | NpcState;
    readonly resolveAtMapClock: number;
}

const pendingBloodSacrifices: AncientGodswordBloodSacrifice[] = [];

/**
 * Consumes Blood Sacrifice marks that resolve on this game tick. A target
 * escapes only by being at least five tiles from the original attacker.
 */
export function takeDueAncientGodswordBloodSacrifices(
    currentMapClock: number,
): readonly AncientGodswordBloodSacrifice[] {
    const currentClock = Math.floor(currentMapClock);
    const due: AncientGodswordBloodSacrifice[] = [];
    for (let index = pendingBloodSacrifices.length - 1; index >= 0; index--) {
        const sacrifice = pendingBloodSacrifices[index];
        if (sacrifice.resolveAtMapClock > currentClock) continue;
        pendingBloodSacrifices.splice(index, 1);
        if (
            distanceBetween(sacrifice.attacker, sacrifice.target) < BLOOD_SACRIFICE_ESCAPE_DISTANCE
        ) {
            due.push(sacrifice);
        }
    }
    return Object.freeze(due.reverse());
}

export function createAncientGodswordBloodSacrificeAttack(
    attacker: PlayerState,
    target: PlayerState | NpcState,
    currentMapClock: number,
): CombatAttack {
    return Object.freeze({
        attacker: playerCombatEntityRef(attacker.id),
        target: entityReference(target),
        attackClock: Math.floor(currentMapClock),
        traits: Object.freeze({
            type: AttackType.Magic,
            style: null,
            rangeTiles: BLOOD_SACRIFICE_ESCAPE_DISTANCE,
            speedTicks: 0,
            specialAttack: false,
        }),
    });
}

export function getAncientGodswordBloodSacrificeDamage(): number {
    return BLOOD_SACRIFICE_DAMAGE;
}

/** Applies Blood Sacrifice's post-damage heal using the actual damage dealt. */
export function applyAncientGodswordBloodSacrificeHeal(
    attacker: PlayerState,
    target: PlayerState | NpcState,
    damageDealt: number,
    targetMaximumHitpoints: number,
): void {
    const appliedDamage = Math.max(0, Math.floor(damageDealt));
    if (appliedDamage <= 0) return;

    const targetBaseHitpoints =
        target instanceof PlayerState
            ? target.skillSystem.getSkill(SkillId.Hitpoints).baseLevel
            : targetMaximumHitpoints;
    const cap =
        target instanceof PlayerState
            ? BLOOD_SACRIFICE_PLAYER_HEAL_CAP
            : BLOOD_SACRIFICE_NPC_HEAL_CAP;
    const healAmount = Math.min(
        appliedDamage,
        cap,
        Math.floor(Math.max(0, targetBaseHitpoints) * BLOOD_SACRIFICE_HEAL_FRACTION),
    );
    attacker.skillSystem.applyHitpointsHeal(healAmount);
}

export class AncientGodswordSpec implements WeaponSpecialAttackScript {
    readonly itemId = ANCIENT_GODSWORD_ITEM_ID;
    readonly energyCost = ANCIENT_GODSWORD_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 2,
            damageMultiplier: 1.1,
        });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        if (!(attacker instanceof PlayerState)) return;
        if (!(target instanceof PlayerState) && !(target instanceof NpcState)) return;
        if (Math.floor(damageCalculated) <= 0) return;

        pendingBloodSacrifices.push(
            Object.freeze({
                attacker,
                target,
                resolveAtMapClock: Math.floor(currentMapClock) + BLOOD_SACRIFICE_DELAY_TICKS,
            }),
        );
    }
}

export const ANCIENT_GODSWORD_SPEC = Object.freeze(new AncientGodswordSpec());

function entityReference(entity: PlayerState | NpcState): CombatEntityRef {
    return entity instanceof PlayerState
        ? playerCombatEntityRef(entity.id)
        : npcCombatEntityRef(entity.id);
}

function distanceBetween(first: PlayerState, second: PlayerState | NpcState): number {
    if (first.level !== second.level) return Number.POSITIVE_INFINITY;
    return Math.max(Math.abs(first.tileX - second.tileX), Math.abs(first.tileY - second.tileY));
}
