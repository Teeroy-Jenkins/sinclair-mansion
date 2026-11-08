import { PlayerState } from "../../../player";
import type { CombatEntity } from "../../engine/CombatTargetResolver";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackTiming,
    type WeaponCombatProfile,
} from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const OSMUMTENS_FANG_ITEM_ID = 26219;
const OSMUMTENS_FANG_ORNAMENT_ITEM_ID = 27246;
const EVISCERATE_ENERGY_COST = 25;
const EVISCERATE_ACCURACY_MULTIPLIER = 1.5;
const FANG_MINIMUM_DAMAGE_MULTIPLIER = 0.15;
const FANG_NORMAL_MAXIMUM_DAMAGE_MULTIPLIER = 0.85;

function isFangStabStyle(attacker: PlayerState): boolean {
    // Fang's third style is Slash; Stab, Lunge, and Block retain its passive.
    return Math.trunc(attacker.combat.styleSlot) !== 2;
}

function createFangAttackPlan(
    attacker: PlayerState,
    specialAttack: boolean,
) {
    return Object.freeze({
        energyCostPercent: specialAttack ? EVISCERATE_ENERGY_COST : 0,
        hitCount: 1,
        accuracyMultiplier: specialAttack ? EVISCERATE_ACCURACY_MULTIPLIER : 1,
        damageMultiplier: 1,
        minimumDamageMultiplier: FANG_MINIMUM_DAMAGE_MULTIPLIER,
        maximumDamageMultiplier: specialAttack ? 1 : FANG_NORMAL_MAXIMUM_DAMAGE_MULTIPLIER,
        accuracyRollCount: isFangStabStyle(attacker) ? 2 : 1,
    });
}

/**
 * The fang's normal damage stays within 15–85% of its true maximum hit. Its
 * double accuracy roll only applies on Stab, Lunge and Block; Eviscerate keeps
 * the same passive but reaches the true (100%) maximum hit.
 */
export const OSMUMTENS_FANG_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:osmumtens_fang",
    itemIds: Object.freeze([OSMUMTENS_FANG_ITEM_ID, OSMUMTENS_FANG_ORNAMENT_ITEM_ID]),
    specialAttackEnergyCost: EVISCERATE_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleNormalAttack: (attacker: CombatEntity) =>
        attacker instanceof PlayerState ? createFangAttackPlan(attacker, false) : null,
    handleSpecialAttack: (attacker: CombatEntity) =>
        attacker instanceof PlayerState ? createFangAttackPlan(attacker, true) : null,
});

/** Eviscerate has 50% accuracy and rolls up to the fang's true maximum hit. */
export class OsmumtensFangSpec implements WeaponSpecialAttackScript {
    readonly energyCost = EVISCERATE_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: EVISCERATE_ACCURACY_MULTIPLIER,
            damageMultiplier: 1,
            minimumDamageMultiplier: FANG_MINIMUM_DAMAGE_MULTIPLIER,
            maximumDamageMultiplier: 1,
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

export const OSMUMTENS_FANG_SPECS = Object.freeze([
    Object.freeze(new OsmumtensFangSpec(OSMUMTENS_FANG_ITEM_ID)),
    Object.freeze(new OsmumtensFangSpec(OSMUMTENS_FANG_ORNAMENT_ITEM_ID)),
]);

export const OSMUMTENS_FANG_SPEC = OSMUMTENS_FANG_SPECS[0];
