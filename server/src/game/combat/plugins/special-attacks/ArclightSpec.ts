import { SkillId } from "../../../../../../client/rs/skill/skills";
import { type NpcCombatStat, NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ARCLIGHT_CHARGED_ITEM_ID = 19675;
const WEAKEN_ENERGY_COST = 50;
const WEAKEN_DRAIN_FRACTION = 0.05;
const WEAKEN_FLAT_DRAIN = 1;
const PLAYER_DRAINED_SKILLS = Object.freeze([
    SkillId.Attack,
    SkillId.Strength,
    SkillId.Defence,
]);
const NPC_DRAINED_STATS: readonly NpcCombatStat[] = Object.freeze([
    "attack",
    "strength",
    "defence",
]);

/**
 * Charged Arclight retains Weaken: a successful Stab-roll drains Attack,
 * Strength, and Defence by 5% of base level plus one. Demons use a 10%
 * fraction, which requires an NPC demon-category flag not yet exposed by the
 * current NPC combat state.
 */
export class ArclightSpec implements WeaponSpecialAttackScript {
    readonly itemId = ARCLIGHT_CHARGED_ITEM_ID;
    readonly energyCost = WEAKEN_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
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
            for (const skillId of PLAYER_DRAINED_SKILLS) {
                const skill = target.skillSystem.getSkill(skillId);
                const baseLevel = Math.max(0, Math.floor(skill.baseLevel));
                const currentLevel = Math.max(0, Math.floor(baseLevel + skill.boost));
                const drainAmount = Math.floor(baseLevel * WEAKEN_DRAIN_FRACTION) + WEAKEN_FLAT_DRAIN;
                target.skillSystem.setSkillBoost(skillId, Math.max(1, currentLevel - drainAmount));
            }
            return;
        }

        if (target instanceof NpcState) {
            for (const stat of NPC_DRAINED_STATS) {
                const currentLevel = Math.max(0, Math.floor(target.getCombatStat(stat)));
                const drainAmount = Math.floor(currentLevel * WEAKEN_DRAIN_FRACTION) + WEAKEN_FLAT_DRAIN;
                target.drainCombatStat(stat, drainAmount);
            }
        }
    }
}

export const ARCLIGHT_SPEC = Object.freeze(new ArclightSpec());
