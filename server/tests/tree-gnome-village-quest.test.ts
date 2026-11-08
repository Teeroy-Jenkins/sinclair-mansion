import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { treeGnomeVillageQuest } from "../gamemodes/dev/quests/definitions/treeGnomeVillage";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_BALLISTA_FIRED,
    STAGE_COMPLETE,
    STAGE_DEFEATED_WARLORD,
    STAGE_FINDING_TRACKERS,
    STAGE_GIVEN_LOGS,
    STAGE_RETRIEVED_ORB,
    STAGE_RETURNED_FIRST_ORB,
    STAGE_SPOKEN_MONTAI,
    STAGE_STARTED,
    VARP_TREE_GNOME_VILLAGE,
} from "../gamemodes/dev/quests/definitions/treeGnomeVillage/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(treeGnomeVillageQuest.varpId, VARP_TREE_GNOME_VILLAGE);
assert.equal(treeGnomeVillageQuest.completionValue, STAGE_COMPLETE);
assert.equal(treeGnomeVillageQuest.rewards.questPoints, 2);
assert.deepEqual(treeGnomeVillageQuest.rewards.xp, [
    { skillId: SkillId.Attack, amount: 11_450, label: "Attack" },
]);
for (const npcId of [
    NPC.kingBolren,
    NPC.commanderMontai,
    NPC.khazardWarlord,
    ...NPC.trackers,
    NPC.elkoyOutside,
    NPC.elkoyInside,
]) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing Tree Gnome Village NPC ${npcId}`);
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_TREE_GNOME_VILLAGE, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const xp = new Map<number, number>();
const drops: Array<{ itemId: number; ownerId?: number }> = [];
let temporaryChest = false;
const player = {
    id: 111,
    name: "Tree Gnome tester",
    tileX: 2503,
    tileY: 3254,
    level: 1,
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

function count(itemId: number): number {
    return slots.filter((entry) => entry.itemId === itemId).reduce((sum, entry) => sum + entry.quantity, 0);
}

const services = {
    variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
    messaging: { sendGameMessage: () => undefined },
    inventory: {
        getInventoryItems: () => slots,
        findOwnedItemLocation: (_player: unknown, itemId: number) =>
            count(itemId) > 0 ? { container: "inventory" } : undefined,
        hasInventorySlot: () => slots.some((entry) => entry.itemId <= 0 || entry.quantity <= 0),
        collectCarriedItemIds: () => slots.filter((entry) => entry.itemId > 0).map((entry) => entry.itemId),
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const slot = addItem(itemId, quantity);
            return { slot, added: quantity };
        },
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => {
            slots[slot] = { slot, itemId, quantity };
        },
        snapshotInventory: () => undefined,
    },
    skills: {
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) =>
            xp.set(skillId, (xp.get(skillId) ?? 0) + amount),
    },
    data: { getObjType: () => ({ stackable: 0 }) },
    groundItems: {
        spawn: (itemId: number, _quantity: number, _tile: unknown, options: { ownerId?: number }) => {
            drops.push({ itemId, ownerId: options.ownerId });
            return { stackId: drops.length, itemId };
        },
    },
    location: { replaceTemporaryLoc: () => { temporaryChest = true; return {}; } },
    movement: { teleportPlayer: () => undefined },
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

treeGnomeVillageQuest.register(registry, services);

function talk(npcId: number): void {
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing talk handler ${npcId}`);
    handler({ player, services, npc: { typeId: npcId }, option: "talk-to" } as never);
}

talk(NPC.kingBolren);
assert.equal(getQuestStage(player, treeGnomeVillageQuest), STAGE_STARTED);
talk(NPC.commanderMontai);
assert.equal(getQuestStage(player, treeGnomeVillageQuest), STAGE_SPOKEN_MONTAI);
addItem(ITEM.logs, 6);
talk(NPC.commanderMontai);
assert.equal(getQuestStage(player, treeGnomeVillageQuest), STAGE_GIVEN_LOGS);
assert.equal(count(ITEM.logs), 0);
talk(NPC.commanderMontai);
assert.equal(getQuestStage(player, treeGnomeVillageQuest), STAGE_FINDING_TRACKERS);
for (const npcId of NPC.trackers) talk(npcId);

registry.findLocInteraction(LOC.ballista, "fire")!({
    player,
    services,
    locId: LOC.ballista,
    tile: { x: 2495, y: 3230 },
    level: 0,
    action: "fire",
} as never);
assert.equal(getQuestStage(player, treeGnomeVillageQuest), STAGE_BALLISTA_FIRED);
registry.findLocInteraction(LOC.closedChest, "open")!({
    player,
    services,
    locId: LOC.closedChest,
    tile: { x: 2503, y: 3254 },
    level: 1,
    action: "open",
} as never);
assert.equal(temporaryChest, true);
registry.findLocInteraction(LOC.openChest, "search")!({
    player,
    services,
    locId: LOC.openChest,
    tile: { x: 2503, y: 3254 },
    level: 1,
    action: "search",
} as never);
assert.equal(getQuestStage(player, treeGnomeVillageQuest), STAGE_RETRIEVED_ORB);
assert.equal(count(ITEM.firstOrb), 1);

talk(NPC.kingBolren);
assert.equal(getQuestStage(player, treeGnomeVillageQuest), STAGE_RETURNED_FIRST_ORB);
assert.equal(count(ITEM.firstOrb), 0);
const warlord = { id: 9000, typeId: NPC.khazardWarlord, tileX: 2457, tileY: 3302, level: 0 };
const decision = registry.findNpcPreDeath(NPC.khazardWarlord)!({
    player,
    services,
    npc: warlord,
    killer: player,
    killerPlayerId: player.id,
    hit: { proposedDamage: 20, style: 0, hitpointsBefore: 10, hitpointsAfter: 0, cause: "combat" },
} as never);
assert.equal(decision, NpcPreDeathDecision.Allow);
assert.equal(getQuestStage(player, treeGnomeVillageQuest), STAGE_DEFEATED_WARLORD);
assert.deepEqual(drops, [{ itemId: ITEM.remainingOrbs, ownerId: player.id }]);
addItem(ITEM.remainingOrbs);

talk(NPC.kingBolren);
assert.equal(getQuestStage(player, treeGnomeVillageQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 2);
assert.equal(xp.get(SkillId.Attack), 11_450);
assert.equal(count(ITEM.gnomeAmulet), 1);

console.log("Tree Gnome Village quest tests passed");
