import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import { SpecialAttackTiming, type WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    SpecialAttackMaximumHitSource,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const SARADOMINS_BLESSED_SWORD_ITEM_ID = 12809;
const BLESSED_LIGHTNING_ENERGY_COST = 65;
const BLESSED_LIGHTNING_DAMAGE_MULTIPLIER = 1.25;
const SLASH_BONUS_INDEX = 1;

const BLESSED_LIGHTNING = Object.freeze({
    energyCostPercent: BLESSED_LIGHTNING_ENERGY_COST,
    hitCount: 1,
    accuracyMultiplier: 1,
    damageMultiplier: BLESSED_LIGHTNING_DAMAGE_MULTIPLIER,
    rollAttackType: AttackType.Melee,
    defenceRollAttackType: AttackType.Magic,
    damageType: AttackType.Magic,
    meleeAttackBonusIndex: SLASH_BONUS_INDEX,
    maximumHitSource: SpecialAttackMaximumHitSource.Magic,
    attackAnimation: 7515,
    castGraphic: Object.freeze({ id: 1194 }),
    attackSoundId: 3853,
});

export const SARADOMINS_BLESSED_SWORD_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:saradomins_blessed_sword",
    itemIds: Object.freeze([SARADOMINS_BLESSED_SWORD_ITEM_ID]),
    specialAttackEnergyCost: BLESSED_LIGHTNING_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () => BLESSED_LIGHTNING,
});

/**
 * Blessed Lightning rolls the sword's Slash attack bonus against Magic
 * defence. Its hit is Magic damage and uses the player's magic maximum hit,
 * increased by 25%.
 */
export class SaradominsBlessedSwordSpec implements WeaponSpecialAttackScript {
    readonly itemId = SARADOMINS_BLESSED_SWORD_ITEM_ID;
    readonly energyCost = BLESSED_LIGHTNING_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: BLESSED_LIGHTNING_DAMAGE_MULTIPLIER,
            rollAttackType: AttackType.Melee,
            defenceRollAttackType: AttackType.Magic,
            damageType: AttackType.Magic,
            meleeAttackBonusIndex: SLASH_BONUS_INDEX,
            maximumHitSource: SpecialAttackMaximumHitSource.Magic,
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

export const SARADOMINS_BLESSED_SWORD_SPEC = Object.freeze(
    new SaradominsBlessedSwordSpec(),
);
