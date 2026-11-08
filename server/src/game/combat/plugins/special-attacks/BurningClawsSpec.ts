import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";
import { getWeaponSpecialAttackRuntimeMetadata } from "../WeaponSpecialAttackScript";

const BURNING_CLAWS_ITEM_ID = 29577;
const BURNING_BARRAGE_ENERGY_COST = 30;
const BURNING_BARRAGE_ACCURACY_ROLLS = 3;
const SLASH_DEFENCE_BONUS_INDEX = 1;

/**
 * Burning Barrage is a three-hit special that retries accuracy up to three
 * times. The core evaluator uses the successful-roll ranges to reproduce the
 * progressively lower total-damage windows: 75–175%, 50–150%, and 25–125%.
 * The burning proc scheduler is intentionally kept separate from this initial
 * attack script so it can share the game's generic delayed-damage pipeline.
 */
export class BurningClawsSpec implements WeaponSpecialAttackScript {
    readonly itemId = BURNING_CLAWS_ITEM_ID;
    readonly energyCost = BURNING_BARRAGE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 3,
            meleeDefenceBonusIndex: SLASH_DEFENCE_BONUS_INDEX,
            accuracyRollCount: BURNING_BARRAGE_ACCURACY_ROLLS,
            firstSuccessfulAccuracyDamageRanges: Object.freeze([
                Object.freeze({ minimumDamageMultiplier: 0.75, maximumDamageMultiplier: 1.75, hitDamageMultipliers: [0.25, 0.25, 0.5] }),
                Object.freeze({ minimumDamageMultiplier: 0.5, maximumDamageMultiplier: 1.5, hitDamageMultipliers: [0.5, 0.5, 0], hitDamageBonuses: [-1, -1, 2] }),
                Object.freeze({ minimumDamageMultiplier: 0.25, maximumDamageMultiplier: 1.25, hitDamageMultipliers: [0, 0, 1], hitDamageBonuses: [1, 1, -2] }),
            ]),
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

    onHitAppliedWithAttack(attacker: any, target: any, damageCalculated: number, currentMapClock: number, attack: CombatAttack): void {
        void damageCalculated;
        const attempt = Number(getWeaponSpecialAttackRuntimeMetadata(attack)?.firstSuccessfulAccuracyRoll ?? 0);
        const chance = attempt === 1 ? 0.15 : attempt === 2 ? 0.30 : attempt === 3 ? 0.45 : 0;
        if (chance <= 0 || Math.random() >= chance) return;
        // Burn stacks are capped at five per target; each scheduled stack deals 10 over 40 ticks.
        const active = burns.filter((burn) => burn.target === target).length;
        if (active >= 5) return;
        burns.push({ attacker, target, nextTick: Math.floor(currentMapClock) + 4, remaining: 10 });
    }
}

const burns: Array<{ attacker: any; target: any; nextTick: number; remaining: number }> = [];
export function takeDueBurningClawBurns(tick: number): readonly { attacker: any; target: any }[] {
    const due = burns.filter((burn) => burn.nextTick <= tick);
    for (const burn of due) {
        const index = burns.indexOf(burn);
        if (index >= 0) burns.splice(index, 1);
        if (burn.remaining > 1) {
            burns.push({ ...burn, nextTick: tick + 4, remaining: burn.remaining - 1 });
        }
    }
    return due;
}

export const BURNING_CLAWS_SPEC = Object.freeze(new BurningClawsSpec());
