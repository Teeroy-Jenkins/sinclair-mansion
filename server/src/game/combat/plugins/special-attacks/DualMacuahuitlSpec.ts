import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DUAL_MACUAHUITL_ITEM_IDS = Object.freeze([28997, 29850]);
const BLOOD_INFUSION_ENERGY_COST = 25;
const BLOOD_INFUSION_MINIMUM_DAMAGE_MULTIPLIER = 0.25;
const BLOOD_INFUSION_MAXIMUM_DAMAGE_MULTIPLIER = 1.25;
const BLOOD_INFUSION_SELF_DAMAGE_FRACTION = 0.25;
const DUAL_HIT_COUNT = 2;
const DUAL_HIT_DELAYS = Object.freeze([0, 1]);

const BLOOD_MOON_HELM_IDS = new Set([29028, 29047, 29073, 29848]);
const BLOOD_MOON_BODY_IDS = new Set([29022, 29043, 29067, 29846]);
const BLOOD_MOON_LEGS_IDS = new Set([29025, 29045, 29070, 29847]);

/**
 * Blood Infusion requires the full Blood moon set. It replaces the dual
 * macuahuitl's normal sequential accuracy checks with two guaranteed hits,
 * raises their combined minimum and maximum damage, and costs the attacker a
 * quarter of current Hitpoints even when both hits roll zero damage.
 */
export class DualMacuahuitlSpec implements WeaponSpecialAttackScript {
    readonly energyCost = BLOOD_INFUSION_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: DUAL_HIT_COUNT,
            maximumHitSplitCount: DUAL_HIT_COUNT,
            hitDelayTicks: DUAL_HIT_DELAYS,
            guaranteedHit: true,
            minimumDamageMultiplier: BLOOD_INFUSION_MINIMUM_DAMAGE_MULTIPLIER,
            maximumDamageMultiplier: BLOOD_INFUSION_MAXIMUM_DAMAGE_MULTIPLIER,
        });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): boolean {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState) || !hasFullBloodMoonArmour(attacker)) return false;

        const currentHitpoints = attacker.skillSystem.getHitpointsCurrent();
        const selfDamage = Math.floor(
            Math.max(0, currentHitpoints) * BLOOD_INFUSION_SELF_DAMAGE_FRACTION,
        );
        if (selfDamage > 0) attacker.skillSystem.applyHitpointsDamage(selfDamage);
        return true;
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

export const DUAL_MACUAHUITL_SPECS = Object.freeze(
    DUAL_MACUAHUITL_ITEM_IDS.map((itemId) => Object.freeze(new DualMacuahuitlSpec(itemId))),
);

export const DUAL_MACUAHUITL_SPEC = DUAL_MACUAHUITL_SPECS[0];

function hasFullBloodMoonArmour(player: PlayerState): boolean {
    const equipment = player.appearance.equip;
    return (
        BLOOD_MOON_HELM_IDS.has(equipment[EquipmentSlot.HEAD] ?? -1) &&
        BLOOD_MOON_BODY_IDS.has(equipment[EquipmentSlot.BODY] ?? -1) &&
        BLOOD_MOON_LEGS_IDS.has(equipment[EquipmentSlot.LEGS] ?? -1)
    );
}
