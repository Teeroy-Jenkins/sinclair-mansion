// The Demon butler (the player-owned house's servant in OSRS) waits in the dining room and sells
// what the household needs to fight back: a dose of stamina potion, a shark, the runes for one Bind,
// a dose of prayer potion. He takes chore tokens, which every finished chore pays per step (MURDER_CONFIG.tokens).
// The shop is the engine's OSRS shop (interface 300), opened by his Talk-to during a game (store.ts).
import { CustomItemBuilder } from "../../../client/custom/items/CustomItemBuilder";
import { CustomItemRegistry } from "../../../client/custom/items/CustomItemRegistry";
import type { ShopDefinition } from "../dev/shops/types";
import { MURDER_CONFIG as C } from "./config";
import { encodeGamemodeData } from "./hud";
import type { Tile } from "./MurderGame";

/**
 * NPC 229, "Demon butler" (Talk-to), in the dining room's north-west corner, out of the way of the
 * table. He stands at his post and doesn't roam: the corner is boxed in by the walls and the
 * sideboard, and pacing it (to 2738,3581 and 2739,3581) drew his big model gliding through them.
 * Reached from the tile south of him, 2738,3581 (not a dinner seat).
 */
export const DEMON_BUTLER = { npcId: 229, tile: { x: 2738, y: 3582, level: 0 } as Tile, wanderRadius: 0,
    /** Faces south, into the room (spawn direction 1 = S). */
    direction: 1 };
export const BUTLER_SHOP_ID = "sinclair_butler";
export const CHORE_TOKEN = C.tokens.itemId;

/**
 * The chore token is OSRS's Warrior guild token under the family's name. Registered here for the
 * server's own item names, and sent to every client at login (contentPacket) for theirs.
 */
const CHORE_TOKEN_ITEM = CustomItemBuilder.create(CHORE_TOKEN)
    .basedOn(CHORE_TOKEN)
    .name(C.tokens.name)
    .examine(C.tokens.examine)
    .stackable()
    .build();
CustomItemRegistry.register(CHORE_TOKEN_ITEM, "sinclair-mansion");

/**
 * Food that turns up during chores (picked in the garden or made along the way) has its Eat taken
 * off the menu: the butler's shark is the only food. The cache gives each of these an Eat
 * (`yarn tsx scripts/obj-ops.ts`); the pat of butter never had one. index.ts also refuses "eat".
 */
const CHORE_FOODS: Array<[number, string]> = [
    [1942, "Potato"], [6701, "Baked potato"], [6703, "Potato with butter"], [1965, "Cabbage"],
    [1985, "Cheese"], [2142, "Cooked meat"], [2003, "Stew"], [2309, "Bread"],
];
export const UNEATABLE_FOODS = CHORE_FOODS.map(([id]) => id);
const UNEATABLE_FOOD_ITEMS = CHORE_FOODS.map(([id, name]) =>
    CustomItemBuilder.create(id).basedOn(id).name(name).inventoryActions(null, null, null, null, "Drop").build(),
);

/** The GAMEMODE_DATA packet with this mode's custom items, for the client's content store. */
export function contentPacket(): Uint8Array {
    return encodeGamemodeData({ datasets: [{ key: "customItems", rows: [CHORE_TOKEN_ITEM, ...UNEATABLE_FOOD_ITEMS] }] });
}
/** The Bind runes are sold as a rune pouch, which empties into your pack as you buy it. */
export const RUNE_POUCH = 12791;
/** Shared by everyone in the game, so plenty, coming back quickly. */
const STOCK = 10;
const RESTOCK_TICKS = 10;

export type Ware = "stamina" | "shark" | "runes" | "potion";
/** In the shop's order, cheapest first. */
export const WARES: Ware[] = ["stamina", "runes", "shark", "potion"];
/** The item the shop shows (and sells) for each ware. */
export const WARE_ITEM: Record<Ware, number> = {
    stamina: C.rewards.staminaPotion, shark: C.rewards.shark, runes: RUNE_POUCH, potion: C.rewards.prayerPotion,
};

/**
 * A ware's price in tokens: its base price (`tokens.basePrice`) plus one for every three members
 * of the household in the game (rounded down), so bigger games, which earn more, pay more.
 */
export function warePrice(ware: Ware, household: number): number {
    return C.tokens.basePrice[ware] + Math.floor(Math.max(0, household) / 3);
}

/** A specialty shop that buys nothing back (store.ts refuses sales), priced for a game this size. */
export function butlerShop(household: number): ShopDefinition {
    return {
        id: BUTLER_SHOP_ID,
        name: "The Demon Butler's Pantry",
        npcIds: [], // opened by his Talk-to, and only during a game
        currencyItemId: CHORE_TOKEN,
        capacity: 40,
        generalStore: false,
        restockTicks: RESTOCK_TICKS,
        stock: WARES.map((w) => ({ itemId: WARE_ITEM[w], quantity: STOCK, price: warePrice(w, household) })),
    };
}
