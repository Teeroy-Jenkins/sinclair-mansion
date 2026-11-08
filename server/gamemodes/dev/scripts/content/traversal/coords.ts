/** LostCity / early-RS2 zone coord helpers → absolute OSRS tiles. */

export type TilePos = { x: number; y: number; level: number };

/**
 * Convert LostCity zone coord components to absolute tile.
 * Format in scripts: `level_mapX_mapY_localX_localY`
 */
export function fromZone(
    level: number,
    mapX: number,
    mapY: number,
    localX: number,
    localY: number,
): TilePos {
    return {
        x: mapX * 64 + localX,
        y: mapY * 64 + localY,
        level,
    };
}

export function tileKey(x: number, y: number, level: number): string {
    return `${level}:${x}:${y}`;
}
