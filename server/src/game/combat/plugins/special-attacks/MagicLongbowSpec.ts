import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../../client/rs/skill/skills";
import { getItemDefinition } from "../../../../data/items";
import { PlayerState } from "../../../player";
import { AttackType } from "../../AttackType";
import type { CombatEntity } from "../../engine/CombatTargetResolver";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackTiming,
    type WeaponCombatContext,
    type WeaponCombatProfile,
} from "../WeaponCombatProfile";
import {
    getWeaponSpecialAttackAttacker,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const MAGIC_LONGBOW_ITEM_ID = 859;
const MAGIC_COMP_BOW_ITEM_ID = 10284;
const POWERSHOT_ENERGY_COST = 35;
const RANGED_STRENGTH_BONUS_INDEX = 11;
const CLIENT_CYCLES_PER_GAME_TICK = 30;
const BOW_RELEASE_DELAY_TICKS = 16 / CLIENT_CYCLES_PER_GAME_TICK;

const POWERSHOT_PROJECTILE = Object.freeze({
    id: 10,
    startHeight: 40,
    endHeight: 36,
    slope: 0,
    steepness: 64,
    startDelayTicks: BOW_RELEASE_DELAY_TICKS,
    lifeModel: "linear5-clamped10" as const,
});

function resolvePowershotTravelDelay(distanceTiles: number): number {
    const distance = Math.max(0, Math.trunc(distanceTiles));
    return Math.max(1, 1 + Math.floor((3 + distance) / 6));
}

/**
 * Powershot uses the visible Ranged level, a fixed +10 style bonus, and only
 * the equipped arrow's Ranged Strength. Prayer, equipment and Slayer boosts
 * deliberately do not contribute to this pre-EoC special formula.
 */
export function calculatePowershotMaxHit(
    visibleRangedLevel: number,
    ammoRangedStrength: number,
): number {
    const level = Math.max(0, Math.trunc(visibleRangedLevel));
    const strength = Math.trunc(ammoRangedStrength);
    return Math.max(0, Math.floor(0.5 + ((level + 10) * (strength + 64)) / 640));
}

export function resolvePowershotMaxHit(attacker: PlayerState): number {
    const ranged = attacker.skillSystem.getSkill(SkillId.Ranged);
    const visibleRangedLevel = ranged.baseLevel + ranged.boost;
    const ammoId = attacker.appearance.equip[EquipmentSlot.AMMO] ?? -1;
    const ammoRangedStrength =
        getItemDefinition(ammoId)?.bonuses?.[RANGED_STRENGTH_BONUS_INDEX] ?? 0;
    return calculatePowershotMaxHit(visibleRangedLevel, ammoRangedStrength);
}

function resolvePowershotAttackSpeed(attack: CombatAttack): number {
    // The Magic comp bow intentionally borrows the Magic longbow special's
    // slower cycle: 6 ticks normally or 5 ticks on Rapid.
    if (attack.traits.weaponId === MAGIC_COMP_BOW_ITEM_ID) {
        return Math.max(1, Math.trunc(attack.traits.speedTicks) + 1);
    }
    return Math.max(1, Math.trunc(attack.traits.speedTicks));
}

function createPowershotProfile(itemId: number, profileId: string): WeaponCombatProfile {
    return Object.freeze({
        id: profileId,
        itemIds: Object.freeze([itemId]),
        attackAnimation: 426,
        projectile: POWERSHOT_PROJECTILE,
        travelDelayTicks: (context: WeaponCombatContext) =>
            resolvePowershotTravelDelay(context.distanceTiles),
        specialAttackEnergyCost: POWERSHOT_ENERGY_COST,
        specialAttackTiming: SpecialAttackTiming.Standard,
        handleSpecialAttack: (
            attacker: CombatEntity,
            _target: CombatEntity,
            attack: CombatAttack,
        ) => {
            if (!(attacker instanceof PlayerState)) return null;
            return Object.freeze({
                energyCostPercent: POWERSHOT_ENERGY_COST,
                hitCount: 1,
                accuracyMultiplier: 1,
                damageMultiplier: 1,
                guaranteedHit: true,
                rollAttackType: AttackType.Ranged,
                damageType: AttackType.Ranged,
                maxHitOverride: resolvePowershotMaxHit(attacker),
                attackAnimation: 426,
                attackSpeedTicks: resolvePowershotAttackSpeed(attack),
            });
        },
    });
}

/** Shared Powershot implementation for the Magic longbow and Magic comp bow. */
export class MagicLongbowSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId: number) {}

    readonly energyCost = POWERSHOT_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        const attacker = getWeaponSpecialAttackAttacker(attack);
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            guaranteedHit: true,
            rollAttackType: AttackType.Ranged,
            damageType: AttackType.Ranged,
            maxHitOverride:
                attacker instanceof PlayerState ? resolvePowershotMaxHit(attacker) : 0,
            attackSpeedTicks: resolvePowershotAttackSpeed(attack),
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

export const MAGIC_LONGBOW_PROFILE = createPowershotProfile(
    MAGIC_LONGBOW_ITEM_ID,
    "core:magic_longbow",
);

export const MAGIC_COMP_BOW_PROFILE = createPowershotProfile(
    MAGIC_COMP_BOW_ITEM_ID,
    "core:magic_comp_bow",
);

export const MAGIC_LONGBOW_SPECS = Object.freeze([
    Object.freeze(new MagicLongbowSpec(MAGIC_LONGBOW_ITEM_ID)),
    Object.freeze(new MagicLongbowSpec(MAGIC_COMP_BOW_ITEM_ID)),
]);

export const MAGIC_LONGBOW_SPEC = MAGIC_LONGBOW_SPECS[0];
export const MAGIC_COMP_BOW_SPEC = MAGIC_LONGBOW_SPECS[1];
