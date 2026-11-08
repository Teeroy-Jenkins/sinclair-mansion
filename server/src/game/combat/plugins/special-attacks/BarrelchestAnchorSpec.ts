import { SkillId } from "../../../../../../client/rs/skill/skills";
import { type NpcCombatStat, NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const BARRELCHEST_ANCHOR_ITEM_ID = 10887;
const SUNDER_ENERGY_COST = 50;
const SUNDER_ACCURACY_MULTIPLIER = 2;
const SUNDER_DAMAGE_MULTIPLIER = 1.1;
const SUNDER_DRAIN_FRACTION = 0.1;
const PLAYER_DRAIN_ORDER = Object.freeze([
    SkillId.Defence,
    SkillId.Attack,
    SkillId.Ranged,
    SkillId.Magic,
]);
const NPC_DRAIN_ORDER: readonly NpcCombatStat[] = Object.freeze([
    "defence",
    "attack",
    "ranged",
    "magic",
]);

/**
 * Sunder doubles accuracy, increases maximum damage by 10%, then drains 10%
 * of the rolled damage in the order Defence, Attack, Ranged, Magic. The combat
 * evaluator currently exposes the special-scaled prospective damage here; a
 * pre-modifier damage-roll hook is needed for byte-exact OSRS drain rounding.
 */
export class BarrelchestAnchorSpec implements WeaponSpecialAttackScript {
    readonly itemId = BARRELCHEST_ANCHOR_ITEM_ID;
    readonly energyCost = SUNDER_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: SUNDER_ACCURACY_MULTIPLIER,
            damageMultiplier: SUNDER_DAMAGE_MULTIPLIER,
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
        let remainingDrain = Math.max(
            0,
            Math.floor(Math.floor(damageCalculated) * SUNDER_DRAIN_FRACTION),
        );
        if (remainingDrain <= 0) return;

        if (target instanceof PlayerState) {
            for (const skillId of PLAYER_DRAIN_ORDER) {
                if (remainingDrain <= 0) break;
                const skill = target.skillSystem.getSkill(skillId);
                const currentLevel = Math.max(0, Math.floor(skill.baseLevel + skill.boost));
                const drainAmount = Math.min(remainingDrain, Math.max(0, currentLevel - 1));
                if (drainAmount <= 0) continue;
                target.skillSystem.setSkillBoost(skillId, currentLevel - drainAmount);
                remainingDrain -= drainAmount;
            }
            return;
        }

        if (target instanceof NpcState) {
            for (const stat of NPC_DRAIN_ORDER) {
                if (remainingDrain <= 0) break;
                remainingDrain -= target.drainCombatStat(stat, remainingDrain);
            }
        }
    }
}

export const BARRELCHEST_ANCHOR_SPEC = Object.freeze(new BarrelchestAnchorSpec());
