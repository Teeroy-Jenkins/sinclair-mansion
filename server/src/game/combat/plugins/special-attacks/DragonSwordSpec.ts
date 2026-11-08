import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_SWORD_ITEM_ID = 21009;
const WILD_STAB_ENERGY_COST = 40;
const WILD_STAB_ACCURACY_MULTIPLIER = 1.25;
const WILD_STAB_DAMAGE_MULTIPLIER = 1.25;
const STAB_BONUS_INDEX = 0;

/**
 * Wild Stab gains 25% accuracy and maximum damage, rolls against Stab
 * defence regardless of selected style, and bypasses Protect from Melee.
 */
export class DragonSwordSpec implements WeaponSpecialAttackScript {
    readonly itemId = DRAGON_SWORD_ITEM_ID;
    readonly energyCost = WILD_STAB_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: WILD_STAB_ACCURACY_MULTIPLIER,
            damageMultiplier: WILD_STAB_DAMAGE_MULTIPLIER,
            meleeDefenceBonusIndex: STAB_BONUS_INDEX,
            ignoreProtectionPrayer: true,
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

export const DRAGON_SWORD_SPEC = Object.freeze(new DragonSwordSpec());
