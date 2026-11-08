import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ABYSSAL_DAGGER_ITEM_IDS = Object.freeze([
    13265, // Abyssal dagger
    13267, // Abyssal dagger (p)
    13269, // Abyssal dagger (p+)
    13271, // Abyssal dagger (p++)
]);

const ABYSSAL_PUNCTURE_ENERGY_COST = 25;
const ABYSSAL_PUNCTURE_ACCURACY_MULTIPLIER = 1.25;
const ABYSSAL_PUNCTURE_DAMAGE_MULTIPLIER = 0.85;
const SLASH_DEFENCE_BONUS_INDEX = 1;

/**
 * OSRS Abyssal dagger special attack, Abyssal Puncture. Both hits share one
 * accuracy roll, but each successful hit rolls its damage independently.
 */
export class AbyssalDaggerSpec implements WeaponSpecialAttackScript {
    readonly energyCost = ABYSSAL_PUNCTURE_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 2,
            accuracyMultiplier: ABYSSAL_PUNCTURE_ACCURACY_MULTIPLIER,
            damageMultiplier: ABYSSAL_PUNCTURE_DAMAGE_MULTIPLIER,
            meleeDefenceBonusIndex: SLASH_DEFENCE_BONUS_INDEX,
            sharedAccuracyRollAcrossHits: true,
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

export const ABYSSAL_DAGGER_SPECS = Object.freeze(
    ABYSSAL_DAGGER_ITEM_IDS.map((itemId) => Object.freeze(new AbyssalDaggerSpec(itemId))),
);

export const ABYSSAL_DAGGER_SPEC = ABYSSAL_DAGGER_SPECS[0];
