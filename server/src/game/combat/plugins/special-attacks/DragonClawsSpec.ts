import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackTiming,
    type WeaponCombatProfile,
} from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    type WeaponSpecialAttackTraitOverrides,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_CLAWS_ITEM_ID = 13652;
const DRAGON_CLAWS_CR_ITEM_ID = 20784;
const DRAGON_CLAWS_ITEM_IDS = Object.freeze([
    DRAGON_CLAWS_ITEM_ID,
    DRAGON_CLAWS_CR_ITEM_ID,
]);

// Sinclair Mansion: 70% (OSRS: 50%), and a landed special drains the target's run energy.
const SLICE_AND_DICE_ENERGY_COST = 70;
/** Run energy (in percentage points) a special that lands takes from the target. */
export const DRAGON_CLAWS_SPECIAL_RUN_DRAIN = 40;
const SLICE_AND_DICE_HIT_COUNT = 4;
const SLICE_AND_DICE_ACCURACY_ROLLS = 4;
const SLASH_DEFENCE_BONUS_INDEX = 1;

const SLICE_AND_DICE_ANIMATION_ID = 7514;
const SLICE_AND_DICE_GRAPHIC_ID = 1171;
const SLICE_AND_DICE_HIT_DELAYS = Object.freeze([0, 0, 1, 1]);
const SLICE_AND_DICE_HIT_SOUNDS = Object.freeze([4138, 4140, 4141, 4141]);

/**
 * Redistributes the successful branch's single integer damage roll into the
 * four Slice and Dice hitsplats. All divisions deliberately floor.
 */
export function calculateDragonClawsHitDistribution(
    firstSuccessfulAccuracyRoll: number,
    rolledDamage: number,
): readonly number[] {
    const branch = Math.max(1, Math.min(4, Math.trunc(firstSuccessfulAccuracyRoll)));
    const damage = Math.max(0, Math.floor(rolledDamage));
    if (branch === 1) {
        return Object.freeze([
            damage,
            Math.floor(damage / 2),
            Math.floor(damage / 4),
            Math.floor(damage / 4) + 1,
        ]);
    }
    if (branch === 2) {
        return Object.freeze([
            0,
            damage,
            Math.floor(damage / 2),
            Math.floor(damage / 2) + 1,
        ]);
    }
    if (branch === 3) {
        return Object.freeze([0, 0, damage, damage + 1]);
    }
    return Object.freeze([0, 0, 0, damage]);
}

/**
 * Murder at Sinclair Mansion: dragon claws (the Murderer's weapon) never deal less than half
 * their potential, so a kill doesn't hinge on a lucky roll. Not OSRS behaviour.
 */
export const DRAGON_CLAWS_MINIMUM_DAMAGE_FRACTION = 0.5;
/**
 * Murder at Sinclair Mansion: Slice and Dice hits twice as hard as in OSRS, so the Murderer's
 * opening kills a household member most of the time at everyone's mid-level stats.
 */
export const DRAGON_CLAWS_SPECIAL_DAMAGE_MULTIPLIER = 2;

export const isDragonClaws = (itemId: number | undefined): boolean =>
    itemId !== undefined && DRAGON_CLAWS_ITEM_IDS.includes(itemId);

/**
 * The least a claws attack may deal, per hitsplat: half the max hit for a single swing, or, for
 * Slice and Dice, the smallest first-roll split whose four hits add up to half its best total.
 */
export function dragonClawsMinimumHits(maxHit: number, hitCount: number): readonly number[] {
    const max = Math.max(0, Math.floor(maxHit));
    if (hitCount <= 1) return [Math.ceil(max * DRAGON_CLAWS_MINIMUM_DAMAGE_FRACTION)];
    const total = (hits: readonly number[]) => hits.reduce((a, b) => a + b, 0);
    const specialMax = Math.floor(max * DRAGON_CLAWS_SPECIAL_DAMAGE_MULTIPLIER);
    const need = Math.ceil(total(calculateDragonClawsHitDistribution(1, specialMax)) * DRAGON_CLAWS_MINIMUM_DAMAGE_FRACTION);
    for (let damage = 0; damage < specialMax; damage++) {
        const hits = calculateDragonClawsHitDistribution(1, damage);
        if (total(hits) >= need) return hits;
    }
    return calculateDragonClawsHitDistribution(1, specialMax);
}

const DRAGON_CLAWS_DAMAGE_RANGES = Object.freeze([
    Object.freeze({
        minimumDamageMultiplier: 0.5,
        maximumDamageMultiplier: 1,
        maximumDamageReduction: 1,
        hitDamageMultipliers: Object.freeze([1, 0.5, 0.25, 0.25]),
        distributeDamage: (damage: number) => calculateDragonClawsHitDistribution(1, damage),
    }),
    Object.freeze({
        minimumDamageMultiplier: 3 / 8,
        maximumDamageMultiplier: 7 / 8,
        hitDamageMultipliers: Object.freeze([0, 1, 0.5, 0.5]),
        distributeDamage: (damage: number) => calculateDragonClawsHitDistribution(2, damage),
    }),
    Object.freeze({
        minimumDamageMultiplier: 1 / 4,
        maximumDamageMultiplier: 3 / 4,
        hitDamageMultipliers: Object.freeze([0, 0, 1, 1]),
        distributeDamage: (damage: number) => calculateDragonClawsHitDistribution(3, damage),
    }),
    Object.freeze({
        minimumDamageMultiplier: 1 / 4,
        maximumDamageMultiplier: 5 / 4,
        hitDamageMultipliers: Object.freeze([0, 0, 0, 1]),
        distributeDamage: (damage: number) => calculateDragonClawsHitDistribution(4, damage),
    }),
]);

// Uniform selection gives 1/3 all-zero and 2/3 two-damage outcomes.
export const DRAGON_CLAWS_ALL_MISS_PATTERNS = Object.freeze([
    Object.freeze([0, 0, 0, 0]),
    Object.freeze([0, 0, 0, 0]),
    Object.freeze([1, 1, 0, 0]),
    Object.freeze([0, 0, 1, 1]),
    Object.freeze([1, 0, 1, 0]),
    Object.freeze([0, 1, 0, 1]),
]);

const DRAGON_CLAWS_TRAITS: WeaponSpecialAttackTraitOverrides = Object.freeze({
    hitCount: SLICE_AND_DICE_HIT_COUNT,
    accuracyMultiplier: 1,
    damageMultiplier: DRAGON_CLAWS_SPECIAL_DAMAGE_MULTIPLIER,
    meleeDefenceBonusIndex: SLASH_DEFENCE_BONUS_INDEX,
    accuracyRollCount: SLICE_AND_DICE_ACCURACY_ROLLS,
    firstSuccessfulAccuracyDamageRanges: DRAGON_CLAWS_DAMAGE_RANGES,
    allMissDamagePatterns: DRAGON_CLAWS_ALL_MISS_PATTERNS,
    hitDelayTicks: SLICE_AND_DICE_HIT_DELAYS,
});

export const DRAGON_CLAWS_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:dragon_claws",
    itemIds: DRAGON_CLAWS_ITEM_IDS,
    specialAttackEnergyCost: SLICE_AND_DICE_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () =>
        Object.freeze({
            energyCostPercent: SLICE_AND_DICE_ENERGY_COST,
            ...DRAGON_CLAWS_TRAITS,
            hitCount: SLICE_AND_DICE_HIT_COUNT,
            accuracyMultiplier: 1,
            damageMultiplier: DRAGON_CLAWS_SPECIAL_DAMAGE_MULTIPLIER,
            attackAnimation: SLICE_AND_DICE_ANIMATION_ID,
            castGraphic: Object.freeze({ id: SLICE_AND_DICE_GRAPHIC_ID }),
            impactSoundIds: SLICE_AND_DICE_HIT_SOUNDS,
        }),
});

/** Shared Slice and Dice implementation for Dragon claws and Dragon claws (cr). */
export class DragonClawsSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId: number) {}

    readonly energyCost = SLICE_AND_DICE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, DRAGON_CLAWS_TRAITS);
    }

    /** Specials that already drained their target (the four hits share one attack). */
    private readonly drained = new WeakSet<object>();

    onHitAppliedWithAttack(
        _attacker: any,
        target: any,
        damageCalculated: number,
        _currentMapClock: number,
        attack: CombatAttack,
    ): void {
        if (!(damageCalculated > 0) || !attack || this.drained.has(attack)) return;
        const energy = target?.energy;
        if (!energy || typeof energy.adjustRunEnergyPercent !== "function") return;
        this.drained.add(attack);
        energy.adjustRunEnergyPercent(-DRAGON_CLAWS_SPECIAL_RUN_DRAIN);
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

export const DRAGON_CLAWS_SPECS = Object.freeze(
    DRAGON_CLAWS_ITEM_IDS.map((itemId) => Object.freeze(new DragonClawsSpec(itemId))),
);

export const DRAGON_CLAWS_SPEC = DRAGON_CLAWS_SPECS[0];
