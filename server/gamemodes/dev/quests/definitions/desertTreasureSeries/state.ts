import type { PlayerState } from "../../../../../src/game/player";

export type BossKind = "fire-warrior" | "damis-1" | "damis-2" | "dessous" | "kamil" | "fareed";

export interface TrackedBoss {
    player: PlayerState;
    kind: BossKind;
}

export const trackedBosses = new Map<number, TrackedBoss>();
export const activeBosses = new Set<string>();
export const knownPlayers = new Map<number, PlayerState>();

export function bossKey(playerId: number, kind: BossKind): string {
    return `${playerId}:${kind}`;
}

export function trackPlayer(player: PlayerState): void {
    knownPlayers.set(player.id, player);
}
