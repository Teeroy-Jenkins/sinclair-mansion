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

/** The charged item. The empty Rosewood blowpipe is item 31585. */
const ROSEWOOD_BLOWPIPE_ITEM_ID = 31586;
const RAPID_BURST_ENERGY_COST = 25;
const RAPID_BURST_HIT_COUNT = 2;
const RAPID_BURST_ACCURACY_MULTIPLIER = 0.8;
const RAPID_BURST_DAMAGE_MULTIPLIER = 1.1;
const BLOWPIPE_ATTACK_ANIMATION_ID = 5061;
const BLOWPIPE_ATTACK_SOUND_ID = 5765;

const RAPID_BURST_TRAITS = Object.freeze({
    hitCount: RAPID_BURST_HIT_COUNT,
    accuracyMultiplier: RAPID_BURST_ACCURACY_MULTIPLIER,
    damageMultiplier: RAPID_BURST_DAMAGE_MULTIPLIER,
    rollAttackType: AttackType.Ranged,
    damageType: AttackType.Ranged,
    // Rapid Burst fires the second dart one game tick after the first.
    hitDelayTicks: Object.freeze([0, 1]),
});

function resolveRapidBurstTravelDelay(distanceTiles: number, specialAttack: boolean): number {
    const distance = Math.max(0, Math.trunc(distanceTiles));
    const normalDelay = Math.max(1, 1 + Math.floor((3 + distance) / 6));
    return normalDelay + (specialAttack ? 1 : 0);
}

/**
 * Rapid Burst fires two darts in quick succession. Unlike a Dragon knife,
 * both shots retain their own independent accuracy and damage rolls while
 * receiving the special's 20% accuracy reduction and 10% damage increase.
 */
export const ROSEWOOD_BLOWPIPE_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:rosewood_blowpipe",
    itemIds: Object.freeze([ROSEWOOD_BLOWPIPE_ITEM_ID]),
    attackAnimation: (context: WeaponCombatContext) =>
        context.attack.traits.type === AttackType.Ranged ? BLOWPIPE_ATTACK_ANIMATION_ID : undefined,
    attackSoundId: (context: WeaponCombatContext) =>
        context.attack.traits.type === AttackType.Ranged ? BLOWPIPE_ATTACK_SOUND_ID : undefined,
    travelDelayTicks: (context: WeaponCombatContext) =>
        resolveRapidBurstTravelDelay(
            context.distanceTiles,
            context.attack.traits.specialAttack === true,
        ),
    specialAttackEnergyCost: RAPID_BURST_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () =>
        Object.freeze({
            energyCostPercent: RAPID_BURST_ENERGY_COST,
            ...RAPID_BURST_TRAITS,
            hitCount: RAPID_BURST_HIT_COUNT,
            accuracyMultiplier: RAPID_BURST_ACCURACY_MULTIPLIER,
            damageMultiplier: RAPID_BURST_DAMAGE_MULTIPLIER,
            attackAnimation: BLOWPIPE_ATTACK_ANIMATION_ID,
            attackSoundId: BLOWPIPE_ATTACK_SOUND_ID,
        }),
});

export class RosewoodBlowpipeSpec implements WeaponSpecialAttackScript {
    readonly itemId = ROSEWOOD_BLOWPIPE_ITEM_ID;
    readonly energyCost = RAPID_BURST_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, RAPID_BURST_TRAITS);
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

export const ROSEWOOD_BLOWPIPE_SPEC = Object.freeze(new RosewoodBlowpipeSpec());
