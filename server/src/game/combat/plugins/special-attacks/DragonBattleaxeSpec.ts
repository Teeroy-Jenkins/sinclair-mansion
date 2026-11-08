import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_BATTLEAXE_ITEM_ID = 1377;
const RAMPAGE_ENERGY_COST = 100;
const RAMPAGE_DRAIN_FRACTION = 0.1;
const RAMPAGE_BASE_STRENGTH_BOOST = 10;
const RAMPAGE_DRAIN_TO_STRENGTH_DIVISOR = 4;
const RAMPAGE_DRAINED_SKILLS = Object.freeze([
    SkillId.Attack,
    SkillId.Defence,
    SkillId.Ranged,
    SkillId.Magic,
]);

/**
 * Rampage is an instant utility special. It drains 10% of the user's current
 * Attack, Defence, Ranged, and Magic levels, then adds 10 plus one quarter of
 * the total drained levels to their current Strength level.
 */
export class DragonBattleaxeSpec implements WeaponSpecialAttackScript {
    readonly itemId = DRAGON_BATTLEAXE_ITEM_ID;
    readonly energyCost = RAMPAGE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): boolean {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return false;

        let totalDrained = 0;
        for (const skillId of RAMPAGE_DRAINED_SKILLS) {
            const skill = attacker.skillSystem.getSkill(skillId);
            const currentLevel = Math.max(0, Math.floor(skill.baseLevel + skill.boost));
            const drainAmount = Math.max(
                0,
                Math.floor(currentLevel * RAMPAGE_DRAIN_FRACTION),
            );
            attacker.skillSystem.setSkillBoost(skillId, currentLevel - drainAmount);
            totalDrained += drainAmount;
        }

        const strength = attacker.skillSystem.getSkill(SkillId.Strength);
        const currentStrength = Math.max(
            0,
            Math.floor(strength.baseLevel + strength.boost),
        );
        const strengthBoost = Math.floor(
            RAMPAGE_BASE_STRENGTH_BOOST +
                Math.floor(totalDrained / RAMPAGE_DRAIN_TO_STRENGTH_DIVISOR),
        );
        attacker.skillSystem.setSkillBoost(SkillId.Strength, currentStrength + strengthBoost);
        return true;
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void attacker;
        void target;
        void damageCalculated;
        void currentMapClock;
    }
}

export const DRAGON_BATTLEAXE_SPEC = Object.freeze(new DragonBattleaxeSpec());
