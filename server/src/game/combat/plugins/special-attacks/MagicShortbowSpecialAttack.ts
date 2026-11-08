import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../../client/rs/skill/skills";
import { getItemDefinition } from "../../../../data/items";
import { PlayerState } from "../../../player";
import type { CombatEntity } from "../../engine/CombatTargetResolver";
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

const MAGIC_SHORTBOW_ITEM_ID = 861;
const IMBUED_MAGIC_SHORTBOW_ITEM_ID = 12788;
const RANGED_STRENGTH_BONUS_INDEX = 11;
const CLIENT_CYCLES_PER_GAME_TICK = 30;

// Sequence 426 releases after its first four frames (4 + 4 + 4 + 4 cycles).
const SHORTBOW_RELEASE_DELAY_TICKS = 16 / CLIENT_CYCLES_PER_GAME_TICK;
// Sequence 1074 contains two draws. Their releases occur after 8 and 39 cycles.
const SNAPSHOT_RELEASE_DELAYS_TICKS = Object.freeze([
    8 / CLIENT_CYCLES_PER_GAME_TICK,
    39 / CLIENT_CYCLES_PER_GAME_TICK,
]);

const SHORTBOW_PROJECTILE = Object.freeze({
    id: 10,
    startHeight: 40,
    endHeight: 36,
    slope: 0,
    steepness: 64,
    startDelayTicks: SHORTBOW_RELEASE_DELAY_TICKS,
    lifeModel: "linear5-clamped10" as const,
});

const SNAPSHOT_PROJECTILE = Object.freeze({
    id: 249,
    startHeight: 40,
    endHeight: 36,
    slope: 0,
    steepness: 64,
    lifeModel: "linear5-clamped10" as const,
});

const SNAPSHOT_CAST_GRAPHIC = Object.freeze({
    id: 256,
    height: 100,
});

function resolveShortbowTravelDelay(distanceTiles: number, specialAttack: boolean): number {
    const distance = Math.max(0, Math.trunc(distanceTiles));
    const normalDelay = Math.max(1, 1 + Math.floor((3 + distance) / 6));
    // Snapshot's second release is one game tick after the first. Giving the
    // attack one extra travel tick keeps both green arrows aligned to the hit.
    return normalDelay + (specialAttack ? 1 : 0);
}

/**
 * Snapshot predates the standard ranged max-hit formula. It only uses the
 * visible Ranged level and the equipped arrow's Ranged Strength bonus.
 */
export function calculateSnapshotMaxHit(
    visibleRangedLevel: number,
    ammoRangedStrength: number,
): number {
    const level = Math.max(0, Math.trunc(visibleRangedLevel));
    const strength = Math.trunc(ammoRangedStrength);
    return Math.max(0, Math.floor(0.5 + ((level + 10) * (strength + 64)) / 640));
}

function resolveSnapshotMaxHit(attacker: PlayerState): number {
    const ranged = attacker.skillSystem.getSkill(SkillId.Ranged);
    const visibleRangedLevel = ranged.baseLevel + ranged.boost;
    const ammoId = attacker.appearance.equip[EquipmentSlot.AMMO] ?? -1;
    const ammoRangedStrength =
        getItemDefinition(ammoId)?.bonuses?.[RANGED_STRENGTH_BONUS_INDEX] ?? 0;
    return calculateSnapshotMaxHit(visibleRangedLevel, ammoRangedStrength);
}

function createMagicShortbowProfile(
    itemId: number,
    profileId: string,
    energyCostPercent: number,
): WeaponCombatProfile {
    return Object.freeze({
        id: profileId,
        itemIds: Object.freeze([itemId]),
        attackAnimation: 426,
        projectile: (context: WeaponCombatContext) =>
            context.attack.traits.specialAttack ? SNAPSHOT_PROJECTILE : SHORTBOW_PROJECTILE,
        travelDelayTicks: (context: WeaponCombatContext) =>
            resolveShortbowTravelDelay(
                context.distanceTiles,
                context.attack.traits.specialAttack === true,
            ),
        specialAttackEnergyCost: energyCostPercent,
        specialAttackTiming: SpecialAttackTiming.Standard,
        handleSpecialAttack: (attacker: CombatEntity) => {
            if (!(attacker instanceof PlayerState)) return null;
            return Object.freeze({
                energyCostPercent,
                hitCount: 2,
                accuracyMultiplier: 10 / 7,
                damageMultiplier: 1,
                maxHitOverride: resolveSnapshotMaxHit(attacker),
                projectileCount: 2,
                projectileReleaseDelaysTicks: SNAPSHOT_RELEASE_DELAYS_TICKS,
                attackAnimation: 1074,
                castGraphic: SNAPSHOT_CAST_GRAPHIC,
                attackSoundId: 2545,
            });
        },
    });
}

export class MagicShortbowSpecialAttackScript implements WeaponSpecialAttackScript {
    constructor(
        readonly itemId: number,
        readonly energyCost: number,
    ) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 2,
            accuracyMultiplier: 10 / 7,
            damageMultiplier: 1,
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

export const MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILE = createMagicShortbowProfile(
    MAGIC_SHORTBOW_ITEM_ID,
    "core:magic_shortbow",
    55,
);

export const IMBUED_MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILE = createMagicShortbowProfile(
    IMBUED_MAGIC_SHORTBOW_ITEM_ID,
    "core:magic_shortbow_imbued",
    50,
);

export const MAGIC_SHORTBOW_SPECIAL_ATTACK_SCRIPTS = Object.freeze([
    Object.freeze(new MagicShortbowSpecialAttackScript(MAGIC_SHORTBOW_ITEM_ID, 55)),
    Object.freeze(new MagicShortbowSpecialAttackScript(IMBUED_MAGIC_SHORTBOW_ITEM_ID, 50)),
]);

export const MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILES = Object.freeze([
    MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILE,
    IMBUED_MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILE,
]);
