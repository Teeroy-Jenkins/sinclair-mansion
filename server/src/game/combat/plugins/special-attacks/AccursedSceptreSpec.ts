import { SkillId } from "../../../../../../client/rs/skill/skills";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ACCURSED_SCEPTRE_CHARGED_ITEM_ID = 27665;
const CONDEMN_ENERGY_COST = 50;
const CONDEMN_ACCURACY_MULTIPLIER = 1.5;
const CONDEMN_DAMAGE_MULTIPLIER = 1.5;
const CONDEMN_DRAIN_FRACTION = 0.15;

/**
 * Condemn gains 50% accuracy and maximum damage. On a successful hit it drains
 * Defence and Magic by up to 15% of their original levels; repeat Condemn hits
 * cannot reduce either stat below that 15% cap. Ether validation/consumption is
 * handled by the charged-weapon subsystem, outside this combat-script contract.
 */
export class AccursedSceptreSpec implements WeaponSpecialAttackScript {
    readonly itemId = ACCURSED_SCEPTRE_CHARGED_ITEM_ID;
    readonly energyCost = CONDEMN_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: CONDEMN_ACCURACY_MULTIPLIER,
            damageMultiplier: CONDEMN_DAMAGE_MULTIPLIER,
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

        if (target instanceof PlayerState) {
            this.drainPlayerSkill(target, SkillId.Defence);
            this.drainPlayerSkill(target, SkillId.Magic);
            return;
        }
        if (target instanceof NpcState) {
            target.drainCombatStatByFraction("defence", CONDEMN_DRAIN_FRACTION);
            target.drainCombatStatByFraction("magic", CONDEMN_DRAIN_FRACTION);
        }
    }

    private drainPlayerSkill(target: PlayerState, skillId: SkillId): void {
        const skill = target.skillSystem.getSkill(skillId);
        const baseLevel = Math.max(0, Math.floor(skill.baseLevel));
        const currentLevel = Math.max(0, Math.floor(baseLevel + skill.boost));
        const drainAmount = Math.max(0, Math.floor(baseLevel * CONDEMN_DRAIN_FRACTION));
        const cap = Math.max(0, baseLevel - drainAmount);
        target.skillSystem.setSkillBoost(skillId, Math.max(cap, currentLevel - drainAmount));
    }
}

export const ACCURSED_SCEPTRE_SPEC = Object.freeze(new AccursedSceptreSpec());
