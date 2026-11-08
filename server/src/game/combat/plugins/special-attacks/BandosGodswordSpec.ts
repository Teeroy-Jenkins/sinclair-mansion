import { SkillId } from "../../../../../../client/rs/skill/skills";
import { type NpcCombatStat, NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const BANDOS_GODSWORD_ITEM_ID = 11804;
const BANDOS_GODSWORD_ENERGY_COST = 50;

const PLAYER_DRAIN_ORDER = Object.freeze([
    SkillId.Defence,
    SkillId.Strength,
    SkillId.Prayer,
    SkillId.Attack,
    SkillId.Magic,
    SkillId.Ranged,
]);

const NPC_DRAIN_ORDER: ReadonlyArray<NpcCombatStat | undefined> = Object.freeze([
    "defence",
    "strength",
    undefined,
    "attack",
    "magic",
    "ranged",
]);

export class BandosGodswordSpec implements WeaponSpecialAttackScript {
    readonly itemId = BANDOS_GODSWORD_ITEM_ID;
    readonly energyCost = BANDOS_GODSWORD_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 2,
            damageMultiplier: 1.21,
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

        let remainingDrain = Math.max(0, Math.floor(damageCalculated));
        if (remainingDrain <= 0) return;

        if (target instanceof PlayerState) {
            for (const skillId of PLAYER_DRAIN_ORDER) {
                if (remainingDrain <= 0) break;
                const skill = target.skillSystem.getSkill(skillId);
                const currentLevel = Math.max(0, Math.floor(skill.baseLevel + skill.boost));
                const minimumLevel = skillId === SkillId.Prayer ? 0 : 1;
                const amount = Math.min(remainingDrain, Math.max(0, currentLevel - minimumLevel));
                if (amount <= 0) continue;
                target.skillSystem.setSkillBoost(skillId, currentLevel - amount);
                remainingDrain -= amount;
            }
            return;
        }

        if (target instanceof NpcState) {
            for (const stat of NPC_DRAIN_ORDER) {
                if (remainingDrain <= 0) break;
                if (stat === undefined) continue;
                remainingDrain -= target.drainCombatStat(stat, remainingDrain);
            }
        }
    }
}

export const BANDOS_GODSWORD_SPEC = Object.freeze(new BandosGodswordSpec());
