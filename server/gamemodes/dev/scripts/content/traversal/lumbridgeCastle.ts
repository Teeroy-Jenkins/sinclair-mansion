/**
 * Lumbridge Castle spiral stair exceptions (LostCity spiralstairs*).
 * Middle floors need both climb-up and climb-down from the same tile.
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

export const LUMBRIDGE_CASTLE_OVERRIDES: readonly TraversalOverride[] = [
    // South spiral — ground ↔ 1
    pair(
        fromZone(0, 50, 50, 4, 7),
        fromZone(1, 50, 50, 5, 9),
        "climb-up",
        "Lumbridge Castle South ground → 1",
    ),
    pair(
        fromZone(1, 50, 50, 4, 7),
        fromZone(0, 50, 50, 5, 9),
        "climb-down",
        "Lumbridge Castle South 1 → ground",
    ),
    // South spiral — 1 ↔ 2
    pair(
        fromZone(1, 50, 50, 4, 7),
        fromZone(2, 50, 50, 5, 9),
        "climb-up",
        "Lumbridge Castle South 1 → 2",
    ),
    pair(
        fromZone(2, 50, 50, 5, 8),
        fromZone(1, 50, 50, 5, 9),
        "climb-down",
        "Lumbridge Castle South 2 → 1",
    ),
    // North spiral — ground ↔ 1
    pair(
        fromZone(0, 50, 50, 4, 29),
        fromZone(1, 50, 50, 5, 28),
        "climb-up",
        "Lumbridge Castle North ground → 1",
    ),
    pair(
        fromZone(1, 50, 50, 4, 29),
        fromZone(0, 50, 50, 5, 28),
        "climb-down",
        "Lumbridge Castle North 1 → ground",
    ),
    // North spiral — 1 ↔ 2
    pair(
        fromZone(1, 50, 50, 4, 29),
        fromZone(2, 50, 50, 6, 29),
        "climb-up",
        "Lumbridge Castle North 1 → 2",
    ),
    pair(
        fromZone(2, 50, 50, 5, 29),
        fromZone(1, 50, 50, 5, 28),
        "climb-down",
        "Lumbridge Castle North 2 → 1",
    ),
];
