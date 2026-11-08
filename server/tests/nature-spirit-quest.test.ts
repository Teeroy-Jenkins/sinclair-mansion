import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
import { SkillId } from "../../client/rs/skill/skills";
import { natureSpiritQuest } from "../gamemodes/dev/quests/definitions/natureSpirit";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_ADDED_POUCH,
    STAGE_BLESSED,
    STAGE_BLESSED_SICKLE,
    STAGE_CAST_SICKLE_BLOOM,
    STAGE_CAST_SPELL,
    STAGE_COMPLETE,
    STAGE_ENTERED_GROTTO,
    STAGE_ENTERED_SWAMP,
    STAGE_FULL_TRANSFORM,
    STAGE_GIVEN_JOURNAL,
    STAGE_KILLED_GHAST_3,
    STAGE_PERFORMED_RITUAL,
    STAGE_PICKED_FUNGI,
    STAGE_PICKED_SICKLE_BLOOM,
    STAGE_RECEIVED_SPELL,
    STAGE_SHOWN_MIRROR,
    STAGE_SPOKEN_FILLIMAN,
    STAGE_SPOKEN_FILLIMAN_2,
    STAGE_STARTED,
    VARP_NATURE_SPIRIT,
    VARP_NATURE_SPIRIT_BITS,
} from "../gamemodes/dev/quests/definitions/natureSpirit/constants";
import { VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(natureSpiritQuest.varpId, 307);
assert.equal(natureSpiritQuest.completionValue, 110);
assert.equal(natureSpiritQuest.rewards.questPoints, 2);

type Slot = { slot: number; itemId: number; quantity: number };
const registry = new ScriptRegistry();
const varps = new Map<number, number>([[302, 60], [VARP_NATURE_SPIRIT, 0], [VARP_NATURE_SPIRIT_BITS, 0], [VARP_QUEST_POINTS, 0]]);
const slots: Slot[] = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const xp = new Map<number, number>();
const equipped = new Map<number, number>();
const activeNpcs: Array<{ id: number; typeId: number; tileX: number; tileY: number; level: number }> = [];
const player = {
    id: 84,
    name: "Spirit tester",
    tileX: 3440,
    tileY: 3338,
    level: 0,
    worldViewId: -1,
    varps: { getVarpValue: (id: number) => varps.get(id) ?? 0, setVarpValue: (id: number, value: number) => varps.set(id, value) },
    gamemode: { getQuestListGroups: () => [] },
} as never;
function count(itemId: number): number { return slots.filter((entry) => entry.itemId === itemId).reduce((sum, entry) => sum + entry.quantity, 0); }
function add(itemId: number, quantity = 1): number {
    if (itemId === ITEM.druidPouch) {
        const existing = slots.find((entry) => entry.itemId === itemId && entry.quantity > 0);
        if (existing) { existing.quantity += quantity; return existing.slot; }
        const free = slots.find((entry) => entry.itemId < 0 || entry.quantity <= 0)!;
        Object.assign(free, { itemId, quantity });
        return free.slot;
    }
    let first = -1;
    for (let index = 0; index < quantity; index++) {
        const free = slots.find((entry) => entry.itemId < 0 || entry.quantity <= 0);
        assert.ok(free);
        Object.assign(free, { itemId, quantity: 1 });
        if (first < 0) first = free.slot;
    }
    return first;
}
const services = {
    variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
    messaging: { sendGameMessage: () => undefined },
    inventory: {
        getInventoryItems: () => slots,
        findOwnedItemLocation: (_player: unknown, itemId: number) => count(itemId) ? { container: "inventory" } : undefined,
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => ({ slot: add(itemId, quantity), added: quantity }),
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => Object.assign(slots[slot], { itemId, quantity }),
        snapshotInventory: () => undefined,
    },
    equipment: { getEquippedItem: (_player: unknown, slot: number) => equipped.get(slot) ?? -1 },
    skills: {
        addSkillXp: (_player: unknown, skillId: number, amount: number) => xp.set(skillId, (xp.get(skillId) ?? 0) + amount),
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
    },
    data: { getObjType: (itemId: number) => ({ stackable: itemId === ITEM.druidPouch ? 1 : 0 }) },
    npc: {
        findNearbyNpc: (_player: unknown, typeId: number) => activeNpcs.find((npc) => npc.typeId === typeId),
        spawnNpc: (config: { id: number; x: number; y: number; level: number }) => {
            const npc = { id: 1_000 + activeNpcs.length, typeId: config.id, tileX: config.x, tileY: config.y, level: config.level };
            activeNpcs.push(npc);
            return npc;
        },
        removeNpc: (id: number) => { const index = activeNpcs.findIndex((npc) => npc.id === id); if (index >= 0) activeNpcs.splice(index, 1); return index >= 0; },
    },
    groundItems: { spawn: () => ({ stackId: 1 }) },
    movement: { teleportPlayer: (_player: unknown, x: number, y: number, level: number) => Object.assign(player, { tileX: x, tileY: y, level }) },
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
    system: { logger: { info: () => undefined, error: () => undefined }, getCurrentTick: () => 100, eventBus: { on: () => undefined } },
} as unknown as ScriptServices;

natureSpiritQuest.register(registry, services);
function npc(id: number): void {
    const handler = registry.findNpcInteractionDirect(id, "talk-to"); assert.ok(handler, `npc ${id}`);
    handler({ player, services, npc: { id, typeId: id, tileX: player.tileX, tileY: player.tileY, level: player.level }, option: "talk-to", tick: 100 } as never);
}
function loc(id: number, action: string): void {
    const handler = registry.findLocInteraction(id, action); assert.ok(handler, `loc ${id}/${action}`);
    handler({ player, services, locId: id, action, tile: { x: player.tileX, y: player.tileY }, level: player.level, tick: 100 } as never);
}
function itemOnNpc(itemId: number, npcId: number): void {
    const handler = registry.findItemOnNpc(itemId, npcId); assert.ok(handler);
    handler({ player, services, source: { itemId, slot: 0 }, npc: { id: npcId, typeId: npcId, tileX: 3440, tileY: 3335, level: 0 } } as never);
}
function itemOnLoc(itemId: number, locId: number): void {
    const handler = registry.findItemOnLoc(itemId, locId); assert.ok(handler);
    handler({ player, services, source: { itemId, slot: 0 }, target: { locId, tile: { x: 0, y: 0 }, level: 0 } } as never);
}

npc(NPC.drezel[0]);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_STARTED);
loc(LOC.swampGates[0], "open");
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_ENTERED_SWAMP);
equipped.set(EquipmentSlot.AMULET, ITEM.ghostspeakAmulet);
npc(NPC.filliman);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_SPOKEN_FILLIMAN);
registry.findGroundItemInteraction(ITEM.washingBowl, "search")!({ player, services } as never);
assert.equal(count(ITEM.mirror), 1);
itemOnNpc(ITEM.mirror, NPC.filliman);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_SHOWN_MIRROR);
loc(LOC.grottoTree, "search");
itemOnNpc(ITEM.journal, NPC.filliman);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_GIVEN_JOURNAL);
npc(NPC.filliman);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_RECEIVED_SPELL);
npc(NPC.drezel[0]);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_BLESSED);
registry.findItemAction(ITEM.bloomSpell, "cast")!({ player, services } as never);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_CAST_SPELL);
loc(LOC.fungiLog, "pick");
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_PICKED_FUNGI);
npc(NPC.filliman);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_SPOKEN_FILLIMAN_2);
itemOnLoc(ITEM.mortMyreFungus, LOC.natureStone);
itemOnLoc(ITEM.usedBloomSpell, LOC.spiritStone);
npc(NPC.filliman);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_PERFORMED_RITUAL);
loc(LOC.grottoEntrance, "enter");
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_ENTERED_GROTTO);
npc(NPC.natureSpirit);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_FULL_TRANSFORM);
add(ITEM.silverSickle);
npc(NPC.natureSpirit);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_BLESSED_SICKLE);
assert.equal(count(ITEM.silverSickleBlessed), 1);
registry.findItemAction(ITEM.silverSickleBlessed, "cast bloom")!({ player, services } as never);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_CAST_SICKLE_BLOOM);
loc(LOC.fungiLog, "pick");
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_PICKED_SICKLE_BLOOM);
registry.findItemAction(ITEM.druidPouchEmpty, "fill")!({ player, services } as never);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_ADDED_POUCH);
assert.equal(count(ITEM.druidPouch), 1);

const death = registry.findNpcPreDeath(NPC.visibleGhast[0]); assert.ok(death);
for (let index = 0; index < 3; index++) {
    assert.equal(death({ player, killer: player, services, npc: { id: 9_000 + index, typeId: NPC.visibleGhast[0], tileX: 3440, tileY: 3335, level: 0 }, hit: {} } as never), NpcPreDeathDecision.Allow);
}
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_KILLED_GHAST_3);
assert.equal(xp.get(SkillId.Prayer), 90);
npc(NPC.natureSpirit);
assert.equal(varps.get(VARP_NATURE_SPIRIT), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 2);
assert.equal(xp.get(SkillId.Crafting), 3_000);
assert.equal(xp.get(SkillId.Hitpoints), 2_000);
assert.equal(xp.get(SkillId.Defence), 2_000);

console.log("Nature Spirit quest tests passed");

