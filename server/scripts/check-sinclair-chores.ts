// Checks every Sinclair Mansion chore against the real map: the furniture is where the gamemode
// thinks it is, someone can walk up to it, and every item spawn lies on a reachable tile.
// Usage (from server/): yarn tsx scripts/check-sinclair-chores.ts
import { getCacheLoaderFactory } from "../../client/rs/cache/loader/CacheLoaderFactory";
import { CONTAINERS, DOORS, ESCAPES, ITEM_SPAWNS, SPAWN, STAIR_LANDING, TASKS } from "../gamemodes/sinclair-mansion/mansion";
import { PathService } from "../src/pathfinding/PathService";
import { initCacheEnv } from "../src/world/CacheEnv";
import { LocTileLookupService } from "../src/world/LocTileLookupService";
import { MapCollisionService } from "../src/world/MapCollisionService";

const env = initCacheEnv("caches");
const locTypes = getCacheLoaderFactory(env.info, env.cacheSystem).getLocTypeLoader();
const lookup = new LocTileLookupService(env);
const path = new PathService(new MapCollisionService(env, false, { precomputedRoot: "cache/collision", usePrecomputed: true }));

const blocked = (x: number, y: number, l: number) => {
    const f = path.getCollisionFlagAt(x, y, l) ?? 0x100;
    return (f & 0x100) !== 0 || (f & 0x200000) !== 0 || (f & 0x40000) !== 0;
};
const doorTiles = new Set(DOORS.map((d) => `${d.tile.x},${d.tile.y},${d.tile.level}`));
/** Every tile reachable on foot from a start tile, inside the grounds. */
function reachable(sx: number, sy: number, l: number): Set<string> {
    const seen = new Set([`${sx},${sy}`]);
    const queue = [[sx, sy]];
    while (queue.length) {
        const [x, y] = queue.shift()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
            if (seen.has(k) || nx < 2715 || nx > 2765 || ny < 3550 || ny > 3595) continue;
            // The game opens every door at the start, so doorways don't count as walls.
            const doorway = doorTiles.has(`${x},${y},${l}`) || doorTiles.has(`${nx},${ny},${l}`);
            if (blocked(nx, ny, l) || (!doorway && path.edgeHasWallBetween(x, y, nx, ny, l))) continue;
            seen.add(k);
            queue.push([nx, ny]);
        }
    }
    return seen;
}
const walk = [reachable(SPAWN.x, SPAWN.y, 0), reachable(STAIR_LANDING.x, STAIR_LANDING.y, 1)];
const map = new MapCollisionService(env, false, { precomputedRoot: "cache/collision", usePrecomputed: true });
/** Floor you can walk onto, or a table you can reach across from next to it. */
const canTake = (t: { x: number; y: number; level: number }) =>
    walk[t.level].has(`${t.x},${t.y}`) ||
    (map.hasItemLayerSupportAt(t.x, t.y, t.level) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => walk[t.level].has(`${t.x + dx},${t.y + dy}`)));

let problems = 0;
const bad = (msg: string) => { problems++; console.log("  PROBLEM: " + msg); };

/** Closest anyone can stand to a piece of furniture (MurderGame.nearContainer measures the same way). */
const standDistance = (c: (typeof CONTAINERS)[number]) => {
    let best = 99;
    for (const k of walk[c.tile.level]) {
        const [x, y] = k.split(",").map(Number);
        const dx = Math.max(c.tile.x - x, 0, x - (c.tile.x + c.w - 1));
        const dy = Math.max(c.tile.y - y, 0, y - (c.tile.y + c.h - 1));
        best = Math.min(best, Math.max(dx, dy));
    }
    return best;
};
/** A tool kept in furniture is found by searching it: the furniture must exist, be searchable and reachable. */
const checkKeptIn = (itemId: number, id: string) => {
    const c = CONTAINERS.find((k) => k.id === id);
    if (!c) return bad(`item ${itemId} is kept in unknown furniture ${id}`);
    if (c.searchable === false) bad(`item ${itemId} is kept in ${c.name}, which can't be searched`);
    if (standDistance(c) > 1) bad(`item ${itemId} is kept in ${c.name}, which can't be reached`);
};

for (const task of TASKS) {
    console.log(`${task.id}: ${task.name}`);
    for (const s of task.steps) {
        if (s.fetch !== undefined) {
            const spawn = ITEM_SPAWNS.find((i) => i.itemId === s.fetch);
            const tiles = spawn?.tiles ?? [];
            if (!tiles.length && !spawn?.in?.length) bad(`"${s.verb}": item ${s.fetch} never spawns`);
            for (const t of tiles) if (!canTake(t)) bad(`"${s.verb}": spawn ${t.x},${t.y},${t.level} can't be reached`);
            for (const id of spawn?.in ?? []) checkKeptIn(s.fetch, id);
            console.log(`  ok? ${s.verb} (at ${[...tiles.map((t) => `${t.x},${t.y},${t.level}`), ...(spawn?.in ?? []).map((id) => `in ${id}`)].join(" / ")})`);
            continue;
        }
        if (s.mix !== undefined) {
            console.log(`  ${s.verb} (item on item, in the pack)`);
            continue;
        }
        const c = CONTAINERS.find((k) => k.id === s.c);
        if (!c) { bad(`"${s.verb}": no container ${s.c}`); continue; }
        // Which of its loc ids really sit inside its rectangle?
        const found: string[] = [];
        for (let x = c.tile.x; x < c.tile.x + c.w; x++) {
            for (let y = c.tile.y; y < c.tile.y + c.h; y++) {
                for (const loc of lookup.getLocsAtTile(c.tile.level, x, y)) {
                    if (!c.locIds.includes(loc.id)) continue;
                    const lt = locTypes.load(loc.id) as { name?: string; actions?: (string | null)[] };
                    found.push(`${loc.id}@${x},${y} type=${loc.type} "${lt?.name}" [${(lt?.actions ?? []).filter(Boolean).join("|")}]`);
                }
            }
        }
        if (!found.length) bad(`"${s.verb}": none of ${c.locIds.join("/")} found in ${c.name}'s rectangle`);
        const best = standDistance(c);
        if (best > 1) bad(`"${s.verb}": closest you can stand to ${c.name} is ${best} tiles`);
        console.log(`  ${s.verb} -> ${c.name} [${found.join("; ") || "none"}] stand ${best}`);
    }
}
for (const sp of ITEM_SPAWNS) {
    for (const t of sp.tiles ?? []) if (!canTake(t)) bad(`spawn of ${sp.itemId} at ${t.x},${t.y},${t.level} can't be reached`);
    for (const id of sp.in ?? []) checkKeptIn(sp.itemId, id);
}
for (const e of ESCAPES) {
    const near = [...walk[e.tile.level]].some((k) => { const [x, y] = k.split(",").map(Number); return Math.max(Math.abs(x - e.tile.x), Math.abs(y - e.tile.y)) <= 1; });
    if (!near) bad(`escape ${e.id} can't be reached`);
}
console.log(problems ? `${problems} problem(s)` : "All chores check out.");
