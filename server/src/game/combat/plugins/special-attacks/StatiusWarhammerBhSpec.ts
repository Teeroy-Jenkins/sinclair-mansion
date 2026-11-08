import { SkillId } from "../../../../../../client/rs/skill/skills";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const STATIUS_WARHAMMER_BH_ITEM_ID = 27908;
const SMASH_ENERGY_COST = 35;
const SMASH_MINIMUM_DAMAGE_MULTIPLIER = 0.25;
const SMASH_MAXIMUM_DAMAGE_MULTIPLIER = 1.25;
const SMASH_DEFENCE_DRAIN_FRACTION = 0.75;

/**
 * Smash rolls damage from 25% to 125% of the wielder's maximum hit. A
 * damaging hit drains 75% of the target's current Defence, so consecutive
 * successful specs drain multiplicatively.
 *
 * The Bounty Hunter area restriction and full-Statius-set accuracy bonus are
 * enforced by game-mode/equipment systems rather than this weapon script.
 */
export class StatiusWarhammerBhSpec implements WeaponSpecialAttackScript {
    readonly itemId = STATIUS_WARHAMMER_BH_ITEM_ID;
    readonly energyCost = SMASH_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            minimumDamageMultiplier: SMASH_MINIMUM_DAMAGE_MULTIPLIER,
            maximumDamageMultiplier: SMASH_MAXIMUM_DAMAGE_MULTIPLIER,
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
            const defence = target.skillSystem.getSkill(SkillId.Defence);
            const currentLevel = Math.max(0, Math.floor(defence.baseLevel + defence.boost));
            const drainAmount = Math.floor(currentLevel * SMASH_DEFENCE_DRAIN_FRACTION);
            target.skillSystem.setSkillBoost(SkillId.Defence, currentLevel - drainAmount);
            return;
        }

        if (target instanceof NpcState) {
            target.drainCombatStatByFraction("defence", SMASH_DEFENCE_DRAIN_FRACTION);
        }
    }
}

export const STATIUS_WARHAMMER_BH_SPEC = Object.freeze(new StatiusWarhammerBhSpec());
