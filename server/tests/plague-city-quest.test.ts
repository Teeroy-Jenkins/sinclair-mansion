import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import groundItemSpawns from "../gamemodes/dev/data/groundItemSpawnData.json";
import { plagueCityQuest } from "../gamemodes/dev/quests/definitions/plagueCity";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_CLERK_PERMISSION,
    STAGE_COMPLETE,
    STAGE_FIND_DWELLBERRIES,
    STAGE_FREED_ELENA,
    STAGE_GAS_MASK,
    STAGE_HAVE_WARRANT,
    STAGE_NEED_CLEARANCE,
    STAGE_NEED_HANGOVER_CURE,
    STAGE_PIPE_OPEN,
    STAGE_READ_SCROLL,
    STAGE_RETURNED_BOOK,
    STAGE_ROPE_TIED,
    STAGE_SHOWN_PICTURE,
    STAGE_SOFTEN_MUD,
    STAGE_SPOKE_TO_MILLI,
    STAGE_SPOKE_TO_REHNISONS,
    STAGE_TUNNEL_OPEN,
    STAGE_WATER_4,
    VARP_PLAGUE_CITY,
} from "../gamemodes/dev/quests/definitions/plagueCity/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(plagueCityQuest.varpId, VARP_PLAGUE_CITY);
assert.equal(plagueCityQuest.completionValue, STAGE_COMPLETE);
assert.equal(plagueCityQuest.rewards.questPoints, 1);
assert.equal(plagueCityQuest.rewards.xp?.[0]?.amount, 2425);
assert.deepEqual(plagueCityQuest.rewards.items?.map((item) => [item.itemId, item.quantity]), [
    [ITEM.ardougneTeleportScroll, 1],
]);
assert.ok(groundItemSpawns.some((spawn) => spawn.id === ITEM.picture && spawn.x === 2576 && spawn.y === 3334));
for (const npcId of [NPC.edmond, NPC.elena, NPC.jethick[1]]) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing Plague City NPC spawn ${npcId}`);
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_PLAGUE_CITY, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
let equippedHead = -1;
let miningXp = 0;
let teleports = 0;
let spawnedSewerEdmond = 0;
const messages: string[] = [];
const player = {
    id: 91,
    name: "Plague tester",
    tileX: 2564,
    tileY: 3332,
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
    assert.ok(entry, `no slot for item ${itemId}`);
    entry.itemId = itemId;
    entry.quantity = quantity;
    return entry.slot;
}

const services = {
    variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
    messaging: { sendGameMessage: (_player: unknown, message: string) => messages.push(message) },
    inventory: {
        getInventoryItems: () => slots,
        collectCarriedItemIds: () => slots.filter((slot) => slot.itemId > 0).map((slot) => slot.itemId),
        playerHasItem: (_player: unknown, itemId: number) =>
            slots.some((slot) => slot.itemId === itemId && slot.quantity > 0),
        findOwnedItemLocation: (_player: unknown, itemId: number) => {
            const entry = slots.find((slot) => slot.itemId === itemId && slot.quantity > 0);
            return entry ? { type: "inventory", slot: entry.slot } : undefined;
        },
        findInventorySlotWithItem: (_player: unknown, itemId: number) =>
            slots.find((slot) => slot.itemId === itemId && slot.quantity > 0)?.slot,
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const entry = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
            if (!entry) return { slot: -1, added: 0, remaining: quantity };
            entry.itemId = itemId;
            entry.quantity = quantity;
            return { slot: entry.slot, added: quantity, remaining: 0 };
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
    equipment: { getEquippedItem: () => equippedHead },
    location: { replaceTemporaryLoc: () => ({}) },
    movement: { teleportPlayer: () => teleports++ },
    npc: {
        spawnNpc: (config: { ownerPlayerId?: number }) => {
            assert.equal(config.ownerPlayerId, 91);
            spawnedSewerEdmond++;
            return {};
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
    data: { getObjType: () => ({ stackable: 0 }) },
    skills: {
        addSkillXp: (_player: unknown, skillId: number, amount: number) => {
            if (skillId === SkillId.Mining) miningXp += amount;
        },
    },
    sound: { sendJingle: () => undefined },
    system: { logger: { info: () => undefined, error: () => undefined } },
} as unknown as ScriptServices;

plagueCityQuest.register(registry, services);
const talk = (npcId: number) => {
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing talk handler for NPC ${npcId}`);
    handler({ player, services, npc: { typeId: npcId } } as never);
};

talk(NPC.edmond);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_FIND_DWELLBERRIES);
addItem(ITEM.dwellberries);
talk(NPC.alrena);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_GAS_MASK);
assert.ok(slots.some((slot) => slot.itemId === ITEM.gasMask));
talk(NPC.edmond);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_SOFTEN_MUD);

for (let i = 0; i < 4; i++) {
    const slot = addItem(ITEM.bucketOfWater);
    registry.findItemOnLoc(ITEM.bucketOfWater, LOC.mudPatch)!({
        player,
        services,
        source: { slot, itemId: ITEM.bucketOfWater },
        target: { locId: LOC.mudPatch, tile: { x: 2566, y: 3331 }, level: 0 },
    } as never);
}
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_WATER_4);

const spadeSlot = addItem(ITEM.spade);
registry.findItemOnLoc(ITEM.spade, LOC.mudPatch)!({
    player,
    services,
    source: { slot: spadeSlot, itemId: ITEM.spade },
    target: { locId: LOC.mudPatch, tile: { x: 2566, y: 3331 }, level: 0 },
} as never);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_TUNNEL_OPEN);
assert.equal(spawnedSewerEdmond, 1);

const ropeSlot = addItem(ITEM.rope);
registry.findItemOnLoc(ITEM.rope, LOC.sewerPipe)!({
    player,
    services,
    source: { slot: ropeSlot, itemId: ITEM.rope },
    target: { locId: LOC.sewerPipe, tile: { x: 2530, y: 9703 }, level: 0 },
} as never);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_ROPE_TIED);
talk(NPC.edmond);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_PIPE_OPEN);

equippedHead = ITEM.gasMask;
registry.findLocInteraction(LOC.sewerPipe, "open")!({
    player,
    services,
    locId: LOC.sewerPipe,
    tile: { x: 2530, y: 9703 },
    level: 0,
} as never);

addItem(ITEM.picture);
talk(NPC.jethick[1]);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_SHOWN_PICTURE);
assert.ok(slots.some((slot) => slot.itemId === ITEM.book));
registry.findLocInteraction(LOC.rehnisonDoor, "open")!({
    player,
    services,
    locId: LOC.rehnisonDoor,
    tile: { x: 2531, y: 3328 },
    level: 0,
} as never);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_RETURNED_BOOK);

talk(NPC.tedRehnison);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_SPOKE_TO_REHNISONS);
talk(NPC.milliRehnison);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_SPOKE_TO_MILLI);
registry.findLocInteraction(LOC.plagueHouseDoorClosed, "open")!({
    player,
    services,
    locId: LOC.plagueHouseDoorClosed,
    tile: { x: 2537, y: 3268 },
    level: 0,
} as never);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_NEED_CLEARANCE);

talk(NPC.clerk);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_CLERK_PERMISSION);
talk(NPC.bravek);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_NEED_HANGOVER_CURE);
assert.ok(slots.some((slot) => slot.itemId === ITEM.scruffyNote));

let dustSlot = addItem(ITEM.chocolateDust);
let milkSlot = addItem(ITEM.bucketOfMilk);
registry.findItemOnItem(ITEM.chocolateDust, ITEM.bucketOfMilk)!({
    player,
    services,
    source: { slot: dustSlot, itemId: ITEM.chocolateDust },
    target: { slot: milkSlot, itemId: ITEM.bucketOfMilk },
} as never);
assert.ok(slots.some((slot) => slot.itemId === ITEM.chocolateyMilk));
const grassSlot = addItem(ITEM.snapeGrass);
const chocolateMilkSlot = slots.find((slot) => slot.itemId === ITEM.chocolateyMilk)!.slot;
registry.findItemOnItem(ITEM.snapeGrass, ITEM.chocolateyMilk)!({
    player,
    services,
    source: { slot: grassSlot, itemId: ITEM.snapeGrass },
    target: { slot: chocolateMilkSlot, itemId: ITEM.chocolateyMilk },
} as never);
const cureSlot = slots.find((slot) => slot.itemId === ITEM.hangoverCure)!.slot;
registry.findItemOnNpc(ITEM.hangoverCure, NPC.bravek)!({
    player,
    services,
    source: { slot: cureSlot, itemId: ITEM.hangoverCure },
    target: { typeId: NPC.bravek },
} as never);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_HAVE_WARRANT);
assert.ok(slots.some((slot) => slot.itemId === ITEM.warrant));

registry.findLocInteraction(LOC.plagueHouseDoorClosed, "open")!({
    player,
    services,
    locId: LOC.plagueHouseDoorClosed,
    tile: { x: 2537, y: 3268 },
    level: 0,
} as never);
registry.findLocInteraction(LOC.keyBarrel, "search")!({
    player,
    services,
    locId: LOC.keyBarrel,
    tile: { x: 2534, y: 3268 },
    level: 0,
} as never);
assert.ok(slots.some((slot) => slot.itemId === ITEM.smallKey));
registry.findLocInteraction(LOC.elenaCellDoor, "open")!({
    player,
    services,
    locId: LOC.elenaCellDoor,
    tile: { x: 2539, y: 9672 },
    level: 0,
} as never);
talk(NPC.elena);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_FREED_ELENA);

talk(NPC.edmond);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 1);
assert.equal(miningXp, 2425);
const scrollSlot = slots.find((slot) => slot.itemId === ITEM.ardougneTeleportScroll)!.slot;
registry.findItemAction(ITEM.ardougneTeleportScroll, "read")!({
    player,
    services,
    source: { slot: scrollSlot, itemId: ITEM.ardougneTeleportScroll, quantity: 1 },
} as never);
assert.equal(getQuestStage(player, plagueCityQuest), STAGE_READ_SCROLL);
assert.match(plagueCityQuest.buildJournal(player, services).join("\n"), /QUEST COMPLETE/);

talk(NPC.edmond);
assert.equal(varps.get(VARP_QUEST_POINTS), 1, "post-quest dialogue must not duplicate rewards");
assert.equal(miningXp, 2425, "post-quest dialogue must not duplicate XP");
assert.ok(teleports >= 4);
assert.ok(messages.some((message) => message.includes("Ardougne Teleport")));

console.log("plague-city-quest.test.ts: all assertions passed");
