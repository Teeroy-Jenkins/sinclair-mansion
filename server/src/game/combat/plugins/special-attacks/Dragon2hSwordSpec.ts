import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_2H_SWORD_ITEM_ID = 7158;
const POWERSTAB_ENERGY_COST = 60;

/**
 * Powerstab has no primary-target accuracy or damage modifier. Its OSRS effect
 * is a single standard hit against up to fourteen targets surrounding the
 * wielder. Creating that target set requires an engagement-level nearby-entity
 * query, which is intentionally outside this single-target script contract.
 */
export class Dragon2hSwordSpec implements WeaponSpecialAttackScript {
    readonly itemId = DRAGON_2H_SWORD_ITEM_ID;
    readonly energyCost = POWERSTAB_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { hitCount: 1 });
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

export const DRAGON_2H_SWORD_SPEC = Object.freeze(new Dragon2hSwordSpec());
