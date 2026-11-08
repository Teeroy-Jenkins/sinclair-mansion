/**
 * RSMod-parity elemental combat spell max-hit scaling.
 *
 * Casting a lower-tier strike/bolt/blast/wave/surge uses the max hit of the
 * highest spell in that family unlocked by the caster's Magic level.
 *
 * @see rsmod ElementalSpells.kt
 */

const STRIKE_IDS = new Set([3273, 3275, 3277, 3279]);
const BOLT_IDS = new Set([3281, 3285, 3288, 3291]);
const BLAST_IDS = new Set([3294, 3297, 3302, 3307]);
const WAVE_IDS = new Set([3313, 3315, 3319, 3321]);
const SURGE_IDS = new Set([21876, 21877, 21878, 21879]);

function scaleByThresholds(magicLevel: number, tiers: ReadonlyArray<[number, number]>): number {
    for (const [requiredLevel, maxHit] of tiers) {
        if (magicLevel >= requiredLevel) {
            return maxHit;
        }
    }
    return tiers[tiers.length - 1]?.[1] ?? 0;
}

/**
 * Resolve the combat max hit for a standard elemental spell.
 * Returns `fallbackBase` when the spell is not in a scaled family.
 */
export function resolveElementalSpellBaseMaxHit(
    spellId: number,
    magicLevel: number,
    fallbackBase: number,
): number {
    const level = Math.max(0, magicLevel | 0);
    if (STRIKE_IDS.has(spellId)) {
        return scaleByThresholds(level, [
            [13, 8],
            [9, 6],
            [5, 4],
            [0, 2],
        ]);
    }
    if (BOLT_IDS.has(spellId)) {
        return scaleByThresholds(level, [
            [35, 12],
            [29, 11],
            [23, 10],
            [0, 9],
        ]);
    }
    if (BLAST_IDS.has(spellId)) {
        return scaleByThresholds(level, [
            [59, 16],
            [53, 15],
            [47, 14],
            [0, 13],
        ]);
    }
    if (WAVE_IDS.has(spellId)) {
        return scaleByThresholds(level, [
            [75, 20],
            [70, 19],
            [65, 18],
            [0, 17],
        ]);
    }
    if (SURGE_IDS.has(spellId)) {
        return scaleByThresholds(level, [
            [95, 24],
            [90, 23],
            [85, 22],
            [0, 21],
        ]);
    }
    return Math.max(0, fallbackBase | 0);
}
