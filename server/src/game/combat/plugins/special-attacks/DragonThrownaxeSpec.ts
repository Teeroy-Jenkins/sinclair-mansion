import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_THROWNAXE_ITEM_ID = 20849;
const MOMENTUM_THROW_ENERGY_COST = 25;
const MOMENTUM_THROW_ACCURACY_MULTIPLIER = 1.25;

/**
 * Momentum Throw bypasses the weapon's normal delay, guaranteeing that the
 * next combat tick can launch the thrownaxe. It has 25% increased accuracy.
 */
export class DragonThrownaxeSpec implements WeaponSpecialAttackScript {
    readonly itemId = DRAGON_THROWNAXE_ITEM_ID;
    readonly energyCost = MOMENTUM_THROW_ENERGY_COST;
    readonly bypassAttackDelay = true;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: MOMENTUM_THROW_ACCURACY_MULTIPLIER,
            rollAttackType: AttackType.Ranged,
            damageType: AttackType.Ranged,
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

export const DRAGON_THROWNAXE_SPEC = Object.freeze(new DragonThrownaxeSpec());
