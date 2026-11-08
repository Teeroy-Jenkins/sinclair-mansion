import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackTiming,
    type WeaponCombatContext,
    type WeaponCombatProfile,
} from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";
import {
    BALLISTA_JAVELIN_IMPACT_GRAPHIC,
    BALLISTA_SPECIAL_ATTACK_ANIMATION_ID,
    BALLISTA_SPECIAL_ATTACK_SOUND_ID,
    BALLISTA_STANDARD_ATTACK_ANIMATION_ID,
    resolveBallistaJavelinHitDelay,
    resolveBallistaJavelinProjectile,
} from "./BallistaCombatSupport";

const LIGHT_BALLISTA_ITEM_IDS = Object.freeze([
    19478, // Light ballista
    27188, // Light ballista (Last Man Standing)
]);

const CONCENTRATED_SHOT_ENERGY_COST = 65;
const CONCENTRATED_SHOT_ACCURACY_MULTIPLIER = 1.25;
const CONCENTRATED_SHOT_DAMAGE_MULTIPLIER = 1.25;

const CONCENTRATED_SHOT = Object.freeze({
    energyCostPercent: CONCENTRATED_SHOT_ENERGY_COST,
    hitCount: 1,
    accuracyMultiplier: CONCENTRATED_SHOT_ACCURACY_MULTIPLIER,
    damageMultiplier: CONCENTRATED_SHOT_DAMAGE_MULTIPLIER,
    rollAttackType: AttackType.Ranged,
    damageType: AttackType.Ranged,
    attackAnimation: BALLISTA_SPECIAL_ATTACK_ANIMATION_ID,
    attackSoundId: BALLISTA_SPECIAL_ATTACK_SOUND_ID,
});

/**
 * OSRS Light ballista profile. It shares Concentrated Shot, javelin timing,
 * and impact visuals with the Heavy ballista while retaining its own script.
 */
export const LIGHT_BALLISTA_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:light_ballista",
    itemIds: LIGHT_BALLISTA_ITEM_IDS,
    attackAnimation: BALLISTA_STANDARD_ATTACK_ANIMATION_ID,
    impactGraphic: BALLISTA_JAVELIN_IMPACT_GRAPHIC,
    splashGraphic: BALLISTA_JAVELIN_IMPACT_GRAPHIC,
    projectile: resolveBallistaJavelinProjectile,
    travelDelayTicks: (context: WeaponCombatContext) =>
        resolveBallistaJavelinHitDelay(context.distanceTiles),
    specialAttackEnergyCost: CONCENTRATED_SHOT_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () => CONCENTRATED_SHOT,
});

/** Concentrated Shot gains 25% accuracy and 25% maximum damage for one shot. */
export class LightBallistaSpec implements WeaponSpecialAttackScript {
    readonly energyCost = CONCENTRATED_SHOT_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: CONCENTRATED_SHOT_ACCURACY_MULTIPLIER,
            damageMultiplier: CONCENTRATED_SHOT_DAMAGE_MULTIPLIER,
            rollAttackType: AttackType.Ranged,
            damageType: AttackType.Ranged,
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

export const LIGHT_BALLISTA_SPECS = Object.freeze(
    LIGHT_BALLISTA_ITEM_IDS.map((itemId) => Object.freeze(new LightBallistaSpec(itemId))),
);

export const LIGHT_BALLISTA_SPEC = LIGHT_BALLISTA_SPECS[0];
