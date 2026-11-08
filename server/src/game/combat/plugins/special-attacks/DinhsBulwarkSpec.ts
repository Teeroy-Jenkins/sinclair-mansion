import { SkillId } from "../../../../../../client/rs/skill/skills";
import { type NpcCombatStat, NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import { CombatAttackStyle, type CombatAttack } from "../../model/CombatAttack";
import { CombatEntityType } from "../../model/CombatEntityRef";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DINHS_BULWARK_ITEM_ID = 21015;
const SHIELD_BASH_ENERGY_COST = 50;
const SHIELD_BASH_ACCURACY_MULTIPLIER = 1.2;
const SHIELD_BASH_DEFENSIVE_NPC_ACCURACY_MULTIPLIER = 0.8;
const SHIELD_BASH_OFFENSIVE_STAT_DRAIN_FRACTION = 0.05;

/**
 * Shield Bash uses a 20% accuracy bonus and hits non-player primary targets
 * twice. Each successful hit drains the target's highest offensive combat
 * style by 5% of its current value. The engagement engine must supply the
 * surrounding 11x11 targets for the full area-of-effect portion.
 */
export class DinhsBulwarkSpec implements WeaponSpecialAttackScript {
    readonly itemId = DINHS_BULWARK_ITEM_ID;
    readonly energyCost = SHIELD_BASH_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        const isPlayerTarget = attack.target.type === CombatEntityType.Player;
        const isDefensiveNpcAttack =
            !isPlayerTarget && attack.traits.style === CombatAttackStyle.Defensive;
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: isPlayerTarget ? 1 : 2,
            accuracyMultiplier: isDefensiveNpcAttack
                ? SHIELD_BASH_DEFENSIVE_NPC_ACCURACY_MULTIPLIER
                : SHIELD_BASH_ACCURACY_MULTIPLIER,
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
            this.drainPlayerHighestOffensiveStyle(target);
            return;
        }
        if (target instanceof NpcState) {
            this.drainNpcHighestOffensiveStyle(target);
        }
    }

    private drainPlayerHighestOffensiveStyle(target: PlayerState): void {
        const attack = this.getPlayerLevel(target, SkillId.Attack);
        const strength = this.getPlayerLevel(target, SkillId.Strength);
        const ranged = this.getPlayerLevel(target, SkillId.Ranged);
        const magic = this.getPlayerLevel(target, SkillId.Magic);
        const melee = attack + strength;
        const highest = Math.max(melee, ranged, magic);

        if (melee === highest) {
            this.drainPlayerSkill(target, SkillId.Attack);
            this.drainPlayerSkill(target, SkillId.Strength);
            return;
        }
        if (ranged === highest) {
            this.drainPlayerSkill(target, SkillId.Ranged);
            return;
        }
        this.drainPlayerSkill(target, SkillId.Magic);
    }

    private drainNpcHighestOffensiveStyle(target: NpcState): void {
        const attack = this.getNpcLevel(target, "attack");
        const strength = this.getNpcLevel(target, "strength");
        const ranged = this.getNpcLevel(target, "ranged");
        const magic = this.getNpcLevel(target, "magic");
        const melee = attack + strength;
        const highest = Math.max(melee, ranged, magic);

        if (melee === highest) {
            target.drainCombatStatByFraction("attack", SHIELD_BASH_OFFENSIVE_STAT_DRAIN_FRACTION);
            target.drainCombatStatByFraction("strength", SHIELD_BASH_OFFENSIVE_STAT_DRAIN_FRACTION);
            return;
        }
        target.drainCombatStatByFraction(
            ranged === highest ? "ranged" : "magic",
            SHIELD_BASH_OFFENSIVE_STAT_DRAIN_FRACTION,
        );
    }

    private getPlayerLevel(target: PlayerState, skillId: SkillId): number {
        const skill = target.skillSystem.getSkill(skillId);
        return Math.max(0, Math.floor(skill.baseLevel + skill.boost));
    }

    private drainPlayerSkill(target: PlayerState, skillId: SkillId): void {
        const currentLevel = this.getPlayerLevel(target, skillId);
        const drainAmount = Math.max(
            0,
            Math.floor(currentLevel * SHIELD_BASH_OFFENSIVE_STAT_DRAIN_FRACTION),
        );
        target.skillSystem.setSkillBoost(skillId, currentLevel - drainAmount);
    }

    private getNpcLevel(target: NpcState, stat: NpcCombatStat): number {
        return Math.max(0, Math.floor(target.getCombatStat(stat)));
    }
}

export const DINHS_BULWARK_SPEC = Object.freeze(new DinhsBulwarkSpec());
