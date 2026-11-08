// Prints collision flags around a tile so gamemode furniture can be checked for reachability.
// Usage (from server/): yarn tsx scripts/collision-probe.ts <x> <y> [level] [radius]
import { initCacheEnv } from "../src/world/CacheEnv";
import { MapCollisionService } from "../src/world/MapCollisionService";
import { PathService } from "../src/pathfinding/PathService";

const [cx, cy, level = 0, r = 4] = process.argv.slice(2).map(Number);
const env = initCacheEnv("caches");
const map = new MapCollisionService(env, false, { precomputedRoot: "cache/collision", usePrecomputed: true });
const path = new PathService(map);
for (let y = cy + r; y >= cy - r; y--) {
    const row: string[] = [];
    for (let x = cx - r; x <= cx + r; x++) {
        const f = path.getCollisionFlagAt(x, y, level) ?? -1;
        // F = floor/object blocked, otherwise show wall bits N/E/S/W as a hex nibble
        const blocked = (f & 0x100) !== 0 || (f & 0x200000) !== 0 || (f & 0x40000) !== 0;
        const walls = ((f & 0x2) ? 1 : 0) | ((f & 0x8) ? 2 : 0) | ((f & 0x20) ? 4 : 0) | ((f & 0x80) ? 8 : 0);
        row.push(blocked ? "##" : walls ? ` ${walls.toString(16)}` : " .");
    }
    console.log(`${y} ${row.join("")}`);
}
console.log(`     x from ${cx - r} to ${cx + r}; ## = blocked tile, digit = wall bits (1=N 2=E 4=S 8=W)`);
