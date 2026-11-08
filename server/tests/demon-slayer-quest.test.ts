import assert from "node:assert/strict";

import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";
import { demonSlayerQuest } from "../gamemodes/dev/quests/definitions/demonSlayer";
import {
    ARIS_VISIBLE_NPC_ID,
    BUCKET_OF_WATER_ITEM_ID,
    DELRITH_NPC_ID,
    DEMON_DRAIN_LOC_IDS,
    PRYSIN_KEY_ITEM_ID,
    SEWER_KEY_TILE,
    SILVERLIGHT_ITEM_ID,
    STAGE_COLLECTING_BONES,
    STAGE_COMPLETE,
    STAGE_SILVERLIGHT,
    VARP_DEMON_SLAYER,
    WEAKENED_DELRITH_NPC_ID,
} from "../gamemodes/dev/quests/definitions/demonSlayer/constants";

assert.equal(demonSlayerQuest.name, "Demon Slayer");
assert.equal(demonSlayerQuest.varpId, VARP_DEMON_SLAYER);
assert.equal(demonSlayerQuest.completionValue, STAGE_COMPLETE);
assert.deepEqual(demonSlayerQuest.stageBits, { start: 0, end: 4 });
assert.equal(demonSlayerQuest.rewards.questPoints, 3);

const baseRegistry = new ScriptRegistry();
demonSlayerQuest.register(baseRegistry, { system: {} } as ScriptServices);
assert.ok(baseRegistry.findNpcInteractionDirect(ARIS_VISIBLE_NPC_ID, "talk-to"));
assert.ok(baseRegistry.findNpcInteractionDirect(5083, "talk-to"));
assert.ok(baseRegistry.findNpcInteractionDirect(5085, "talk-to"));
assert.ok(baseRegistry.findNpcInteractionDirect(5081, "talk-to"));
assert.ok(baseRegistry.findNpcInteractionDirect(WEAKENED_DELRITH_NPC_ID, "banish"));
assert.ok(baseRegistry.findLocInteraction(DEMON_DRAIN_LOC_IDS[0], "search"));
assert.ok(baseRegistry.findItemOnLoc(BUCKET_OF_WATER_ITEM_ID, DEMON_DRAIN_LOC_IDS[0]));

const journal = demonSlayerQuest.buildJournal(
    { varps: { getVarpValue: () => STAGE_COLLECTING_BONES + 2 } } as never,
    {
        inventory: { getInventoryItems: () => [] },
    } as unknown as ScriptServices,
);
assert.ok(journal.includes("Wizard Traiborn still needs 23 sets of bones."));

const inventory = [{ slot: 0, itemId: BUCKET_OF_WATER_ITEM_ID, quantity: 1 }];
let spawnedKey: unknown;
const drainPlayer = {
    id: 12,
    varps: {
        getVarpValue: () => 0,
        getVarbitValue: () => 1,
        setVarpValue: () => undefined,
        setVarbitValue: () => undefined,
    },
} as never;
const drainServices = {
    system: {},
    inventory: {
        getInventoryItems: () => inventory,
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => {
            inventory[slot] = { slot, itemId, quantity };
        },
        snapshotInventory: () => undefined,
        canStoreItem: () => true,
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            inventory[0] = { slot: 0, itemId, quantity };
            return { slot: 0, added: quantity };
        },
        findOwnedItemLocation: () => undefined,
    },
    groundItems: {
        query: () => [],
        spawn: (itemId: number, quantity: number, tile: unknown, options: unknown) => {
            spawnedKey = { itemId, quantity, tile, options };
        },
    },
    variables: { sendVarp: () => undefined, sendVarbit: () => undefined },
    messaging: { sendGameMessage: () => undefined },
} as unknown as ScriptServices;
const drainRegistry = new ScriptRegistry();
demonSlayerQuest.register(drainRegistry, drainServices);
drainRegistry.findItemOnLoc(BUCKET_OF_WATER_ITEM_ID, DEMON_DRAIN_LOC_IDS[0])?.({
    player: drainPlayer,
    services: drainServices,
    tick: 1,
    source: { slot: 0, itemId: BUCKET_OF_WATER_ITEM_ID },
    target: { locId: DEMON_DRAIN_LOC_IDS[0], tile: { x: 3225, y: 3496 }, level: 0 },
});
assert.deepEqual(spawnedKey, {
    itemId: PRYSIN_KEY_ITEM_ID,
    quantity: 1,
    tile: SEWER_KEY_TILE,
    options: { ownerId: 12, privateTicks: 300, durationTicks: 300 },
});

const eventHandlers = new Map<string, Array<(payload: any) => void>>();
const spawnedTypes: number[] = [];
let nextNpcId = 100;
const encounterServices = {
    system: {
        getCurrentTick: () => 50,
        eventBus: {
            on: (eventName: string, handler: (payload: any) => void) => {
                const handlers = eventHandlers.get(eventName) ?? [];
                handlers.push(handler);
                eventHandlers.set(eventName, handlers);
            },
        },
    },
    npc: {
        spawnNpc: ({ id, x, y, level }: { id: number; x: number; y: number; level: number }) => {
            spawnedTypes.push(id);
            return { id: nextNpcId++, typeId: id, tileX: x, tileY: y, level };
        },
        removeNpc: () => true,
    },
    inventory: { findOwnedItemLocation: () => "equipment" },
    messaging: { sendGameMessage: () => undefined },
} as unknown as ScriptServices;
const encounterRegistry = new ScriptRegistry();
demonSlayerQuest.register(encounterRegistry, encounterServices);
const encounterPlayer = {
    id: 77,
    tileX: 3228,
    tileY: 3369,
    level: 0,
    varps: { getVarpValue: () => STAGE_SILVERLIGHT },
} as never;
encounterRegistry.findZoneHandler("demon_slayer_stone_circle", "enter")?.({
    player: encounterPlayer,
    services: encounterServices,
    tick: 50,
    zone: { id: "demon_slayer_stone_circle", minX: 3220, maxX: 3235, minY: 3362, maxY: 3377 },
    type: "enter",
    previous: { x: 3219, y: 3369, level: 0, worldViewId: -1 },
    current: { x: 3220, y: 3369, level: 0, worldViewId: -1 },
});
assert.equal(spawnedTypes.at(-1), DELRITH_NPC_ID);
const preDeathDecision = encounterRegistry.findNpcPreDeath(DELRITH_NPC_ID)?.({
    player: encounterPlayer,
    services: encounterServices,
    tick: 51,
    npc: { id: 100, typeId: DELRITH_NPC_ID, tileX: 3228, tileY: 3369, level: 0 },
    killer: encounterPlayer,
    killerPlayerId: 77,
    hit: {
        proposedDamage: 10,
        style: 0,
        maxHit: 10,
        hitpointsBefore: 4,
        hitpointsAfter: 0,
        cause: "combat",
    },
} as never);
assert.equal(preDeathDecision, NpcPreDeathDecision.Prevent);
assert.equal(spawnedTypes.at(-1), WEAKENED_DELRITH_NPC_ID);
assert.equal(SILVERLIGHT_ITEM_ID, 2402);

console.log("demon-slayer-quest.test.ts: all assertions passed");
