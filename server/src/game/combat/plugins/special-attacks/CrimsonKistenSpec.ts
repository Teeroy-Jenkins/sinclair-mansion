import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const CRIMSON_KISTEN_ITEM_ID = 33631;
const BRUTAL_SWING_ENERGY_COST = 50;
const CRUSH_BONUS_INDEX = 2;
const BRUTAL_SWING_ACCURACY_ROLLS = 4;
const BRUTAL_SWING_FULL_ACCURACY_MAX_HIT_REDUCTION = 1;

/**
 * The damage range for one hitsplat, indexed by the number of successful
 * internal accuracy rolls (one through four).
 */
const BRUTAL_SWING_DAMAGE_RANGES = Object.freeze([
    Object.freeze({ minimumDamageMultiplier: 0.7, maximumDamageMultiplier: 1.1 }),
    Object.freeze({ minimumDamageMultiplier: 0.9, maximumDamageMultiplier: 1.3 }),
    Object.freeze({ minimumDamageMultiplier: 1.1, maximumDamageMultiplier: 1.5 }),
    Object.freeze({ minimumDamageMultiplier: 1.3, maximumDamageMultiplier: 1.7 }),
]);

/**
 * Brutal Swing makes four independent Crush accuracy rolls but produces one
 * hitsplat. Each success advances its damage range; all four successes reduce
 * that range's maximum hit by one.
 */
export class CrimsonKistenSpec implements WeaponSpecialAttackScript {
    readonly itemId = CRIMSON_KISTEN_ITEM_ID;
    readonly energyCost = BRUTAL_SWING_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            meleeAttackBonusIndex: CRUSH_BONUS_INDEX,
            accuracyRollCount: BRUTAL_SWING_ACCURACY_ROLLS,
            damageRangeBySuccessfulAccuracyRolls: BRUTAL_SWING_DAMAGE_RANGES,
            maximumHitReductionOnFullAccuracyRolls:
                BRUTAL_SWING_FULL_ACCURACY_MAX_HIT_REDUCTION,
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

export const CRIMSON_KISTEN_SPEC = Object.freeze(new CrimsonKistenSpec());
