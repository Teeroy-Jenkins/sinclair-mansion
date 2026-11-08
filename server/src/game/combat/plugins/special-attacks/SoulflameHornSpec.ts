import { PlayerState } from "../../../player";
import { NpcState } from "../../../npc";
import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const SOULFLAME_HORN_ITEM_ID = 30759;
const ENTICE_ENERGY_PER_PLAYER = 25;
const ENTICE_DURATION_TICKS = 10;
// The user occupies one 25% segment, leaving room for three nearby allies.
const ENTICE_MAXIMUM_ALLIES = 3;

const pendingEntices = new WeakMap<PlayerState, number>();

function eligibleAllies(
    source: PlayerState,
    candidates: readonly any[],
): readonly PlayerState[] {
    const allies: PlayerState[] = [];
    for (const candidate of candidates) {
        if (!(candidate instanceof PlayerState) || candidate === source) continue;
        if (candidate.level !== source.level) continue;
        if (candidate.skillSystem.getHitpointsCurrent() <= 0) continue;
        const distance = Math.max(
            Math.abs(candidate.tileX - source.tileX),
            Math.abs(candidate.tileY - source.tileY),
        );
        if (distance > 2) continue;
        allies.push(candidate);
        if (allies.length >= ENTICE_MAXIMUM_ALLIES) break;
    }
    return Object.freeze(allies);
}

/** Consumes Entice for the first melee accuracy roll before its expiry. */
export function consumeSoulflameHornEntice(
    player: PlayerState,
    attackType: AttackType,
    target: unknown,
    currentMapClock: number,
): boolean {
    const expiresAt = pendingEntices.get(player);
    if (expiresAt === undefined) return false;
    if (
        Math.floor(currentMapClock) > expiresAt ||
        attackType !== AttackType.Melee ||
        !(target instanceof NpcState)
    ) {
        if (Math.floor(currentMapClock) > expiresAt) pendingEntices.delete(player);
        return false;
    }
    pendingEntices.delete(player);
    return true;
}

/**
 * Entice is a utility special. It affects the user and up to three nearby
 * allies, spending one 25% energy segment for every affected player.
 */
export class SoulflameHornSpec implements WeaponSpecialAttackScript {
    readonly itemId = SOULFLAME_HORN_ITEM_ID;
    readonly energyCost = ENTICE_ENERGY_PER_PLAYER;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true });
    }

    resolveEnergyCost(
        attacker: any,
        target: any,
        currentMapClock: number,
        nearbyPlayers: readonly any[] = [],
    ): number {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return ENTICE_ENERGY_PER_PLAYER;
        return ENTICE_ENERGY_PER_PLAYER * (1 + eligibleAllies(attacker, nearbyPlayers).length);
    }

    onSpecialActivatedWithPlayers(
        attacker: any,
        target: any,
        currentMapClock: number,
        nearbyPlayers: readonly any[],
        attack: CombatAttack,
    ): boolean {
        void target;
        void attack;
        if (!(attacker instanceof PlayerState)) return false;

        const allies = eligibleAllies(attacker, nearbyPlayers);
        // Entice only grants its self-buff when it successfully rallies an ally.
        if (allies.length === 0) return false;

        const expiry = Math.floor(currentMapClock) + ENTICE_DURATION_TICKS;
        pendingEntices.set(attacker, expiry);
        for (const ally of allies) pendingEntices.set(ally, expiry);
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

export const SOULFLAME_HORN_SPEC = Object.freeze(new SoulflameHornSpec());
