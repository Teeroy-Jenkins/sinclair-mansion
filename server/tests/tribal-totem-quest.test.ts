import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { tribalTotemQuest } from "../gamemodes/dev/quests/definitions/tribalTotem";
import {
    ITEM,
    LOC,
    NPC,
    STAIRS_DISABLED_BIT,
    STAGE_COMPLETE,
    STAGE_CRATE_DELIVERED,
    STAGE_CRATE_MARKED,
    STAGE_STARTED,
    STAGE_TELEPORTED,
    TILE,
    TRAP_COMBINATION_SOLVED_BIT,
    VARP_HANDELMORT_TRAPS,
    VARP_TRIBAL_TOTEM,
} from "../gamemodes/dev/quests/definitions/tribalTotem/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(tribalTotemQuest.varpId, VARP_TRIBAL_TOTEM);
assert.equal(tribalTotemQuest.completionValue, STAGE_COMPLETE);
assert.deepEqual(tribalTotemQuest.requirements?.skills?.[0], {
    skillId: SkillId.Thieving,
    level: 21,
    label: "Thieving",
});
assert.equal(tribalTotemQuest.rewards.questPoints, 1);
assert.deepEqual(tribalTotemQuest.rewards.xp?.[0], {
    skillId: SkillId.Thieving,
    amount: 1775,
    label: "Thieving",
});
assert.deepEqual(tribalTotemQuest.rewards.items?.[0], {
    itemId: ITEM.swordfish,
    quantity: 5,
    label: "5 Swordfish",
});
for (const npcId of [NPC.gpdtEmployee, NPC.wizardCromperty[0], NPC.horacio, NPC.kangaiMau]) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing static NPC ${npcId}`);
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_TRIBAL_TOTEM, 0],
    [VARP_HANDELMORT_TRAPS, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const teleports: Array<{ x: number; y: number; level: number }> = [];
const xp = new Map<number, number>();
const player = {
    id: 200,
    name: "Totem tester",
    tileX: 2791,
    tileY: 3182,
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
    location: { replaceTemporaryLoc: () => ({}) },
    combat: { applyPlayerHitsplat: () => ({ amount: 0, style: 0, hpCurrent: 10, hpMax: 10 }) },
    skills: {
        getSkill: (_player: unknown, skillId: number) => ({
            baseLevel: skillId === SkillId.Thieving ? 21 : 10,
            boost: 0,
        }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) =>
            xp.set(skillId, (xp.get(skillId) ?? 0) + amount),
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

tribalTotemQuest.register(registry, services);

function talk(npcId: number, option = "talk-to"): void {
    const handler = registry.findNpcInteractionDirect(npcId, option);
    assert.ok(handler, `missing ${option} handler for NPC ${npcId}`);
    handler({ player, services, npc: { typeId: npcId }, option } as never);
}

talk(NPC.kangaiMau);
assert.equal(getQuestStage(player, tribalTotemQuest), STAGE_STARTED);

registry.findLocInteraction(LOC.hornCrate, "investigate")!({
    player,
    services,
    locId: LOC.hornCrate,
    tile: { x: 2650, y: 3273 },
    level: 0,
    action: "investigate",
} as never);
const labelSlot = slots.find((entry) => entry.itemId === ITEM.addressLabel)?.slot;
assert.notEqual(labelSlot, undefined);

registry.findItemOnLoc(ITEM.addressLabel, LOC.teleportCrate)!({
    player,
    services,
    source: { slot: labelSlot, itemId: ITEM.addressLabel },
    target: { locId: LOC.teleportCrate, tile: { x: 2650, y: 3271 }, level: 0 },
} as never);
assert.equal(getQuestStage(player, tribalTotemQuest), STAGE_CRATE_MARKED);

talk(NPC.gpdtEmployee);
assert.equal(getQuestStage(player, tribalTotemQuest), STAGE_CRATE_DELIVERED);
talk(NPC.wizardCromperty[0], "teleport");
assert.equal(getQuestStage(player, tribalTotemQuest), STAGE_TELEPORTED);
assert.deepEqual(teleports.at(-1), TILE.mansionTeleport);

const combinationDoor = registry.findLocInteraction(LOC.combinationDoor, "open");
assert.ok(combinationDoor);
combinationDoor({
    player,
    services,
    locId: LOC.combinationDoor,
    tile: { x: 2634, y: 3323 },
    level: 0,
    action: "open",
} as never);
assert.ok((varps.get(VARP_HANDELMORT_TRAPS)! & TRAP_COMBINATION_SOLVED_BIT) !== 0);
combinationDoor({
    player,
    services,
    locId: LOC.combinationDoor,
    tile: { x: 2634, y: 3323 },
    level: 0,
    action: "open",
} as never);
assert.equal(player.tileY, 3324);

registry.findLocInteraction(LOC.trapStairs, "investigate")!({
    player,
    services,
    locId: LOC.trapStairs,
    tile: { x: 2631, y: 3322 },
    level: 0,
    action: "investigate",
} as never);
assert.ok((varps.get(VARP_HANDELMORT_TRAPS)! & STAIRS_DISABLED_BIT) !== 0);
registry.findLocInteraction(LOC.trapStairs, "climb-up")!({
    player,
    services,
    locId: LOC.trapStairs,
    tile: { x: 2631, y: 3322 },
    level: 0,
    action: "climb-up",
} as never);
assert.deepEqual(teleports.at(-1), TILE.stairsTop);

registry.findLocInteraction(LOC.closedChest, "open")!({
    player,
    services,
    locId: LOC.closedChest,
    tile: { x: 2638, y: 3324 },
    level: 1,
    action: "open",
} as never);
assert.ok(slots.some((entry) => entry.itemId === ITEM.tribalTotem));

talk(NPC.kangaiMau);
assert.equal(getQuestStage(player, tribalTotemQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 1);
assert.equal(xp.get(SkillId.Thieving), 1775);
assert.equal(slots.find((entry) => entry.itemId === ITEM.swordfish)?.quantity, 5);
assert.ok(!slots.some((entry) => entry.itemId === ITEM.tribalTotem));

console.log("Tribal Totem quest tests passed");
