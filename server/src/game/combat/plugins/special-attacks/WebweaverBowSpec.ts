import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import { AttackType } from "../../AttackType";
import { isInWilderness } from "../../MultiCombatZones";
import { getNpcPoisonConfig, getPoisonApplicationChance } from "../../PoisonVenomSystem";
import type { CombatEntity } from "../../engine/CombatTargetResolver";
import type { AppliedCombatHit } from "../../engine/DeferredHitQueue";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackTiming,
    type WeaponCombatContext,
    type WeaponCombatProfile,
    type WeaponProjectileProfile,
    type WeaponSpecialAttack,
} from "../WeaponCombatProfile";
import {
    SpecialAttackMultiplierRounding,
    type WeaponSpecialAttackScript,
    type WeaponSpecialAttackTraitOverrides,
    getWeaponSpecialAttackTarget,
    setWeaponSpecialAttackTraitOverrides,
    wasWeaponSpecialAttackExecuted,
} from "../WeaponSpecialAttackScript";

export const WEBWEAVER_BOW_UNCHARGED_ITEM_ID = 27652;
export const WEBWEAVER_BOW_ITEM_ID = 27655;
export const WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID = 21820;
export const WEBWEAVER_BOW_ACTIVATION_ETHER = 1_000;
export const WEBWEAVER_BOW_MAX_AMMO_ETHER = 16_000;

const SWARM_ENERGY_COST = 50;
const SWARM_HIT_COUNT = 4;
const SWARM_ACCURACY_MULTIPLIER = 2;
const SWARM_DAMAGE_MULTIPLIER = 0.4;
const WILDERNESS_ACCURACY_MULTIPLIER = 1.5;
const WILDERNESS_DAMAGE_MULTIPLIER = 1.5;
const SWARM_POISON_POTENCY = 4;

const NORMAL_ATTACK_ANIMATION_ID = 426;
const SWARM_ATTACK_ANIMATION_ID = 9964;
const NORMAL_PROJECTILE_ID = 2282;
const NORMAL_LAUNCH_GRAPHIC_ID = 2283;
const SWARM_PROJECTILE_ID = 2354;
const SWARM_IMPACT_GRAPHIC_ID = 2355;
const WILDERNESS_BOW_ATTACK_SOUND_ID = 2702;
const ARROW_IMPACT_SOUND_ID = 2693;
const CLIENT_CYCLES_PER_GAME_TICK = 30;

// Swarm resolves in two very close hitsplat groups while retaining four
// independent rolls. Each projectile is paired with its corresponding hit.
const SWARM_HIT_DELAYS = Object.freeze([0, 0, 1, 1]);
const SWARM_PROJECTILE_RELEASE_CYCLES = Object.freeze([8, 10, 12, 14]);

const NORMAL_PROJECTILE: WeaponProjectileProfile = Object.freeze({
    id: NORMAL_PROJECTILE_ID,
    startHeight: 40,
    endHeight: 36,
    slope: 0,
    steepness: 64,
    startDelayTicks: 16 / CLIENT_CYCLES_PER_GAME_TICK,
    lifeModel: "linear5-clamped10",
});

const SWARM_PROJECTILES: readonly WeaponProjectileProfile[] = Object.freeze(
    SWARM_PROJECTILE_RELEASE_CYCLES.map((releaseCycle, index) =>
        Object.freeze({
            id: SWARM_PROJECTILE_ID,
            startHeight: 40,
            endHeight: 36,
            slope: index * 12,
            steepness: 64,
            startDelayTicks: releaseCycle / CLIENT_CYCLES_PER_GAME_TICK,
            lifeModel: "linear5-clamped10" as const,
        }),
    ),
);

const NORMAL_LAUNCH_GRAPHIC = Object.freeze({
    id: NORMAL_LAUNCH_GRAPHIC_ID,
    height: 100,
});

const SWARM_IMPACT_GRAPHIC = Object.freeze({
    id: SWARM_IMPACT_GRAPHIC_ID,
    height: 100,
});

const REVENANT_CAVES_BOUNDS = Object.freeze({
    minX: 3136,
    maxX: 3263,
    minY: 10048,
    maxY: 10175,
});

function isKnownWildernessCombatTile(x: number, y: number): boolean {
    if (isInWilderness(x, y)) return true;
    return (
        x >= REVENANT_CAVES_BOUNDS.minX &&
        x <= REVENANT_CAVES_BOUNDS.maxX &&
        y >= REVENANT_CAVES_BOUNDS.minY &&
        y <= REVENANT_CAVES_BOUNDS.maxY
    );
}

/** The 50% Wilderness passive is PvM-only and follows the target NPC. */
export function hasWebweaverWildernessPassive(target: CombatEntity | undefined): boolean {
    return target instanceof NpcState && isKnownWildernessCombatTile(target.tileX, target.tileY);
}

/** OSRS floors the Wilderness boost before Swarm rounds its 40% cap upward. */
export function calculateWebweaverSwarmMaxHit(
    standardMaximumHit: number,
    wildernessPassive = false,
): number {
    const standard = Math.max(0, Math.floor(standardMaximumHit));
    const normalMaximum = wildernessPassive
        ? Math.floor(standard * WILDERNESS_DAMAGE_MULTIPLIER)
        : standard;
    return Math.ceil(normalMaximum * SWARM_DAMAGE_MULTIPLIER);
}

export function getWebweaverEtherCharges(player: PlayerState): number {
    return Math.max(0, Math.floor(player.equipment.getCharges(WEBWEAVER_BOW_ITEM_ID)));
}

/** Consumes one shot for an entire attack, including all four Swarm hits. */
export function consumeWebweaverEtherCharge(player: PlayerState): boolean {
    const charges = getWebweaverEtherCharges(player);
    if (charges <= 0) return false;
    player.equipment.setCharges(WEBWEAVER_BOW_ITEM_ID, charges - 1);
    return true;
}

export function shouldApplyWebweaverPoison(random: () => number = Math.random): boolean {
    return random() < getPoisonApplicationChance(WEBWEAVER_BOW_ITEM_ID);
}

function resolveWebweaverTravelDelay(distanceTiles: number): number {
    const distance = Math.max(0, Math.trunc(distanceTiles));
    return Math.max(1, 1 + Math.floor((3 + distance) / 6));
}

function createNormalAttackTraits(wildernessPassive: boolean): WeaponSpecialAttack | null {
    if (!wildernessPassive) return null;
    return Object.freeze({
        energyCostPercent: 0,
        hitCount: 1,
        accuracyMultiplier: WILDERNESS_ACCURACY_MULTIPLIER,
        accuracyMultiplierStages: Object.freeze([WILDERNESS_ACCURACY_MULTIPLIER]),
        damageMultiplier: WILDERNESS_DAMAGE_MULTIPLIER,
        damageMultiplierStages: Object.freeze([WILDERNESS_DAMAGE_MULTIPLIER]),
        damageMultiplierStageRounding: Object.freeze([SpecialAttackMultiplierRounding.Floor]),
        rollAttackType: AttackType.Ranged,
        damageType: AttackType.Ranged,
    });
}

function createSwarmTraitOverrides(wildernessPassive: boolean): WeaponSpecialAttackTraitOverrides {
    const accuracyMultiplierStages = wildernessPassive
        ? Object.freeze([WILDERNESS_ACCURACY_MULTIPLIER, SWARM_ACCURACY_MULTIPLIER])
        : Object.freeze([SWARM_ACCURACY_MULTIPLIER]);
    const damageMultiplierStages = wildernessPassive
        ? Object.freeze([WILDERNESS_DAMAGE_MULTIPLIER, SWARM_DAMAGE_MULTIPLIER])
        : Object.freeze([SWARM_DAMAGE_MULTIPLIER]);
    const damageMultiplierStageRounding = wildernessPassive
        ? Object.freeze([
              SpecialAttackMultiplierRounding.Floor,
              SpecialAttackMultiplierRounding.Ceil,
          ])
        : Object.freeze([SpecialAttackMultiplierRounding.Ceil]);

    return Object.freeze({
        hitCount: SWARM_HIT_COUNT,
        accuracyMultiplier: wildernessPassive ? 3 : SWARM_ACCURACY_MULTIPLIER,
        accuracyMultiplierStages,
        damageMultiplier: wildernessPassive ? 0.6 : SWARM_DAMAGE_MULTIPLIER,
        damageMultiplierStages,
        damageMultiplierStageRounding,
        rollAttackType: AttackType.Ranged,
        damageType: AttackType.Ranged,
        hitDelayTicks: SWARM_HIT_DELAYS,
    });
}

function createSwarmAttack(wildernessPassive: boolean): WeaponSpecialAttack {
    const traits = createSwarmTraitOverrides(wildernessPassive);
    return Object.freeze({
        energyCostPercent: SWARM_ENERGY_COST,
        ...traits,
        hitCount: SWARM_HIT_COUNT,
        accuracyMultiplier: wildernessPassive ? 3 : SWARM_ACCURACY_MULTIPLIER,
        damageMultiplier: wildernessPassive ? 0.6 : SWARM_DAMAGE_MULTIPLIER,
        attackAnimation: SWARM_ATTACK_ANIMATION_ID,
        attackSoundId: WILDERNESS_BOW_ATTACK_SOUND_ID,
        projectiles: SWARM_PROJECTILES,
        hitDelayTicks: SWARM_HIT_DELAYS,
    });
}

function applySwarmPoison(hit: AppliedCombatHit): void {
    if (!hit.pending.landed) return;
    if (!wasWeaponSpecialAttackExecuted(hit.pending.attack)) return;
    if (!shouldApplyWebweaverPoison()) return;

    if (hit.target instanceof PlayerState) {
        if (hit.target.skillSystem.getHitpointsCurrent() <= 0) return;
        hit.target.skillSystem.inflictPoison(SWARM_POISON_POTENCY, hit.appliedClock);
        return;
    }

    if (hit.target.getHitpoints() <= 0) return;
    if (getNpcPoisonConfig(hit.target.typeId).poisonImmune) return;
    hit.target.inflictPoison(SWARM_POISON_POTENCY, hit.appliedClock);
}

/**
 * Webweaver's powered-arrow attack, Wilderness PvM passive, and Swarm special.
 * Swarm makes four independent rolls; each successful component gets its own
 * standard 25% weapon-poison roll beginning at 4 damage.
 */
export const WEBWEAVER_BOW_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:webweaver_bow",
    itemIds: Object.freeze([WEBWEAVER_BOW_ITEM_ID]),
    attackAnimation: NORMAL_ATTACK_ANIMATION_ID,
    castGraphic: (context: WeaponCombatContext) =>
        context.attack.traits.specialAttack ? undefined : NORMAL_LAUNCH_GRAPHIC,
    impactGraphic: (context: WeaponCombatContext) =>
        context.attack.traits.specialAttack ? SWARM_IMPACT_GRAPHIC : undefined,
    splashGraphic: (context: WeaponCombatContext) =>
        context.attack.traits.specialAttack ? SWARM_IMPACT_GRAPHIC : undefined,
    projectile: NORMAL_PROJECTILE,
    attackSoundId: WILDERNESS_BOW_ATTACK_SOUND_ID,
    impactSoundId: ARROW_IMPACT_SOUND_ID,
    travelDelayTicks: (context: WeaponCombatContext) =>
        resolveWebweaverTravelDelay(context.distanceTiles),
    specialAttackEnergyCost: SWARM_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleNormalAttack: (_attacker: CombatEntity, target: CombatEntity) =>
        createNormalAttackTraits(hasWebweaverWildernessPassive(target)),
    handleSpecialAttack: (_attacker: CombatEntity, target: CombatEntity) =>
        createSwarmAttack(hasWebweaverWildernessPassive(target)),
    onHitApplied: (hit: AppliedCombatHit) => applySwarmPoison(hit),
});

export class WebweaverBowSpec implements WeaponSpecialAttackScript {
    readonly itemId = WEBWEAVER_BOW_ITEM_ID;
    readonly energyCost = SWARM_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        const target = getWeaponSpecialAttackTarget(attack) as CombatEntity | undefined;
        setWeaponSpecialAttackTraitOverrides(
            attack,
            createSwarmTraitOverrides(hasWebweaverWildernessPassive(target)),
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
        // The profile receives AppliedCombatHit, which is required to distinguish
        // an accurate zero from a blocked hit before making the poison roll.
    }
}

export const WEBWEAVER_BOW_SPEC = Object.freeze(new WebweaverBowSpec());
