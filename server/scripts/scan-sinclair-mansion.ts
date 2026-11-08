// Lists interactable locs (furniture) around Sinclair Mansion so the
// sinclair-mansion gamemode can map them to containers, and prints an ASCII
// plan of the walls on one level.
// Usage (from server/): yarn tsx scripts/scan-sinclair-mansion.ts [--plan] [level]
import { getCacheLoaderFactory } from "../../client/rs/cache/loader/CacheLoaderFactory";
import { initCacheEnv } from "../src/world/CacheEnv";
import { LocTileLookupService } from "../src/world/LocTileLookupService";

const args = process.argv.slice(2);
const plan = args.includes("--plan");
const planLevel = Number(args.find((a) => /^\d$/.test(a)) ?? 0);
const [minX, minY, maxX, maxY] = [2715, 3555, 2785, 3600];

const env = initCacheEnv("caches");
const factory = getCacheLoaderFactory(env.info, env.cacheSystem);
const locTypes = factory.getLocTypeLoader();
const lookup = new LocTileLookupService(env);

type LocInfo = { name?: string; actions?: (string | null)[]; sizeX?: number; sizeY?: number };

if (plan) {
    // '#' wall-ish loc (types 0-3), 'D' door, letters = interactables (legend below), '.' empty.
    const legend: string[] = [];
    const lines: string[] = [];
    for (let y = 3590; y >= 3555; y--) {
        let row = `${y} `;
        for (let x = 2722; x <= 2760; x++) {
            let ch = ".";
            for (const loc of lookup.getLocsAtTile(planLevel, x, y)) {
                const t = locTypes.load(loc.id) as LocInfo;
                const actions = (t?.actions ?? []).filter((a) => a && a !== "hidden");
                if (/door|gate/i.test(t?.name ?? "") && actions.length) ch = "D";
                else if (actions.length && loc.type === 10) {
                    ch = String.fromCharCode(65 + (legend.length % 26));
                    legend.push(`${ch}=${t.name}@${x},${y}`);
                } else if (loc.type <= 3 && ch === ".") ch = "#";
                else if (loc.type === 10 && ch === ".") ch = "o";
            }
            row += ch;
        }
        lines.push(row);
    }
    console.log("     " + Array.from({ length: 39 }, (_, i) => String((2722 + i) % 10)).join(""));
    console.log(lines.join("\n"));
    console.log(legend.join("\n"));
} else {
    const rows: string[] = [];
    for (let level = 0; level <= 1; level++) {
        for (let y = maxY; y >= minY; y--) {
            for (let x = minX; x <= maxX; x++) {
                for (const loc of lookup.getLocsAtTile(level, x, y)) {
                    const t = locTypes.load(loc.id) as LocInfo;
                    const actions = (t?.actions ?? []).filter((a) => a && a !== "hidden");
                    if (!t?.name || t.name === "null" || actions.length === 0) continue;
                    rows.push(`${level} ${x},${y} id=${loc.id} type=${loc.type} rot=${loc.rotation} size=${t.sizeX}x${t.sizeY} "${t.name}" [${actions.join("|")}]`);
                }
            }
        }
    }
    console.log(rows.join("\n"));
    console.log(`${rows.length} interactable locs`);
}
