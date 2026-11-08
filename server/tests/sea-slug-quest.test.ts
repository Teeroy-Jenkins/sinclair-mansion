import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import groundItemSpawns from "../gamemodes/dev/data/groundItemSpawnData.json";
import { seaSlugQuest } from "../gamemodes/dev/quests/definitions/seaSlug";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_BOAT_REPAIRED,
    STAGE_COMPLETE,
    STAGE_KENNITH_NEEDS_ESCAPE,
    STAGE_LIT_TORCH,
    STAGE_NEEDS_CRANE,
    STAGE_NEEDS_SWAMP_PASTE,
    STAGE_PANEL_OPENED,
    STAGE_SAILED_TO_KENT,
    STAGE_SAVED_KENNITH,
    STAGE_SPOKEN_TO_KENNITH,
    STAGE_SPOKEN_TO_KENT,
    STAGE_STARTED,
    VARP_SEA_SLUG,
} from "../gamemodes/dev/quests/definitions/seaSlug/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(seaSlugQuest.varpId, VARP_SEA_SLUG);
assert.equal(seaSlugQuest.completionValue, STAGE_COMPLETE);
assert.equal(seaSlugQuest.requirements?.skills?.[0].level, 30);
assert.equal(seaSlugQuest.rewards.xp?.[0].amount, 7175);
assert.deepEqual(seaSlugQuest.rewards.items?.[0], {
    itemId: ITEM.oysterPearls,
    quantity: 1,
    label: "Oyster pearls",
});
for (const npcId of [NPC.caroline, NPC.bailey, NPC.kennithBase, NPC.kent, NPC.islandHolgart]) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing Sea Slug NPC ${npcId}`);
}
assert.ok(
    groundItemSpawns.some(
        (spawn) => spawn.id === ITEM.dampSticks && spawn.x === 2784 && spawn.y === 3289,
    ),
);
for (const y of [3277, 3289]) {
    assert.ok(
        groundItemSpawns.some(
            (spawn) => spawn.id === ITEM.brokenGlass && spawn.x === 2766 && spawn.y === y,
        ),
    );
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_SEA_SLUG, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const activeNpcs = new Map<number, Record<string, unknown>>();
let nextNpcId = 2000;
let fishingXp = 0;
let spawnedSlug = 0;
const player = {
    id: 81,
    name: "Slug tester",
    tileX: 2716,
    tileY: 3302,
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
        hasInventorySlot: () => slots.some((entry) => entry.itemId <= 0 || entry.quantity <= 0),
        collectCarriedItemIds: () => slots.filter((entry) => entry.itemId > 0).map((entry) => entry.itemId),
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const existing = slots.find((entry) => entry.itemId === itemId && entry.quantity > 0);
            if (existing && [ITEM.swampTar, ITEM.rawSwampPaste, ITEM.swampPaste].includes(itemId)) {
                existing.quantity += quantity;
                return { slot: existing.slot, added: quantity };
            }
            const entry = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
            if (!entry) return { slot: -1, added: 0 };
            entry.itemId = itemId;
            entry.quantity = quantity;
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
    movement: {
        teleportPlayer: (_player: unknown, x: number, y: number, level: number) => {
            (player as { tileX: number }).tileX = x;
            (player as { tileY: number }).tileY = y;
            (player as { level: number }).level = level;
        },
    },
    combat: {
        getNpc: (id: number) => activeNpcs.get(id),
        applyPlayerHitsplat: () => ({ amount: 3, style: 0, hpCurrent: 7, hpMax: 10 }),
    },
    npc: {
        spawnNpc: (config: Record<string, unknown>) => {
            const id = ++nextNpcId;
            const npc = { ...config, id, typeId: config.id };
            activeNpcs.set(id, npc);
            return npc;
        },
        removeNpc: (id: number) => activeNpcs.delete(id),
    },
    groundItems: {
        spawn: () => {
            spawnedSlug++;
            return {};
        },
    },
    location: { replaceTemporaryLoc: () => ({}) },
    skills: {
        getSkill: (_player: unknown, skillId: number) => ({
            baseLevel: skillId === SkillId.Firemaking ? 30 : 1,
            boost: 0,
        }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) => {
            if (skillId === SkillId.Fishing) fishingXp += amount;
        },
    },
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
    },
} as unknown as ScriptServices;

seaSlugQuest.register(registry, services);
const talk = (npcId: number, npcInstance?: Record<string, unknown>, option = "talk-to") => {
    const handler = registry.findNpcInteractionDirect(npcId, option);
    assert.ok(handler, `missing ${option} handler for ${npcId}`);
    handler({ player, services, npc: npcInstance ?? { typeId: npcId }, option } as never);
};

talk(NPC.caroline);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_STARTED);
talk(NPC.shoreHolgartBase);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_NEEDS_SWAMP_PASTE);

const tarSlot = addItem(ITEM.swampTar);
const flourSlot = addItem(ITEM.potOfFlour);
registry.findItemOnItem(ITEM.swampTar, ITEM.potOfFlour)!({
    player,
    services,
    source: { slot: tarSlot, itemId: ITEM.swampTar },
    target: { slot: flourSlot, itemId: ITEM.potOfFlour },
} as never);
const rawSlot = slots.find((entry) => entry.itemId === ITEM.rawSwampPaste)!.slot;
registry.findItemOnLoc(ITEM.rawSwampPaste, LOC.fires[0])!({
    player,
    services,
    source: { slot: rawSlot, itemId: ITEM.rawSwampPaste },
    target: { locId: LOC.fires[0], tile: { x: 2720, y: 3300 }, level: 0 },
} as never);
assert.ok(slots.some((entry) => entry.itemId === ITEM.swampPaste));

talk(NPC.shoreHolgartBase);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_BOAT_REPAIRED);
talk(NPC.shoreHolgartBase, undefined, "travel");
let platformHolgart = [...activeNpcs.values()].find(
    (npc) => npc.typeId === NPC.platformHolgart,
);
assert.ok(platformHolgart);

talk(NPC.kennithBase);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_SPOKEN_TO_KENNITH);
talk(NPC.platformHolgart, platformHolgart);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_SAILED_TO_KENT);
talk(NPC.kent);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_SPOKEN_TO_KENT);
assert.equal(spawnedSlug, 1);
talk(NPC.islandHolgart);
platformHolgart = [...activeNpcs.values()].find((npc) => npc.typeId === NPC.platformHolgart);
assert.ok(platformHolgart);

talk(NPC.bailey);
assert.ok(slots.some((entry) => entry.itemId === ITEM.unlitTorch));
const dampSlot = addItem(ITEM.dampSticks);
const glassSlot = addItem(ITEM.brokenGlass);
registry.findItemOnItem(ITEM.brokenGlass, ITEM.dampSticks)!({
    player,
    services,
    source: { slot: glassSlot, itemId: ITEM.brokenGlass },
    target: { slot: dampSlot, itemId: ITEM.dampSticks },
} as never);
const drySlot = slots.find((entry) => entry.itemId === ITEM.drySticks)!.slot;
registry.findItemAction(ITEM.drySticks, "rub-together")!({
    player,
    services,
    source: { slot: drySlot, itemId: ITEM.drySticks },
    target: { slot: drySlot, itemId: ITEM.drySticks },
} as never);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_LIT_TORCH);
assert.ok(slots.some((entry) => entry.itemId === ITEM.litTorch));

talk(NPC.kennithBase);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_KENNITH_NEEDS_ESCAPE);
registry.findLocInteraction(LOC.panelsClosed[1], "kick")!({
    player,
    services,
    locId: LOC.panelsClosed[1],
    tile: { x: 2768, y: 3288 },
    level: 1,
} as never);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_PANEL_OPENED);
talk(NPC.kennithBase);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_NEEDS_CRANE);
registry.findLocInteraction(LOC.cranes[1], "rotate")!({
    player,
    services,
    locId: LOC.cranes[1],
    tile: { x: 2769, y: 3287 },
    level: 1,
} as never);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_SAVED_KENNITH);

talk(NPC.platformHolgart, platformHolgart);
talk(NPC.caroline);
assert.equal(getQuestStage(player, seaSlugQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 1);
assert.equal(fishingXp, 7175);
assert.ok(slots.some((entry) => entry.itemId === ITEM.oysterPearls));
assert.match(seaSlugQuest.buildJournal(player, services).join("\n"), /QUEST COMPLETE/);

console.log("sea-slug-quest.test.ts: all assertions passed");
