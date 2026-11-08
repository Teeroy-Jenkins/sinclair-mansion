import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { elementalWorkshopIQuest } from "../gamemodes/dev/quests/definitions/elementalWorkshopI";
import {
    BIT,
    ITEM,
    LOC,
    NPC,
    TILE,
    VARP_ELEMENTAL_WORKSHOP,
} from "../gamemodes/dev/quests/definitions/elementalWorkshopI/constants";
import { VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(elementalWorkshopIQuest.varpId, VARP_ELEMENTAL_WORKSHOP);
assert.equal(elementalWorkshopIQuest.completionValue, BIT.complete);
assert.deepEqual(elementalWorkshopIQuest.requirements?.skills, [
    { skillId: SkillId.Mining, level: 20, label: "Mining" },
    { skillId: SkillId.Smithing, level: 20, label: "Smithing" },
    { skillId: SkillId.Crafting, level: 20, label: "Crafting" },
]);
assert.deepEqual(elementalWorkshopIQuest.rewards.xp, [
    { skillId: SkillId.Crafting, amount: 5_000, label: "Crafting" },
    { skillId: SkillId.Smithing, amount: 5_000, label: "Smithing" },
]);
for (const npcId of Object.values(NPC)) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing Elemental Workshop NPC ${npcId}`);
}

const varps = new Map<number, number>([
    [VARP_ELEMENTAL_WORKSHOP, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const xp = new Map<number, number>();
const drops: Array<{ itemId: number; ownerId?: number }> = [];
let spawnedElemental: Record<string, unknown> | undefined;
let engaged = false;
const teleports: Array<{ x: number; y: number; level: number }> = [];
const player = {
    id: 244,
    name: "Elemental tester",
    tileX: 2710,
    tileY: 3494,
    level: 0,
    worldViewId: -1,
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;

function add(itemId: number, quantity = 1): number {
    const existing = slots.find((entry) => entry.itemId === itemId && entry.quantity > 0);
    if (existing) {
        existing.quantity += quantity;
        return existing.slot;
    }
    const entry = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
    assert.ok(entry, `no slot for ${itemId}`);
    entry.itemId = itemId;
    entry.quantity = quantity;
    return entry.slot;
}

function count(itemId: number): number {
    return slots.filter((entry) => entry.itemId === itemId).reduce((total, entry) => total + entry.quantity, 0);
}

const services = {
    variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
    messaging: { sendGameMessage: () => undefined },
    inventory: {
        getInventoryItems: () => slots,
        findOwnedItemLocation: (_player: unknown, itemId: number) => count(itemId) > 0 ? { container: "inventory" } : undefined,
        hasInventorySlot: () => slots.some((entry) => entry.itemId <= 0 || entry.quantity <= 0),
        collectCarriedItemIds: () => slots.filter((entry) => entry.itemId > 0).map((entry) => entry.itemId),
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => ({ slot: add(itemId, quantity), added: quantity }),
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => {
            slots[slot] = { slot, itemId, quantity };
        },
        snapshotInventory: () => undefined,
    },
    skills: {
        getSkill: () => ({ baseLevel: 20, boost: 0 }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) => xp.set(skillId, (xp.get(skillId) ?? 0) + amount),
    },
    data: { getObjType: (itemId: number) => itemId === ITEM.knife ? { name: "Knife", bonuses: [] } : { stackable: 0 } },
    movement: {
        teleportPlayer: (_player: unknown, x: number, y: number, level: number) => {
            teleports.push({ x, y, level });
            Object.assign(player, { tileX: x, tileY: y, level });
        },
    },
    npc: {
        findNearbyNpc: () => undefined,
        spawnNpc: (config: Record<string, unknown>) => {
            spawnedElemental = {
                ...config,
                id: 9000,
                typeId: config.id,
                tileX: config.x,
                tileY: config.y,
                level: config.level,
                worldViewId: config.worldViewId,
                ownerPlayerId: config.ownerPlayerId,
                engageCombat: () => { engaged = true; },
            };
            return spawnedElemental;
        },
    },
    groundItems: {
        spawn: (itemId: number, _quantity: number, _tile: unknown, options: { ownerId?: number }) => {
            drops.push({ itemId, ownerId: options.ownerId });
            return { stackId: drops.length, itemId };
        },
    },
    dialog: {
        getInterfaceService: () => ({ getCurrentChatboxModal: () => undefined }),
        openDialog: (_player: unknown, spec: { onContinue?: () => void }) => spec.onContinue?.(),
        openDialogOptions: (_player: unknown, spec: { onSelect?: (choice: number) => void }) => spec.onSelect?.(0),
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

const registry = new ScriptRegistry();
elementalWorkshopIQuest.register(registry, services);

function loc(locId: number, action: string, x = 0, y = 0): void {
    const handler = registry.findLocInteraction(locId, action);
    assert.ok(handler, `missing ${action} for loc ${locId}`);
    handler({ player, services, locId, tile: { x, y }, level: 0, action } as never);
}

function itemOnLoc(itemId: number, locId: number): void {
    const handler = registry.findItemOnLoc(itemId, locId);
    assert.ok(handler, `missing item ${itemId} on loc ${locId}`);
    handler({ player, services, source: { slot: 0, itemId }, target: { locId, tile: { x: 0, y: 0 }, level: 0 } } as never);
}

add(ITEM.knife);
add(1275);
add(ITEM.thread);
add(ITEM.coal, 4);
add(ITEM.hammer);

loc(LOC.bookcase, "search");
assert.equal(count(ITEM.batteredBook), 1);
registry.findItemAction(ITEM.batteredBook, "read")!({
    player,
    services,
    source: { slot: 0, itemId: ITEM.batteredBook },
    target: { slot: 0, itemId: ITEM.batteredBook },
} as never);
assert.ok((varps.get(VARP_ELEMENTAL_WORKSHOP)! & BIT.readBook) !== 0);
const cutBook = registry.findItemOnItem(ITEM.knife, ITEM.batteredBook);
assert.ok(cutBook, "wildcard sharp-item book handler should resolve");
cutBook({
    player,
    services,
    source: { slot: 0, itemId: ITEM.knife },
    target: { slot: 1, itemId: ITEM.batteredBook },
} as never);
assert.equal(count(ITEM.batteredKey), 1);
assert.ok((varps.get(VARP_ELEMENTAL_WORKSHOP)! & BIT.slashedBook) !== 0);

itemOnLoc(ITEM.batteredKey, LOC.oddWalls[0]);
loc(LOC.surfaceStairs, "climb-down");
assert.deepEqual(teleports.at(-1), TILE.workshopEntry);
assert.ok((varps.get(VARP_ELEMENTAL_WORKSHOP)! & BIT.enteredWorkshop) !== 0);

loc(LOC.bowlCrate, "search");
loc(LOC.needleCrate, "search");
loc(LOC.leatherCrate, "search");
assert.equal(count(ITEM.emptyBowl), 1);
assert.equal(count(ITEM.needle), 1);
assert.equal(count(ITEM.leather), 1);

loc(LOC.waterValves[0], "turn", 2726, 9908);
loc(LOC.waterValves[1], "turn", 2713, 9908);
loc(LOC.waterLever, "pull");
assert.ok((varps.get(VARP_ELEMENTAL_WORKSHOP)! & BIT.waterFlowing) !== 0);

loc(LOC.bellows[1], "fix");
assert.equal(count(ITEM.thread), 0);
assert.equal(count(ITEM.leather), 0);
assert.equal(count(ITEM.needle), 1);
loc(LOC.airLever, "pull");
assert.ok((varps.get(VARP_ELEMENTAL_WORKSHOP)! & BIT.airBlowing) !== 0);

itemOnLoc(ITEM.emptyBowl, LOC.lavaTroughs[0]);
assert.equal(count(ITEM.lavaBowl), 1);
itemOnLoc(ITEM.lavaBowl, LOC.furnaces[0]);
assert.equal(count(ITEM.emptyBowl), 1);
assert.ok((varps.get(VARP_ELEMENTAL_WORKSHOP)! & BIT.furnaceLit) !== 0);

const mine = registry.findNpcInteractionDirect(NPC.elementalRock, "mine");
assert.ok(mine);
mine({ player, services, npc: { id: 8, typeId: NPC.elementalRock, tileX: 2690, tileY: 9880, level: 0 }, option: "mine", tick: 100 } as never);
assert.ok(spawnedElemental);
assert.equal(engaged, true);
const decision = registry.findNpcPreDeath(NPC.earthElemental)!({
    player,
    services,
    npc: spawnedElemental,
    killer: player,
    killerPlayerId: player.id,
    hit: { proposedDamage: 10, style: 0, hitpointsBefore: 10, hitpointsAfter: 0, cause: "combat" },
} as never);
assert.equal(decision, NpcPreDeathDecision.Allow);
assert.deepEqual(drops.at(-1), { itemId: ITEM.elementalOre, ownerId: player.id });
add(ITEM.elementalOre);

itemOnLoc(ITEM.elementalOre, LOC.furnaces[0]);
assert.equal(count(ITEM.coal), 0);
assert.equal(count(ITEM.elementalMetal), 1);
assert.equal(xp.get(SkillId.Smithing), 8);
itemOnLoc(ITEM.elementalMetal, LOC.workbench);
assert.equal(count(ITEM.elementalMetal), 0);
assert.equal(count(ITEM.elementalShield), 1);
assert.ok((varps.get(VARP_ELEMENTAL_WORKSHOP)! & BIT.complete) !== 0);
assert.ok((varps.get(VARP_ELEMENTAL_WORKSHOP)! & BIT.waterFlowing) !== 0, "completion should preserve machine state");
assert.equal(varps.get(VARP_QUEST_POINTS), 1);
assert.equal(xp.get(SkillId.Smithing), 5_028);
assert.equal(xp.get(SkillId.Crafting), 5_000);

console.log("Elemental Workshop I quest tests passed");
