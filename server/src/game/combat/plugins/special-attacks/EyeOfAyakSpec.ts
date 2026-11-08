import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import { CombatAttributes } from "../../state/CombatAttributes";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const EYE_OF_AYAK_CHARGED_ITEM_ID = 31113;
const SOUL_REND_ENERGY_COST = 50;
const SOUL_REND_ACCURACY_MULTIPLIER = 2;
const SOUL_REND_DAMAGE_MULTIPLIER = 1.3;

/**
 * Soul Rend is a Magic attack with doubled accuracy and 30% higher maximum
 * hit. A damaging hit drains Magic Defence bonus equal to the damage dealt,
 * without reducing it below zero. Charge validation and consumption belong to
 * the charged-weapon subsystem.
 */
export class EyeOfAyakSpec implements WeaponSpecialAttackScript {
    readonly itemId = EYE_OF_AYAK_CHARGED_ITEM_ID;
    readonly energyCost = SOUL_REND_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            rollAttackType: AttackType.Magic,
            damageType: AttackType.Magic,
            accuracyMultiplier: SOUL_REND_ACCURACY_MULTIPLIER,
            damageMultiplier: SOUL_REND_DAMAGE_MULTIPLIER,
        });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void attacker;
        void currentMapClock;
        if (Math.floor(damageCalculated) <= 0) return;
        if (!(target instanceof PlayerState) && !(target instanceof NpcState)) return;

        const currentBonus = Math.max(
            0,
            Math.floor(
                target.combatAttributes.get(CombatAttributes.MAGIC_DEFENCE_BONUS_CURRENT),
            ),
        );
        const drainAmount = Math.min(Math.floor(damageCalculated), currentBonus);
        if (drainAmount <= 0) return;

        const accumulatedDrain = Math.max(
            0,
            Math.floor(
                target.combatAttributes.get(CombatAttributes.MAGIC_DEFENCE_BONUS_DRAIN),
            ),
        );
        target.combatAttributes.set(
            CombatAttributes.MAGIC_DEFENCE_BONUS_DRAIN,
            accumulatedDrain + drainAmount,
        );
    }
}

export const EYE_OF_AYAK_SPEC = Object.freeze(new EyeOfAyakSpec());
