import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
import { SkillId } from "../../client/rs/skill/skills";
import { biohazardQuest } from "../gamemodes/dev/quests/definitions/biohazard";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_CLIMBED_LADDER,
    STAGE_COMPLETE,
    STAGE_FOUND_DISTILLATOR,
    STAGE_FOUND_SECRET,
    STAGE_GIVEN_DISTILLATOR,
    STAGE_POISONED_STEW,
    STAGE_RELEASED_PIGEONS,
    STAGE_REPORTED_TO_ELENA,
    STAGE_SPOKEN_TO_CHEMIST,
    STAGE_SPOKEN_TO_JERICO,
    STAGE_STARTED,
    STAGE_USED_BIRD_FEED,
    VARP_BIOHAZARD,
    VARP_BIO_DUMMIES,
    VARP_BIO_ERRAND,
} from "../gamemodes/dev/quests/definitions/biohazard/constants";
import { VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(biohazardQuest.varpId, 68);
assert.equal(biohazardQuest.completionValue, 16);
assert.equal(biohazardQuest.rewards.questPoints, 3);

type Slot = { slot: number; itemId: number; quantity: number };
const registry = new ScriptRegistry();
const varps = new Map<number, number>([[165, 29], [VARP_BIOHAZARD, 0], [VARP_BIO_ERRAND, 0], [VARP_BIO_DUMMIES, 0], [VARP_QUEST_POINTS, 0]]);
const slots: Slot[] = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const equipped = new Map<number, number>();
const xp = new Map<number, number>();
const choices = [0, 2, 1, 0];
const spawned: number[] = [];
const player = {
    id: 81,
    name: "Bio tester",
    tileX: 2561,
    tileY: 3303,
    level: 0,
    worldViewId: -1,
    varps: { getVarpValue: (id: number) => varps.get(id) ?? 0, setVarpValue: (id: number, value: number) => varps.set(id, value) },
    gamemode: { getQuestListGroups: () => [] },
} as never;

function count(itemId: number): number {
    return slots.filter((entry) => entry.itemId === itemId).reduce((sum, entry) => sum + entry.quantity, 0);
}
function add(itemId: number, quantity = 1): number {
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
    data: { getObjType: () => ({ stackable: 0 }) },
    npc: {
        findNearbyNpc: () => undefined,
        spawnNpc: (config: { id: number }) => { spawned.push(config.id); return { id: 1_000 + spawned.length, typeId: config.id }; },
    },
    movement: { teleportPlayer: (_player: unknown, x: number, y: number, level: number) => Object.assign(player, { tileX: x, tileY: y, level }) },
    dialog: {
        getInterfaceService: () => ({ getCurrentChatboxModal: () => undefined }),
        openDialog: (_player: unknown, spec: { onContinue?: () => void }) => spec.onContinue?.(),
        openDialogOptions: (_player: unknown, spec: { onSelect?: (choice: number) => void }) => spec.onSelect?.(choices.shift() ?? 0),
        closeDialog: () => undefined,
        openSubInterface: () => undefined,
        queueWidgetEvent: () => undefined,
    },
    viewport: { getMainmodalUid: () => 0 },
    sound: { sendJingle: () => undefined },
    system: { logger: { info: () => undefined, error: () => undefined }, getCurrentTick: () => 100, eventBus: { on: () => undefined } },
} as unknown as ScriptServices;

biohazardQuest.register(registry, services);

function npc(id: number): void {
    const handler = registry.findNpcInteractionDirect(id, "talk-to");
    assert.ok(handler, `missing npc ${id}`);
    handler({ player, services, npc: { id, typeId: id }, option: "talk-to", tick: 100 } as never);
}
function loc(id: number, action: string): void {
    const handler = registry.findLocInteraction(id, action);
    assert.ok(handler, `missing loc ${id}/${action}`);
    handler({ player, services, locId: id, action, tile: { x: 0, y: 0 }, level: 0, tick: 100 } as never);
}
function itemOnLoc(itemId: number, locId: number): void {
    const handler = registry.findItemOnLoc(itemId, locId);
    assert.ok(handler);
    handler({ player, services, source: { itemId, slot: 0 }, target: { locId, tile: { x: 0, y: 0 }, level: 0 } } as never);
}

npc(NPC.elena);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_STARTED);
npc(NPC.jerico);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_SPOKEN_TO_JERICO);
assert.equal(count(ITEM.birdFeed), 1);
assert.equal(count(ITEM.pigeonCage), 1);
itemOnLoc(ITEM.birdFeed, LOC.watchtower[0]);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_USED_BIRD_FEED);
registry.findItemAction(ITEM.pigeonCage, "open")!({ player, services } as never);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_RELEASED_PIGEONS);
npc(NPC.omart[0]);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_CLIMBED_LADDER);
loc(LOC.rottenAppleTrough, "search");
itemOnLoc(ITEM.rottenApple, LOC.mournerCauldron[0]);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_POISONED_STEW);
npc(NPC.nurseSarah);
assert.equal(count(ITEM.medicalGown), 1);
loc(LOC.distillatorCrate, "search");
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_FOUND_DISTILLATOR);
npc(NPC.elena);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_GIVEN_DISTILLATOR);
npc(NPC.chemist);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_SPOKEN_TO_CHEMIST);

npc(NPC.hopsRimmington);
npc(NPC.chancyRimmington);
npc(NPC.daVinciRimmington);
assert.ok(spawned.includes(NPC.hopsVarrock));
npc(NPC.hopsVarrock);
npc(NPC.chancyVarrock);
npc(NPC.daVinciVarrock);
assert.equal(count(ITEM.sulphuricBroline), 1);
assert.equal(count(ITEM.liquidHoney), 1);
assert.equal(count(ITEM.ethenea), 1);

equipped.set(EquipmentSlot.BODY, ITEM.priestGownTop);
equipped.set(EquipmentSlot.LEGS, ITEM.priestGownBottom);
npc(NPC.guidor);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_FOUND_SECRET);
npc(NPC.elena);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_REPORTED_TO_ELENA);
npc(NPC.kingLathas[0]);
assert.equal(varps.get(VARP_BIOHAZARD), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 3);
assert.equal(xp.get(SkillId.Thieving), 1_250);
for (let index = 0; index < 6; index++) loc(LOC.trainingDummy, "hit");
assert.equal(varps.get(VARP_BIO_DUMMIES), 6);
assert.equal(xp.get(SkillId.Attack), 300);

console.log("Biohazard quest tests passed");

