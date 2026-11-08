import assert from "node:assert/strict";

import { merlinsCrystalQuest } from "../gamemodes/dev/quests/definitions/merlinsCrystal";
import {
    AUX,
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_EXCALIBUR_BOUND,
    STAGE_MERLIN_FREED,
    STAGE_SPOKEN_GAWAIN,
    STAGE_SPOKEN_LANCELOT,
    STAGE_SPOKEN_MORGAN,
    STAGE_STARTED,
    TILE,
    VARP_MERLINS_CRYSTAL,
} from "../gamemodes/dev/quests/definitions/merlinsCrystal/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(merlinsCrystalQuest.varpId, VARP_MERLINS_CRYSTAL);
assert.deepEqual(merlinsCrystalQuest.stageBits, { start: 0, end: 2 });
assert.equal(merlinsCrystalQuest.completionValue, STAGE_COMPLETE);
assert.equal(merlinsCrystalQuest.rewards.questPoints, 6);
for (const npcId of [
    NPC.kingArthur,
    NPC.sirGawain,
    NPC.sirLancelot,
    NPC.sirMordred,
    NPC.ladyOfTheLake,
    NPC.candleMaker,
    NPC.arhein,
]) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing static NPC ${npcId}`);
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_MERLINS_CRYSTAL, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const activeNpcs = new Map<number, Record<string, unknown>>();
let nextNpcId = 8000;
const teleports: Array<{ x: number; y: number; level: number }> = [];
const player = {
    id: 14,
    name: "Merlin tester",
    tileX: 2764,
    tileY: 3515,
    level: 0,
    worldViewId: -1,
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;

function addItem(itemId: number, quantity = 1): number {
    const existing = slots.find((entry) => entry.itemId === itemId && entry.quantity > 0);
    if (existing && itemId === ITEM.coins) {
        existing.quantity += quantity;
        return existing.slot;
    }
    const entry = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
    assert.ok(entry, `no slot for ${itemId}`);
    entry.itemId = itemId;
    entry.quantity = quantity;
    return entry.slot;
}

const services = {
    variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
    messaging: { sendGameMessage: () => undefined },
    inventory: {
        getInventoryItems: () => slots,
        playerHasItem: (_player: unknown, itemId: number) =>
            slots.some((entry) => entry.itemId === itemId && entry.quantity > 0),
        findInventorySlotWithItem: (_player: unknown, itemId: number) =>
            slots.find((entry) => entry.itemId === itemId && entry.quantity > 0)?.slot,
        findOwnedItemLocation: (_player: unknown, itemId: number) =>
            slots.some((entry) => entry.itemId === itemId && entry.quantity > 0)
                ? { container: "inventory" }
                : undefined,
        hasInventorySlot: () => slots.some((entry) => entry.itemId <= 0 || entry.quantity <= 0),
        collectCarriedItemIds: () => slots.filter((entry) => entry.itemId > 0).map((entry) => entry.itemId),
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const slot = addItem(itemId, quantity);
            return { slot, added: quantity };
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
    movement: {
        teleportPlayer: (target: typeof player, x: number, y: number, level: number) => {
            target.tileX = x;
            target.tileY = y;
            target.level = level;
            teleports.push({ x, y, level });
        },
    },
    npc: {
        spawnNpc: (config: Record<string, unknown>) => {
            const id = ++nextNpcId;
            const npc = { ...config, id, typeId: config.id };
            activeNpcs.set(id, npc);
            return npc;
        },
        removeNpc: (id: number) => activeNpcs.delete(id),
        stopNpcMovement: () => undefined,
    },
    combat: {
        getNpc: (id: number) => activeNpcs.get(id),
        applyPlayerHitsplat: () => ({ amount: 2, style: 0, hpCurrent: 8, hpMax: 10 }),
    },
    location: { removeTemporaryLoc: () => ({}) },
    skills: { addSkillXp: () => undefined },
    data: { getObjType: () => ({ stackable: 0 }) },
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
    sound: { sendJingle: () => undefined },
    system: {
        getCurrentTick: () => 100,
        logger: { info: () => undefined, error: () => undefined },
        eventBus: { on: () => undefined },
    },
} as unknown as ScriptServices;

merlinsCrystalQuest.register(registry, services);

function talk(npcId: number): void {
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing talk handler ${npcId}`);
    handler({ player, services, npc: { typeId: npcId }, option: "talk-to" } as never);
}

talk(NPC.kingArthur);
assert.equal(getQuestStage(player, merlinsCrystalQuest), STAGE_STARTED);
talk(NPC.sirGawain);
assert.equal(getQuestStage(player, merlinsCrystalQuest), STAGE_SPOKEN_GAWAIN);
talk(NPC.sirLancelot);
assert.equal(getQuestStage(player, merlinsCrystalQuest), STAGE_SPOKEN_LANCELOT);

registry.findLocInteraction(LOC.catherbyCrate, "hide-in")!({
    player,
    services,
    locId: LOC.catherbyCrate,
    tile: TILE.catherbyCrate,
    level: 0,
    action: "hide-in",
} as never);
assert.deepEqual(teleports.at(-1), TILE.keepCrate);

const mordredDecision = registry.findNpcPreDeath(NPC.sirMordred)!({
    npc: { id: 3527, typeId: NPC.sirMordred },
    killer: player,
    killerPlayerId: player.id,
    services,
    hit: {
        proposedDamage: 10,
        style: 0,
        hitpointsBefore: 5,
        hitpointsAfter: 0,
        cause: "combat",
    },
} as never);
assert.equal(mordredDecision, NpcPreDeathDecision.Prevent);
assert.equal(getQuestStage(player, merlinsCrystalQuest), STAGE_SPOKEN_MORGAN);

talk(NPC.ladyOfTheLake);
assert.ok((varps.get(VARP_MERLINS_CRYSTAL)! & AUX.excaliburTestStarted) !== 0);
addItem(ITEM.bread);
registry.findLocInteraction(LOC.jewellersDoor, "open")!({
    player,
    services,
    locId: LOC.jewellersDoor,
    tile: { x: 3015, y: 3249 },
    level: 0,
    action: "open",
} as never);
assert.ok(slots.some((entry) => entry.itemId === ITEM.excalibur));
assert.ok((varps.get(VARP_MERLINS_CRYSTAL)! & AUX.excaliburRewarded) !== 0);

talk(NPC.candleMaker);
assert.ok((varps.get(VARP_MERLINS_CRYSTAL)! & AUX.blackCandleRequested) !== 0);
const repellentSlot = addItem(ITEM.insectRepellent);
const bucketSlot = addItem(ITEM.bucket);
registry.findItemOnLoc(ITEM.insectRepellent, LOC.beehive)!({
    player,
    services,
    source: { slot: repellentSlot, itemId: ITEM.insectRepellent },
    target: { locId: LOC.beehive, tile: { x: 2781, y: 3468 }, level: 0 },
} as never);
registry.findItemOnLoc(ITEM.bucket, LOC.beehive)!({
    player,
    services,
    source: { slot: bucketSlot, itemId: ITEM.bucket },
    target: { locId: LOC.beehive, tile: { x: 2781, y: 3468 }, level: 0 },
} as never);
assert.ok(slots.some((entry) => entry.itemId === ITEM.bucketOfWax));
talk(NPC.candleMaker);
const candleSlot = slots.find((entry) => entry.itemId === ITEM.blackCandle)?.slot;
assert.notEqual(candleSlot, undefined);
const tinderboxSlot = addItem(ITEM.tinderbox);
registry.findItemOnItem(ITEM.tinderbox, ITEM.blackCandle)!({
    player,
    services,
    source: { slot: tinderboxSlot, itemId: ITEM.tinderbox },
    target: { slot: candleSlot, itemId: ITEM.blackCandle },
} as never);
assert.ok(slots.some((entry) => entry.itemId === ITEM.litBlackCandle));

registry.findLocInteraction(LOC.chaosAltar, "check")!({
    player,
    services,
    locId: LOC.chaosAltar,
    tile: { x: 3238, y: 3608 },
    level: 0,
    action: "check",
} as never);
assert.ok((varps.get(VARP_MERLINS_CRYSTAL)! & AUX.chaosWordsKnown) !== 0);
const bonesSlot = addItem(ITEM.batBones);
player.tileX = TILE.ritual.x;
player.tileY = TILE.ritual.y;
player.level = TILE.ritual.level;
registry.findItemAction(ITEM.batBones, "drop")!({
    player,
    services,
    source: { slot: bonesSlot, itemId: ITEM.batBones },
    target: { slot: bonesSlot, itemId: ITEM.batBones },
    option: "drop",
} as never);
assert.equal(getQuestStage(player, merlinsCrystalQuest), STAGE_EXCALIBUR_BOUND);
assert.ok(!slots.some((entry) => entry.itemId === ITEM.batBones));

const excaliburSlot = slots.find((entry) => entry.itemId === ITEM.excalibur)!.slot;
registry.findItemOnLoc(ITEM.excalibur, LOC.merlinsCrystal)!({
    player,
    services,
    source: { slot: excaliburSlot, itemId: ITEM.excalibur },
    target: { locId: LOC.merlinsCrystal, tile: { x: 2768, y: 3492 }, level: 2 },
} as never);
assert.equal(getQuestStage(player, merlinsCrystalQuest), STAGE_MERLIN_FREED);
assert.equal(varps.get(VARP_MERLINS_CRYSTAL), STAGE_MERLIN_FREED);

talk(NPC.kingArthur);
assert.equal(getQuestStage(player, merlinsCrystalQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_MERLINS_CRYSTAL), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 6);
assert.ok(slots.some((entry) => entry.itemId === ITEM.excalibur));

console.log("Merlin's Crystal quest tests passed");
