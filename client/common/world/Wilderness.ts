/** Canonical surface-Wilderness bounds used for client-side menu visibility. */
export function isInWilderness(x: number, y: number): boolean {
    return x >= 2944 && x <= 3391 && y >= 3520 && y <= 3966;
}
