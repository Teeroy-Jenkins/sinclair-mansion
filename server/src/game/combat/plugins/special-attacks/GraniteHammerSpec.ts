import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const GRANITE_HAMMER_ITEM_ID = 21742;
const HAMMER_BLOW_ENERGY_COST = 60;
const HAMMER_BLOW_ACCURACY_MULTIPLIER = 1.5;
const HAMMER_BLOW_DAMAGE_BONUS = 5;

/**
 * Hammer Blow gains 50% accuracy and adds five damage to every successful
 * damage roll, including a roll that would otherwise have produced zero.
 */
export class GraniteHammerSpec implements WeaponSpecialAttackScript {
    readonly itemId = GRANITE_HAMMER_ITEM_ID;
    readonly energyCost = HAMMER_BLOW_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: HAMMER_BLOW_ACCURACY_MULTIPLIER,
            minimumDamageBonus: HAMMER_BLOW_DAMAGE_BONUS,
            maximumDamageBonus: HAMMER_BLOW_DAMAGE_BONUS,
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

export const GRANITE_HAMMER_SPEC = Object.freeze(new GraniteHammerSpec());
