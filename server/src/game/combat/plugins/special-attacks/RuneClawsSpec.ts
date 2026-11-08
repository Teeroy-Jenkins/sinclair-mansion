import type { CombatAttack } from "../../model/CombatAttack";
import { SpecialAttackTiming, type WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const RUNE_CLAWS_ITEM_ID = 3101;
const IMPALE_ENERGY_COST = 25;
const IMPALE_LEVEL_MULTIPLIER = 1.1;
const IMPALE_EXTRA_ATTACK_DELAY_TICKS = 2;
const IMPALE_ANIMATION_ID = 2068;

export const RUNE_CLAWS_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:rune_claws",
    itemIds: Object.freeze([RUNE_CLAWS_ITEM_ID]),
    specialAttackEnergyCost: IMPALE_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () =>
        Object.freeze({
            energyCostPercent: IMPALE_ENERGY_COST,
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            attackAnimation: IMPALE_ANIMATION_ID,
        }),
});

/**
 * Impale is a single strike. It increases the attacker's visible Attack and
 * Strength levels by 10% for this roll and takes two ticks longer than the
 * normal four-tick claw cycle.
 */
export class RuneClawsSpec implements WeaponSpecialAttackScript {
    readonly itemId = RUNE_CLAWS_ITEM_ID;
    readonly energyCost = IMPALE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            attackLevelMultiplier: IMPALE_LEVEL_MULTIPLIER,
            strengthLevelMultiplier: IMPALE_LEVEL_MULTIPLIER,
            attackSpeedTicks: Math.max(
                1,
                Math.trunc(attack.traits.speedTicks) + IMPALE_EXTRA_ATTACK_DELAY_TICKS,
            ),
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

export const RUNE_CLAWS_SPEC = Object.freeze(new RuneClawsSpec());
