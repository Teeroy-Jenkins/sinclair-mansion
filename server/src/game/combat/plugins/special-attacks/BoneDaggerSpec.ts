import { SkillId } from "../../../../../../client/rs/skill/skills";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const BONE_DAGGER_ITEM_ID = 8872;
const BONE_DAGGER_POISONED_ITEM_ID = 8874;
const BONE_DAGGER_POISON_PLUS_ITEM_ID = 8876;
const BONE_DAGGER_POISON_PLUS_PLUS_ITEM_ID = 8878;
const BACKSTAB_ENERGY_COST = 75;

/**
 * Backstab drains Defence by the amount of damage rolled. OSRS guarantees the
 * accuracy roll only when the wielder was not the target's most recent attacker;
 * resolving that live combat relationship requires an engagement-layer hook.
 */
export class BoneDaggerSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId = BONE_DAGGER_ITEM_ID) {}

    readonly energyCost = BACKSTAB_ENERGY_COST;

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
            const currentLevel = Math.max(0, Math.floor(defence.baseLevel + defence.boost));
            target.skillSystem.setSkillBoost(SkillId.Defence, Math.max(1, currentLevel - damage));
            return;
        }
        if (target instanceof NpcState) {
            target.drainCombatStat("defence", damage);
        }
    }
}

export const BONE_DAGGER_SPEC = Object.freeze(new BoneDaggerSpec());
export const BONE_DAGGER_VARIANT_SPECS = Object.freeze([
    new BoneDaggerSpec(BONE_DAGGER_POISONED_ITEM_ID),
    new BoneDaggerSpec(BONE_DAGGER_POISON_PLUS_ITEM_ID),
    new BoneDaggerSpec(BONE_DAGGER_POISON_PLUS_PLUS_ITEM_ID),
]);
