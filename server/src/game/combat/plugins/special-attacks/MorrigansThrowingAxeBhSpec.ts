import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const MORRIGANS_THROWING_AXE_BH_ITEM_ID = 27912;
const HAMSTRING_ENERGY_COST = 50;
const HAMSTRING_ACCURACY_MULTIPLIER = 1.5;
const HAMSTRING_MINIMUM_DAMAGE_MULTIPLIER = 0.5;
const HAMSTRING_MAXIMUM_DAMAGE_MULTIPLIER = 1.5;
const HAMSTRING_DRAIN_MULTIPLIER = 6;
const HAMSTRING_DURATION_TICKS = 100;

/**
 * Hamstring has 150% accuracy and rolls from 50% to 150% of maximum damage.
 * On a damaging PvP hit, it makes the target's run energy drain six times as
 * quickly for one minute (100 game ticks).
 *
 * The Bounty Hunter area restriction and full-Morrigan-set accuracy bonus are
 * enforced by game-mode/equipment systems rather than this weapon script.
 */
export class MorrigansThrowingAxeBhSpec implements WeaponSpecialAttackScript {
    readonly itemId = MORRIGANS_THROWING_AXE_BH_ITEM_ID;
    readonly energyCost = HAMSTRING_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: HAMSTRING_ACCURACY_MULTIPLIER,
            minimumDamageMultiplier: HAMSTRING_MINIMUM_DAMAGE_MULTIPLIER,
            maximumDamageMultiplier: HAMSTRING_MAXIMUM_DAMAGE_MULTIPLIER,
        });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void attacker;
        if (Math.floor(damageCalculated) <= 0) return;
        if (!(target instanceof PlayerState)) return;

        target.energy.applyRunEnergyDrainPenalty(
            currentMapClock,
            HAMSTRING_DURATION_TICKS,
            HAMSTRING_DRAIN_MULTIPLIER,
        );
    }
}

export const MORRIGANS_THROWING_AXE_BH_SPEC = Object.freeze(
    new MorrigansThrowingAxeBhSpec(),
);
