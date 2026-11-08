import assert from "node:assert/strict";

import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { princeAliRescueQuest } from "../gamemodes/dev/quests/definitions/princeAliRescue";
import {
    BLONDE_WIG_ITEM_ID,
    BRONZE_KEY_ITEM_ID,
    GREY_WIG_ITEM_ID,
    LADY_KELI_VISIBLE_NPC_ID,
    PRINCE_ALI_VISIBLE_NPC_ID,
    PRISON_GATE_LOC_ID,
    ROPE_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_GUARD_DRUNK,
    STAGE_KELI_TIED,
    STAGE_SPOKEN_TO_OSMAN,
    VARP_PRINCE_ALI_RESCUE,
    YELLOW_DYE_ITEM_ID,
} from "../gamemodes/dev/quests/definitions/princeAliRescue/constants";

assert.equal(princeAliRescueQuest.name, "Prince Ali Rescue");
assert.equal(princeAliRescueQuest.varpId, VARP_PRINCE_ALI_RESCUE);
assert.equal(princeAliRescueQuest.completionValue, STAGE_COMPLETE);
assert.equal(princeAliRescueQuest.rewards.questPoints, 3);
assert.deepEqual(princeAliRescueQuest.rewards.items, [
    { itemId: 995, quantity: 700, label: "700 Coins" },
]);

const baseRegistry = new ScriptRegistry();
princeAliRescueQuest.register(baseRegistry, { system: {} } as ScriptServices);
assert.ok(baseRegistry.findNpcInteractionDirect(4285, "talk-to"));
assert.ok(baseRegistry.findNpcInteractionDirect(6165, "talk-to"));
assert.ok(baseRegistry.findNpcInteractionDirect(4274, "talk-to"));
assert.ok(baseRegistry.findNpcInteractionDirect(LADY_KELI_VISIBLE_NPC_ID, "talk-to"));
assert.ok(baseRegistry.findNpcInteractionDirect(PRINCE_ALI_VISIBLE_NPC_ID, "talk-to"));
assert.ok(baseRegistry.findItemOnNpc(ROPE_ITEM_ID, LADY_KELI_VISIBLE_NPC_ID));
assert.ok(baseRegistry.findItemOnLoc(BRONZE_KEY_ITEM_ID, PRISON_GATE_LOC_ID));

const journal = princeAliRescueQuest.buildJournal(
    { varps: { getVarpValue: () => STAGE_SPOKEN_TO_OSMAN } } as never,
    {
        inventory: {
            getInventoryItems: () => [
                { slot: 0, itemId: BRONZE_KEY_ITEM_ID, quantity: 1 },
                { slot: 1, itemId: ROPE_ITEM_ID, quantity: 1 },
            ],
        },
    } as unknown as ScriptServices,
);
assert.ok(journal.includes("<str>I have the duplicate bronze key.</str>"));
assert.ok(journal.includes("<str>I have rope for Lady Keli.</str>"));

const inventory = [
    { slot: 0, itemId: GREY_WIG_ITEM_ID, quantity: 1 },
    { slot: 1, itemId: YELLOW_DYE_ITEM_ID, quantity: 1 },
];
const craftingServices = {
    system: {},
    inventory: {
        getInventoryItems: () => inventory,
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => {
            inventory[slot] = { slot, itemId, quantity };
        },
        snapshotInventory: () => undefined,
        canStoreItem: () => true,
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const slot = inventory.findIndex((entry) => entry.itemId <= 0);
            inventory[slot] = { slot, itemId, quantity };
            return { slot, added: quantity };
        },
    },
    messaging: { sendGameMessage: () => undefined },
} as unknown as ScriptServices;
const craftingRegistry = new ScriptRegistry();
princeAliRescueQuest.register(craftingRegistry, craftingServices);
craftingRegistry.findItemOnItem(YELLOW_DYE_ITEM_ID, GREY_WIG_ITEM_ID)?.({
    player: {} as never,
    services: craftingServices,
    tick: 1,
    source: { slot: 1, itemId: YELLOW_DYE_ITEM_ID },
    target: { slot: 0, itemId: GREY_WIG_ITEM_ID },
});
assert.ok(inventory.some((entry) => entry.itemId === BLONDE_WIG_ITEM_ID));

let stage = STAGE_GUARD_DRUNK;
const rescueInventory = [{ slot: 0, itemId: ROPE_ITEM_ID, quantity: 1 }];
const rescueServices = {
    system: {},
    inventory: {
        getInventoryItems: () => rescueInventory,
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => {
            rescueInventory[slot] = { slot, itemId, quantity };
        },
        snapshotInventory: () => undefined,
    },
    variables: {
        sendVarp: (_player: unknown, _varpId: number, value: number) => {
            stage = value;
        },
    },
    npc: { removeNpc: () => true },
    messaging: { sendGameMessage: () => undefined },
    dialog: { queueWidgetEvent: () => undefined },
} as unknown as ScriptServices;
const rescueRegistry = new ScriptRegistry();
princeAliRescueQuest.register(rescueRegistry, rescueServices);
const rescuePlayer = {
    id: 9,
    varps: {
        getVarpValue: () => stage,
        setVarpValue: (_id: number, value: number) => {
            stage = value;
        },
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;
rescueRegistry.findItemOnNpc(ROPE_ITEM_ID, LADY_KELI_VISIBLE_NPC_ID)?.({
    player: rescuePlayer,
    services: rescueServices,
    tick: 1,
    source: { slot: 0, itemId: ROPE_ITEM_ID },
    target: { id: 44, typeId: LADY_KELI_VISIBLE_NPC_ID } as never,
});
assert.equal(stage, STAGE_KELI_TIED);

const spawnedTypes: number[] = [];
const actorServices = {
    system: {},
    npc: {
        spawnNpc: ({ id }: { id: number }) => {
            spawnedTypes.push(id);
            return { id: spawnedTypes.length, typeId: id };
        },
        removeNpc: () => true,
    },
} as unknown as ScriptServices;
const actorRegistry = new ScriptRegistry();
princeAliRescueQuest.register(actorRegistry, actorServices);
actorRegistry.findZoneHandler("prince_ali_rescue_jail", "enter")?.({
    player: {
        id: 20,
        tileX: 3120,
        tileY: 3245,
        level: 0,
        varps: { getVarpValue: () => 0 },
    } as never,
    services: actorServices,
    tick: 1,
    zone: { id: "prince_ali_rescue_jail", minX: 3111, maxX: 3138, minY: 3231, maxY: 3261 },
    type: "enter",
    previous: { x: 3110, y: 3245, level: 0, worldViewId: -1 },
    current: { x: 3111, y: 3245, level: 0, worldViewId: -1 },
});
assert.deepEqual(spawnedTypes, [11577, 11578, 11579]);

console.log("prince-ali-rescue-quest.test.ts: all assertions passed");
