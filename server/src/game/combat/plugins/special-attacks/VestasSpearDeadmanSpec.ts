import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const VESTAS_SPEAR_DEADMAN_ITEM_ID = 22610;
const SPEAR_WALL_ENERGY_COST = 50;

/**
 * Deadman Spear Wall has an unmodified primary damage roll. In OSRS it damages
 * up to sixteen targets within eight tiles in multi-combat (one target outside
 * multi-combat) and grants the wielder eight ticks of melee immunity. Both
 * effects require engagement-level target selection and incoming-damage hooks.
 */
export class VestasSpearDeadmanSpec implements WeaponSpecialAttackScript {
    readonly itemId = VESTAS_SPEAR_DEADMAN_ITEM_ID;
    readonly energyCost = SPEAR_WALL_ENERGY_COST;

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

export const VESTAS_SPEAR_DEADMAN_SPEC = Object.freeze(new VestasSpearDeadmanSpec());
