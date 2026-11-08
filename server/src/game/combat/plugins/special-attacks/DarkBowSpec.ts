import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";

import { PlayerState } from "../../../player";
import { AttackType } from "../../AttackType";
import type { CombatEntity } from "../../engine/CombatTargetResolver";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackTiming,
    type WeaponCombatContext,
    type WeaponCombatProfile,
    type WeaponGraphicProfile,
    type WeaponProjectileProfile,
    type WeaponSpecialAttack,
} from "../WeaponCombatProfile";
import {
    getWeaponSpecialAttackAttacker,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DARK_BOW_ITEM_IDS = Object.freeze([11235, 12765, 12766, 12767, 12768]);
const DRAGON_ARROW_ITEM_IDS = new Set([11212, 11227, 11228, 11229]);

const DESCENT_ENERGY_COST = 55;
const DESCENT_HIT_COUNT = 2;
const DESCENT_OF_DARKNESS_DAMAGE_MULTIPLIER = 1.3;
const DESCENT_OF_DARKNESS_MINIMUM_DAMAGE = 5;
const DESCENT_OF_DRAGONS_DAMAGE_MULTIPLIER = 1.5;
const DESCENT_OF_DRAGONS_MINIMUM_DAMAGE = 8;
const DESCENT_OF_DRAGONS_MAXIMUM_DAMAGE = 48;

const HUMAN_BOW_ANIMATION = 426;
const CLIENT_CYCLES_PER_GAME_TICK = 30;
const BOW_STRING_RELEASE_DELAY = 16 / CLIENT_CYCLES_PER_GAME_TICK;

const DARK_BOW_DOUBLE_FIRE_SOUND = 3732;
const DARK_BOW_DRAGON_ATTACK_SOUND = 3733;
const DARK_BOW_SHADOW_ATTACK_SOUND = 3736;
const DARK_BOW_SHADOW_IMPACT_SOUND = 3737;

// Cache 237 identities verified against RSMod's named spot animations.
const DESCENT_OF_DRAGONS_PROJECTILE_ID = 1099;
const DESCENT_OF_DRAGONS_IMPACT_ID = 1100;
const DESCENT_OF_DARKNESS_PROJECTILE_ID = 1101;
const DESCENT_OF_DARKNESS_IMPACT_ID = 1103;

const NORMAL_ARROW_PROJECTILE: WeaponProjectileProfile = Object.freeze({
    id: 10,
    startHeight: 40,
    endHeight: 36,
    slope: 0,
    steepness: 64,
    startDelayTicks: BOW_STRING_RELEASE_DELAY,
    lifeModel: "linear5-clamped10",
});

const DESCENT_OF_DARKNESS_PROJECTILE: WeaponProjectileProfile = Object.freeze({
    id: DESCENT_OF_DARKNESS_PROJECTILE_ID,
    startHeight: 40,
    endHeight: 36,
    slope: 5,
    startDelayTicks: BOW_STRING_RELEASE_DELAY,
    lifeModel: "linear5-clamped10",
});

const DESCENT_OF_DRAGONS_PROJECTILE: WeaponProjectileProfile = Object.freeze({
    id: DESCENT_OF_DRAGONS_PROJECTILE_ID,
    startHeight: 40,
    endHeight: 36,
    slope: 5,
    startDelayTicks: BOW_STRING_RELEASE_DELAY,
    lifeModel: "linear5-clamped10",
});

const DESCENT_OF_DARKNESS_IMPACT: WeaponGraphicProfile = Object.freeze({
    id: DESCENT_OF_DARKNESS_IMPACT_ID,
    height: 96,
});

const DESCENT_OF_DRAGONS_IMPACT: WeaponGraphicProfile = Object.freeze({
    id: DESCENT_OF_DRAGONS_IMPACT_ID,
    height: 96,
});

const darkBowSpecialConfigurations = new WeakMap<CombatAttack, DarkBowSpecialConfiguration>();

export interface DarkBowSpecialConfiguration {
    readonly dragonArrows: boolean;
    readonly damageMultiplier: number;
    readonly minimumDamage: number;
    readonly maximumDamage?: number;
    readonly projectile: WeaponProjectileProfile;
    readonly impactGraphic: WeaponGraphicProfile;
    readonly attackSoundId: number;
}

export function isDragonArrow(ammoId: number): boolean {
    return DRAGON_ARROW_ITEM_IDS.has(Math.trunc(ammoId));
}

/** Selects Descent of Darkness or Descent of Dragons from the equipped arrow. */
export function resolveDarkBowSpecialConfiguration(ammoId: number): DarkBowSpecialConfiguration {
    if (isDragonArrow(ammoId)) {
        return Object.freeze({
            dragonArrows: true,
            damageMultiplier: DESCENT_OF_DRAGONS_DAMAGE_MULTIPLIER,
            minimumDamage: DESCENT_OF_DRAGONS_MINIMUM_DAMAGE,
            maximumDamage: DESCENT_OF_DRAGONS_MAXIMUM_DAMAGE,
            projectile: DESCENT_OF_DRAGONS_PROJECTILE,
            impactGraphic: DESCENT_OF_DRAGONS_IMPACT,
            attackSoundId: DARK_BOW_DRAGON_ATTACK_SOUND,
        });
    }
    return Object.freeze({
        dragonArrows: false,
        damageMultiplier: DESCENT_OF_DARKNESS_DAMAGE_MULTIPLIER,
        minimumDamage: DESCENT_OF_DARKNESS_MINIMUM_DAMAGE,
        projectile: DESCENT_OF_DARKNESS_PROJECTILE,
        impactGraphic: DESCENT_OF_DARKNESS_IMPACT,
        attackSoundId: DARK_BOW_SHADOW_ATTACK_SOUND,
    });
}

function getEquippedAmmoId(attacker: CombatEntity | undefined): number {
    return attacker instanceof PlayerState
        ? (attacker.appearance.equip[EquipmentSlot.AMMO] ?? -1)
        : -1;
}

function snapshotSpecialConfiguration(
    attack: CombatAttack,
    attacker: CombatEntity | undefined,
): DarkBowSpecialConfiguration {
    const config = resolveDarkBowSpecialConfiguration(getEquippedAmmoId(attacker));
    darkBowSpecialConfigurations.set(attack, config);
    return config;
}

function getSpecialConfiguration(context: WeaponCombatContext): DarkBowSpecialConfiguration {
    return (
        darkBowSpecialConfigurations.get(context.attack) ??
        snapshotSpecialConfiguration(context.attack, context.attacker)
    );
}

function createDoubleProjectileTracks(
    projectile: WeaponProjectileProfile,
): readonly WeaponProjectileProfile[] {
    return Object.freeze([
        Object.freeze({ ...projectile, slope: 5 }),
        Object.freeze({ ...projectile, slope: 25 }),
    ]);
}

function resolveDarkBowTravelDelay(distanceTiles: number): number {
    const distance = Math.max(0, Math.trunc(distanceTiles));
    return Math.max(2, 1 + Math.floor((3 + distance) / 6));
}

function createNormalDarkBowAttack(): WeaponSpecialAttack {
    return Object.freeze({
        energyCostPercent: 0,
        hitCount: DESCENT_HIT_COUNT,
        accuracyMultiplier: 1,
        damageMultiplier: 1,
        rollAttackType: AttackType.Ranged,
        damageType: AttackType.Ranged,
        projectiles: createDoubleProjectileTracks(NORMAL_ARROW_PROJECTILE),
    });
}

function createDarkBowSpecialAttack(
    attacker: CombatEntity,
    attack: CombatAttack,
): WeaponSpecialAttack {
    const config = snapshotSpecialConfiguration(attack, attacker);
    return Object.freeze({
        energyCostPercent: DESCENT_ENERGY_COST,
        hitCount: DESCENT_HIT_COUNT,
        accuracyMultiplier: 1,
        damageMultiplier: config.damageMultiplier,
        minimumDamageBonus: config.minimumDamage,
        maximumDamageCap: config.maximumDamage,
        rollAttackType: AttackType.Ranged,
        damageType: AttackType.Ranged,
        projectiles: createDoubleProjectileTracks(config.projectile),
        attackAnimation: HUMAN_BOW_ANIMATION,
        attackSoundIds: Object.freeze([
            DARK_BOW_DOUBLE_FIRE_SOUND,
            config.attackSoundId,
        ]),
        impactGraphicHitIndex: 1,
    });
}

/**
 * Handles both the Dark bow's ordinary independent double shot and its
 * ammo-sensitive Descent special attack for all four painted variants.
 */
export const DARK_BOW_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:dark_bow",
    itemIds: DARK_BOW_ITEM_IDS,
    attackAnimation: HUMAN_BOW_ANIMATION,
    projectile: (context: WeaponCombatContext) =>
        context.attack.traits.specialAttack
            ? getSpecialConfiguration(context).projectile
            : NORMAL_ARROW_PROJECTILE,
    impactGraphic: (context: WeaponCombatContext) =>
        context.attack.traits.specialAttack
            ? getSpecialConfiguration(context).impactGraphic
            : undefined,
    splashGraphic: (context: WeaponCombatContext) =>
        context.attack.traits.specialAttack
            ? getSpecialConfiguration(context).impactGraphic
            : undefined,
    attackSoundId: (context: WeaponCombatContext) =>
        context.attack.traits.specialAttack ? undefined : DARK_BOW_DOUBLE_FIRE_SOUND,
    impactSoundId: (context: WeaponCombatContext) =>
        context.attack.traits.specialAttack ? DARK_BOW_SHADOW_IMPACT_SOUND : undefined,
    travelDelayTicks: (context: WeaponCombatContext) =>
        resolveDarkBowTravelDelay(context.distanceTiles),
    specialAttackEnergyCost: DESCENT_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleNormalAttack: () => createNormalDarkBowAttack(),
    handleSpecialAttack: (
        attacker: CombatEntity,
        _target: CombatEntity,
        attack: CombatAttack,
    ) => createDarkBowSpecialAttack(attacker, attack),
});

export class DarkBowSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId: number) {}

    readonly energyCost = DESCENT_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        const attacker = getWeaponSpecialAttackAttacker(attack);
        const config = snapshotSpecialConfiguration(attack, attacker);
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: DESCENT_HIT_COUNT,
            accuracyMultiplier: 1,
            damageMultiplier: config.damageMultiplier,
            minimumDamageBonus: config.minimumDamage,
            maximumDamageCap: config.maximumDamage,
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

export const DARK_BOW_SPECS = Object.freeze(
    DARK_BOW_ITEM_IDS.map((itemId) => Object.freeze(new DarkBowSpec(itemId))),
);

export const DARK_BOW_SPEC = DARK_BOW_SPECS[0];
