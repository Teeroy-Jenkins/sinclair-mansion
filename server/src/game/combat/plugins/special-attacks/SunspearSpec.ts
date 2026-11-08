import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const SUNSPEAR_ITEM_ID = 33722;
const SEEKING_LUNGE_ENERGY_COST = 50;
const SEEKING_LUNGE_FIXED_DAMAGE_MULTIPLIER = 0.7;
const SEEKING_LUNGE_EXECUTE_ACCURACY_MULTIPLIER = 0.7;

/**
 * OSRS Sunspear special attack, Seeking Lunge.
 *
 * A successful hit always deals exactly 70% of the attack's maximum hit. If
 * the target is already within that damage threshold, its normal random
 * accuracy roll is replaced with a fixed 70% maximum-accuracy roll.
 */
export class SunspearSpec implements WeaponSpecialAttackScript {
    readonly itemId = SUNSPEAR_ITEM_ID;
    readonly energyCost = SEEKING_LUNGE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            minimumDamageMultiplier: SEEKING_LUNGE_FIXED_DAMAGE_MULTIPLIER,
            maximumDamageMultiplier: SEEKING_LUNGE_FIXED_DAMAGE_MULTIPLIER,
            fixedAccuracyRollMultiplierWhenTargetAtOrBelowMaximumDamage:
                SEEKING_LUNGE_EXECUTE_ACCURACY_MULTIPLIER,
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

export const SUNSPEAR_SPEC = Object.freeze(new SunspearSpec());
