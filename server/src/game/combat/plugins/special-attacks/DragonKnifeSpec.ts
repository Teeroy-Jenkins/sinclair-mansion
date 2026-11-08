import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackTiming,
    type WeaponCombatContext,
    type WeaponCombatProfile,
} from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_KNIFE_ITEM_IDS = Object.freeze([
    22804, // Dragon knife
    22806, // Dragon knife(p)
    22808, // Dragon knife(p+)
    22810, // Dragon knife(p++)
]);

const DUALITY_ENERGY_COST = 25;
const DUALITY_HIT_COUNT = 2;
const DRAGON_KNIFE_ATTACK_ANIMATION_ID = 929;
const DRAGON_KNIFE_PROJECTILE_ID = 1166;

const DRAGON_KNIFE_PROJECTILE = Object.freeze({
    id: DRAGON_KNIFE_PROJECTILE_ID,
    startHeight: 25,
    endHeight: 27,
    lifeModel: "linear5-clamped10" as const,
});

function resolveDragonKnifeTravelDelay(distanceTiles: number): number {
    const distance = Math.max(0, Math.trunc(distanceTiles));
    return Math.max(1, 1 + Math.floor((3 + distance) / 6));
}

const DUALITY_TRAITS = Object.freeze({
    hitCount: DUALITY_HIT_COUNT,
    accuracyMultiplier: 1,
    damageMultiplier: 1,
    rollAttackType: AttackType.Ranged,
    damageType: AttackType.Ranged,
    // Both knives are released and resolve together after their shared flight.
    hitDelayTicks: Object.freeze([0, 0]),
});

/**
 * Duality throws two Dragon knives at the same time. Each knife receives its
 * own ordinary ranged accuracy and damage roll, with no special modifiers.
 */
export const DRAGON_KNIFE_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:dragon_knife",
    itemIds: DRAGON_KNIFE_ITEM_IDS,
    attackAnimation: DRAGON_KNIFE_ATTACK_ANIMATION_ID,
    projectile: DRAGON_KNIFE_PROJECTILE,
    travelDelayTicks: (context: WeaponCombatContext) =>
        resolveDragonKnifeTravelDelay(context.distanceTiles),
    specialAttackEnergyCost: DUALITY_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () =>
        Object.freeze({
            energyCostPercent: DUALITY_ENERGY_COST,
            ...DUALITY_TRAITS,
            hitCount: DUALITY_HIT_COUNT,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            attackAnimation: DRAGON_KNIFE_ATTACK_ANIMATION_ID,
            projectiles: Object.freeze([
                DRAGON_KNIFE_PROJECTILE,
                Object.freeze({ ...DRAGON_KNIFE_PROJECTILE, slope: 20 }),
            ]),
        }),
});

/** Shared Duality implementation for Dragon knife and its poison variants. */
export class DragonKnifeSpec implements WeaponSpecialAttackScript {
    readonly energyCost = DUALITY_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, DUALITY_TRAITS);
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

export const DRAGON_KNIFE_SPECS = Object.freeze(
    DRAGON_KNIFE_ITEM_IDS.map((itemId) => Object.freeze(new DragonKnifeSpec(itemId))),
);

export const DRAGON_KNIFE_SPEC = DRAGON_KNIFE_SPECS[0];
