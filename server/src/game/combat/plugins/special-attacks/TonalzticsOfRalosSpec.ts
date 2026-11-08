import { SkillId } from "../../../../../../client/rs/skill/skills";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const TONALZTICS_OF_RALOS_CHARGED_ITEM_ID = 28922;
const DIVISION_ENERGY_COST = 50;
const DIVISION_HIT_COUNT = 2;
const DIVISION_DEFENCE_DRAIN_MAGIC_FRACTION = 0.1;

/**
 * Charged Division fires two independent hits. Each damaging hit drains the
 * target's Defence by 10% of its current Magic level, rounded down. Therefore
 * landing both hits drains 20% of Magic level in total.
 *
 * Charge validation and consumption are handled by the charged-weapon system.
 */
export class TonalzticsOfRalosSpec implements WeaponSpecialAttackScript {
    readonly itemId = TONALZTICS_OF_RALOS_CHARGED_ITEM_ID;
    readonly energyCost = DIVISION_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: DIVISION_HIT_COUNT,
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
            const magic = target.skillSystem.getSkill(SkillId.Magic);
            const defence = target.skillSystem.getSkill(SkillId.Defence);
            const magicLevel = Math.max(0, Math.floor(magic.baseLevel + magic.boost));
            const currentDefence = Math.max(0, Math.floor(defence.baseLevel + defence.boost));
            const drainAmount = Math.floor(
                magicLevel * DIVISION_DEFENCE_DRAIN_MAGIC_FRACTION,
            );
            if (drainAmount > 0) {
                target.skillSystem.setSkillBoost(
                    SkillId.Defence,
                    Math.max(0, currentDefence - drainAmount),
                );
            }
            return;
        }

        if (target instanceof NpcState) {
            const magicLevel = Math.max(0, Math.floor(target.getCombatStat("magic")));
            target.drainCombatStat(
                "defence",
                Math.floor(magicLevel * DIVISION_DEFENCE_DRAIN_MAGIC_FRACTION),
            );
        }
    }
}

export const TONALZTICS_OF_RALOS_SPEC = Object.freeze(new TonalzticsOfRalosSpec());
