/**
 * White Knights' Castle spiral / courtyard stairs (LostCity stairs.rs2).
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

export const WHITE_KNIGHTS_OVERRIDES: readonly TraversalOverride[] = [
    // Main west spiral
    pair(
        fromZone(0, 46, 52, 10, 10),
        fromZone(1, 46, 52, 12, 10),
        "climb-up",
        "White Knights Castle ground → 1",
    ),
    pair(
        fromZone(1, 46, 52, 11, 10),
        fromZone(0, 46, 52, 11, 9),
        "climb-down",
        "White Knights Castle 1 → ground",
    ),
    pair(
        fromZone(1, 46, 52, 16, 10),
        fromZone(2, 46, 52, 15, 11),
        "climb-up",
        "White Knights Castle 1 → 2",
    ),
    pair(
        fromZone(2, 46, 52, 16, 11),
        fromZone(1, 46, 52, 16, 12),
        "climb-down",
        "White Knights Castle 2 → 1",
    ),
    pair(
        fromZone(2, 46, 52, 13, 10),
        fromZone(3, 46, 52, 12, 11),
        "climb-up",
        "White Knights Castle 2 → 3",
    ),
    pair(
        fromZone(3, 46, 52, 13, 11),
        fromZone(2, 46, 52, 13, 12),
        "climb-down",
        "White Knights Castle 3 → 2",
    ),
    // East side spiral
    pair(
        fromZone(1, 46, 52, 40, 9),
        fromZone(2, 46, 52, 40, 12),
        "climb-up",
        "White Knights Castle east 1 → 2",
    ),
    pair(
        fromZone(2, 46, 52, 40, 10),
        fromZone(1, 46, 52, 40, 8),
        "climb-down",
        "White Knights Castle east 2 → 1",
    ),
    // Courtyard stairs
    pair(
        fromZone(0, 46, 52, 26, 19),
        fromZone(1, 46, 52, 24, 20),
        "climb-up",
        "Falador castle courtyard up",
    ),
    pair(
        fromZone(1, 46, 52, 24, 19),
        fromZone(0, 46, 52, 27, 19),
        "climb-down",
        "Falador castle courtyard down",
    ),
];
