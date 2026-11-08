import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const EXCALIBUR_ITEM_ID = 35;
const SANCTUARY_ENERGY_COST = 100;
const SANCTUARY_DEFENCE_BOOST = 8;

/**
 * Sanctuary is an instant utility special that temporarily raises the user's
 * Defence level by eight rather than making an attack roll.
 */
export class ExcaliburSpec implements WeaponSpecialAttackScript {
    readonly itemId = EXCALIBUR_ITEM_ID;
    readonly energyCost = SANCTUARY_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): boolean {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return false;

        const defence = attacker.skillSystem.getSkill(SkillId.Defence);
        const currentLevel = Math.max(
            0,
            Math.floor(defence.baseLevel + defence.boost),
        );
        attacker.skillSystem.setSkillBoost(
            SkillId.Defence,
            Math.floor(currentLevel + SANCTUARY_DEFENCE_BOOST),
        );
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

export const EXCALIBUR_SPEC = Object.freeze(new ExcaliburSpec());
