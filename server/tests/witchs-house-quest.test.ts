import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import groundItemSpawns from "../gamemodes/dev/data/groundItemSpawnData.json";
import { witchsHouseQuest } from "../gamemodes/dev/quests/definitions/witchsHouse";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_DEFEATED_EXPERIMENT,
    STAGE_FOUND_MAGNET,
    STAGE_READ_DIARY,
    STAGE_STARTED,
    STAGE_UNLOCKED_BACK_DOOR,
    VARP_WITCHS_HOUSE,
} from "../gamemodes/dev/quests/definitions/witchsHouse/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(witchsHouseQuest.varpId, VARP_WITCHS_HOUSE);
assert.equal(witchsHouseQuest.completionValue, STAGE_COMPLETE);
assert.equal(witchsHouseQuest.rewards.questPoints, 4);
assert.deepEqual(witchsHouseQuest.rewards.xp?.[0], {
    skillId: SkillId.Hitpoints,
    amount: 6325,
    label: "Hitpoints",
});
for (const [itemId, x, y] of [
    [ITEM.diary, 2903, 3471],
    [ITEM.ball, 2935, 3460],
] as const) {
    assert.ok(
        groundItemSpawns.some(
            (spawn) => spawn.id === itemId && spawn.x === x && spawn.y === y && spawn.plane === 0,
        ),
        `missing Witch's House ground spawn ${itemId}`,
    );
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_WITCHS_HOUSE, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const activeNpcs = new Map<number, Record<string, unknown>>();
let nextNpcId = 1000;
let hitpointsXp = 0;
let removedGroundItems = 0;
const messages: string[] = [];
const player = {
    id: 73,
    name: "Witch tester",
    tileX: 2928,
    tileY: 3456,
    level: 0,
    worldViewId: -1,
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;

function addItem(itemId: number): number {
    const entry = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
    assert.ok(entry, `no slot for ${itemId}`);
    entry.itemId = itemId;
    entry.quantity = 1;
    return entry.slot;
}

const services = {
    variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
    messaging: { sendGameMessage: (_player: unknown, message: string) => messages.push(message) },
    inventory: {
        getInventoryItems: () => slots,
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
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
        findOwnedItemLocation: (_player: unknown, itemId: number) =>
            slots.some((slot) => slot.itemId === itemId && slot.quantity > 0)
                ? "inventory"
                : undefined,
        hasInventorySlot: () => slots.some((slot) => slot.itemId <= 0 || slot.quantity <= 0),
        collectCarriedItemIds: () => slots.filter((slot) => slot.itemId > 0).map((slot) => slot.itemId),
    },
    equipment: { getEquippedItem: () => -1 },
    location: { replaceTemporaryLoc: () => ({}) },
    movement: { teleportPlayer: () => undefined },
    combat: {
        getNpc: (id: number) => activeNpcs.get(id),
        applyPlayerHitsplat: () => ({ amount: 1, style: 0, hpCurrent: 9, hpMax: 10 }),
    },
    npc: {
        spawnNpc: (config: Record<string, unknown>) => {
            const id = ++nextNpcId;
            const npc = {
                ...config,
                id,
                typeId: config.id,
                tileX: config.x,
                tileY: config.y,
                level: config.level,
                engageCombat: () => undefined,
            };
            activeNpcs.set(id, npc);
            return npc;
        },
        removeNpc: (id: number) => activeNpcs.delete(id),
        findNearbyNpc: () => undefined,
        hasLineOfSightToPlayer: () => false,
        stopNpcMovement: () => undefined,
        faceNpcToPlayer: () => undefined,
        queueNpcForcedChat: () => undefined,
    },
    groundItems: {
        remove: () => {
            removedGroundItems++;
            return { removed: 1 };
        },
    },
    skills: {
        getSkill: () => ({ baseLevel: 10, boost: 0 }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) => {
            if (skillId === SkillId.Hitpoints) hitpointsXp += amount;
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
    sound: { sendJingle: () => undefined },
    system: {
        getCurrentTick: () => 100,
        logger: { info: () => undefined, error: () => undefined },
    },
} as unknown as ScriptServices;

witchsHouseQuest.register(registry, services);

const talk = registry.findNpcInteractionDirect(NPC.boy, "talk-to");
assert.ok(talk);
talk({ player, services, npc: { typeId: NPC.boy } } as never);
assert.equal(getQuestStage(player, witchsHouseQuest), STAGE_STARTED);

registry.findLocInteraction(LOC.pottedPlant, "look-under")!({
    player,
    services,
    locId: LOC.pottedPlant,
    tile: { x: 2900, y: 3474 },
    level: 0,
} as never);
assert.ok(slots.some((slot) => slot.itemId === ITEM.doorKey));

registry.findLocInteraction(LOC.cupboardOpen, "search")!({
    player,
    services,
    locId: LOC.cupboardOpen,
    tile: { x: 2898, y: 9873 },
    level: 0,
} as never);
assert.equal(getQuestStage(player, witchsHouseQuest), STAGE_FOUND_MAGNET);

const cheeseSlot = addItem(ITEM.cheese);
registry.findItemOnLoc(ITEM.cheese, LOC.mouseHoles[0])!({
    player,
    services,
    source: { slot: cheeseSlot, itemId: ITEM.cheese },
    target: { locId: LOC.mouseHoles[0], tile: { x: 2903, y: 3466 }, level: 0 },
} as never);
const mouse = [...activeNpcs.values()].find((npc) => npc.typeId === NPC.mouse);
assert.ok(mouse);
const magnetSlot = slots.find((slot) => slot.itemId === ITEM.magnet)!.slot;
registry.findItemOnNpc(ITEM.magnet, NPC.mouse)!({
    player,
    services,
    source: { slot: magnetSlot, itemId: ITEM.magnet },
    target: mouse,
} as never);
assert.equal(getQuestStage(player, witchsHouseQuest), STAGE_UNLOCKED_BACK_DOOR);

const diarySlot = addItem(ITEM.diary);
registry.findItemAction(ITEM.diary, "read")!({
    player,
    services,
    source: { slot: diarySlot, itemId: ITEM.diary },
    target: { slot: diarySlot, itemId: ITEM.diary },
} as never);
assert.equal(getQuestStage(player, witchsHouseQuest), STAGE_READ_DIARY);

registry.findLocInteraction(LOC.fountain, "check")!({
    player,
    services,
    locId: LOC.fountain,
    tile: { x: 2909, y: 3470 },
    level: 0,
} as never);
const shedKeySlot = slots.find((slot) => slot.itemId === ITEM.shedKey)!.slot;
(player as { tileY: number }).tileY = 3464;
registry.findItemOnLoc(ITEM.shedKey, LOC.shedDoor)!({
    player,
    services,
    source: { slot: shedKeySlot, itemId: ITEM.shedKey },
    target: { locId: LOC.shedDoor, tile: { x: 2934, y: 3463 }, level: 0 },
} as never);

for (let index = 0; index < NPC.experimentForms.length; index++) {
    const npc = [...activeNpcs.values()].find(
        (candidate) => candidate.typeId === NPC.experimentForms[index],
    );
    assert.ok(npc, `missing experiment form ${index}`);
    const decision = registry.findNpcPreDeath(NPC.experimentForms[index])!({
        player,
        services,
        npc,
        killer: player,
        killerPlayerId: player.id,
        tick: 100 + index,
        hit: {
            proposedDamage: 10,
            style: 0,
            hitpointsBefore: 5,
            hitpointsAfter: 0,
            cause: "combat",
        },
    } as never);
    assert.equal(
        decision,
        index === NPC.experimentForms.length - 1
            ? NpcPreDeathDecision.Allow
            : NpcPreDeathDecision.Prevent,
    );
}
assert.equal(getQuestStage(player, witchsHouseQuest), STAGE_DEFEATED_EXPERIMENT);

registry.findGroundItemInteraction(ITEM.ball, "take")!({
    player,
    services,
    option: "take",
    target: {
        stackId: 55,
        itemId: ITEM.ball,
        quantity: 1,
        tile: { x: 2935, y: 3460, level: 0 },
        worldViewId: -1,
    },
} as never);
assert.equal(removedGroundItems, 1);
assert.ok(slots.some((slot) => slot.itemId === ITEM.ball));

talk({ player, services, npc: { typeId: NPC.boy } } as never);
assert.equal(getQuestStage(player, witchsHouseQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 4);
assert.equal(hitpointsXp, 6325);
assert.ok(!slots.some((slot) => slot.itemId === ITEM.ball));
assert.match(witchsHouseQuest.buildJournal(player, services).join("\n"), /QUEST COMPLETE/);

console.log("witchs-house-quest.test.ts: all assertions passed");
