/**
 * Varrock hub stair exceptions (East Bank + common palace/church spirals).
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

export const VARROCK_HUB_OVERRIDES: readonly TraversalOverride[] = [
    // East Bank
    pair(
        fromZone(0, 50, 53, 55, 29),
        fromZone(1, 50, 53, 55, 28),
        "climb-up",
        "Varrock East Bank ground → 1",
    ),
    pair(
        fromZone(1, 50, 53, 55, 29),
        fromZone(0, 50, 53, 54, 29),
        "climb-down",
        "Varrock East Bank 1 → ground",
    ),
    // Palace NW tower (middle has both directions)
    pair(
        fromZone(0, 50, 54, 2, 41),
        fromZone(1, 50, 54, 3, 40),
        "climb-up",
        "Varrock Palace NW tower ground → 1",
    ),
    pair(
        fromZone(1, 50, 54, 2, 41),
        fromZone(2, 50, 54, 4, 41),
        "climb-up",
        "Varrock Palace NW tower 1 → 2",
    ),
    pair(
        fromZone(1, 50, 54, 2, 41),
        fromZone(0, 50, 54, 3, 40),
        "climb-down",
        "Varrock Palace NW tower 1 → ground",
    ),
    pair(
        fromZone(2, 50, 54, 3, 41),
        fromZone(1, 50, 54, 3, 40),
        "climb-down",
        "Varrock Palace NW tower 2 → 1",
    ),
    // Church (middle floors both ways)
    pair(
        fromZone(0, 50, 54, 58, 31),
        fromZone(1, 50, 54, 58, 30),
        "climb-up",
        "Varrock church ground → 1",
    ),
    pair(
        fromZone(1, 50, 54, 58, 31),
        fromZone(2, 50, 54, 58, 30),
        "climb-up",
        "Varrock church 1 → 2",
    ),
    pair(
        fromZone(1, 50, 54, 58, 31),
        fromZone(0, 50, 54, 58, 30),
        "climb-down",
        "Varrock church 1 → ground",
    ),
    pair(
        fromZone(2, 50, 54, 58, 31),
        fromZone(3, 50, 54, 58, 30),
        "climb-up",
        "Varrock church 2 → 3",
    ),
    pair(
        fromZone(2, 50, 54, 58, 31),
        fromZone(1, 50, 54, 58, 30),
        "climb-down",
        "Varrock church 2 → 1",
    ),
    // Blue Moon Inn
    pair(
        fromZone(0, 50, 53, 27, 1),
        fromZone(1, 50, 53, 30, 1),
        "climb-up",
        "Blue Moon Inn ground → 1",
    ),
    pair(
        fromZone(1, 50, 53, 28, 1),
        fromZone(0, 50, 53, 26, 1),
        "climb-down",
        "Blue Moon Inn 1 → ground",
    ),
];
