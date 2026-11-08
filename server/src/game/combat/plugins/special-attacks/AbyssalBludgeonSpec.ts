import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    getWeaponSpecialAttackAttacker,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ABYSSAL_BLUDGEON_ITEM_ID = 13263;
const PENANCE_ENERGY_COST = 50;
const PENANCE_DAMAGE_PER_MISSING_PRAYER_POINT = 0.005;

/**
 * Penance increases maximum damage by 0.5% for every Prayer point missing
 * from the attacker's current level at the time the attack roll is prepared.
 */
export class AbyssalBludgeonSpec implements WeaponSpecialAttackScript {
    readonly itemId = ABYSSAL_BLUDGEON_ITEM_ID;
    readonly energyCost = PENANCE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        const attacker = getWeaponSpecialAttackAttacker(attack);
        let damageMultiplier = 1;
        if (attacker instanceof PlayerState) {
            const prayer = attacker.skillSystem.getSkill(SkillId.Prayer);
            const basePrayer = Math.max(0, Math.floor(prayer.baseLevel));
            const currentPrayer = Math.max(0, Math.floor(basePrayer + prayer.boost));
            const missingPrayer = Math.max(0, basePrayer - currentPrayer);
            damageMultiplier += missingPrayer * PENANCE_DAMAGE_PER_MISSING_PRAYER_POINT;
        }

        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            damageMultiplier,
        });
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

export const ABYSSAL_BLUDGEON_SPEC = Object.freeze(new AbyssalBludgeonSpec());
