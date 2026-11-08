import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";
import { PlayerState } from "../../../player";
import { CombatAttributes } from "../../state/CombatAttributes";

const STAFF_OF_THE_DEAD_ITEM_ID = 11791;
const POWER_OF_DEATH_ENERGY_COST = 100;
const POWER_OF_DEATH_DURATION_TICKS = 100;

/**
 * Power of Death is a utility special that halves incoming melee damage for
 * one minute. The effect is inactive while the staff is unequipped, but its
 * original expiry remains in force if the staff is re-equipped in time.
 */
export class StaffOfTheDeadSpec implements WeaponSpecialAttackScript {
    readonly itemId = STAFF_OF_THE_DEAD_ITEM_ID;
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

export const STAFF_OF_THE_DEAD_SPEC = Object.freeze(new StaffOfTheDeadSpec());
