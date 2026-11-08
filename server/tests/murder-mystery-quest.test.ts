import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { murderMysteryQuest } from "../gamemodes/dev/quests/definitions/murderMystery";
import {
    EVIDENCE_FINGERPRINTS,
    EVIDENCE_THREAD,
    ITEM,
    LOC,
    MURDERERS,
    NPC,
    POISON_LOCATION_CHECKED,
    POISON_MURDERER_QUESTIONED,
    POISON_SALESMAN_QUESTIONED,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_MURDER_EVIDENCE,
    VARP_MURDERER,
    VARP_MURDER_MYSTERY,
    VARP_POISON_PROOF,
} from "../gamemodes/dev/quests/definitions/murderMystery/constants";
import { VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(murderMysteryQuest.varpId, VARP_MURDER_MYSTERY);
assert.equal(murderMysteryQuest.completionValue, STAGE_COMPLETE);
assert.equal(murderMysteryQuest.rewards.questPoints, 3);
assert.deepEqual(murderMysteryQuest.rewards.xp, [
    { skillId: SkillId.Crafting, amount: 1_406, label: "Crafting" },
]);
assert.deepEqual(murderMysteryQuest.rewards.items, [
    { itemId: ITEM.coins, quantity: 2_000, label: "Coins" },
]);

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_MURDER_MYSTERY, 0],
    [VARP_POISON_PROOF, 0],
    [VARP_MURDER_EVIDENCE, 0],
    [VARP_MURDERER, 0],
    [VARP_QUEST_POINTS, 0],
]);
const slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const choices = [0, 2, 2];
const xp = new Map<number, number>();
const spawnedGroundItems: number[] = [];
const player = {
    id: 7,
    name: "Detective",
    tileX: 2739,
    tileY: 3577,
    level: 0,
    worldViewId: -1,
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;

function count(itemId: number): number {
    return slots.filter((entry) => entry.itemId === itemId).reduce((sum, entry) => sum + entry.quantity, 0);
}

function add(itemId: number, quantity = 1): number {
    const existing = slots.find((entry) => entry.itemId === itemId && entry.quantity > 0);
    if (existing) {
        existing.quantity += quantity;
        return existing.slot;
    }
    const free = slots.find((entry) => entry.itemId <= 0 || entry.quantity <= 0);
    assert.ok(free, `no slot for ${itemId}`);
    Object.assign(free, { itemId, quantity });
    return free.slot;
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
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => Object.assign(slots[slot], { itemId, quantity }),
        snapshotInventory: () => undefined,
    },
    skills: {
        addSkillXp: (_player: unknown, skillId: number, amount: number) => xp.set(skillId, (xp.get(skillId) ?? 0) + amount),
    },
    data: { getObjType: (itemId: number) => ({ stackable: itemId === ITEM.coins ? 1 : 0 }) },
    groundItems: {
        query: () => [],
        spawn: (itemId: number) => {
            spawnedGroundItems.push(itemId);
            return { stackId: spawnedGroundItems.length, itemId };
        },
    },
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
    system: { getCurrentTick: () => 100, logger: { info: () => undefined, error: () => undefined }, eventBus: { on: () => undefined } },
} as unknown as ScriptServices;

murderMysteryQuest.register(registry, services);

function npc(npcId: number): void {
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing NPC ${npcId}`);
    handler({ player, services, npc: { id: npcId, typeId: npcId }, option: "talk-to", tick: 100 } as never);
}

function loc(locId: number, action: string): void {
    const handler = registry.findLocInteraction(locId, action);
    assert.ok(handler, `missing ${action} for loc ${locId}`);
    handler({ player, services, locId, tile: { x: 0, y: 0 }, level: 0, action } as never);
}

function use(first: number, second: number): void {
    const handler = registry.findItemOnItem(first, second);
    assert.ok(handler, `missing item recipe ${first} + ${second}`);
    handler({ player, services, source: { slot: 0, itemId: first }, target: { slot: 1, itemId: second } } as never);
}

npc(NPC.guard[0]);
assert.equal(varps.get(VARP_MURDER_MYSTERY), STAGE_STARTED);
assert.deepEqual(spawnedGroundItems.sort((a, b) => a - b), [ITEM.pungentPot, ITEM.dagger].sort((a, b) => a - b));

const culprit = MURDERERS[0];
varps.set(VARP_MURDERER, culprit.id);
add(ITEM.dagger);
add(ITEM.pungentPot);
add(ITEM.emptyPot, 2);

npc(NPC.poisonSalesman);
assert.equal(varps.get(VARP_POISON_PROOF), POISON_SALESMAN_QUESTIONED);
npc(culprit.npcId);
assert.equal(varps.get(VARP_POISON_PROOF), POISON_MURDERER_QUESTIONED);
loc(culprit.poisonLocIds[1], "investigate");
assert.equal(varps.get(VARP_POISON_PROOF), POISON_LOCATION_CHECKED);

loc(LOC.smashedWindow[1], "investigate");
assert.equal(count(culprit.threadItem), 1);
assert.ok((varps.get(VARP_MURDER_EVIDENCE)! & EVIDENCE_THREAD) !== 0);

loc(LOC.flourBarrel[1], "take-from");
loc(LOC.flypaperSacks, "investigate");
use(ITEM.potOfFlour, ITEM.dagger);
assert.equal(count(ITEM.dustedDagger), 1);
use(ITEM.flypaper, ITEM.dustedDagger);
assert.equal(count(ITEM.unknownPrint), 1);

loc(culprit.barrelId, "search");
loc(LOC.flourBarrel[1], "take-from");
loc(LOC.flypaperSacks, "investigate");
use(ITEM.potOfFlour, culprit.originalItem);
use(ITEM.flypaper, culprit.dustedItem);
assert.equal(count(culprit.printItem), 1);
use(ITEM.unknownPrint, culprit.printItem);
assert.equal(count(ITEM.killersPrint), 1);
assert.ok((varps.get(VARP_MURDER_EVIDENCE)! & EVIDENCE_FINGERPRINTS) !== 0);

npc(NPC.guard[0]);
assert.equal(varps.get(VARP_MURDER_MYSTERY), STAGE_COMPLETE);
assert.equal(varps.get(VARP_MURDERER), 0);
assert.equal(varps.get(VARP_POISON_PROOF), 0);
assert.equal(varps.get(VARP_MURDER_EVIDENCE), 0);
assert.equal(varps.get(VARP_QUEST_POINTS), 3);
assert.equal(count(ITEM.coins), 2_000);
assert.equal(xp.get(SkillId.Crafting), 1_406);
assert.equal(count(ITEM.killersPrint), 0);
assert.equal(count(culprit.threadItem), 0);

console.log("Murder Mystery quest tests passed");
