import { PlayerState } from "../../../player";
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

const TOXIC_BLOWPIPE_ITEM_ID = 12926;
const TOXIC_SIPHON_ENERGY_COST = 50;
const TOXIC_SIPHON_HEAL_FRACTION = 0.5;

const TOXIC_SIPHON = Object.freeze({
    energyCostPercent: TOXIC_SIPHON_ENERGY_COST,
    hitCount: 1,
    accuracyMultiplier: 2,
    damageMultiplier: 1.5,
    attackAnimation: 5061,
    castGraphic: Object.freeze({ id: 1043 }),
    attackSoundId: 2697,
});

export const TOXIC_BLOWPIPE_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:toxic_blowpipe",
    itemIds: Object.freeze([TOXIC_BLOWPIPE_ITEM_ID]),
    attackAnimation: (context: WeaponCombatContext) =>
        context.attack.traits.type === AttackType.Ranged ? 5061 : undefined,
    attackSoundId: (context: WeaponCombatContext) =>
        context.attack.traits.type === AttackType.Ranged ? 5765 : undefined,
    specialAttackEnergyCost: TOXIC_SIPHON_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () => TOXIC_SIPHON,
});

export class ToxicBlowpipeSpec implements WeaponSpecialAttackScript {
    readonly itemId = TOXIC_BLOWPIPE_ITEM_ID;
    readonly energyCost = TOXIC_SIPHON_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 2,
            damageMultiplier: 1.5,
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
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return;

        const damage = Math.max(0, Math.floor(damageCalculated));
        attacker.skillSystem.applyHitpointsHeal(
            Math.floor(damage * TOXIC_SIPHON_HEAL_FRACTION),
        );
    }
}

export const TOXIC_BLOWPIPE_SPEC = Object.freeze(new ToxicBlowpipeSpec());
