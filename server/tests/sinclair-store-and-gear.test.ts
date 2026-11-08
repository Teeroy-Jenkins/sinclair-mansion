// The cosmetic store charges and pays what it says, head cosmetics hide only what the cache
// says they cover (the mime mask is just a face: hiding the hair too left the head invisible),
// and the chore token stacks under its Sinclair name.
import assert from "node:assert/strict";

import { getCacheLoaderFactory } from "../../client/rs/cache/loader/CacheLoaderFactory";
import { ObjStackability } from "../../client/rs/config/objtype/ObjStackability";
import { getHeadCoverage, HeadCoverage } from "../../client/rs/config/player/Equipment";
import { ShopManager } from "../gamemodes/dev/shops/ShopManager";
import { CHORE_TOKEN, contentPacket } from "../gamemodes/sinclair-mansion/butler";
import { COSMETIC_SHOP, COSMETIC_SHOP_ID } from "../gamemodes/sinclair-mansion/cosmetics";
import { getItemDefinition, setCacheStackability } from "../src/data/items";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { PlayerState } from "../src/game/player";
import { initCacheEnv } from "../src/world/CacheEnv";

const env = initCacheEnv("./caches", "osrs-237_2026-03-25");
const objs = getCacheLoaderFactory(env.info, env.cacheSystem).getObjTypeLoader();

// --- Head coverage, from each item's wearpos2/wearpos3 ---
const coverage = (id: number) => getHeadCoverage(objs.load(id));
assert.equal(coverage(3057), HeadCoverage.JAW, "mime mask hides the beard only");
assert.equal(coverage(1053), HeadCoverage.HAIR_AND_JAW, "h'ween mask hides hair and beard");
assert.equal(coverage(9925), HeadCoverage.HAIR, "skeleton mask hides the hair only");
assert.equal(coverage(2631), HeadCoverage.NONE, "highwayman mask hides neither");
assert.equal(coverage(1038), HeadCoverage.NONE, "partyhat hides neither");

// --- The chore token: the Warrior guild token, stacking, as the Sinclair Family IOU ---
// (importing butler.ts registers the renamed item, as the gamemode does)
setCacheStackability((id) => objs.load(id)?.stackability === ObjStackability.ALWAYS);
assert.equal(getItemDefinition(CHORE_TOKEN)?.stackable, true, "chore tokens stack");
assert.equal(objs.load(CHORE_TOKEN).name, "Sinclair Family IOU", "the server calls it an IOU");
const contentJson = JSON.parse(Buffer.from(contentPacket().subarray(8)).toString("utf-8"));
const sent = contentJson.datasets.find((d: { key: string }) => d.key === "customItems")?.rows?.[0];
assert.equal(sent?.id, CHORE_TOKEN, "clients get the renamed token at login");
assert.equal(sent?.objType?.name, "Sinclair Family IOU");
assert.equal(sent?.baseItemId, CHORE_TOKEN, "keeping the token's own model");

// --- The store ---
const COINS = 995;
const MODE = { id: "store-test", name: "Store test", initializePlayer: () => undefined } as unknown as GamemodeDefinition;
registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1,
});
const messages: string[] = [];
const manager = new ShopManager({
    getObjType: (id) => objs.load(id),
    addItemToInventory: (player, itemId, quantity) => {
        const t = player.addItem(itemId, quantity);
        return { slot: t.slots[0]?.slot ?? -1, added: t.completed };
    },
    snapshotInventory: () => {},
    sendGameMessage: (_player, text) => messages.push(text),
});
manager.registerDefinition(COSMETIC_SHOP);

function shopper(coins: number, emptySlots = 28): PlayerState {
    const player = new PlayerState(1, 3200, 3200, 0, MODE);
    player.setItemDefResolver((id) => ({ stackable: objs.load(id)?.stackability === ObjStackability.ALWAYS }));
    const pack = player.getInventoryEntries();
    for (let i = 0; i < pack.length; i++) {
        pack[i].itemId = i >= emptySlots ? 1925 : -1; // fill the rest with buckets
        pack[i].quantity = i >= emptySlots ? 1 : 0;
    }
    if (coins > 0) player.addItem(COINS, coins);
    manager.openShopById(player, COSMETIC_SHOP_ID);
    return player;
}
const count = (player: PlayerState, itemId: number) =>
    player.getInventoryEntries().reduce((n, e) => n + (e.itemId === itemId ? e.quantity : 0), 0);
const slotOf = (itemId: number) => COSMETIC_SHOP.stock.findIndex((s) => s.itemId === itemId);
const SKELETON_GLOVES = 9922; // 750 coins, untradeable in OSRS
const MIME_MASK = 3057; // 1,500 coins

// Buying charges the store's price, not the item's cache value.
let p = shopper(10_000);
manager.buyFromShop(p, slotOf(MIME_MASK), 1, 0);
assert.equal(count(p, MIME_MASK), 1);
assert.equal(count(p, COINS), 8_500, "mime mask costs 1,500");

// Buy 5 with coins for 2: buys 2, as in OSRS, and says why it stopped.
p = shopper(1_500);
messages.length = 0;
manager.buyFromShop(p, slotOf(SKELETON_GLOVES), 5, 0);
assert.equal(count(p, SKELETON_GLOVES), 2, "buys as many as the coins cover");
assert.equal(count(p, COINS), 0);
assert.deepEqual(messages, ["You don't have enough coins."]);

// Buy 10 with 3 free slots (one of them for the coins): buys 2.
p = shopper(100_000, 3);
messages.length = 0;
manager.buyFromShop(p, slotOf(SKELETON_GLOVES), 10, 0);
assert.equal(count(p, SKELETON_GLOVES), 2, "buys as many as fit");
assert.equal(count(p, COINS), 98_500);
assert.deepEqual(messages, ["You don't have enough inventory space."]);

// Value quotes what Sell pays, and the store buys back its own (untradeable) stock.
p = shopper(0);
p.addItem(SKELETON_GLOVES, 1);
assert.equal(manager.getInventoryItemSellValue(p, SKELETON_GLOVES)?.sellPrice, 337, "45% of 750, rounded down");
const glovesSlot = p.getInventoryEntries().findIndex((e) => e.itemId === SKELETON_GLOVES);
manager.sellToShop(p, glovesSlot, 1, SKELETON_GLOVES, 0);
assert.equal(count(p, SKELETON_GLOVES), 0, "sold");
assert.equal(count(p, COINS), 337, "paid what Value said");

// Something it doesn't stock: Value and Sell both say no.
p = shopper(0);
p.addItem(1925, 1);
messages.length = 0;
assert.equal(manager.getInventoryItemSellValue(p, 1925), undefined);
manager.sellToShop(p, p.getInventoryEntries().findIndex((e) => e.itemId === 1925), 1, 1925, 0);
assert.equal(count(p, 1925), 1, "kept");
assert.equal(messages.length, 2, "both explained");

console.log("sinclair store and gear: ok");
