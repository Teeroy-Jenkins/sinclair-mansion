import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_SCIMITAR_ITEM_ID = 4587;
const SEVER_ENERGY_COST = 55;
const SEVER_ACCURACY_MULTIPLIER = 1.25;
const SEVER_PROTECTION_PRAYER_LOCK_TICKS = 8;

const PROTECTION_PRAYERS = new Set([
    "protect_from_magic",
    "protect_from_missiles",
    "protect_from_melee",
]);

/**
 * Sever consumes 55% special-attack energy and rolls against Slash defence
 * with 25% increased accuracy. A successful PvP hit turns off the target's
 * active protection prayer(s).
 *
 * OSRS prevents those prayers from being reactivated for eight ticks.
 */
export class DragonScimitarSpec implements WeaponSpecialAttackScript {
    readonly itemId = DRAGON_SCIMITAR_ITEM_ID;
    readonly energyCost = SEVER_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: SEVER_ACCURACY_MULTIPLIER,
        });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void attacker;
        void currentMapClock;
        if (Math.floor(damageCalculated) <= 0) return;
        if (!(target instanceof PlayerState)) return;

        const remainingPrayers = Array.from(target.prayer.getActivePrayers()).filter(
            (prayer) => !PROTECTION_PRAYERS.has(prayer),
        );
        target.prayer.lockProtectionPrayers(SEVER_PROTECTION_PRAYER_LOCK_TICKS);
        target.prayer.setActivePrayers(remainingPrayers);
    }
}

export const DRAGON_SCIMITAR_SPEC = Object.freeze(new DragonScimitarSpec());
