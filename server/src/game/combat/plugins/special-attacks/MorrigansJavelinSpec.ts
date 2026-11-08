import { PlayerState } from "../../../player";
import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import { playerCombatEntityRef } from "../../model/CombatEntityRef";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const MORRIGANS_JAVELIN_ITEM_IDS = Object.freeze([
    22636, // Deadman Mode
    23619, // Last Man Standing
    27916, // Bounty Hunter
]);
const PHANTOM_STRIKE_ENERGY_COST = 50;
const PHANTOM_STRIKE_ACCURACY_MULTIPLIER = 1.5;
const PHANTOM_STRIKE_BLEED_FRACTION = 0.75;
const PHANTOM_STRIKE_BLEED_DAMAGE = 10;
const PHANTOM_STRIKE_INTERVAL_TICKS = 1;

export const MORRIGANS_JAVELIN_BLEED_PROFILE_ID = "core:morrigans_javelin_bleed";

export interface MorrigansJavelinBleed {
    readonly attacker: PlayerState;
    readonly target: PlayerState;
    readonly resolveAtMapClock: number;
    readonly remainingDamage: number;
}

const pendingBleeds: MorrigansJavelinBleed[] = [];

/** Returns each Phantom Strike bleed hitsplat due on this map tick. */
export function takeDueMorrigansJavelinBleeds(
    currentMapClock: number,
): readonly MorrigansJavelinBleed[] {
    const clock = Math.floor(currentMapClock);
    const due: MorrigansJavelinBleed[] = [];
    for (let index = pendingBleeds.length - 1; index >= 0; index--) {
        const bleed = pendingBleeds[index];
        if (bleed.resolveAtMapClock > clock) continue;

        pendingBleeds.splice(index, 1);
        due.push(bleed);
        const remainingDamage = bleed.remainingDamage - PHANTOM_STRIKE_BLEED_DAMAGE;
        if (remainingDamage > 0) {
            pendingBleeds.push(
                Object.freeze({
                    ...bleed,
                    resolveAtMapClock: clock + PHANTOM_STRIKE_INTERVAL_TICKS,
                    remainingDamage,
                }),
            );
        }
    }
    return Object.freeze(due.reverse());
}

export function createMorrigansJavelinBleedAttack(
    attacker: PlayerState,
    target: PlayerState,
    currentMapClock: number,
): CombatAttack {
    return Object.freeze({
        attacker: playerCombatEntityRef(attacker.id),
        target: playerCombatEntityRef(target.id),
        attackClock: Math.floor(currentMapClock),
        traits: Object.freeze({
            type: AttackType.Ranged,
            style: null,
            rangeTiles: 0,
            speedTicks: 0,
            specialAttack: false,
        }),
    });
}

export function getMorrigansJavelinBleedDamage(bleed: MorrigansJavelinBleed): number {
    return Math.min(PHANTOM_STRIKE_BLEED_DAMAGE, Math.max(0, Math.floor(bleed.remainingDamage)));
}

/**
 * Phantom Strike is a normal-damage ranged attack with 150% accuracy. A
 * damaging player-versus-player hit subsequently bleeds for 75% of that hit,
 * in ten-damage hitsplats every game tick. It deliberately does nothing to NPCs.
 */
export class MorrigansJavelinSpec implements WeaponSpecialAttackScript {
    readonly energyCost = PHANTOM_STRIKE_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: PHANTOM_STRIKE_ACCURACY_MULTIPLIER,
            damageMultiplier: 1,
            rollAttackType: AttackType.Ranged,
            damageType: AttackType.Ranged,
        });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        if (!(attacker instanceof PlayerState) || !(target instanceof PlayerState)) return;

        const totalBleedDamage = Math.floor(
            Math.max(0, Math.floor(damageCalculated)) * PHANTOM_STRIKE_BLEED_FRACTION,
        );
        if (totalBleedDamage <= 0) return;

        pendingBleeds.push(
            Object.freeze({
                attacker,
                target,
                resolveAtMapClock: Math.floor(currentMapClock) + PHANTOM_STRIKE_INTERVAL_TICKS,
                remainingDamage: totalBleedDamage,
            }),
        );
    }
}

export const MORRIGANS_JAVELIN_SPECS = Object.freeze(
    MORRIGANS_JAVELIN_ITEM_IDS.map((itemId) => Object.freeze(new MorrigansJavelinSpec(itemId))),
);

export const MORRIGANS_JAVELIN_SPEC = MORRIGANS_JAVELIN_SPECS[0];
