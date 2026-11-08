// Builds the mansion's room map from the real walls, for the limited-vision zones.
// Every walkable tile is flood-filled into the area its walls (and the cache's closed doors)
// enclose; each area takes the name of the room (ROOMS) most of it lies in. Outdoors is one
// big area. Writes gamemodes/sinclair-mansion/room-map.json and a picture of it,
// gamemodes/sinclair-mansion/zones.svg (rooms, the vision zones they make up, and the walls).
// Usage (from server/): yarn tsx scripts/build-sinclair-zones.ts
import * as fs from "fs";
import * as path from "path";

import { ROOMS, ZONE_OF_ROOM } from "../gamemodes/sinclair-mansion/mansion";
import { PathService } from "../src/pathfinding/PathService";
import { initCacheEnv } from "../src/world/CacheEnv";
import { MapCollisionService } from "../src/world/MapCollisionService";

const X1 = 2715, Y1 = 3550, X2 = 2765, Y2 = 3595;
const W = X2 - X1 + 1, H = Y2 - Y1 + 1;
const env = initCacheEnv("caches");
const pathSvc = new PathService(new MapCollisionService(env, false, { precomputedRoot: "cache/collision", usePrecomputed: true }));

const blocked = (x: number, y: number, l: number) => {
    const f = pathSvc.getCollisionFlagAt(x, y, l) ?? 0x100;
    return (f & 0x100) !== 0 || (f & 0x200000) !== 0 || (f & 0x40000) !== 0;
};
const wall = (x: number, y: number, nx: number, ny: number, l: number) => pathSvc.edgeHasWallBetween(x, y, nx, ny, l);
/** The hand-drawn room a tile is in, if any. */
const rectRoom = (x: number, y: number, l: number) =>
    ROOMS.find((r) => r.level === l && x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2)?.name;

const out: Record<string, { x1: number; y1: number; w: number; h: number; names: string[]; rows: string[] }> = {};
const svgParts: string[] = [];
const CELL = 14;
const palette: Record<string, string> = {};
const colors = ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000", "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"];
const colorOf = (zone: string) => (palette[zone] ??= colors[Object.keys(palette).length % colors.length]);

for (const level of [0, 1]) {
    const comp = new Int32Array(W * H).fill(-1);
    const comps: Array<{ tiles: number[] }> = [];
    for (let y = Y1; y <= Y2; y++) {
        for (let x = X1; x <= X2; x++) {
            const i = (y - Y1) * W + (x - X1);
            if (comp[i] >= 0 || blocked(x, y, level)) continue;
            const id = comps.length;
            const tiles: number[] = [];
            const queue = [[x, y]];
            comp[i] = id;
            while (queue.length) {
                const [cx, cy] = queue.pop()!;
                tiles.push((cy - Y1) * W + (cx - X1));
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = cx + dx, ny = cy + dy;
                    if (nx < X1 || nx > X2 || ny < Y1 || ny > Y2) continue;
                    const ni = (ny - Y1) * W + (nx - X1);
                    if (comp[ni] >= 0 || blocked(nx, ny, level) || wall(cx, cy, nx, ny, level)) continue;
                    comp[ni] = id;
                    queue.push([nx, ny]);
                }
            }
            comps.push({ tiles });
        }
    }
    // Name each area by the room most of its tiles are in. The biggest area on the ground floor
    // is outdoors; areas with no room at all are outdoors too (on the ground floor).
    const biggest = comps.reduce((b, c, i) => (c.tiles.length > comps[b].tiles.length ? i : b), 0);
    const names: string[] = ["(blocked)"];
    const nameIndex = new Map<string, number>([["(blocked)", 0]]);
    // Tiles in no named room vote for "outside"; the open-air rooms count as outside too.
    const OPEN_AIR = new Set(["Garden", "Vegetable Patch", "West Yard"]);
    const outside = level === 0 ? "Outdoors" : "(outside the house)";
    const compName = comps.map((c, ci) => {
        if (ci === biggest) return outside; // the grounds (or, upstairs, the empty air around the house)
        const votes = new Map<string, number>();
        for (const t of c.tiles) {
            const r = rectRoom(X1 + (t % W), Y1 + Math.floor(t / W), level) ?? outside;
            const name = OPEN_AIR.has(r) ? outside : r;
            votes.set(name, (votes.get(name) ?? 0) + 1);
        }
        const best = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? outside;
        if (best !== outside || level === 0) return best;
        // Upstairs, an enclosed pocket no room covers (a closet) belongs to the nearest room.
        const cx = X1 + c.tiles.reduce((s, t) => s + (t % W), 0) / c.tiles.length;
        const cy = Y1 + c.tiles.reduce((s, t) => s + Math.floor(t / W), 0) / c.tiles.length;
        const near = ROOMS.filter((r) => r.level === level)
            .map((r) => ({ r, d: Math.max(0, r.x1 - cx, cx - r.x2) + Math.max(0, r.y1 - cy, cy - r.y2) }))
            .sort((a, b) => a.d - b.d)[0];
        return near && near.d <= 3 ? near.r.name : outside;
    });
    const rows: string[] = [];
    for (let y = Y1; y <= Y2; y++) {
        let row = "";
        for (let x = X1; x <= X2; x++) {
            const c = comp[(y - Y1) * W + (x - X1)];
            const name = c < 0 ? "(blocked)" : compName[c];
            if (!nameIndex.has(name)) {
                nameIndex.set(name, names.length);
                names.push(name);
            }
            row += String.fromCharCode(48 + nameIndex.get(name)!); // '0' = blocked
        }
        rows.push(row);
    }
    out[level] = { x1: X1, y1: Y1, w: W, h: H, names, rows };

    // The picture: one panel per floor, north at the top, coloured by vision zone, room names on.
    const ox = 20, oy = 40 + level * (H * CELL + 50);
    svgParts.push(`<text x="${ox}" y="${oy - 10}" font-size="16" font-weight="bold">${level === 0 ? "Ground floor" : "Upstairs"}</text>`);
    for (let y = Y1; y <= Y2; y++) {
        for (let x = X1; x <= X2; x++) {
            const name = names[rows[y - Y1].charCodeAt(x - X1) - 48];
            if (name === "(blocked)") continue;
            const zone = zoneName(name, x, level);
            const px = ox + (x - X1) * CELL, py = oy + (Y2 - y) * CELL;
            svgParts.push(`<rect x="${px}" y="${py}" width="${CELL}" height="${CELL}" fill="${colorOf(zone)}" fill-opacity="0.55"/>`);
        }
    }
    // Walls (thick black lines on blocked edges).
    for (let y = Y1; y <= Y2; y++) {
        for (let x = X1; x <= X2; x++) {
            const px = ox + (x - X1) * CELL, py = oy + (Y2 - y) * CELL;
            if (x < X2 && wall(x, y, x + 1, y, level)) svgParts.push(`<line x1="${px + CELL}" y1="${py}" x2="${px + CELL}" y2="${py + CELL}" stroke="#000" stroke-width="2.5"/>`);
            if (y < Y2 && wall(x, y, x, y + 1, level)) svgParts.push(`<line x1="${px}" y1="${py}" x2="${px + CELL}" y2="${py}" stroke="#000" stroke-width="2.5"/>`);
        }
    }
    // Labels at each room's centre.
    for (const name of names.slice(1)) {
        const pts: Array<[number, number]> = [];
        rows.forEach((row, ry) => [...row].forEach((ch, rx) => ch.charCodeAt(0) - 48 === names.indexOf(name) && pts.push([rx, ry])));
        if (!pts.length || name === "Outdoors") continue;
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        svgParts.push(`<text x="${ox + cx * CELL}" y="${oy + (H - 1 - cy) * CELL}" font-size="10" text-anchor="middle">${name.replace("&", "&amp;").replace("'", "&#39;")}</text>`);
    }
}

function zoneName(room: string, x: number, level: number): string {
    if (room === "Outdoors" || room === "(outside the house)") return level === 0 ? (x < 2740 ? "West Grounds" : "East Grounds") : "Upstairs";
    return ZONE_OF_ROOM[room] ?? room;
}

// Legend.
const legendY = 40 + 2 * (H * CELL + 50);
Object.entries(palette).forEach(([zone, color], i) => {
    const lx = 20 + (i % 4) * 230, ly = legendY + Math.floor(i / 4) * 22;
    svgParts.push(`<rect x="${lx}" y="${ly}" width="16" height="16" fill="${color}" fill-opacity="0.55" stroke="#000"/><text x="${lx + 22}" y="${ly + 13}" font-size="13">${zone.replace("'", "&#39;")}</text>`);
});
const svgW = W * CELL + 280, svgH = legendY + 110;
const dir = path.join(__dirname, "../gamemodes/sinclair-mansion");
fs.writeFileSync(path.join(dir, "room-map.json"), JSON.stringify(out));
fs.writeFileSync(
    path.join(dir, "zones.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/>${svgParts.join("")}` +
        `<text x="20" y="${svgH - 12}" font-size="12">Vision zones from the real walls: the living only see people in the same colour. North is up; thick lines are walls and closed doors.</text></svg>`,
);
console.log("rooms:", JSON.stringify(Object.fromEntries(Object.entries(out).map(([l, v]) => [l, v.names]))));
