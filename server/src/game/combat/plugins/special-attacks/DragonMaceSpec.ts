import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_MACE_ITEM_ID = 1239;
const SHATTER_ENERGY_COST = 25;
const SHATTER_ACCURACY_MULTIPLIER = 1.25;
const SHATTER_DAMAGE_MULTIPLIER = 1.5;
const CRUSH_BONUS_INDEX = 2;

/**
 * Shatter gains 25% accuracy and 50% maximum damage. Its accuracy uses the
 * selected attack style but is always checked against Crush defence.
 */
export class DragonMaceSpec implements WeaponSpecialAttackScript {
    readonly itemId = DRAGON_MACE_ITEM_ID;
    readonly energyCost = SHATTER_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: SHATTER_ACCURACY_MULTIPLIER,
            damageMultiplier: SHATTER_DAMAGE_MULTIPLIER,
            meleeDefenceBonusIndex: CRUSH_BONUS_INDEX,
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

export const DRAGON_MACE_SPEC = Object.freeze(new DragonMaceSpec());
