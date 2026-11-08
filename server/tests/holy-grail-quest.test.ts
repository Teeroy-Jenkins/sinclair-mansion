import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
import { SkillId } from "../../client/rs/skill/skills";
import { holyGrailQuest } from "../gamemodes/dev/quests/definitions/holyGrail";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_FAILED_TITAN,
    STAGE_FINDING_PERCIVAL,
    STAGE_GIVEN_WHISTLE,
    STAGE_SPOKEN_CRONE,
    STAGE_SPOKEN_MERLIN,
    STAGE_STARTED,
    TILE,
    VARP_HOLY_GRAIL,
    VARP_MERLINS_CRYSTAL,
} from "../gamemodes/dev/quests/definitions/holyGrail/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(holyGrailQuest.varpId, VARP_HOLY_GRAIL);
assert.equal(holyGrailQuest.completionValue, STAGE_COMPLETE);
assert.deepEqual(holyGrailQuest.requirements, {
    skills: [{ skillId: SkillId.Attack, level: 20, label: "Attack" }],
    quests: [{ varpId: VARP_MERLINS_CRYSTAL, minValue: 7, label: "Merlin's Crystal" }],
});
assert.equal(holyGrailQuest.rewards.questPoints, 2);
assert.deepEqual(holyGrailQuest.rewards.xp, [
    { skillId: SkillId.Prayer, amount: 11_000, label: "Prayer" },
    { skillId: SkillId.Defence, amount: 15_300, label: "Defence" },
]);

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_HOLY_GRAIL, 0],
    [VARP_MERLINS_CRYSTAL, 7],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const equipment = new Map<number, number>();
const xp = new Map<number, number>();
const drops: Array<{ itemId: number; quantity: number; ownerId?: number }> = [];
const activeNpcs: Array<{ id: number; typeId: number; tileX: number; tileY: number; level: number }> = [];
const teleports: Array<{ x: number; y: number; level: number }> = [];
const player = {
    id: 5,
    name: "Holy Grail tester",
    tileX: 2757,
    tileY: 3507,
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
    equipment: { getEquippedItem: (_player: unknown, slot: number) => equipment.get(slot) ?? -1 },
    skills: {
        getSkill: (_player: unknown, skillId: number) => ({ baseLevel: skillId === SkillId.Attack ? 20 : 99, boost: 0 }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) =>
            xp.set(skillId, (xp.get(skillId) ?? 0) + amount),
    },
    data: { getObjType: () => ({ stackable: 0 }) },
    groundItems: {
        spawn: (itemId: number, quantity: number, _tile: unknown, options: { ownerId?: number }) => {
            drops.push({ itemId, quantity, ownerId: options.ownerId });
            return { stackId: drops.length, itemId };
        },
    },
    npc: {
        findNearbyNpc: (_player: unknown, typeId: number) => activeNpcs.find((npc) => npc.typeId === typeId),
        spawnNpc: (config: { id: number; x: number; y: number; level: number }) => {
            const npc = { id: 10_000 + activeNpcs.length, typeId: config.id, tileX: config.x, tileY: config.y, level: config.level };
            activeNpcs.push(npc);
            return npc;
        },
        removeNpc: (id: number) => {
            const index = activeNpcs.findIndex((npc) => npc.id === id);
            if (index >= 0) activeNpcs.splice(index, 1);
        },
    },
    movement: {
        teleportPlayer: (_player: unknown, x: number, y: number, level: number) => {
            teleports.push({ x, y, level });
            Object.assign(player, { tileX: x, tileY: y, level });
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

holyGrailQuest.register(registry, services);

function talk(npc: number | { id: number; typeId: number }): void {
    const target = typeof npc === "number" ? { id: npc, typeId: npc } : npc;
    const handler = registry.findNpcInteractionDirect(target.typeId, "talk-to");
    assert.ok(handler, `missing talk handler ${target.typeId}`);
    handler({ player, services, npc: target, option: "talk-to" } as never);
}

function useItem(itemId: number): void {
    const handler = registry.findItemAction(itemId);
    assert.ok(handler, `missing item action ${itemId}`);
    handler({ player, services, source: { slot: 0, itemId }, target: { slot: 0, itemId } } as never);
}

talk(NPC.kingArthur);
assert.equal(getQuestStage(player, holyGrailQuest), STAGE_STARTED);
const merlin = activeNpcs.find((npc) => npc.typeId === NPC.merlin);
assert.ok(merlin, "King Arthur should make Merlin available to this player");
talk(merlin);
assert.equal(getQuestStage(player, holyGrailQuest), STAGE_SPOKEN_MERLIN);
talk(NPC.highPriest);
assert.equal(getQuestStage(player, holyGrailQuest), STAGE_SPOKEN_CRONE);
talk(NPC.galahad);
assert.equal(count(ITEM.napkin), 1);

registry.findLocInteraction(LOC.whistleRoomDoor, "open")!({
    player,
    services,
    locId: LOC.whistleRoomDoor,
    tile: TILE.whistleTable,
    level: TILE.whistleTable.level,
    action: "open",
} as never);
assert.deepEqual(drops.at(-1), { itemId: ITEM.magicWhistle, quantity: 2, ownerId: player.id });
addItem(ITEM.magicWhistle, 2);

Object.assign(player, { tileX: TILE.karamjaTower.x, tileY: TILE.karamjaTower.y, level: 0 });
useItem(ITEM.magicWhistle);
assert.deepEqual(teleports.at(-1), TILE.realmDying);

let healed = 0;
const titan = { id: 7000, typeId: NPC.blackKnightTitan, heal: (amount: number) => { healed += amount; } };
const preDeath = registry.findNpcPreDeath(NPC.blackKnightTitan);
assert.ok(preDeath);
let decision = preDeath({
    player,
    services,
    npc: titan,
    killer: player,
    killerPlayerId: player.id,
    hit: { proposedDamage: 10, style: 0, hitpointsBefore: 10, hitpointsAfter: 0, cause: "combat" },
} as never);
assert.equal(decision, NpcPreDeathDecision.Prevent);
assert.equal(getQuestStage(player, holyGrailQuest), STAGE_FAILED_TITAN);
assert.equal(healed, 10_000);
equipment.set(EquipmentSlot.WEAPON, ITEM.excalibur);
decision = preDeath({
    player,
    services,
    npc: titan,
    killer: player,
    killerPlayerId: player.id,
    hit: { proposedDamage: 10, style: 0, hitpointsBefore: 10, hitpointsAfter: 0, cause: "combat" },
} as never);
assert.equal(decision, NpcPreDeathDecision.Allow);

talk(NPC.fisherman);
assert.equal(count(ITEM.grailBell), 1);
useItem(ITEM.grailBell);
assert.deepEqual(teleports.at(-1), TILE.fisherCastle);
talk(NPC.fisherKing);
assert.equal(getQuestStage(player, holyGrailQuest), STAGE_FINDING_PERCIVAL);
talk(NPC.kingArthur);
assert.equal(count(ITEM.magicFeather), 1);

registry.findLocInteraction(LOC.percivalSacks, "open")!({
    player,
    services,
    locId: LOC.percivalSacks,
    tile: { x: 2780, y: 3360 },
    level: 0,
    action: "open",
} as never);
const percival = activeNpcs.find((npc) => npc.typeId === NPC.sirPercival);
assert.ok(percival);
talk(percival);
assert.equal(getQuestStage(player, holyGrailQuest), STAGE_GIVEN_WHISTLE);
assert.equal(count(ITEM.magicWhistle), 1);

Object.assign(player, { tileX: TILE.karamjaTower.x, tileY: TILE.karamjaTower.y, level: 0 });
useItem(ITEM.magicWhistle);
assert.deepEqual(teleports.at(-1), TILE.realmRestored);
assert.deepEqual(drops.at(-1), { itemId: ITEM.holyGrail, quantity: 1, ownerId: player.id });
addItem(ITEM.holyGrail);
talk(NPC.kingArthur);
assert.equal(getQuestStage(player, holyGrailQuest), STAGE_COMPLETE);
assert.equal(count(ITEM.holyGrail), 0);
assert.equal(varps.get(VARP_QUEST_POINTS), 2);
assert.equal(xp.get(SkillId.Prayer), 11_000);
assert.equal(xp.get(SkillId.Defence), 15_300);

console.log("Holy Grail quest tests passed");
