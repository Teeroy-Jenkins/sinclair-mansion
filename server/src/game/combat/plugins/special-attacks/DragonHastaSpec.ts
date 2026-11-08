import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    getWeaponSpecialAttackAttacker,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_HASTA_ITEM_IDS = Object.freeze([
    22731, // Dragon hasta
    22734, // Dragon hasta(p)
    22737, // Dragon hasta(p+)
    22740, // Dragon hasta(p++)
    22743, // Dragon hasta(kp)
]);
const UNLEASH_MINIMUM_ENERGY_COST = 5;
const STAB_BONUS_INDEX = 0;
const UNLEASH_ACCURACY_PER_ENERGY_STEP = 0.05;
const UNLEASH_DAMAGE_PER_ENERGY_STEP = 0.025;

function getUnleashEnergyCost(attacker: unknown): number {
    if (!(attacker instanceof PlayerState)) return UNLEASH_MINIMUM_ENERGY_COST;
    return Math.max(0, Math.floor(attacker.specEnergy.getPercent()));
}

/**
 * Unleash consumes every available special-attack point (minimum 5%). For
 * each complete 5% spent it gains 5% accuracy and 2.5% maximum damage, rolls
 * against Stab defence, and bypasses Protect from Melee.
 */
export class DragonHastaSpec implements WeaponSpecialAttackScript {
    readonly energyCost = UNLEASH_MINIMUM_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        const energyCost = getUnleashEnergyCost(getWeaponSpecialAttackAttacker(attack));
        const energySteps = Math.floor(energyCost / UNLEASH_MINIMUM_ENERGY_COST);

        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1 + energySteps * UNLEASH_ACCURACY_PER_ENERGY_STEP,
            damageMultiplier: 1 + energySteps * UNLEASH_DAMAGE_PER_ENERGY_STEP,
            meleeAttackBonusIndex: STAB_BONUS_INDEX,
            ignoreProtectionPrayer: true,
        });
    }

    resolveEnergyCost(attacker: any, target: any, currentMapClock: number): number {
        void target;
        void currentMapClock;
        // The special cannot be used below 5%; returning the minimum lets the
        // shared processor reject an insufficient-energy attempt normally.
        return Math.max(UNLEASH_MINIMUM_ENERGY_COST, getUnleashEnergyCost(attacker));
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

export const DRAGON_HASTA_SPECS = Object.freeze(
    DRAGON_HASTA_ITEM_IDS.map((itemId) => Object.freeze(new DragonHastaSpec(itemId))),
);

export const DRAGON_HASTA_SPEC = DRAGON_HASTA_SPECS[0];
