import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import { CombatAttributes } from "../../state/CombatAttributes";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const STAFF_OF_BALANCE_ITEM_ID = 24144;
const POWER_OF_DEATH_ENERGY_COST = 100;
const POWER_OF_DEATH_DURATION_TICKS = 100;

/**
 * Power of Death is a utility special that halves incoming melee damage for
 * one minute. The effect is inactive while the Staff of balance is unequipped,
 * but resumes if it is re-equipped before the original expiry.
 */
export class StaffOfBalanceSpec implements WeaponSpecialAttackScript {
    readonly itemId = STAFF_OF_BALANCE_ITEM_ID;
    readonly energyCost = POWER_OF_DEATH_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true });
    }

    onSpecialActivated(
        attacker: any,
        target: any,
        currentMapClock: number,
    ): boolean | void {
        void target;
        if (!(attacker instanceof PlayerState)) return false;

        attacker.combatAttributes.set(
            CombatAttributes.POWER_OF_DEATH_UNTIL_CLOCK,
            Math.max(0, Math.floor(currentMapClock)) + POWER_OF_DEATH_DURATION_TICKS,
        );
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

export const STAFF_OF_BALANCE_SPEC = Object.freeze(new StaffOfBalanceSpec());
