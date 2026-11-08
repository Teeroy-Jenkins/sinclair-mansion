import { CELLAR_DOWN, CELLAR_UP } from "./cellars";
import { tileKey } from "./coords";
import { CRYPT_OVERRIDES } from "./crypts";
import { LUMBRIDGE_CASTLE_OVERRIDES } from "./lumbridgeCastle";
import type { TraversalOverride } from "./types";
import { VARROCK_HUB_OVERRIDES } from "./varrockHub";
import { WHITE_KNIGHTS_OVERRIDES } from "./whiteKnightsCastle";
import { WIZARD_TOWER_OVERRIDES } from "./wizardTower";

const ALL_OVERRIDES: readonly TraversalOverride[] = [
    ...CELLAR_DOWN,
    ...CELLAR_UP,
    ...CRYPT_OVERRIDES,
    ...WIZARD_TOWER_OVERRIDES,
    ...LUMBRIDGE_CASTLE_OVERRIDES,
    ...WHITE_KNIGHTS_OVERRIDES,
    ...VARROCK_HUB_OVERRIDES,
];

const BY_TILE = new Map<string, TraversalOverride[]>();
for (const row of ALL_OVERRIDES) {
    const key = tileKey(row.from.x, row.from.y, row.from.level);
    const list = BY_TILE.get(key);
    if (list) list.push(row);
    else BY_TILE.set(key, [row]);
}

function actionMatches(wanted: TraversalOverride["action"], actualOffset: number): boolean {
    if (wanted === "climb-up") return actualOffset > 0;
    if (wanted === "climb-down" || wanted === "enter") return actualOffset < 0;
    return true;
}

/**
 * Look up a coord-keyed traversal exception (cellars, crypts, special ladders).
 * @param levelOffset +1 for climb-up style, -1 for climb-down/enter.
 */
export function findTraversalOverride(
    x: number,
    y: number,
    level: number,
    levelOffset: number,
): TraversalOverride | undefined {
    const rows = BY_TILE.get(tileKey(x, y, level));
    if (!rows) return undefined;
    return rows.find((row) => actionMatches(row.action, levelOffset));
}

export function traversalOverrideCount(): number {
    return ALL_OVERRIDES.length;
}
