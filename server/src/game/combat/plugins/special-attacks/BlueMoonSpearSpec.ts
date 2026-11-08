import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import { CombatAttributes } from "../../state/CombatAttributes";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    getWeaponSpecialAttackTarget,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const BLUE_MOON_SPEAR_ITEM_IDS = Object.freeze([28988, 29849]);
const BREAK_SHACKLES_ENERGY_COST = 50;
const BREAK_SHACKLES_BONUS_PER_BIND_TICK = 0.015;
const BREAK_SHACKLES_DAMAGE_BONUS_CAP = 1.125;
const BREAK_SHACKLES_DAMAGE_TICK_CAP = Math.floor(
    BREAK_SHACKLES_DAMAGE_BONUS_CAP / BREAK_SHACKLES_BONUS_PER_BIND_TICK,
);
const CRUSH_BONUS_INDEX = 2;

const BLUE_MOON_HELM_IDS = new Set([29019, 29041, 29064, 29845]);
const BLUE_MOON_BODY_IDS = new Set([29013, 29037, 29058, 29843]);
const BLUE_MOON_LEGS_IDS = new Set([29016, 29039, 29061, 29844]);

/**
 * Break Shackles consumes a target's legitimate active freeze/bind. Its damage
 * multiplier caps after 75 ticks (+112.5%); accuracy intentionally does not.
 */
export class BlueMoonSpearSpec implements WeaponSpecialAttackScript {
    readonly energyCost = BREAK_SHACKLES_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        const target = getWeaponSpecialAttackTarget(attack);
        const bindingTicks = getBindingTicksRemaining(target, attack.attackClock);
        const accuracyMultiplier = 1 + bindingTicks * BREAK_SHACKLES_BONUS_PER_BIND_TICK;
        const damageMultiplier =
            1 +
            Math.min(bindingTicks, BREAK_SHACKLES_DAMAGE_TICK_CAP) *
                BREAK_SHACKLES_BONUS_PER_BIND_TICK;

        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier,
            damageMultiplier,
            // Break Shackles uses the Blue moon spear's Fend (crush) attack.
            meleeAttackBonusIndex: CRUSH_BONUS_INDEX,
        });
    }

    onSpecialActivated(
        attacker: any,
        target: any,
        currentMapClock: number,
    ): boolean | void {
        void target;
        void currentMapClock;
        return attacker instanceof PlayerState && hasFullBlueMoonArmour(attacker);
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
        if (target instanceof PlayerState || target instanceof NpcState) {
            target.clearFreeze();
        }
    }
}

export const BLUE_MOON_SPEAR_SPECS = Object.freeze(
    BLUE_MOON_SPEAR_ITEM_IDS.map((itemId) => Object.freeze(new BlueMoonSpearSpec(itemId))),
);

export const BLUE_MOON_SPEAR_SPEC = BLUE_MOON_SPEAR_SPECS[0];

function hasFullBlueMoonArmour(player: PlayerState): boolean {
    const equipment = player.appearance.equip;
    return (
        BLUE_MOON_HELM_IDS.has(equipment[EquipmentSlot.HEAD] ?? -1) &&
        BLUE_MOON_BODY_IDS.has(equipment[EquipmentSlot.BODY] ?? -1) &&
        BLUE_MOON_LEGS_IDS.has(equipment[EquipmentSlot.LEGS] ?? -1)
    );
}

function getBindingTicksRemaining(target: unknown, currentMapClock: number): number {
    if (!(target instanceof PlayerState) && !(target instanceof NpcState)) return 0;
    const freezeUntil = target.combatAttributes.get(CombatAttributes.FREEZE_UNTIL_CLOCK);
    return Math.max(0, Math.floor(freezeUntil) - Math.floor(currentMapClock));
}
