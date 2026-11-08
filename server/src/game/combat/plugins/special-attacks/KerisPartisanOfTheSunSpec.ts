import { SKILL_IDS, SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const KERIS_PARTISAN_OF_THE_SUN_ITEM_ID = 27279;
const TUMEKENS_LIGHT_ENERGY_COST = 75;
const TUMEKENS_LIGHT_PRAYER_COST = 50;
const TUMEKENS_LIGHT_OVERHEAL_MULTIPLIER = 1.2;

/**
 * Tumeken's Light is a utility special: it spends Prayer and special energy
 * to restore the wielder instead of making an attack roll or damage hitsplat.
 */
export class KerisPartisanOfTheSunSpec implements WeaponSpecialAttackScript {
    readonly itemId = KERIS_PARTISAN_OF_THE_SUN_ITEM_ID;
    readonly energyCost = TUMEKENS_LIGHT_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): boolean {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return false;

        const prayer = attacker.skillSystem.getSkill(SkillId.Prayer);
        const currentPrayer = Math.max(0, Math.floor(prayer.baseLevel + prayer.boost));
        if (currentPrayer < TUMEKENS_LIGHT_PRAYER_COST) return false;

        attacker.skillSystem.setSkillBoost(
            SkillId.Prayer,
            currentPrayer - TUMEKENS_LIGHT_PRAYER_COST,
        );
        this.restoreDrainedSkills(attacker);
        attacker.skillSystem.curePoison();
        attacker.skillSystem.cureVenom();
        this.overhealHitpoints(attacker);
        attacker.energy.setRunEnergyPercent(100);
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

    private restoreDrainedSkills(player: PlayerState): void {
        for (const skillId of SKILL_IDS) {
            if (skillId === SkillId.Prayer || skillId === SkillId.Hitpoints) continue;
            const skill = player.skillSystem.getSkill(skillId);
            if (skill.boost < 0) {
                player.skillSystem.setSkillBoost(skillId, skill.baseLevel);
            }
        }
    }

    private overhealHitpoints(player: PlayerState): void {
        const hitpoints = player.skillSystem.getSkill(SkillId.Hitpoints);
        const cap = Math.floor(hitpoints.baseLevel * TUMEKENS_LIGHT_OVERHEAL_MULTIPLIER);
        const current = player.skillSystem.getHitpointsCurrent();
        player.skillSystem.applyHitpointsOverheal(Math.max(0, cap - current), cap);
    }
}

export const KERIS_PARTISAN_OF_THE_SUN_SPEC = Object.freeze(new KerisPartisanOfTheSunSpec());
