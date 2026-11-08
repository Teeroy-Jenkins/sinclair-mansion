import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ANCIENT_MACE_ITEM_ID = 11061;
const FAVOUR_OF_THE_WAR_GOD_ENERGY_COST = 100;

/**
 * Favour of the War God restores the wielder's Prayer by the damage rolled and
 * drains the same amount from a player target. The restore may raise Prayer
 * above its base level, capped at base Prayer plus that hit's damage.
 * Protection-prayer bypass is an evaluator-level concern.
 */
export class AncientMaceSpec implements WeaponSpecialAttackScript {
    readonly itemId = ANCIENT_MACE_ITEM_ID;
    readonly energyCost = FAVOUR_OF_THE_WAR_GOD_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { hitCount: 1 });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return;

        const damage = Math.max(0, Math.floor(damageCalculated));
        if (damage <= 0) return;

        if (target instanceof PlayerState) {
            const targetPrayer = target.skillSystem.getSkill(SkillId.Prayer);
            const targetCurrentPrayer = Math.max(
                0,
                Math.floor(targetPrayer.baseLevel + targetPrayer.boost),
            );
            target.skillSystem.setSkillBoost(
                SkillId.Prayer,
                Math.max(0, targetCurrentPrayer - damage),
            );
        }

        const attackerPrayer = attacker.skillSystem.getSkill(SkillId.Prayer);
        const attackerCurrentPrayer = Math.max(
            0,
            Math.floor(attackerPrayer.baseLevel + attackerPrayer.boost),
        );
        const prayerCap = Math.floor(attackerPrayer.baseLevel + damage);
        attacker.skillSystem.setSkillBoost(
            SkillId.Prayer,
            Math.min(prayerCap, attackerCurrentPrayer + damage),
        );
    }
}

export const ANCIENT_MACE_SPEC = Object.freeze(new AncientMaceSpec());
