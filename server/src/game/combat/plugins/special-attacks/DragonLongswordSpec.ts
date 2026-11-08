import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_LONGSWORD_ITEM_ID = 1305;
const CLEAVE_ENERGY_COST = 25;
const CLEAVE_DAMAGE_MULTIPLIER = 1.25;
const SLASH_BONUS_INDEX = 1;

/**
 * Cleave raises the maximum hit by 25%. Its accuracy continues to use the
 * selected combat style's attack bonus, but always rolls against Slash
 * defence.
 */
export class DragonLongswordSpec implements WeaponSpecialAttackScript {
    readonly itemId = DRAGON_LONGSWORD_ITEM_ID;
    readonly energyCost = CLEAVE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            damageMultiplier: CLEAVE_DAMAGE_MULTIPLIER,
            meleeDefenceBonusIndex: SLASH_BONUS_INDEX,
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

export const DRAGON_LONGSWORD_SPEC = Object.freeze(new DragonLongswordSpec());
