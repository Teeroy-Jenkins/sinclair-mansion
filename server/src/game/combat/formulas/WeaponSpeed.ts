/** RSMod's `combat_default_attackrate`, used when no weapon is equipped. */
export const DEFAULT_WEAPON_ATTACK_RATE = 4;

function normalizeAttackRate(attackRate: number, label: string): number {
    if (!Number.isFinite(attackRate)) {
        throw new RangeError(`${label} must be finite; received ${attackRate}`);
    }
    return Math.trunc(attackRate);
}

/**
 * Resolves the equipped object's `attackrate` parameter.
 *
 * A missing value represents an unarmed player or a cache definition using
 * the default parameter value.
 */
export function baseWeaponSpeed(
    attackRate: number | null | undefined,
    defaultAttackRate: number = DEFAULT_WEAPON_ATTACK_RATE,
): number {
    const fallback = normalizeAttackRate(defaultAttackRate, "Default weapon attack rate");
    return attackRate == null
        ? fallback
        : normalizeAttackRate(attackRate, "Weapon attackrate parameter");
}

/**
 * Applies attack-style speed changes to a weapon's base `attackrate` value.
 * RSMod only reduces the rate for Rapid ranged style and clamps it to one tick.
 */
export function actualWeaponSpeed(
    attackRate: number | null | undefined,
    rapidRanged: boolean = false,
    defaultAttackRate: number = DEFAULT_WEAPON_ATTACK_RATE,
): number {
    const baseSpeed = baseWeaponSpeed(attackRate, defaultAttackRate);
    return rapidRanged ? Math.max(1, baseSpeed - 1) : baseSpeed;
}
