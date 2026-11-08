import type { CombatAttack } from "../../model/CombatAttack";
import { SpecialAttackTiming, type WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ARMADYL_GODSWORD_ITEM_IDS = Object.freeze([
    11802, // Armadyl godsword
    20368, // Armadyl godsword (or)
    20593, // Armadyl godsword (Last Man Standing)
]);

const THE_JUDGEMENT_ENERGY_COST = 50;
const THE_JUDGEMENT_ACCURACY_MULTIPLIER = 2;
const GODSWORD_HIDDEN_DAMAGE_MULTIPLIER = 1.1;
const THE_JUDGEMENT_DAMAGE_MULTIPLIER = 1.25;
const THE_JUDGEMENT_COMBINED_DAMAGE_MULTIPLIER = 1.375;
const THE_JUDGEMENT_ANIMATION_ID = 7644;
const THE_JUDGEMENT_GRAPHIC_ID = 1211;
const THE_JUDGEMENT_SOUND_ID = 3869;
const THE_JUDGEMENT_HIT_DELAY_TICKS = 1;
const SLASH_BONUS_INDEX = 1;

const THE_JUDGEMENT_DAMAGE_STAGES = Object.freeze([
    GODSWORD_HIDDEN_DAMAGE_MULTIPLIER,
    THE_JUDGEMENT_DAMAGE_MULTIPLIER,
]);

const THE_JUDGEMENT = Object.freeze({
    energyCostPercent: THE_JUDGEMENT_ENERGY_COST,
    hitCount: 1,
    accuracyMultiplier: THE_JUDGEMENT_ACCURACY_MULTIPLIER,
    damageMultiplier: THE_JUDGEMENT_COMBINED_DAMAGE_MULTIPLIER,
    damageMultiplierStages: THE_JUDGEMENT_DAMAGE_STAGES,
    meleeAttackBonusIndex: SLASH_BONUS_INDEX,
    attackAnimation: THE_JUDGEMENT_ANIMATION_ID,
    castGraphic: Object.freeze({ id: THE_JUDGEMENT_GRAPHIC_ID }),
    attackSoundId: THE_JUDGEMENT_SOUND_ID,
});

/** Modern OSRS visual and hit-timing profile for The Judgement. */
export const ARMADYL_GODSWORD_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:armadyl_godsword",
    itemIds: ARMADYL_GODSWORD_ITEM_IDS,
    specialAttackEnergyCost: THE_JUDGEMENT_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    travelDelayTicks: THE_JUDGEMENT_HIT_DELAY_TICKS,
    handleSpecialAttack: () => THE_JUDGEMENT,
});

/**
 * The Judgement doubles accuracy and applies the godsword's hidden 10% max-hit
 * increase before its own 25% increase, flooring after both OSRS integer stages.
 */
export class ArmadylGodswordSpec implements WeaponSpecialAttackScript {
    readonly energyCost = THE_JUDGEMENT_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: THE_JUDGEMENT_ACCURACY_MULTIPLIER,
            damageMultiplier: THE_JUDGEMENT_COMBINED_DAMAGE_MULTIPLIER,
            damageMultiplierStages: THE_JUDGEMENT_DAMAGE_STAGES,
            meleeAttackBonusIndex: SLASH_BONUS_INDEX,
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

export const ARMADYL_GODSWORD_SPECS = Object.freeze(
    ARMADYL_GODSWORD_ITEM_IDS.map((itemId) => Object.freeze(new ArmadylGodswordSpec(itemId))),
);

export const ARMADYL_GODSWORD_SPEC = ARMADYL_GODSWORD_SPECS[0];
