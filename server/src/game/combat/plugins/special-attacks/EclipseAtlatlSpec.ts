import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    consumeRemainingArkanBladeBurnDamage,
} from "./ArkanBladeSpec";
import {
    SpecialAttackMaximumHitSource,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ECLIPSE_ATLATL_ITEM_IDS = Object.freeze([29000, 29851]);
const ECLIPSE_ENERGY_COST = 50;
const ECLIPSE_ACCURACY_MULTIPLIER = 1.5;
const ECLIPSE_BURN_DAMAGE_CAP = 50;

const ECLIPSE_MOON_HELM_IDS = new Set([29010]);
const ECLIPSE_MOON_BODY_IDS = new Set([29004]);
const ECLIPSE_MOON_LEGS_IDS = new Set([29007]);

/**
 * Eclipse is a melee-range Magic strike that uses the atlatl's physical
 * Strength-derived damage. It needs the full Eclipse moon set and turns a
 * target's remaining registered burn damage into a capped damage bonus.
 */
export class EclipseAtlatlSpec implements WeaponSpecialAttackScript {
    readonly energyCost = ECLIPSE_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: ECLIPSE_ACCURACY_MULTIPLIER,
            rollAttackType: AttackType.Magic,
            damageType: AttackType.Magic,
            maximumHitSource: SpecialAttackMaximumHitSource.PhysicalMelee,
        });
    }

    onSpecialActivated(
        attacker: any,
        target: any,
        currentMapClock: number,
        attack: CombatAttack,
    ): boolean {
        void currentMapClock;
        if (!(attacker instanceof PlayerState) || !hasFullEclipseMoonArmour(attacker)) return false;
        if (!(target instanceof PlayerState) && !(target instanceof NpcState)) return false;

        const remainingBurnDamage = Math.min(
            ECLIPSE_BURN_DAMAGE_CAP,
            consumeRemainingArkanBladeBurnDamage(target),
        );
        setWeaponSpecialAttackTraitOverrides(attack, {
            minimumDamageBonus: Math.floor(remainingBurnDamage / 2),
            maximumDamageBonus: remainingBurnDamage,
        });
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

export const ECLIPSE_ATLATL_SPECS = Object.freeze(
    ECLIPSE_ATLATL_ITEM_IDS.map((itemId) => Object.freeze(new EclipseAtlatlSpec(itemId))),
);

export const ECLIPSE_ATLATL_SPEC = ECLIPSE_ATLATL_SPECS[0];

function hasFullEclipseMoonArmour(player: PlayerState): boolean {
    const equipment = player.appearance.equip;
    return (
        ECLIPSE_MOON_HELM_IDS.has(equipment[EquipmentSlot.HEAD] ?? -1) &&
        ECLIPSE_MOON_BODY_IDS.has(equipment[EquipmentSlot.BODY] ?? -1) &&
        ECLIPSE_MOON_LEGS_IDS.has(equipment[EquipmentSlot.LEGS] ?? -1)
    );
}
