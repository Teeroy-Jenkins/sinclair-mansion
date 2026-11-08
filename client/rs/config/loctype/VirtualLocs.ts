// Loc ids that don't exist in the cache: copies of a real loc with a tweak. The server and the
// client share these loaders, so both resolve them the same way.

export interface VirtualLoc {
    /** The cache loc it copies. */
    base: number;
    /** Flip the model (OSRS's "rotated" flag), e.g. a door hinged on the other side. */
    mirror?: boolean;
}

/** Sinclair Mansion: the dining room's west door, open (25719) but hinged on the other side. */
export const MIRRORED_MANSION_DOOR_OPEN = 65000;

export const VIRTUAL_LOCS: ReadonlyMap<number, VirtualLoc> = new Map([
    [MIRRORED_MANSION_DOOR_OPEN, { base: 25719, mirror: true }],
]);
