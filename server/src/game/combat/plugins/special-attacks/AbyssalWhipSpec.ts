import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ABYSSAL_WHIP_ITEM_ID = 4151;
const ENERGY_DRAIN_ENERGY_COST = 50;
const ENERGY_DRAIN_ACCURACY_MULTIPLIER = 1.25;
const ENERGY_DRAIN_RUN_ENERGY_FRACTION = 0.1;

/**
 * Energy Drain increases accuracy by 25%. A landed PvP hit transfers 10% of
 * the target's current run-energy units to the wielder.
 */
export class AbyssalWhipSpec implements WeaponSpecialAttackScript {
    readonly itemId = ABYSSAL_WHIP_ITEM_ID;
    readonly energyCost = ENERGY_DRAIN_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: ENERGY_DRAIN_ACCURACY_MULTIPLIER,
        });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void currentMapClock;
        if (Math.floor(damageCalculated) <= 0) return;
        if (!(attacker instanceof PlayerState) || !(target instanceof PlayerState)) return;

        const targetEnergy = Math.max(0, target.energy.getRunEnergyUnits());
        const transferredUnits = Math.max(
            0,
            Math.floor(targetEnergy * ENERGY_DRAIN_RUN_ENERGY_FRACTION),
        );
        if (transferredUnits <= 0) return;

        target.energy.adjustRunEnergyUnits(-transferredUnits);
        attacker.energy.adjustRunEnergyUnits(transferredUnits);
    }
}

export const ABYSSAL_WHIP_SPEC = Object.freeze(new AbyssalWhipSpec());
