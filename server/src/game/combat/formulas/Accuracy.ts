export const HIT_CHANCE_SCALE = 10_000;

function combatInteger(value: number): number {
    if (!Number.isFinite(value)) {
        throw new RangeError(`Combat formula input must be finite; received ${value}`);
    }
    return Math.trunc(value);
}

/** attackRoll = effectiveAttack * (attackBonus + 64) */
export function calculateAttackRoll(effectiveAttack: number, attackBonus: number): number {
    const effective = combatInteger(effectiveAttack);
    const bonus = combatInteger(attackBonus);
    return effective * (bonus + 64);
}

/** defenceRoll = effectiveDefence * (defenceBonus + 64) */
export function calculateDefenceRoll(effectiveDefence: number, defenceBonus: number): number {
    const effective = combatInteger(effectiveDefence);
    const bonus = combatInteger(defenceBonus);
    return effective * (bonus + 64);
}

function standardHitChance(attack: number, defence: number): number {
    if (attack > defence) {
        return 1 - (defence + 2) / (2 * (attack + 1));
    }
    return attack / (2 * (defence + 1));
}

/**
 * Calculates RSMod's scaled OSRS hit chance, including negative-roll cases.
 *
 * The result is rounded to the nearest integer exactly like Kotlin's
 * `roundToInt` for this non-negative probability, yielding a value on the
 * 0..10,000 scale.
 */
export function calculateHitChance(attackRoll: number, defenceRoll: number): number {
    let attack = combatInteger(attackRoll);
    let defence = combatInteger(defenceRoll);

    if (attack < 0) {
        attack = Math.min(0, attack + 2);
    }

    if (defence < 0) {
        defence = Math.min(0, defence + 2);
    }

    let result: number;
    if (attack >= 0 && defence >= 0) {
        result = standardHitChance(attack, defence);
    } else if (attack >= 0 && defence < 0) {
        result = 1 - 1 / (-defence + 1) / (attack + 1);
    } else if (attack < 0 && defence >= 0) {
        result = 0;
    } else {
        result = standardHitChance(-defence, -attack);
    }

    return Math.round(result * HIT_CHANCE_SCALE);
}

/** RSMod succeeds only when hitChance is strictly greater than the random roll. */
export function isSuccessfulHit(hitChance: number, randomRoll: number): boolean {
    const chance = combatInteger(hitChance);
    const roll = combatInteger(randomRoll);
    if (roll < 0 || roll >= HIT_CHANCE_SCALE) {
        throw new RangeError(
            `Accuracy roll must be in [0, ${HIT_CHANCE_SCALE}); received ${randomRoll}`,
        );
    }
    return chance > roll;
}

/** Rolls against a random source that returns a floating-point value in [0, 1). */
export function rollAccuracy(hitChance: number, random: () => number = Math.random): boolean {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new RangeError(
            `Accuracy random source must return a value in [0, 1); received ${sample}`,
        );
    }
    const randomRoll = Math.floor(sample * HIT_CHANCE_SCALE);
    return isSuccessfulHit(hitChance, randomRoll);
}
