import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const PURGING_STAFF_ITEM_ID = 29594;
const SCATTER_ASHES_ENERGY_COST = 25;

/**
 * Scatter Ashes uses the strongest Demonbane spell available to an Arceuus
 * caster. It has no independent accuracy or damage multiplier; spell choice,
 * rune validation, and Demonbane scaling remain the magic-combat engine's
 * responsibility.
 */
export class PurgingStaffSpec implements WeaponSpecialAttackScript {
    readonly itemId = PURGING_STAFF_ITEM_ID;
    readonly energyCost = SCATTER_ASHES_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            rollAttackType: AttackType.Magic,
            damageType: AttackType.Magic,
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

        // The engine-level spell resolver will own the conditional refund and
        // three-tick next-attack reduction once it exposes spellbook and NPC
        // species data to weapon-special scripts.
    }
}

export const PURGING_STAFF_SPEC = Object.freeze(new PurgingStaffSpec());
