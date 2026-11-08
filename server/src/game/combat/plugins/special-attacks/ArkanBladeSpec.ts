import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type CombatEntityRef,
    npcCombatEntityRef,
    playerCombatEntityRef,
} from "../../model/CombatEntityRef";
import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ARKAN_BLADE_ITEM_ID = 30955;
const FLAMES_OF_RALOS_ENERGY_COST = 30;
const FLAMES_OF_RALOS_MULTIPLIER = 1.5;
const FLAMES_OF_RALOS_TOTAL_DAMAGE = 10;
const FLAMES_OF_RALOS_TICK_INTERVAL = 4;

export const ARKAN_BLADE_BURN_PROFILE_ID = "core:arkan_blade_burn";

export interface ArkanBladeBurn {
    readonly attacker: PlayerState;
    readonly target: PlayerState | NpcState;
    readonly resolveAtMapClock: number;
    readonly remainingDamage: number;
}

const pendingBurns: ArkanBladeBurn[] = [];

/**
 * Returns every burn tick due now and reschedules each independent stack until
 * it has dealt all ten damage. Separate special hits create separate stacks.
 */
export function takeDueArkanBladeBurns(currentMapClock: number): readonly ArkanBladeBurn[] {
    const clock = Math.floor(currentMapClock);
    const due: ArkanBladeBurn[] = [];
    for (let index = pendingBurns.length - 1; index >= 0; index--) {
        const burn = pendingBurns[index];
        if (burn.resolveAtMapClock > clock) continue;

        pendingBurns.splice(index, 1);
        due.push(burn);
        if (burn.remainingDamage > 1) {
            pendingBurns.push(
                Object.freeze({
                    ...burn,
                    resolveAtMapClock: clock + FLAMES_OF_RALOS_TICK_INTERVAL,
                    remainingDamage: burn.remainingDamage - 1,
                }),
            );
        }
    }
    return Object.freeze(due.reverse());
}

/** Consumes all remaining Arkan-blade burn damage on one target. */
export function consumeRemainingArkanBladeBurnDamage(target: PlayerState | NpcState): number {
    let remainingDamage = 0;
    for (let index = pendingBurns.length - 1; index >= 0; index--) {
        const burn = pendingBurns[index];
        if (burn.target !== target) continue;
        remainingDamage += Math.max(0, Math.floor(burn.remainingDamage));
        pendingBurns.splice(index, 1);
    }
    return remainingDamage;
}

export function createArkanBladeBurnAttack(
    attacker: PlayerState,
    target: PlayerState | NpcState,
    currentMapClock: number,
): CombatAttack {
    return Object.freeze({
        attacker: playerCombatEntityRef(attacker.id),
        target: entityReference(target),
        attackClock: Math.floor(currentMapClock),
        traits: Object.freeze({
            type: AttackType.Magic,
            style: null,
            rangeTiles: 0,
            speedTicks: 0,
            specialAttack: false,
        }),
    });
}

export class ArkanBladeSpec implements WeaponSpecialAttackScript {
    readonly itemId = ARKAN_BLADE_ITEM_ID;
    readonly energyCost = FLAMES_OF_RALOS_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: FLAMES_OF_RALOS_MULTIPLIER,
            damageMultiplier: FLAMES_OF_RALOS_MULTIPLIER,
        });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        if (!(attacker instanceof PlayerState)) return;
        if (!(target instanceof PlayerState) && !(target instanceof NpcState)) return;
        if (Math.floor(damageCalculated) <= 0) return;

        pendingBurns.push(
            Object.freeze({
                attacker,
                target,
                resolveAtMapClock: Math.floor(currentMapClock) + FLAMES_OF_RALOS_TICK_INTERVAL,
                remainingDamage: FLAMES_OF_RALOS_TOTAL_DAMAGE,
            }),
        );
    }
}

export const ARKAN_BLADE_SPEC = Object.freeze(new ArkanBladeSpec());

function entityReference(entity: PlayerState | NpcState): CombatEntityRef {
    return entity instanceof PlayerState
        ? playerCombatEntityRef(entity.id)
        : npcCombatEntityRef(entity.id);
}
