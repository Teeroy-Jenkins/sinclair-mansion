/**
 * Cellar / underground stair exceptions from LostCity stairs_cellar + loc_1734.
 * Zone coords converted to absolute tiles. Verify IDs/layout against current cache.
 */
import { fromZone, type TilePos } from "./coords";
import type { TraversalOverride } from "./types";

function pair(
    from: TilePos,
    to: TilePos,
    action: TraversalOverride["action"],
    note: string,
): TraversalOverride {
    return { from, to, action, animate: true, note };
}

/** Down into cellars / dungeons. */
export const CELLAR_DOWN: readonly TraversalOverride[] = [
    pair(
        fromZone(0, 49, 53, 51, 41),
        fromZone(0, 49, 153, 54, 41),
        "climb-down",
        "Varrock West Bank cellar",
    ),
    pair(
        fromZone(0, 42, 52, 36, 46),
        fromZone(0, 42, 152, 39, 46),
        "climb-down",
        "Legends Guild dungeon",
    ),
    pair(
        fromZone(0, 40, 48, 43, 6),
        fromZone(0, 40, 148, 41, 6),
        "climb-down",
        "Yanille town dungeon",
    ),
    pair(
        fromZone(0, 40, 48, 9, 50),
        fromZone(0, 40, 148, 9, 53),
        "climb-down",
        "Yanille outer dungeon",
    ),
    pair(
        fromZone(0, 47, 52, 51, 48),
        fromZone(0, 47, 152, 50, 48),
        "climb-down",
        "Falador mining guild stairs",
    ),
    pair(
        fromZone(0, 47, 61, 36, 20),
        fromZone(0, 47, 161, 37, 19),
        "climb-down",
        "Wilderness dungeon stairs",
    ),
];

/** Matching climb-ups from cellar floors. */
export const CELLAR_UP: readonly TraversalOverride[] = [
    pair(
        fromZone(0, 49, 153, 51, 41),
        fromZone(0, 49, 53, 50, 41),
        "climb-up",
        "Varrock West Bank from cellar",
    ),
    pair(
        fromZone(0, 42, 152, 36, 46),
        fromZone(0, 42, 52, 35, 46),
        "climb-up",
        "Legends Guild from dungeon",
    ),
    pair(
        fromZone(0, 40, 148, 43, 6),
        fromZone(0, 40, 48, 46, 6),
        "climb-up",
        "Yanille from town dungeon",
    ),
    pair(
        fromZone(0, 40, 148, 9, 50),
        fromZone(0, 40, 48, 9, 49),
        "climb-up",
        "Yanille from outer dungeon",
    ),
    pair(
        fromZone(0, 47, 152, 51, 48),
        fromZone(0, 47, 52, 54, 48),
        "climb-up",
        "Falador from mining guild",
    ),
    pair(
        fromZone(0, 47, 161, 36, 20),
        fromZone(0, 47, 61, 37, 23),
        "climb-up",
        "Wilderness from dungeon",
    ),
];
