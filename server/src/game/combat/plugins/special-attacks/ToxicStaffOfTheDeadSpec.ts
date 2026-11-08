import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import { CombatAttributes } from "../../state/CombatAttributes";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const TOXIC_STAFF_OF_THE_DEAD_CHARGED_ITEM_ID = 12904;
const POWER_OF_DEATH_ENERGY_COST = 100;
const POWER_OF_DEATH_DURATION_TICKS = 100;

/**
 * Charged Toxic staff of the dead uses Power of Death: a utility special that
 * halves incoming melee damage for one minute. The defensive effect remains
 * available only while this staff is equipped.
 */
export class ToxicStaffOfTheDeadSpec implements WeaponSpecialAttackScript {
    readonly itemId = TOXIC_STAFF_OF_THE_DEAD_CHARGED_ITEM_ID;
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

export const TOXIC_STAFF_OF_THE_DEAD_SPEC = Object.freeze(new ToxicStaffOfTheDeadSpec());
