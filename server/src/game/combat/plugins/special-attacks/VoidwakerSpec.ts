import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackMaximumHitSource,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const VOIDWAKER_ITEM_ID = 27690;
const VOIDWAKER_ENERGY_COST = 50;

export class VoidwakerSpec implements WeaponSpecialAttackScript {
    readonly itemId = VOIDWAKER_ITEM_ID;
    readonly energyCost = VOIDWAKER_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            guaranteedHit: true,
            damageType: AttackType.Magic,
            maximumHitSource: SpecialAttackMaximumHitSource.PhysicalMelee,
            minimumDamageMultiplier: 0.5,
            maximumDamageMultiplier: 1.5,
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

export const VOIDWAKER_SPEC = Object.freeze(new VoidwakerSpec());
