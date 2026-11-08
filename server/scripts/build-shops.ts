/**
 * Builds server/data/shops.json from:
 * - DayV osrsreboxed shops-items-by-shop.json (stock + pricing)
 * - DayV shops-wiki-page-text.json (owners + map + general-store flag)
 * - server/data/npc-spawns.json (npcId wiring via name + proximity)
 *
 * Inputs are downloaded into server/data/sources/ on first run.
 */
import fs from "fs";
import https from "https";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const SOURCES = path.resolve(ROOT, "data/sources");
const SPAWNS_PATH = path.resolve(ROOT, "data/npc-spawns.json");
const OUT = path.resolve(ROOT, "data/shops.json");

const SHOPS_URL =
    "https://raw.githubusercontent.com/DayV-git/osrsreboxed-db/master/docs/shops-items-by-shop.json";
const WIKI_URL =
    "https://raw.githubusercontent.com/DayV-git/osrsreboxed-db/master/data/shops/shops-wiki-page-text.json";

const CURRENCY_ITEM_IDS: Record<string, number> = {
    coins: 995,
    coin: 995,
    tokkul: 6529,
    "trading sticks": 6306,
    "trading stick": 6306,
    "pieces of eight": 8951,
    "piece of eight": 8951,
    "ecto-token": 4278,
    "ecto-tokens": 4278,
    "castle wars ticket": 4067,
    "castle wars tickets": 4067,
    "warrior guild token": 8851,
    "warrior guild tokens": 8851,
    "mark of grace": 11849,
    "marks of grace": 11849,
    "golden nugget": 12012,
    "golden nuggets": 12012,
    stardust: 25527,
    "agility arena ticket": 2996,
    "agility arena tickets": 2996,
    "archery ticket": 1464,
    "archery tickets": 1464,
    "paramaya ticket": 1110,
    "hallowed mark": 24711,
    "hallowed marks": 24711,
    "abyssal pearls": 24937,
    "abyssal pearl": 24937,
    "mermaid's tear": 21620,
    "mermaid's tears": 21620,
    "molch pearl": 22820,
    "molch pearls": 22820,
    "brimhaven voucher": 29433,
    "unidentified minerals": 21341,
    "zeal token": 10508,
    "zeal tokens": 10508,
    // Virtual / unsupported point currencies – skip these shops
    nmz: -1,
    points: -1,
    "nightmare zone points": -1,
    "reward currency": -1,
    "deadman points": -1,
    "event points": -1,
    "league points": -1,
    "speedrun points": -1,
    "honour points": -1,
    "foundry reputation": -1,
    tithe: -1,
    "volcanic mine points": -1,
    termites: -1,
    "archaic emblem": -1,
    "agility arena ticket (discontinued)": -1,
};

type DayVShopItem = {
    type?: string;
    id?: number;
    name?: string;
    stock?: number | string;
    restock_time?: number | string;
    currency?: string;
};

type DayVShop = {
    shop_info?: {
        sells_at?: number | null;
        buys_at?: number | null;
        change_per?: number | null;
        currency?: string;
    };
    items?: DayVShopItem[];
};

type NpcSpawn = {
    id: number;
    name?: string;
    x: number;
    y: number;
    level?: number;
};

type ShopStockOut = {
    itemId: number;
    quantity: number;
    restockTicks?: number;
};

type ShopOut = {
    id: string;
    name: string;
    npcIds: number[];
    currencyItemId: number;
    capacity: number;
    generalStore: boolean;
    restockTicks: number;
    buyPriceMultiplier: number;
    sellPriceMultiplier: number;
    stock: ShopStockOut[];
    owners?: string[];
    centroid?: { x: number; y: number };
};

function download(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const file = fs.createWriteStream(dest);
        https
            .get(url, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    file.close();
                    fs.unlinkSync(dest);
                    download(res.headers.location, dest).then(resolve, reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`GET ${url} → ${res.statusCode}`));
                    return;
                }
                res.pipe(file);
                file.on("finish", () => file.close(() => resolve()));
            })
            .on("error", (err) => {
                try {
                    fs.unlinkSync(dest);
                } catch {
                    /* ignore */
                }
                reject(err);
            });
    });
}

async function ensureSource(url: string, filename: string): Promise<string> {
    const dest = path.resolve(SOURCES, filename);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
        console.log(`Downloading ${filename}...`);
        await download(url, dest);
    }
    return dest;
}

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/['’.]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80);
}

function parseOwnerLinks(wikitext: string): string[] {
    const ownerMatch = wikitext.match(/\|\s*owner\s*=\s*([^\n|{]+(?:\[[^\]]*\][^\n|{]*)*)/i);
    if (!ownerMatch) return [];
    const raw = ownerMatch[1];
    const names: string[] = [];
    for (const m of raw.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)) {
        const target = m[1].trim();
        if (!target) continue;
        // Prefer display-less page title; strip disambiguator for spawn name match later
        names.push(target);
    }
    if (names.length === 0) {
        const plain = raw.replace(/\[\[|\]\]/g, "").split(/,| and /i);
        for (const p of plain) {
            const t = p.trim();
            if (t) names.push(t);
        }
    }
    return [...new Set(names)];
}

function ownerToSpawnNames(ownerPage: string): string[] {
    // "Shop keeper (Lumbridge)" → ["Shop keeper (Lumbridge)", "Shop keeper"]
    // "Bob" → ["Bob"]
    const names = [ownerPage];
    const paren = ownerPage.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (paren) {
        names.push(paren[1].trim());
    }
    // Pipe-style already stripped; also handle "Shopkeeper" variants
    return [...new Set(names)];
}

function parseMapPoints(wikitext: string): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const lower = wikitext.toLowerCase();
    let i = 0;
    while (i < wikitext.length) {
        const start = lower.indexOf("{{map", i);
        if (start < 0) break;
        let depth = 0;
        let j = start;
        for (; j < wikitext.length - 1; j++) {
            if (wikitext[j] === "{" && wikitext[j + 1] === "{") {
                depth++;
                j++;
                continue;
            }
            if (wikitext[j] === "}" && wikitext[j + 1] === "}") {
                depth--;
                j++;
                if (depth === 0) {
                    j++;
                    break;
                }
            }
        }
        const body = wikitext.slice(start, j);
        for (const m of body.matchAll(/(\d{3,5})\s*,\s*(\d{3,5})/g)) {
            points.push({ x: Number(m[1]), y: Number(m[2]) });
        }
        i = Math.max(j, start + 5);
    }
    return points;
}

function isGeneralStore(name: string, wikitext: string | undefined): boolean {
    if (/general\s+store/i.test(name)) return true;
    if (!wikitext) return false;
    const special = wikitext.match(/\|\s*special\s*=\s*([^\n]+)/i);
    if (special && /general\s+store/i.test(special[1])) return true;
    return false;
}

function resolveCurrency(currency: string | undefined, unknown: Set<string>): number {
    const key = (currency ?? "coins").trim().toLowerCase();
    if (CURRENCY_ITEM_IDS[key] !== undefined) {
        return CURRENCY_ITEM_IDS[key];
    }
    unknown.add(key);
    return -1;
}

function stockQuantity(stock: number | string | undefined): number {
    if (stock === "infinite" || stock === "Infinite") return 100000;
    if (typeof stock === "number" && Number.isFinite(stock)) return Math.max(0, Math.trunc(stock));
    if (typeof stock === "string" && /^\d+$/.test(stock)) return Math.trunc(Number(stock));
    return 0;
}

function restockTicks(value: number | string | undefined, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return Math.trunc(Number(value));
    return fallback;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

function mapCentroid(points: Array<{ x: number; y: number }>): { x: number; y: number } | undefined {
    if (!points.length) return undefined;
    let sx = 0;
    let sy = 0;
    for (const p of points) {
        sx += p.x;
        sy += p.y;
    }
    return { x: sx / points.length, y: sy / points.length };
}

function uniqueSpawns(list: NpcSpawn[]): NpcSpawn[] {
    const byId = new Map<number, NpcSpawn>();
    for (const c of list) byId.set(c.id, c);
    return [...byId.values()];
}

function pickNearCentroid(
    candidates: NpcSpawn[],
    centroid: { x: number; y: number } | undefined,
    radius: number,
): NpcSpawn[] {
    if (!centroid) return [];
    const radius2 = radius * radius;
    const near = candidates
        .map((c) => ({ c, d2: dist2(c.x, c.y, centroid.x, centroid.y) }))
        .filter((x) => x.d2 <= radius2)
        .sort((a, b) => a.d2 - b.d2);
    if (near.length === 0) return [];
    // Keep the closest cluster (within 8 tiles of the nearest match)
    const best = near[0].d2;
    const clusterR2 = 8 * 8;
    return near.filter((x) => x.d2 <= best + clusterR2).map((x) => x.c);
}

function resolveNpcIds(
    owners: string[],
    mapPoints: Array<{ x: number; y: number }>,
    spawnsByName: Map<string, NpcSpawn[]>,
    opts?: { generalStore?: boolean },
): number[] {
    const ids = new Set<number>();
    const centroid = mapCentroid(mapPoints);
    const matchedSpawns: NpcSpawn[] = [];

    for (const owner of owners) {
        const spawnNames = ownerToSpawnNames(owner);
        let candidates: NpcSpawn[] = [];
        for (const n of spawnNames) {
            const list = spawnsByName.get(n.toLowerCase());
            if (list) candidates = candidates.concat(list);
        }
        candidates = uniqueSpawns(candidates);
        if (candidates.length === 0) continue;

        const near = pickNearCentroid(candidates, centroid, 14);
        if (near.length > 0) {
            for (const c of near) {
                ids.add(c.id);
                matchedSpawns.push(c);
            }
            continue;
        }

        // Fall back: if few IDs share the name, take them all (unique shopkeepers)
        if (!centroid && candidates.length <= 3) {
            for (const c of candidates) {
                ids.add(c.id);
                matchedSpawns.push(c);
            }
        } else if (centroid && candidates.length === 1) {
            ids.add(candidates[0].id);
            matchedSpawns.push(candidates[0]);
        }
    }

    // Only general stores share a keeper/assistant pair
    if (opts?.generalStore && matchedSpawns.length > 0 && centroid) {
        const assistants = spawnsByName.get("shop assistant") ?? [];
        for (const a of pickNearCentroid(assistants, centroid, 12)) {
            ids.add(a.id);
        }
    }

    return [...ids].sort((a, b) => a - b);
}

async function main(): Promise<void> {
    const shopsPath = await ensureSource(SHOPS_URL, "shops-items-by-shop.json");
    const wikiPath = await ensureSource(WIKI_URL, "shops-wiki-page-text.json");

    if (!fs.existsSync(SPAWNS_PATH)) {
        console.error(`Missing ${SPAWNS_PATH}`);
        process.exit(1);
    }

    const shopsRaw = JSON.parse(fs.readFileSync(shopsPath, "utf8")) as Record<string, DayVShop>;
    const wikiRaw = JSON.parse(fs.readFileSync(wikiPath, "utf8")) as Record<string, string>;
    const spawns = JSON.parse(fs.readFileSync(SPAWNS_PATH, "utf8")) as NpcSpawn[];

    const spawnsByName = new Map<string, NpcSpawn[]>();
    for (const spawn of spawns) {
        if (!spawn?.name || !(spawn.id > 0)) continue;
        const key = spawn.name.toLowerCase();
        const list = spawnsByName.get(key);
        if (list) list.push(spawn);
        else spawnsByName.set(key, [spawn]);
    }

    const unknownCurrencies = new Set<string>();
    const usedIds = new Set<string>();
    const shops: ShopOut[] = [];
    let withNpcs = 0;
    let withoutNpcs = 0;
    let skippedEmpty = 0;
    let skippedCurrency = 0;

    // Skip category / meta pages that appear in wiki dump but aren't in DayV shop stock
    for (const [name, shop] of Object.entries(shopsRaw)) {
        const items = Array.isArray(shop?.items) ? shop.items : [];
        if (items.length === 0) {
            skippedEmpty++;
            continue;
        }

        const info = shop.shop_info ?? {};
        const currencyName = info.currency ?? items[0]?.currency ?? "coins";
        const currencyItemId = resolveCurrency(currencyName, unknownCurrencies);
        if (currencyItemId < 0) {
            skippedCurrency++;
            continue;
        }

        const sellsAt = typeof info.sells_at === "number" ? info.sells_at : 1000;
        const buysAt = typeof info.buys_at === "number" ? info.buys_at : 500;
        const buyPriceMultiplier = Math.max(0, sellsAt / 1000);
        const sellPriceMultiplier = Math.max(0, buysAt / 1000);

        const stock: ShopStockOut[] = [];
        let defaultRestock = 40;
        for (const item of items) {
            if (!item || typeof item.id !== "number" || !(item.id > 0)) continue;
            const quantity = stockQuantity(item.stock);
            if (quantity <= 0) continue;
            const ticks = restockTicks(item.restock_time, defaultRestock);
            stock.push({
                itemId: Math.trunc(item.id),
                quantity,
                restockTicks: ticks,
            });
            defaultRestock = ticks;
        }
        if (stock.length === 0) {
            skippedEmpty++;
            continue;
        }

        const wikitext = wikiRaw[name];
        const owners = wikitext ? parseOwnerLinks(wikitext) : [];
        const mapPoints = wikitext ? parseMapPoints(wikitext) : [];
        const generalStore = isGeneralStore(name, wikitext);
        const npcIds = resolveNpcIds(owners, mapPoints, spawnsByName, { generalStore });
        if (npcIds.length > 0) withNpcs++;
        else withoutNpcs++;

        let id = slugify(name);
        if (!id) id = `shop_${shops.length}`;
        if (usedIds.has(id)) {
            let i = 2;
            while (usedIds.has(`${id}_${i}`)) i++;
            id = `${id}_${i}`;
        }
        usedIds.add(id);

        const capacity = Math.min(80, Math.max(40, stock.length));
        shops.push({
            id,
            name,
            npcIds,
            currencyItemId,
            capacity,
            generalStore,
            restockTicks: defaultRestock,
            buyPriceMultiplier,
            sellPriceMultiplier,
            stock,
            owners,
            centroid: mapCentroid(mapPoints),
        });
    }

    shops.sort((a, b) => a.name.localeCompare(b.name));

    // Resolve NPC collisions: each npcId may only belong to one shop (closest centroid wins when possible)
    resolveNpcCollisions(shops, spawns);

    const withNpcsFinal = shops.filter((s) => s.npcIds.length > 0).length;
    const withoutNpcsFinal = shops.length - withNpcsFinal;

    const payload = {
        $comment:
            "Generated by server/scripts/build-shops.ts from DayV osrsreboxed-db shop dumps + npc-spawns.json. Regenerate with yarn build-shops.",
        generatedAt: new Date().toISOString(),
        shopCount: shops.length,
        shopsWithNpcs: withNpcsFinal,
        shopsWithoutNpcs: withoutNpcsFinal,
        shops: shops.map(({ owners, centroid, ...rest }) => rest),
    };

    fs.writeFileSync(OUT, JSON.stringify(payload));
    console.log(`Wrote ${OUT}`);
    console.log(
        `shops=${shops.length} withNpcs=${withNpcsFinal} withoutNpcs=${withoutNpcsFinal} skippedEmpty=${skippedEmpty} skippedCurrency=${skippedCurrency}`,
    );
    if (unknownCurrencies.size) {
        console.log(
            "Skipped/unknown currencies:",
            [...unknownCurrencies].sort().join(", "),
        );
    }

    // Spot-check a few known shops
    const checks = [
        "Bob's Brilliant Axes.",
        "Lumbridge General Store",
        "Aubury's Rune Shop.",
        "Varrock General Store",
        "Zaff's Superior Staffs!",
    ];
    for (const n of checks) {
        const s = shops.find((x) => x.name === n);
        console.log(
            `  check ${n}: id=${s?.id} npcs=${s?.npcIds?.join(",") ?? "MISSING"} stock=${s?.stock.length ?? 0}`,
        );
    }
}

function resolveNpcCollisions(shops: ShopOut[], spawns: NpcSpawn[]): void {
    const spawnById = new Map<number, NpcSpawn>();
    for (const s of spawns) spawnById.set(s.id, s);

    type Claim = { shopId: string; score: number };
    const best = new Map<number, Claim>();

    for (const shop of shops) {
        for (const npcId of shop.npcIds) {
            const spawn = spawnById.get(npcId);
            let score = 0;
            if (spawn && shop.centroid) {
                // Closer shop wins; general stores get a tiny bias for their assistants
                const d = Math.sqrt(dist2(spawn.x, spawn.y, shop.centroid.x, shop.centroid.y));
                score = 100000 - d * 100 + (shop.generalStore ? 1 : 0);
            } else if (spawn) {
                score = 1000;
            } else {
                score = 1;
            }
            const existing = best.get(npcId);
            if (!existing || score > existing.score) {
                best.set(npcId, { shopId: shop.id, score });
            }
        }
    }

    for (const shop of shops) {
        shop.npcIds = shop.npcIds.filter((id) => best.get(id)?.shopId === shop.id);
    }
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
