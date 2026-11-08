/**
 * Calculates the unmodified melee max hit using RSMod's integer formula.
 *
 * floor((effectiveStrength * (strengthBonus + 64) + 320) / 640)
 */
export function calculateMeleeMaxHit(effectiveStrength: number, strengthBonus: number): number {
    if (!Number.isFinite(effectiveStrength) || !Number.isFinite(strengthBonus)) {
        throw new RangeError("Melee max-hit inputs must be finite numbers");
    }

    const effective = Math.trunc(effectiveStrength);
    const bonus = Math.trunc(strengthBonus);
    return Math.floor((effective * (bonus + 64) + 320) / 640);
}
