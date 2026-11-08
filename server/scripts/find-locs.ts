// Lists loc types whose name matches a pattern (with their options and sizes), to pick scenery.
// Usage (from server/): yarn tsx scripts/find-locs.ts "<regex>"
import { getCacheLoaderFactory } from "../../client/rs/cache/loader/CacheLoaderFactory";
import { initCacheEnv } from "../src/world/CacheEnv";

const re = new RegExp(process.argv[2] ?? "wall", "i");
const env = initCacheEnv("caches");
const locTypes = getCacheLoaderFactory(env.info, env.cacheSystem).getLocTypeLoader();
type LocInfo = { name?: string; actions?: (string | null)[]; sizeX?: number; sizeY?: number; models?: number[][] | number[]; types?: number[] };
for (let id = 0; id < locTypes.getCount(); id++) {
    const t = locTypes.load(id) as LocInfo;
    if (!t?.name || !re.test(t.name)) continue;
    const actions = (t.actions ?? []).filter(Boolean).join("|");
    console.log(`${id} "${t.name}" ${t.sizeX}x${t.sizeY} types=${JSON.stringify(t.types ?? null)} [${actions}]`);
}
