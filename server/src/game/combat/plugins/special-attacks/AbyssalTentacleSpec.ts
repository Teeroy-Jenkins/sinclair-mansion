import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import type { WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ABYSSAL_TENTACLE_ITEM_ID = 12006;
const BINDING_TENTACLE_ENERGY_COST = 50;
const BINDING_TENTACLE_ACCURACY_MULTIPLIER = 1.25;
const BINDING_TENTACLE_DURATION_TICKS = 8;
const BINDING_TENTACLE_POISON_CHANCE = 0.5;
const BINDING_TENTACLE_POISON_POTENCY = 4;

const BINDING_TENTACLE_SPECIAL = Object.freeze({
    energyCostPercent: BINDING_TENTACLE_ENERGY_COST,
    hitCount: 1,
    accuracyMultiplier: BINDING_TENTACLE_ACCURACY_MULTIPLIER,
    damageMultiplier: 1,
    meleeAttackBonusIndex: 1 as const,
    meleeDefenceBonusIndex: 1 as const,
});

/** OSRS Binding Tentacle: a 5-second bind and an independent poison roll. */
export const ABYSSAL_TENTACLE_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:abyssal_tentacle",
    itemIds: Object.freeze([ABYSSAL_TENTACLE_ITEM_ID]),
    specialAttackEnergyCost: BINDING_TENTACLE_ENERGY_COST,
    handleSpecialAttack: () => BINDING_TENTACLE_SPECIAL,
});

export function applyBindingTentacleEffects(
    target: unknown,
    currentMapClock: number,
    random: () => number = Math.random,
): void {
    if (target instanceof PlayerState) {
        target.applyFreeze(BINDING_TENTACLE_DURATION_TICKS, currentMapClock);
        if (random() < BINDING_TENTACLE_POISON_CHANCE) {
            target.skillSystem.inflictPoison(BINDING_TENTACLE_POISON_POTENCY, currentMapClock);
        }
        return;
    }

    if (target instanceof NpcState) {
        target.applyFreeze(BINDING_TENTACLE_DURATION_TICKS, currentMapClock);
        if (random() < BINDING_TENTACLE_POISON_CHANCE) {
            target.inflictPoison(BINDING_TENTACLE_POISON_POTENCY, currentMapClock);
        }
    }
}

/**
 * Binding Tentacle has 25% increased slash accuracy. Its bind and poison are
 * applied on activation, so an inaccurate zero still receives both rolls.
 */
export class AbyssalTentacleSpec implements WeaponSpecialAttackScript {
    readonly itemId = ABYSSAL_TENTACLE_ITEM_ID;
    readonly energyCost = BINDING_TENTACLE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: BINDING_TENTACLE_ACCURACY_MULTIPLIER,
            meleeAttackBonusIndex: 1,
            meleeDefenceBonusIndex: 1,
        });
    }

    onSpecialActivated(
        _attacker: unknown,
        target: unknown,
        currentMapClock: number,
    ): void {
        applyBindingTentacleEffects(target, currentMapClock);
    }

    onHitApplied(
        _attacker: unknown,
        _target: unknown,
        _damageCalculated: number,
        _currentMapClock: number,
    ): void {}
}

export const ABYSSAL_TENTACLE_SPEC = Object.freeze(new AbyssalTentacleSpec());
