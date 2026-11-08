import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import { isInTombsOfAmascut } from "../../MultiCombatZones";
import type { CombatAttack } from "../../model/CombatAttack";
import { CombatAttributes } from "../../state/CombatAttributes";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const KERIS_PARTISAN_OF_CORRUPTION_ITEM_ID = 27369;
const WRATH_OF_AMASCUT_ENERGY_COST = 75;
const WRATH_OF_AMASCUT_ACCURACY_MULTIPLIER = 2;
const WRATH_OF_AMASCUT_DAMAGE_MULTIPLIER = 1.25;
const WRATH_OF_AMASCUT_DURATION_TICKS = 10;

/**
 * Wrath of Amascut is a ToA-only strike with double accuracy and 25% higher
 * max hit. A damaging hit makes the target take 25% more damage for 10 ticks.
 */
export class KerisPartisanOfCorruptionSpec implements WeaponSpecialAttackScript {
    readonly itemId = KERIS_PARTISAN_OF_CORRUPTION_ITEM_ID;
    readonly energyCost = WRATH_OF_AMASCUT_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: WRATH_OF_AMASCUT_ACCURACY_MULTIPLIER,
            damageMultiplier: WRATH_OF_AMASCUT_DAMAGE_MULTIPLIER,
        });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number, attack: CombatAttack): boolean {
        void target;
        void currentMapClock;
        void attack;
        return (
            attacker instanceof PlayerState &&
            isInTombsOfAmascut(attacker.tileX, attacker.tileY, attacker.level)
        );
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void attacker;
        if (Math.floor(damageCalculated) <= 0) return;
        if (!(target instanceof PlayerState) && !(target instanceof NpcState)) return;
        target.combatAttributes.set(
            CombatAttributes.WRATH_OF_AMASCUT_UNTIL_CLOCK,
            Math.floor(currentMapClock) + WRATH_OF_AMASCUT_DURATION_TICKS,
        );
    }
}

export const KERIS_PARTISAN_OF_CORRUPTION_SPEC = Object.freeze(
    new KerisPartisanOfCorruptionSpec(),
);
