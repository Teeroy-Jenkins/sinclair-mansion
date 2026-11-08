// Prints the length (in ticks) of animation sequences, to pick ones that loop well.
// Usage (from server/): yarn tsx scripts/seq-info.ts 832 733 ...
import { getCacheLoaderFactory } from "../../client/rs/cache/loader/CacheLoaderFactory";
import { initCacheEnv } from "../src/world/CacheEnv";

const env = initCacheEnv("caches");
const seqs = getCacheLoaderFactory(env.info, env.cacheSystem).getSeqTypeLoader();
for (const arg of process.argv.slice(2)) {
    const id = Number(arg);
    const s = seqs.load(id) as { frameLengths?: number[]; frameIds?: number[]; leftHandItem?: number; rightHandItem?: number; looping?: boolean; frameStep?: number };
    const cycles = (s?.frameLengths ?? []).reduce((a, b) => a + b, 0);
    console.log(`${id}: frames=${s?.frameIds?.length ?? 0} clientCycles=${cycles} (~${(cycles / 30).toFixed(1)} ticks) left=${s?.leftHandItem} right=${s?.rightHandItem} step=${s?.frameStep}`);
}
