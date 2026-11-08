import { SkillId } from "../../../../../../client/rs/skill/skills";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DORGESHUUN_CROSSBOW_ITEM_ID = 8880;
const SNIPE_ENERGY_COST = 75;

/**
 * Snipe drains Defence by the damage rolled, but only if it has not already
 * been reduced. OSRS guarantees accuracy when the target has never been hit or
 * was last hit by someone else; resolving that relationship requires live
 * engagement state, unavailable through CombatAttack's target reference.
 */
export class DorgeshuunCrossbowSpec implements WeaponSpecialAttackScript {
    readonly itemId = DORGESHUUN_CROSSBOW_ITEM_ID;
    readonly energyCost = SNIPE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { hitCount: 1 });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void attacker;
        void currentMapClock;
        const damage = Math.max(0, Math.floor(damageCalculated));
        if (damage <= 0) return;

        if (target instanceof PlayerState) {
            const defence = target.skillSystem.getSkill(SkillId.Defence);
            if (defence.boost < 0) return;
            const currentLevel = Math.max(0, Math.floor(defence.baseLevel + defence.boost));
            target.skillSystem.setSkillBoost(SkillId.Defence, Math.max(1, currentLevel - damage));
            return;
        }

        if (target instanceof NpcState) {
            // NPC combat state does not expose its original Defence level, so
            // enforcing Snipe's "only when not already lowered" guard belongs
            // in the NPC stat-drain/evaluator layer.
            target.drainCombatStat("defence", damage);
        }
    }
}

export const DORGESHUUN_CROSSBOW_SPEC = Object.freeze(new DorgeshuunCrossbowSpec());
