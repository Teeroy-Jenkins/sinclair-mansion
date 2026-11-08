/** Ticks before standard aggressive NPCs become tolerant of a player. */
export const AGGRESSION_TIMER_TICKS = 1000;

/** Ticks between NPC target searches. */
export const TARGET_SEARCH_INTERVAL = 5;

/** Chebyshev radius used by OSRS tolerance-region resets. */
export const TOLERANCE_REGION_RADIUS = 10;

/** Player state for the two-anchor OSRS aggression tolerance region. */
export interface PlayerAggressionState {
    entryTick: number;
    aggressionExpired: boolean;
    tile1: { x: number; y: number };
    tile2: { x: number; y: number };
}

/** Applies the standard outside-Wilderness combat-level aggression gate. */
export function isPlayerSafeFromStandardNpcAggression(
    playerCombatLevel: number,
    npcCombatLevel: number,
): boolean {
    const npcLevel = Math.max(0, npcCombatLevel | 0);
    const playerLevel = Math.max(0, playerCombatLevel | 0);
    return npcLevel < 63 && playerLevel > npcLevel * 2;
}

export function createAggressionState(
    entryTick: number,
    x: number,
    y: number,
): PlayerAggressionState {
    return {
        entryTick,
        aggressionExpired: false,
        tile1: { x, y },
        tile2: { x, y },
    };
}

export function updateAggressionStateWithPosition(
    state: PlayerAggressionState,
    currentTick: number,
    playerX: number,
    playerY: number,
    aggressiveTimer: number = AGGRESSION_TIMER_TICKS,
    neverTolerant: boolean = false,
): PlayerAggressionState {
    if (neverTolerant) return state;

    const distanceFromFirst = chebyshevDistance(
        playerX,
        playerY,
        state.tile1.x,
        state.tile1.y,
    );
    const distanceFromSecond = chebyshevDistance(
        playerX,
        playerY,
        state.tile2.x,
        state.tile2.y,
    );
    const leftToleranceRegion =
        distanceFromFirst > TOLERANCE_REGION_RADIUS &&
        distanceFromSecond > TOLERANCE_REGION_RADIUS;

    if (leftToleranceRegion) {
        return {
            entryTick: currentTick,
            aggressionExpired: false,
            tile1: { ...state.tile2 },
            tile2: { x: playerX, y: playerY },
        };
    }
    if (!state.aggressionExpired && currentTick - state.entryTick >= aggressiveTimer) {
        return { ...state, aggressionExpired: true };
    }
    return state;
}

function chebyshevDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}
