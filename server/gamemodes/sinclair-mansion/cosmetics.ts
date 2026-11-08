// The cosmetic store's stock: RuneScape's holiday items and fashionscape, bought with the
// coins earned in games. Cosmetics are yours for good, like coins: they survive the end of a
// game, death and the Detective handing over their kit (see `isCosmetic` in index.ts).
// The toys work as in 2009scape (`ToyListeners.kt`, `ToyHorseyListener.kt`).
import type { PlayerState } from "../../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../../src/game/scripts/types";
import type { ShopDefinition } from "../dev/shops/types";

export const COSMETIC_SHOP_ID = "sinclair_cosmetics";
/** Shop stock regrows one at a time, every minute (100 ticks). */
const RESTOCK_TICKS = 100;
const STOCK = 10;

/** [item id, price in coins]. 40 items: the OSRS shop interface shows 40 slots. */
const PRICES: Array<[number, number]> = [
    // Party hats (Christmas crackers)
    [1038, 32_000], // Red partyhat
    [1040, 32_000], // Yellow partyhat
    [1042, 32_000], // Blue partyhat
    [1044, 32_000], // Green partyhat
    [1046, 32_000], // Purple partyhat
    [1048, 32_000], // White partyhat
    [11862, 80_000], // Black partyhat
    [11863, 80_000], // Rainbow partyhat
    // Christmas
    [1050, 7_500], // Santa hat
    [13343, 11_250], // Black santa hat
    [13344, 11_250], // Inverted santa hat
    [10507, 3_000], // Reindeer hat
    // Halloween
    [1053, 9_000], // Green halloween mask
    [1055, 9_000], // Blue halloween mask
    [1057, 9_000], // Red halloween mask
    [11847, 18_000], // Black h'ween mask
    [9920, 3_750], // Jack lantern mask
    [9925, 1_500], // Skeleton mask
    [9924, 1_500], // Skeleton shirt
    [9923, 1_500], // Skeleton leggings
    [9922, 750], // Skeleton gloves
    [9921, 750], // Skeleton boots
    // Easter
    [1037, 4_500], // Bunny ears
    [13182, 3_000], // Bunny feet
    [21214, 3_750], // Easter egg helm
    [11021, 1_500], // Chicken head
    [11020, 1_500], // Chicken wings
    [11022, 1_500], // Chicken legs
    [11019, 750], // Chicken feet
    // Fashionscape (the Mime and Highwayman random events, Treasure Trails)
    [3057, 1_500], // Mime mask
    [3058, 1_500], // Mime top
    [3059, 1_500], // Mime legs
    [3060, 750], // Mime gloves
    [3061, 750], // Mime boots
    [2631, 2_250], // Highwayman mask
    [2639, 2_250], // Tan cavalier
    // Toys
    [4079, 750], // Yo-yo
    [4566, 1_125], // Rubber chicken
    [6867, 900], // Red marionette
    [2520, 600], // Brown toy horsey
];

export const COSMETIC_IDS: ReadonlySet<number> = new Set(PRICES.map(([id]) => id));

/** A specialty shop (it buys back only its own stock, at the engine's specialty rate). */
export const COSMETIC_SHOP: ShopDefinition = {
    id: COSMETIC_SHOP_ID,
    name: "Sinclair Family Costumes",
    npcIds: [],
    currencyItemId: 995,
    capacity: 40,
    generalStore: false,
    restockTicks: RESTOCK_TICKS,
    stock: PRICES.map(([itemId, price]) => ({ itemId, quantity: STOCK, price })),
};

// --- Toys (2009scape ToyListeners / ToyHorseyListener) ---
const YOYO = 4079;
const YOYO_ANIMS: Record<string, number> = { play: 1457, loop: 1458, walk: 1459, crazy: 1460 };
const MARIONETTES = [6867, 6866, 6865]; // red, green, blue
const MARIONETTE_ANIMS: Record<string, number> = { jump: 3003, walk: 3004, bow: 3005, dance: 3006 };
const MARIONETTE_GFX = [[507, 508, 509, 510], [511, 512, 513, 514], [515, 516, 517, 518]];
const HORSEYS: Record<number, number> = { 2520: 918, 2522: 919, 2524: 920, 2526: 921 };
const HORSEY_PHRASES = ["Come-on Dobbin, we can win the race!", "Hi-ho Silver, and away", "Neaahhhyyy! Giddy-up horsey!"];

/** Play with the toys from the store. `say` puts a line over the player's head (public chat). */
export function registerToyHandlers(registry: IScriptRegistry, say: (player: PlayerState, text: string) => void): void {
    const play = (services: ScriptServices, player: PlayerState, seq: number, gfx?: number) => {
        player.clearPath(); // a "high-priority" interaction: stop walking
        services.animation.playPlayerSeq(player, seq);
        if (gfx !== undefined) services.animation.broadcastPlayerSpot(player, gfx);
    };
    for (const [option, seq] of Object.entries(YOYO_ANIMS)) {
        registry.registerItemAction(YOYO, ({ player, services }) => play(services, player, seq), option);
    }
    MARIONETTES.forEach((itemId, colour) => {
        Object.entries(MARIONETTE_ANIMS).forEach(([option, seq], i) => {
            registry.registerItemAction(itemId, ({ player, services }) => play(services, player, seq, MARIONETTE_GFX[colour][i]), option);
        });
    });
    for (const [itemId, seq] of Object.entries(HORSEYS)) {
        registry.registerItemAction(Number(itemId), ({ player, services }) => {
            play(services, player, seq);
            say(player, HORSEY_PHRASES[Math.floor(Math.random() * HORSEY_PHRASES.length)]);
        }, "play-with");
    }
}
