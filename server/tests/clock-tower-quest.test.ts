import assert from "node:assert/strict";

import groundItemSpawns from "../gamemodes/dev/data/groundItemSpawnData.json";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import { clockTowerQuest } from "../gamemodes/dev/quests/definitions/clockTower";
import {
    BIT_BLACK_COG_COOLED,
    BIT_RAT_GATE_OPEN,
    BROTHER_KOJO_NPC_ID,
    COGS,
    ITEM,
    LOC,
    STAGE_ALL_COGS_PLACED,
    STAGE_COMPLETE,
    STAGE_PLACE_COGS,
    VARP_CLOCK_TOWER,
    VARP_CLOCK_TOWER_BITS,
} from "../gamemodes/dev/quests/definitions/clockTower/constants";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(clockTowerQuest.varpId, 10);
assert.deepEqual(clockTowerQuest.stageBits, { start: 0, end: 3 });
assert.equal(clockTowerQuest.completionValue, STAGE_COMPLETE);
assert.deepEqual(
    clockTowerQuest.rewards.items?.map((reward) => [reward.itemId, reward.quantity]),
    [[ITEM.coins, 500]],
);

for (const expected of [
    { id: ITEM.ratPoison, x: 2564, y: 9662 },
    { id: ITEM.blueCog, x: 2574, y: 9633 },
    { id: ITEM.whiteCog, x: 2577, y: 9655 },
    { id: ITEM.redCog, x: 2583, y: 9613 },
    { id: ITEM.blackCog, x: 2613, y: 9639 },
]) {
    assert.ok(
        groundItemSpawns.some(
            (spawn) =>
                spawn.id === expected.id &&
                spawn.x === expected.x &&
                spawn.y === expected.y &&
                spawn.plane === 0,
        ),
        `missing static Clock Tower spawn for item ${expected.id}`,
    );
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_CLOCK_TOWER, 0],
    [VARP_CLOCK_TOWER_BITS, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
let equippedGloves = -1;
let removedStackId: number | undefined;
let teleports = 0;
const messages: string[] = [];
const player = {
    id: 71,
    name: "Clock tester",
    tileX: 2594,
    tileY: 9657,
    level: 0,
    worldViewId: -1,
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;

function addItem(itemId: number, quantity = 1): number {
    const entry = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
    assert.ok(entry);
    entry.itemId = itemId;
    entry.quantity = quantity;
    return entry.slot;
}

const services = {
    variables: {
        sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value),
    },
    messaging: {
        sendGameMessage: (_player: unknown, message: string) => messages.push(message),
    },
    inventory: {
        getInventoryItems: () => slots,
        collectCarriedItemIds: () => slots.filter((slot) => slot.itemId > 0).map((slot) => slot.itemId),
        canStoreItem: () => slots.some((slot) => slot.itemId <= 0 || slot.quantity <= 0),
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const existing = itemId === ITEM.coins
                ? slots.find((slot) => slot.itemId === itemId && slot.quantity > 0)
                : undefined;
            const entry = existing ?? slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
            if (!entry) return { slot: -1, added: 0 };
            entry.itemId = itemId;
            entry.quantity += quantity;
            return { slot: entry.slot, added: quantity };
        },
        consumeItem: (_player: unknown, slot: number) => {
            const entry = slots[slot];
            if (!entry || entry.quantity <= 0) return false;
            entry.quantity--;
            if (entry.quantity === 0) slots[slot] = { slot, itemId: -1, quantity: 0 };
            return true;
        },
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => {
            slots[slot] = { slot, itemId, quantity };
        },
        snapshotInventory: () => undefined,
    },
    equipment: { getEquippedItem: () => equippedGloves },
    groundItems: {
        remove: (stackId: number) => {
            removedStackId = stackId;
            return { removed: 1, remaining: 0 };
        },
    },
    dialog: {
        getInterfaceService: () => ({ getCurrentChatboxModal: () => undefined }),
        openDialog: (_player: unknown, spec: { onContinue?: () => void }) => spec.onContinue?.(),
        openDialogOptions: (_player: unknown, spec: { onSelect?: (choice: number) => void }) =>
            spec.onSelect?.(0),
        closeDialog: () => undefined,
        openSubInterface: () => undefined,
        queueWidgetEvent: () => undefined,
    },
    viewport: { getMainmodalUid: () => 0 },
    movement: { teleportPlayer: () => teleports++ },
    data: { getObjType: () => ({ stackable: 1 }) },
    skills: { addSkillXp: () => undefined },
    sound: { sendJingle: () => undefined },
    system: { logger: { info: () => undefined, error: () => undefined } },
} as unknown as ScriptServices;

clockTowerQuest.register(registry, services);
const kojoTalk = registry.findNpcInteractionDirect(BROTHER_KOJO_NPC_ID, "talk-to");
assert.ok(kojoTalk);
assert.ok(registry.findGroundItemInteraction(ITEM.blackCog, "take"));
assert.ok(registry.findItemOnGround(ITEM.bucketOfWater, ITEM.blackCog));
assert.ok(registry.findItemOnLoc(ITEM.ratPoison, LOC.foodTrough));

const whiteTake = registry.findGroundItemInteraction(ITEM.whiteCog, "take")!;
whiteTake({
    player,
    services,
    option: "take",
    target: {
        stackId: 100,
        itemId: ITEM.whiteCog,
        quantity: 1,
        tile: { x: 2577, y: 9655, level: 0 },
        worldViewId: -1,
    },
} as never);
assert.equal(slots.some((slot) => slot.itemId === ITEM.whiteCog), false);

kojoTalk!({ player, services, npc: { typeId: BROTHER_KOJO_NPC_ID } } as never);
assert.equal(getQuestStage(player, clockTowerQuest), STAGE_PLACE_COGS);

const poisonSlot = addItem(ITEM.ratPoison);
registry.findItemOnLoc(ITEM.ratPoison, LOC.foodTrough)!({
    player,
    services,
    source: { slot: poisonSlot, itemId: ITEM.ratPoison },
    target: { locId: LOC.foodTrough, tile: { x: 2586, y: 9654 }, level: 0 },
} as never);
assert.equal(varps.get(VARP_CLOCK_TOWER), STAGE_PLACE_COGS | (1 << BIT_RAT_GATE_OPEN));
assert.equal(getQuestStage(player, clockTowerQuest), STAGE_PLACE_COGS);

whiteTake({
    player,
    services,
    option: "take",
    target: {
        stackId: 101,
        itemId: ITEM.whiteCog,
        quantity: 1,
        tile: { x: 2577, y: 9655, level: 0 },
        worldViewId: -1,
    },
} as never);
assert.equal(removedStackId, 101);
const whiteSlot = slots.find((slot) => slot.itemId === ITEM.whiteCog)!.slot;
registry.findItemOnLoc(ITEM.whiteCog, LOC.blackSpindle)!({
    player,
    services,
    source: { slot: whiteSlot, itemId: ITEM.whiteCog },
    target: { locId: LOC.blackSpindle, tile: { x: 2570, y: 9642 }, level: 0 },
} as never);
assert.equal(slots[whiteSlot].itemId, ITEM.whiteCog);
registry.findItemOnLoc(ITEM.whiteCog, LOC.whiteSpindle)!({
    player,
    services,
    source: { slot: whiteSlot, itemId: ITEM.whiteCog },
    target: { locId: LOC.whiteSpindle, tile: { x: 2567, y: 3241 }, level: 2 },
} as never);
assert.equal(getQuestStage(player, clockTowerQuest), 2);

const blackTake = registry.findGroundItemInteraction(ITEM.blackCog, "take")!;
blackTake({
    player,
    services,
    option: "take",
    target: {
        stackId: 102,
        itemId: ITEM.blackCog,
        quantity: 1,
        tile: { x: 2613, y: 9639, level: 0 },
        worldViewId: -1,
    },
} as never);
assert.equal(slots.some((slot) => slot.itemId === ITEM.blackCog), false);

const waterSlot = addItem(ITEM.bucketOfWater);
registry.findItemOnGround(ITEM.bucketOfWater, ITEM.blackCog)!({
    player,
    services,
    source: { slot: waterSlot, itemId: ITEM.bucketOfWater },
    target: {
        stackId: 102,
        itemId: ITEM.blackCog,
        quantity: 1,
        tile: { x: 2613, y: 9639, level: 0 },
        worldViewId: -1,
    },
} as never);
assert.ok((varps.get(VARP_CLOCK_TOWER_BITS)! & (1 << BIT_BLACK_COG_COOLED)) !== 0);
assert.ok(slots.some((slot) => slot.itemId === ITEM.bucket));

blackTake({
    player,
    services,
    option: "take",
    target: {
        stackId: 102,
        itemId: ITEM.blackCog,
        quantity: 1,
        tile: { x: 2613, y: 9639, level: 0 },
        worldViewId: -1,
    },
} as never);
let blackSlot = slots.find((slot) => slot.itemId === ITEM.blackCog)!.slot;
registry.findItemOnLoc(ITEM.blackCog, LOC.blackSpindle)!({
    player,
    services,
    source: { slot: blackSlot, itemId: ITEM.blackCog },
    target: { locId: LOC.blackSpindle, tile: { x: 2570, y: 9642 }, level: 0 },
} as never);

for (const cog of COGS.filter((entry) => entry.itemId === ITEM.blueCog || entry.itemId === ITEM.redCog)) {
    const slot = addItem(cog.itemId);
    registry.findItemOnLoc(cog.itemId, cog.spindleLocId)!({
        player,
        services,
        source: { slot, itemId: cog.itemId },
        target: { locId: cog.spindleLocId, tile: { x: 2568, y: 3241 }, level: 1 },
    } as never);
}
assert.equal(getQuestStage(player, clockTowerQuest), STAGE_ALL_COGS_PLACED);
assert.equal(varps.get(VARP_CLOCK_TOWER)! & (1 << BIT_RAT_GATE_OPEN), 1 << BIT_RAT_GATE_OPEN);

const placedJournal = clockTowerQuest.buildJournal(player, services).join("\n");
for (const cog of COGS) assert.match(placedJournal, new RegExp(`placed the ${cog.name} cog`, "i"));

kojoTalk!({ player, services, npc: { typeId: BROTHER_KOJO_NPC_ID } } as never);
assert.equal(getQuestStage(player, clockTowerQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 1);
assert.equal(slots.find((slot) => slot.itemId === ITEM.coins)?.quantity, 500);
assert.match(clockTowerQuest.buildJournal(player, services).join("\n"), /QUEST COMPLETE/);

kojoTalk!({ player, services, npc: { typeId: BROTHER_KOJO_NPC_ID } } as never);
assert.equal(varps.get(VARP_QUEST_POINTS), 1, "post-quest dialogue must not duplicate rewards");
assert.equal(slots.find((slot) => slot.itemId === ITEM.coins)?.quantity, 500);

registry.findLocInteraction(LOC.poisonedRatGate, "go-through")!({
    player,
    services,
    locId: LOC.poisonedRatGate,
    tile: { x: 2579, y: 9656 },
    level: 0,
} as never);
assert.equal(teleports, 1);

assert.ok(messages.some((message) => message.includes("red hot")));

console.log("clock-tower-quest.test.ts: all assertions passed");
