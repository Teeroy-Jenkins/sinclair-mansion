import { SkillId } from "../../../../../../client/rs/skill/skills";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const SEERCULL_ITEM_ID = 6724;
const SOULSHOT_ENERGY_COST = 100;

/**
 * Soulshot is a guaranteed ranged hit. A damaging hit drains Magic by the
 * rolled damage, but only while the target's Magic has not already been
 * reduced; the target must fully restore before a later Soulshot can drain it
 * again.
 *
 * Its exact maximum-hit formula uses only visible Ranged level and ammunition
 * Ranged Strength. The generic ranged evaluator does not yet expose an
 * ammo-only maximum-hit source, so its damage-roll exclusion of prayers and
 * passive equipment bonuses requires that evaluator extension.
 */
export class SeercullSpec implements WeaponSpecialAttackScript {
    readonly itemId = SEERCULL_ITEM_ID;
    readonly energyCost = SOULSHOT_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            guaranteedHit: true,
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
        const damage = Math.max(0, Math.floor(damageCalculated));
        if (damage <= 0) return;

        if (target instanceof PlayerState) {
            const magic = target.skillSystem.getSkill(SkillId.Magic);
            if (magic.boost < 0) return;
            const currentLevel = Math.max(0, Math.floor(magic.baseLevel + magic.boost));
            target.skillSystem.setSkillBoost(SkillId.Magic, Math.max(0, currentLevel - damage));
            return;
        }

        if (target instanceof NpcState && !target.isCombatStatReduced("magic")) {
            target.drainCombatStat("magic", damage);
        }
    }
}

export const SEERCULL_SPEC = Object.freeze(new SeercullSpec());
