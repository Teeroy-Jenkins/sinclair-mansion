import type { Model } from "../../rs/model/Model";

/** Points (in model units, around the tile centre) where the surface under an item is sampled. */
const SAMPLE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [-32, -32],
    [32, -32],
    [-32, 32],
    [32, 32],
];

/** Height (above the loc's base, positive up) of the highest visible face over (x, z), or -1. */
function surfaceHeightAt(model: Model, x: number, z: number): number {
    const vx = model.verticesX;
    const vy = model.verticesY;
    const vz = model.verticesZ;
    const colors = model.faceColors3;
    const alphas = model.faceAlphas;
    let best = -1;
    for (let f = 0; f < model.faceCount; f++) {
        // -2 marks a hidden face; a fully transparent one isn't something to stand an item on.
        if (colors && colors[f] === -2) continue;
        if (alphas && (alphas[f] & 0xff) >= 254) continue;
        const a = model.indices1[f];
        const b = model.indices2[f];
        const c = model.indices3[f];
        const ax = vx[a], az = vz[a];
        const bx = vx[b], bz = vz[b];
        const cx = vx[c], cz = vz[c];
        const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (det === 0) continue; // vertical or degenerate face
        const w1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const w2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        // Model Y grows downwards.
        const h = -(w1 * vy[a] + w2 * vy[b] + w3 * vy[c]);
        if (h > best) best = h;
    }
    return best;
}

/**
 * How high items on one tile of a "supports items" loc sit, in model units.
 *
 * OSRS raises every item on such a loc to the top of its whole model (`Model.height`). That's
 * right for a bare table, but a table modelled with things standing on it (the Sinclair dining
 * table's candlesticks) puts the items at candle height, floating over the cloth. So this takes
 * the surface under the item instead: the highest visible face over a few points around the
 * tile's centre, and the middle of those (so a thin candlestick at one point doesn't count).
 * A tile no face covers falls back to the model's top, as in OSRS.
 *
 * `centerX`/`centerZ` are the tile centre relative to the loc's origin (the model's 0, 0).
 */
export function itemSupportHeight(model: Model, centerX: number, centerZ: number): number {
    const hits: number[] = [];
    for (const [dx, dz] of SAMPLE_OFFSETS) {
        const h = surfaceHeightAt(model, centerX + dx, centerZ + dz);
        if (h >= 0) hits.push(h);
    }
    if (hits.length === 0) return Math.max(0, model.height | 0);
    hits.sort((p, q) => p - q);
    return Math.max(0, Math.round(hits[(hits.length - 1) >> 1]));
}
