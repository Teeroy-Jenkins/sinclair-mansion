import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const VESTAS_LONGSWORD_BH_ITEM_IDS = Object.freeze([
    27904, // Vesta's longsword (bh)
    24617, // Vesta's blighted longsword
]);

const FEINT_ENERGY_COST = 25;
const FEINT_MINIMUM_DAMAGE_MULTIPLIER = 0.2;
const FEINT_MAXIMUM_DAMAGE_MULTIPLIER = 1.2;
const FEINT_DEFENCE_ROLL_MULTIPLIER = 0.25;
const STAB_DEFENCE_BONUS_INDEX = 0;

/**
 * OSRS Vesta's longsword Feint special. The user's selected stance supplies
 * the attacking roll, while the target rolls only 25% of its Stab defence.
 */
export class VestasLongswordBhSpec implements WeaponSpecialAttackScript {
    readonly energyCost = FEINT_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            minimumDamageMultiplier: FEINT_MINIMUM_DAMAGE_MULTIPLIER,
            maximumDamageMultiplier: FEINT_MAXIMUM_DAMAGE_MULTIPLIER,
            // Feint retains the selected stance's attacking bonus but always
            // compares it with the target's Stab defence.
            meleeDefenceBonusIndex: STAB_DEFENCE_BONUS_INDEX,
            defenceRollMultiplier: FEINT_DEFENCE_ROLL_MULTIPLIER,
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

export const VESTAS_LONGSWORD_BH_SPECS = Object.freeze(
    VESTAS_LONGSWORD_BH_ITEM_IDS.map((itemId) => Object.freeze(new VestasLongswordBhSpec(itemId))),
);

export const VESTAS_LONGSWORD_BH_SPEC = VESTAS_LONGSWORD_BH_SPECS[0];
