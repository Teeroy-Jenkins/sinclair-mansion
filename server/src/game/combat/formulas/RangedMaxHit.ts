/**
 * Calculates the unmodified ranged max hit using RSMod's integer formula.
 *
 * floor((effectiveRanged * (rangedStrengthBonus + 64) + 320) / 640)
 */
export function calculateRangedMaxHit(
    effectiveRanged: number,
    rangedStrengthBonus: number,
): number {
    if (!Number.isFinite(effectiveRanged) || !Number.isFinite(rangedStrengthBonus)) {
        throw new RangeError("Ranged max-hit inputs must be finite numbers");
    }

    const effective = Math.trunc(effectiveRanged);
    const bonus = Math.trunc(rangedStrengthBonus);
    return Math.floor((effective * (bonus + 64) + 320) / 640);
}
