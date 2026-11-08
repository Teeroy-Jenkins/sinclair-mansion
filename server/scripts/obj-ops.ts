// Prints items' names and inventory options, e.g. to see which chore items the cache lets you Eat.
// Usage (from server/): yarn tsx scripts/obj-ops.ts 1942 1965 6697
import { getCacheLoaderFactory } from "../../client/rs/cache/loader/CacheLoaderFactory";
import { initCacheEnv } from "../src/world/CacheEnv";

const env = initCacheEnv("caches");
const objTypes = getCacheLoaderFactory(env.info, env.cacheSystem).getObjTypeLoader();
for (const arg of process.argv.slice(2)) {
    const t = objTypes.load(Number(arg)) as { name?: string; inventoryActions?: (string | null)[] };
    console.log(`${arg} "${t?.name}" [${(t?.inventoryActions ?? []).map((a) => a ?? "-").join("|")}]`);
}
