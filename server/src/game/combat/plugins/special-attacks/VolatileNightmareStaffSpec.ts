import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackMaximumHitSource,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const VOLATILE_NIGHTMARE_STAFF_ITEM_IDS = Object.freeze([
    24424, // Volatile nightmare staff
    25517, // Volatile nightmare staff (Last Man Standing)
    29602, // Corrupted volatile nightmare staff (Deadman)
    29609, // Volatile nightmare staff (Deadman)
]);

const IMMOLATE_ENERGY_COST = 55;
const IMMOLATE_ACCURACY_MULTIPLIER = 1.5;
const IMMOLATE_BASE_MAX_HIT = 58;

/**
 * OSRS Volatile nightmare staff special attack, Immolate. It is a rune-free
 * magic attack with 50% extra accuracy. Its base maximum hit scales from the
 * player's visible Magic level and caps at 58 before magic-damage bonuses.
 */
export class VolatileNightmareStaffSpec implements WeaponSpecialAttackScript {
    readonly energyCost = IMMOLATE_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: IMMOLATE_ACCURACY_MULTIPLIER,
            damageMultiplier: 1,
            rollAttackType: AttackType.Magic,
            damageType: AttackType.Magic,
            maximumHitSource: SpecialAttackMaximumHitSource.VisibleMagic,
            visibleMagicMaximumHit: IMMOLATE_BASE_MAX_HIT,
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

export const VOLATILE_NIGHTMARE_STAFF_SPECS = Object.freeze(
    VOLATILE_NIGHTMARE_STAFF_ITEM_IDS.map((itemId) =>
        Object.freeze(new VolatileNightmareStaffSpec(itemId)),
    ),
);

export const VOLATILE_NIGHTMARE_STAFF_SPEC = VOLATILE_NIGHTMARE_STAFF_SPECS[0];
