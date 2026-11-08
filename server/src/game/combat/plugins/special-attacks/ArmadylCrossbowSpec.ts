import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ARMADYL_CROSSBOW_ITEM_ID = 11785;
const ARMADYL_EYE_ENERGY_COST = 50;
const ARMADYL_EYE_ACCURACY_MULTIPLIER = 2;

/**
 * Armadyl Eye doubles the complete ranged accuracy roll for one shot.
 *
 * OSRS also doubles the base activation chance of an enchanted-bolt effect.
 * The hit processor consumes the multiplier at fire time, before the delayed
 * projectile is queued.
 */
export class ArmadylCrossbowSpec implements WeaponSpecialAttackScript {
    readonly itemId = ARMADYL_CROSSBOW_ITEM_ID;
    readonly energyCost = ARMADYL_EYE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: ARMADYL_EYE_ACCURACY_MULTIPLIER,
            enchantedBoltEffectChanceMultiplier: 2,
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

export const ARMADYL_CROSSBOW_SPEC = Object.freeze(new ArmadylCrossbowSpec());
