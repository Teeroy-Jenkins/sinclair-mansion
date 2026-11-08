import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const RUNE_THROWNAXE_ITEM_ID = 805;
const CHAINHIT_INITIAL_ENERGY_COST = 10;

/**
 * Chainhit begins with a standard hit for 10% special energy. In OSRS it then
 * bounces to up to five additional targets within three tiles, spending a
 * further 10% per bounce (up to 50% total); each miss ends the sequence, and
 * damage rolls omit prayer modifiers. Those mechanics require target selection,
 * per-hit energy consumption, and prayer-roll hooks outside this contract.
 */
export class RuneThrownaxeSpec implements WeaponSpecialAttackScript {
    readonly itemId = RUNE_THROWNAXE_ITEM_ID;
    readonly energyCost = CHAINHIT_INITIAL_ENERGY_COST;

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

export const RUNE_THROWNAXE_SPEC = Object.freeze(new RuneThrownaxeSpec());
