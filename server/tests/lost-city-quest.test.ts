import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
import { SkillId } from "../../client/rs/skill/skills";
import { lostCityQuest } from "../gamemodes/dev/quests/definitions/lostCity";
import {
    AXES,
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_SPIRIT_DEFEATED,
    STAGE_SPOKEN_SHAMUS,
    STAGE_STAFF_MADE,
    STAGE_STARTED,
    STAGE_TREE_CHOPPED,
    TILE,
    VARP_LOST_CITY,
} from "../gamemodes/dev/quests/definitions/lostCity/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(lostCityQuest.varpId, VARP_LOST_CITY);
assert.equal(lostCityQuest.completionValue, STAGE_COMPLETE);
assert.equal(lostCityQuest.rewards.questPoints, 3);
assert.deepEqual(lostCityQuest.requirements?.skills, [
    { skillId: SkillId.Crafting, level: 31, label: "Crafting" },
    { skillId: SkillId.Woodcutting, level: 36, label: "Woodcutting" },
]);
for (const npcId of [NPC.archer, NPC.warrior, NPC.monk, NPC.wizard]) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing adventurer ${npcId}`);
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_LOST_CITY, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const equipped = new Map<number, number>();
const activeNpcs = new Map<number, Record<string, unknown>>();
let nextNpcId = 9000;
const teleports: Array<{ x: number; y: number; level: number }> = [];
const player = {
    id: 147,
    name: "Lost City tester",
    tileX: 3149,
    tileY: 3207,
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
    messaging: { sendGameMessage: () => undefined },
    inventory: {
        getInventoryItems: () => slots,
        playerHasItem: (_player: unknown, itemId: number) =>
            slots.some((entry) => entry.itemId === itemId && entry.quantity > 0),
        findOwnedItemLocation: (_player: unknown, itemId: number) =>
            slots.some((entry) => entry.itemId === itemId && entry.quantity > 0) ||
            [...equipped.values()].includes(itemId)
                ? { container: "inventory" }
                : undefined,
        hasInventorySlot: () => slots.some((entry) => entry.itemId <= 0 || entry.quantity <= 0),
        collectCarriedItemIds: () => slots.filter((entry) => entry.itemId > 0).map((entry) => entry.itemId),
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const slot = addItem(itemId);
            slots[slot].quantity = quantity;
            return { slot, added: quantity };
        },
        consumeItem: (_player: unknown, slot: number) => {
            if (!slots[slot] || slots[slot].quantity <= 0) return false;
            slots[slot] = { slot, itemId: -1, quantity: 0 };
            return true;
        },
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => {
            slots[slot] = { slot, itemId, quantity };
        },
        snapshotInventory: () => undefined,
    },
    equipment: { getEquippedItem: (_player: unknown, slot: number) => equipped.get(slot) ?? -1 },
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
    },
    combat: { getNpc: (id: number) => activeNpcs.get(id) },
    skills: {
        getSkill: (_player: unknown, skillId: number) => ({
            baseLevel: skillId === SkillId.Crafting ? 31 : skillId === SkillId.Woodcutting ? 36 : 1,
            boost: 0,
        }),
        addSkillXp: () => undefined,
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
        eventBus: { on: () => undefined },
    },
} as unknown as ScriptServices;

lostCityQuest.register(registry, services);

function talk(npc: Record<string, unknown>): void {
    const npcId = Number(npc.typeId);
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing talk handler ${npcId}`);
    handler({ player, services, npc, option: "talk-to" } as never);
}

talk({ typeId: NPC.warrior });
assert.equal(getQuestStage(player, lostCityQuest), STAGE_STARTED);
const axeSlot = addItem(AXES[0]);

registry.findLocInteraction(LOC.leprechaunTree, "chop")!({
    player,
    services,
    locId: LOC.leprechaunTree,
    tile: { x: 3138, y: 3212 },
    level: 0,
    action: "chop",
} as never);
const shamus = [...activeNpcs.values()].find((npc) => npc.typeId === NPC.shamus);
assert.ok(shamus);
talk(shamus);
assert.equal(getQuestStage(player, lostCityQuest), STAGE_SPOKEN_SHAMUS);

registry.findLocInteraction(LOC.dramenTree, "chop down")!({
    player,
    services,
    locId: LOC.dramenTree,
    tile: { x: 2861, y: 9736 },
    level: 0,
    action: "chop down",
} as never);
const spirit = [...activeNpcs.values()].find((npc) => npc.typeId === NPC.treeSpirit);
assert.ok(spirit);
const decision = registry.findNpcPreDeath(NPC.treeSpirit)!({
    npc: spirit,
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
assert.equal(decision, NpcPreDeathDecision.Allow);
assert.equal(getQuestStage(player, lostCityQuest), STAGE_SPIRIT_DEFEATED);

registry.findLocInteraction(LOC.dramenTree, "chop down")!({
    player,
    services,
    locId: LOC.dramenTree,
    tile: { x: 2861, y: 9736 },
    level: 0,
    action: "chop down",
} as never);
assert.equal(getQuestStage(player, lostCityQuest), STAGE_TREE_CHOPPED);
const branchSlot = slots.find((entry) => entry.itemId === ITEM.dramenBranch)!.slot;
const knifeSlot = addItem(ITEM.knife);
registry.findItemOnItem(ITEM.knife, ITEM.dramenBranch)!({
    player,
    services,
    source: { slot: knifeSlot, itemId: ITEM.knife },
    target: { slot: branchSlot, itemId: ITEM.dramenBranch },
} as never);
assert.equal(getQuestStage(player, lostCityQuest), STAGE_STAFF_MADE);
assert.equal(slots[branchSlot].itemId, ITEM.dramenStaff);

slots[branchSlot] = { slot: branchSlot, itemId: -1, quantity: 0 };
equipped.set(EquipmentSlot.WEAPON, ITEM.dramenStaff);
registry.findLocInteraction(LOC.zanarisDoor, "open")!({
    player,
    services,
    locId: LOC.zanarisDoor,
    tile: { x: 3201, y: 3169 },
    level: 0,
    action: "open",
} as never);
assert.deepEqual(teleports.at(-1), TILE.zanaris);
assert.equal(getQuestStage(player, lostCityQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 3);
assert.equal(slots[axeSlot].itemId, AXES[0]);

console.log("Lost City quest tests passed");
