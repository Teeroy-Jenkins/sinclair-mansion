import { SkillId } from "../../../../../../client/rs/skill/skills";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ELDER_MAUL_ITEM_ID = 21003;
const ELDER_MAUL_ORNAMENTED_ITEM_ID = 27100;
const PULVERIZE_ENERGY_COST = 50;
const PULVERIZE_ACCURACY_MULTIPLIER = 1.25;
const PULVERIZE_DEFENCE_DRAIN_FRACTION = 0.35;

/**
 * Pulverize has 25% increased accuracy and, on a damaging hit, drains 35% of
 * the target's current Defence. The drain is therefore multiplicative across
 * consecutive successful special attacks.
 *
 * The special attack's one-tick attack-delay increase requires attack-timing
 * support and is intentionally not represented by roll traits.
 */
export class ElderMaulSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId: number) {}

    readonly energyCost = PULVERIZE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: PULVERIZE_ACCURACY_MULTIPLIER,
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
            const drainAmount = Math.floor(currentLevel * PULVERIZE_DEFENCE_DRAIN_FRACTION);
            target.skillSystem.setSkillBoost(SkillId.Defence, currentLevel - drainAmount);
            return;
        }

        if (target instanceof NpcState) {
            target.drainCombatStatByFraction("defence", PULVERIZE_DEFENCE_DRAIN_FRACTION);
        }
    }
}

export const ELDER_MAUL_SPEC = Object.freeze(new ElderMaulSpec(ELDER_MAUL_ITEM_ID));
export const ELDER_MAUL_ORNAMENTED_SPEC = Object.freeze(
    new ElderMaulSpec(ELDER_MAUL_ORNAMENTED_ITEM_ID),
);
export const ELDER_MAUL_SPECS = Object.freeze([
    ELDER_MAUL_SPEC,
    ELDER_MAUL_ORNAMENTED_SPEC,
]);
