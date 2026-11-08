import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const BRINE_SABRE_ITEM_ID = 11037;
const LIQUIFY_ENERGY_COST = 75;
const LIQUIFY_ACCURACY_MULTIPLIER = 2;
const LIQUIFY_DAMAGE_TO_STAT_FRACTION = 0.25;
const LIQUIFY_BASE_BOOST_CAP = 3;
const LIQUIFY_LEVEL_CAP_FRACTION = 0.1;
const LIQUIFY_SKILLS = Object.freeze([
    SkillId.Strength,
    SkillId.Attack,
    SkillId.Defence,
]);

/**
 * Liquify doubles accuracy and, on a successful hit, raises Strength, Attack,
 * and Defence by 25% of the dealt damage. Each boost is capped at the skill's
 * base level plus 3 + 10% of that base level.
 *
 * The OSRS availability restriction (underwater only) belongs to the map-area
 * layer. This combat script intentionally contains no hard-coded area IDs.
 */
export class BrineSabreSpec implements WeaponSpecialAttackScript {
    readonly itemId = BRINE_SABRE_ITEM_ID;
    readonly energyCost = LIQUIFY_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: LIQUIFY_ACCURACY_MULTIPLIER,
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

        const boostAmount = Math.max(
            0,
            Math.floor(Math.floor(damageCalculated) * LIQUIFY_DAMAGE_TO_STAT_FRACTION),
        );
        if (boostAmount <= 0) return;

        for (const skillId of LIQUIFY_SKILLS) {
            const skill = attacker.skillSystem.getSkill(skillId);
            const currentLevel = Math.max(0, Math.floor(skill.baseLevel + skill.boost));
            const cap = Math.floor(
                skill.baseLevel +
                    LIQUIFY_BASE_BOOST_CAP +
                    Math.floor(skill.baseLevel * LIQUIFY_LEVEL_CAP_FRACTION),
            );
            attacker.skillSystem.setSkillBoost(skillId, Math.min(cap, currentLevel + boostAmount));
        }
    }
}

export const BRINE_SABRE_SPEC = Object.freeze(new BrineSabreSpec());
