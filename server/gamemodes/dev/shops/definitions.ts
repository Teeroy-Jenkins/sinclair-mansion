import fs from "fs";
import path from "path";
import { type ShopDefinition } from "./types";

type ShopsFile = {
    shops?: ShopDefinition[];
};

const TEST_WEAPONS_SHOP: ShopDefinition = {
    id: "test_weapons_shop",
    name: "Test Weapons Shop",
    // Dedicated non-world NPC id so Trade never steals a real shopkeeper (e.g. Arhein).
    npcIds: [39998],
    currencyItemId: 995,
    capacity: 60,
    generalStore: false,
    restockTicks: 1,
    buyPriceMultiplier: 0,
    sellPriceMultiplier: 0,
    stock: [
        // Melee weapons
        { itemId: 4151, quantity: 100, price: 0 }, // Abyssal whip
        { itemId: 4587, quantity: 100, price: 0 }, // Dragon scimitar
        { itemId: 1305, quantity: 100, price: 0 }, // Dragon longsword
        { itemId: 5698, quantity: 100, price: 0 }, // Dragon dagger (p++)
        { itemId: 11802, quantity: 100, price: 0 }, // Armadyl godsword
        { itemId: 11804, quantity: 100, price: 0 }, // Bandos godsword
        { itemId: 11806, quantity: 100, price: 0 }, // Saradomin godsword
        { itemId: 11808, quantity: 100, price: 0 }, // Zamorak godsword
        { itemId: 13652, quantity: 100, price: 0 }, // Dragon claws
        { itemId: 13576, quantity: 100, price: 0 }, // Dragon warhammer
        { itemId: 21003, quantity: 100, price: 0 }, // Elder maul
        { itemId: 22324, quantity: 100, price: 0 }, // Ghrazi rapier
        { itemId: 24417, quantity: 100, price: 0 }, // Inquisitor's mace
        { itemId: 22325, quantity: 100, price: 0 }, // Scythe of vitur
        { itemId: 25867, quantity: 100, price: 0 }, // Blade of saeldor
        { itemId: 1434, quantity: 100, price: 0 }, // Dragon mace
        { itemId: 4718, quantity: 100, price: 0 }, // Dharok's greataxe
        { itemId: 4726, quantity: 100, price: 0 }, // Guthan's warspear
        { itemId: 4747, quantity: 100, price: 0 }, // Torag's hammers
        { itemId: 4755, quantity: 100, price: 0 }, // Verac's flail
        // Ranged weapons
        { itemId: 11785, quantity: 100, price: 0 }, // Armadyl crossbow
        { itemId: 20997, quantity: 100, price: 0 }, // Twisted bow
        { itemId: 25862, quantity: 100, price: 0 }, // Bow of faerdhinen
        { itemId: 12926, quantity: 100, price: 0 }, // Toxic blowpipe
        { itemId: 861, quantity: 100, price: 0 }, // Magic shortbow
        { itemId: 4212, quantity: 100, price: 0 }, // Crystal bow
        { itemId: 9185, quantity: 100, price: 0 }, // Rune crossbow
        { itemId: 11235, quantity: 100, price: 0 }, // Dark bow
        { itemId: 19481, quantity: 100, price: 0 }, // Heavy ballista
        { itemId: 19478, quantity: 100, price: 0 }, // Light ballista
        // Magic weapons
        { itemId: 11791, quantity: 100, price: 0 }, // Staff of the dead
        { itemId: 11905, quantity: 100, price: 0 }, // Trident of the seas
        { itemId: 12899, quantity: 100, price: 0 }, // Trident of the swamp
        { itemId: 21006, quantity: 100, price: 0 }, // Kodai wand
        { itemId: 24422, quantity: 100, price: 0 }, // Eldritch nightmare staff
        { itemId: 24423, quantity: 100, price: 0 }, // Harmonised nightmare staff
        { itemId: 24424, quantity: 100, price: 0 }, // Volatile nightmare staff
        { itemId: 22647, quantity: 100, price: 0 }, // Sanguinesti staff
        { itemId: 4675, quantity: 100, price: 0 }, // Ancient staff
        { itemId: 6914, quantity: 100, price: 0 }, // Master wand
        // Ammo
        { itemId: 11212, quantity: 10000, price: 0 }, // Dragon arrow
        { itemId: 9244, quantity: 10000, price: 0 }, // Dragon bolts (e)
        { itemId: 892, quantity: 10000, price: 0 }, // Rune arrow
        { itemId: 9245, quantity: 10000, price: 0 }, // Onyx bolts (e)
        { itemId: 21326, quantity: 10000, price: 0 }, // Dragon javelin
    ],
};

// This F2P shop is absent from the imported DayV catalog, but its shopkeeper
// and assistant (2884/2885) are registered with a trade dialogue in Varrock.
const VARROCK_SWORDSHOP: ShopDefinition = {
    id: "varrock_swordshop",
    name: "Varrock Swordshop",
    npcIds: [2884, 2885],
    currencyItemId: 995,
    capacity: 40,
    generalStore: false,
    restockTicks: 100,
    buyPriceMultiplier: 1,
    sellPriceMultiplier: 0.6,
    stock: [
        { itemId: 1205, quantity: 5 }, // Bronze dagger
        { itemId: 1203, quantity: 5 }, // Iron dagger
        { itemId: 1207, quantity: 5 }, // Steel dagger
        { itemId: 1217, quantity: 5 }, // Black dagger
        { itemId: 1209, quantity: 5 }, // Mithril dagger
        { itemId: 1211, quantity: 5 }, // Adamant dagger
        { itemId: 1277, quantity: 5 }, // Bronze sword
        { itemId: 1279, quantity: 5 }, // Iron sword
        { itemId: 1281, quantity: 5 }, // Steel sword
        { itemId: 1283, quantity: 5 }, // Black sword
        { itemId: 1285, quantity: 5 }, // Mithril sword
        { itemId: 1287, quantity: 5 }, // Adamant sword
        { itemId: 1291, quantity: 5 }, // Bronze longsword
        { itemId: 1293, quantity: 5 }, // Iron longsword
        { itemId: 1295, quantity: 5 }, // Steel longsword
        { itemId: 1297, quantity: 5 }, // Black longsword
        { itemId: 1299, quantity: 5 }, // Mithril longsword
        { itemId: 1301, quantity: 5 }, // Adamant longsword
    ],
};

function loadGeneratedShops(): ShopDefinition[] {
    const candidates = [
        path.resolve(__dirname, "../../../data/shops.json"),
        path.resolve(process.cwd(), "data/shops.json"),
        path.resolve(process.cwd(), "server/data/shops.json"),
    ];
    for (const filePath of candidates) {
        if (!fs.existsSync(filePath)) continue;
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as ShopsFile;
            if (Array.isArray(raw.shops) && raw.shops.length > 0) {
                return raw.shops.filter(
                    (shop) =>
                        shop &&
                        typeof shop.id === "string" &&
                        Array.isArray(shop.stock) &&
                        shop.stock.length > 0,
                );
            }
        } catch (err) {
            console.warn(`[shops] Failed to load ${filePath}:`, err);
        }
    }
    console.warn("[shops] shops.json not found; only override shops will be available");
    return [];
}

const GENERATED_SHOPS = loadGeneratedShops();

const SHOP_OVERRIDES: ShopDefinition[] = [TEST_WEAPONS_SHOP, VARROCK_SWORDSHOP];

const SHOP_DEFINITIONS: ShopDefinition[] = (() => {
    const byId = new Map<string, ShopDefinition>();
    for (const shop of GENERATED_SHOPS) {
        byId.set(shop.id, shop);
    }
    // Overrides win on id collision (e.g. test shop)
    for (const shop of SHOP_OVERRIDES) {
        byId.set(shop.id, shop);
    }
    return [...byId.values()];
})();

export function getShopDefinitionById(id: string): ShopDefinition | undefined {
    return SHOP_DEFINITIONS.find((shop) => shop.id === id);
}

export function getShopDefinitionByNpcId(npcId: number): ShopDefinition | undefined {
    const normalized = npcId;
    return SHOP_DEFINITIONS.find((shop) => shop.npcIds?.some((id) => id === normalized));
}

export function getAllShopDefinitions(): ShopDefinition[] {
    return SHOP_DEFINITIONS.slice();
}
