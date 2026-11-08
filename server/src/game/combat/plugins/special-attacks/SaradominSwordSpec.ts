import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import type { AppliedCombatHit } from "../../engine/DeferredHitQueue";
import {
    type CombatEntityRef,
    npcCombatEntityRef,
    playerCombatEntityRef,
} from "../../model/CombatEntityRef";
import { SpecialAttackTiming, type WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const SARADOMIN_SWORD_ITEM_ID = 11838;
const SARADOMINS_LIGHTNING_ENERGY_COST = 100;
const SARADOMINS_LIGHTNING_DAMAGE_MULTIPLIER = 1.1;
const SLASH_DEFENCE_BONUS_INDEX = 1;
const SARADOMINS_LIGHTNING_MAGIC_MINIMUM_DAMAGE = 1;
const SARADOMINS_LIGHTNING_MAGIC_MAXIMUM_DAMAGE = 16;

export const SARADOMIN_SWORD_LIGHTNING_PROFILE_ID = "core:saradomin_sword_lightning";

export interface SaradominSwordLightning {
    readonly attacker: PlayerState;
    readonly target: PlayerState | NpcState;
    readonly resolveAtMapClock: number;
}

const pendingLightnings: SaradominSwordLightning[] = [];

export function queueSaradominSwordLightning(
    attacker: PlayerState,
    target: PlayerState | NpcState,
    currentMapClock: number,
): void {
    pendingLightnings.push(
        Object.freeze({
            attacker,
            target,
            resolveAtMapClock: Math.floor(currentMapClock),
        }),
    );
}

export function takeDueSaradominSwordLightnings(
    currentMapClock: number,
): readonly SaradominSwordLightning[] {
    const clock = Math.floor(currentMapClock);
    const due: SaradominSwordLightning[] = [];
    for (let index = pendingLightnings.length - 1; index >= 0; index--) {
        const lightning = pendingLightnings[index];
        if (lightning.resolveAtMapClock > clock) continue;
        pendingLightnings.splice(index, 1);
        due.push(lightning);
    }
    return Object.freeze(due.reverse());
}

export function createSaradominSwordLightningAttack(
    attacker: PlayerState,
    target: PlayerState | NpcState,
    currentMapClock: number,
): CombatAttack {
    return Object.freeze({
        attacker: playerCombatEntityRef(attacker.id),
        target:
            target instanceof PlayerState
                ? playerCombatEntityRef(target.id)
                : npcCombatEntityRef(target.id),
        attackClock: Math.floor(currentMapClock),
        traits: Object.freeze({
            type: AttackType.Magic,
            style: null,
            rangeTiles: 0,
            speedTicks: 0,
            specialAttack: false,
        }),
    });
}

/** Rolls Saradomin's Lightning's fixed independent 1–16 Magic damage range. */
export function rollSaradominSwordLightningDamage(random: () => number = Math.random): number {
    const roll = Math.max(0, Math.min(0.999999999999, random()));
    return SARADOMINS_LIGHTNING_MAGIC_MINIMUM_DAMAGE + Math.floor(
        roll * (SARADOMINS_LIGHTNING_MAGIC_MAXIMUM_DAMAGE - SARADOMINS_LIGHTNING_MAGIC_MINIMUM_DAMAGE + 1),
    );
}

const SARADOMINS_LIGHTNING = Object.freeze({
    energyCostPercent: SARADOMINS_LIGHTNING_ENERGY_COST,
    hitCount: 1,
    accuracyMultiplier: 1,
    damageMultiplier: SARADOMINS_LIGHTNING_DAMAGE_MULTIPLIER,
    rollAttackType: AttackType.Melee,
    // The player's chosen melee stance supplies the attack bonus, but the
    // target always defends with Slash for Saradomin's Lightning.
    meleeDefenceBonusIndex: SLASH_DEFENCE_BONUS_INDEX,
    attackAnimation: 1132,
    castGraphic: Object.freeze({ id: 1194 }),
    attackSoundId: 3853,
});

export const SARADOMIN_SWORD_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:saradomin_sword",
    itemIds: Object.freeze([SARADOMIN_SWORD_ITEM_ID]),
    impactGraphic: Object.freeze({ id: 1195 }),
    specialAttackEnergyCost: SARADOMINS_LIGHTNING_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () => SARADOMINS_LIGHTNING,
    onHitApplied: (hit: AppliedCombatHit) => {
        if (!hit.pending.landed || !(hit.source instanceof PlayerState)) return;
        if (!(hit.target instanceof PlayerState) && !(hit.target instanceof NpcState)) return;
        queueSaradominSwordLightning(hit.source, hit.target, hit.appliedClock);
    },
});

/**
 * Saradomin's Lightning consumes all special energy for a 10% stronger melee
 * strike. Its melee accuracy uses the active stance's attack bonus against
 * the target's Slash defence.
 */
export class SaradominSwordSpec implements WeaponSpecialAttackScript {
    readonly itemId = SARADOMIN_SWORD_ITEM_ID;
    readonly energyCost = SARADOMINS_LIGHTNING_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: SARADOMINS_LIGHTNING_DAMAGE_MULTIPLIER,
            rollAttackType: AttackType.Melee,
            meleeDefenceBonusIndex: SLASH_DEFENCE_BONUS_INDEX,
        });
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

export const SARADOMIN_SWORD_SPEC = Object.freeze(new SaradominSwordSpec());
