/**
 * Draynor Manor crypt stairs (Count Draytor / vampyre crypt).
 * Source: LostCity cryptstairsdown / cryptstairsup.
 */
import { fromZone } from "./coords";
import type { TraversalOverride } from "./types";

export const CRYPT_OVERRIDES: readonly TraversalOverride[] = [
    {
        from: fromZone(0, 48, 52, 43, 29),
        to: fromZone(0, 48, 152, 5, 43),
        action: "climb-down",
        animate: true,
        message: "You walk down the stairs...",
        note: "Draynor Manor → vampyre crypt",
    },
    {
        from: fromZone(0, 48, 152, 5, 40),
        to: fromZone(0, 48, 52, 43, 28),
        action: "climb-up",
        animate: true,
        note: "Vampyre crypt → Draynor Manor",
    },
];
