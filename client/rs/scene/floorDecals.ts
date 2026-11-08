/**
 * Floor decorations that lie on top of whatever is already on the tile instead of taking its
 * floor-decoration slot. OSRS keeps one floor decoration per tile, so a blood stain spawned on a
 * rug used to replace the rug. These are drawn as an extra layer, a little above it.
 *
 * 654: the Murder Mystery blood stain (Murder at Sinclair Mansion's crime scenes and kills).
 */
export const FLOOR_DECAL_LOCS: ReadonlySet<number> = new Set([654]);

/** How far (in height units, 128 to a tile) a decal is lifted above the floor decoration under it. */
export const FLOOR_DECAL_LIFT = 3;

/** Draw priority for decals: above floor decorations (3). */
export const FLOOR_DECAL_PRIORITY = 4;

/**
 * NPCs that lie flat on the floor (Murder at Sinclair Mansion's bodies, the cache's Corpse NPC).
 * Their faces get a depth bias so rugs and other floor decorations never draw over them.
 */
export const FLOOR_LYING_NPCS: ReadonlySet<number> = new Set([3614]);
export const FLOOR_LYING_NPC_PRIORITY = 2;
