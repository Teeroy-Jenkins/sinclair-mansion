import type { CombatAttack } from "../../model/CombatAttack";
import type { WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    WeaponSpecialAttackTargetPattern,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_HALBERD_ITEM_ID = 3204;
const CRYSTAL_HALBERD_ITEM_ID = 13081;
const SWEEP_ENERGY_COST = 30;
const SWEEP_DAMAGE_MULTIPLIER = 1.1;
const SWEEP_SECOND_HIT_ACCURACY_MULTIPLIER = 0.75;

export const HALBERD_SWEEP_TARGETING = Object.freeze({
    pattern: WeaponSpecialAttackTargetPattern.ForwardLine,
    width: 3,
    maxTargets: 10,
    requiresMultiCombat: true,
    largeTargetExtraHit: Object.freeze({
        minimumSize: 2,
        accuracyMultiplier: SWEEP_SECOND_HIT_ACCURACY_MULTIPLIER,
    }),
});

const DRAGON_HALBERD_SPECIAL = Object.freeze({
    energyCostPercent: SWEEP_ENERGY_COST,
    hitCount: 1,
    accuracyMultiplier: 1,
    damageMultiplier: SWEEP_DAMAGE_MULTIPLIER,
    meleeAttackBonusIndex: 1 as const,
    meleeDefenceBonusIndex: 1 as const,
    attackAnimation: 1203,
    castGraphic: Object.freeze({ id: 282 }),
    attackSoundId: 2533,
    targeting: HALBERD_SWEEP_TARGETING,
});

export const DRAGON_HALBERD_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:dragon_halberd",
    itemIds: Object.freeze([DRAGON_HALBERD_ITEM_ID]),
    specialAttackEnergyCost: SWEEP_ENERGY_COST,
    handleSpecialAttack: () => DRAGON_HALBERD_SPECIAL,
});

/**
 * Sweep increases each hit's maximum damage by 10%. The targeting descriptor
 * lets the engagement engine select NPC footprints across the forward line or
 * replace them with the reduced-accuracy second hit against a large target.
 */
export class DragonHalberdSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId = DRAGON_HALBERD_ITEM_ID) {}

    readonly energyCost = SWEEP_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            damageMultiplier: SWEEP_DAMAGE_MULTIPLIER,
            meleeAttackBonusIndex: 1,
            meleeDefenceBonusIndex: 1,
            targeting: HALBERD_SWEEP_TARGETING,
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

export const DRAGON_HALBERD_SPEC = Object.freeze(new DragonHalberdSpec());
export const CRYSTAL_HALBERD_SPEC = Object.freeze(
    new DragonHalberdSpec(CRYSTAL_HALBERD_ITEM_ID),
);
