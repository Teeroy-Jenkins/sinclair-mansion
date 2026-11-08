import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ZARYTE_CROSSBOW_ITEM_IDS = Object.freeze([
    26374, // Zaryte crossbow
    27186, // Zaryte crossbow (Last Man Standing)
]);
const EVOKE_ENERGY_COST = 75;
const EVOKE_ACCURACY_MULTIPLIER = 2;

/**
 * OSRS Zaryte crossbow special attack, Evoke. A successful hit has doubled
 * accuracy and always triggers the equipped enchanted bolt's special effect.
 */
export class ZaryteCrossbowSpec implements WeaponSpecialAttackScript {
    readonly energyCost = EVOKE_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            rollAttackType: AttackType.Ranged,
            damageType: AttackType.Ranged,
            accuracyMultiplier: EVOKE_ACCURACY_MULTIPLIER,
            guaranteedEnchantedBoltEffect: true,
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

export const ZARYTE_CROSSBOW_SPECS = Object.freeze(
    ZARYTE_CROSSBOW_ITEM_IDS.map((itemId) => Object.freeze(new ZaryteCrossbowSpec(itemId))),
);

export const ZARYTE_CROSSBOW_SPEC = ZARYTE_CROSSBOW_SPECS[0];
