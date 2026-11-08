import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
import groundItems from "../gamemodes/dev/data/groundItemSpawnData.json";
import { sheepHerderQuest } from "../gamemodes/dev/quests/definitions/sheepHerder";
import {
    ITEM,
    LOC,
    NPC,
    SHEEP,
    STAGE_COMPLETE,
    STAGE_DISPOSING_SHEEP,
    STAGE_NEEDS_PROTECTIVE_CLOTHING,
    VARP_SHEEP_DISPOSAL,
    VARP_SHEEP_HERDER,
} from "../gamemodes/dev/quests/definitions/sheepHerder/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(sheepHerderQuest.varpId, VARP_SHEEP_HERDER);
assert.equal(sheepHerderQuest.completionValue, STAGE_COMPLETE);
assert.equal(sheepHerderQuest.rewards.questPoints, 4);
assert.deepEqual(sheepHerderQuest.rewards.items?.[0], {
    itemId: ITEM.coins,
    quantity: 3100,
    label: "3,100 Coins",
});
assert.ok(npcSpawns.some((spawn) => spawn.id === NPC.councillorHalgrive[0]));
assert.ok(npcSpawns.some((spawn) => spawn.id === NPC.doctorOrbon));
assert.ok(npcSpawns.some((spawn) => spawn.id === NPC.farmerBrumty));
assert.ok(groundItems.some((spawn) => spawn.id === ITEM.cattleprod));

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_SHEEP_HERDER, 0],
    [VARP_SHEEP_DISPOSAL, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const equipped = new Map<number, number>();
const activeNpcs = new Map<number, Record<string, unknown>>();
let nextNpcId = 5000;
const player = {
    id: 83,
    name: "Sheep tester",
    tileX: 2615,
    tileY: 3298,
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
    if (existing && itemId === ITEM.coins) {
        existing.quantity += quantity;
        return existing.slot;
    }
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
    equipment: { getEquippedItem: (_player: unknown, slot: number) => equipped.get(slot) ?? -1 },
    movement: { teleportPlayer: () => undefined },
    combat: { getNpc: (id: number) => activeNpcs.get(id) },
    npc: {
        spawnNpc: (config: Record<string, unknown>) => {
            const instanceId = ++nextNpcId;
            const npc = { ...config, id: instanceId, typeId: config.id };
            activeNpcs.set(instanceId, npc);
            return npc;
        },
        removeNpc: (id: number) => activeNpcs.delete(id),
    },
    skills: {
        getSkill: () => ({ baseLevel: 1, boost: 0 }),
        addSkillXp: () => undefined,
    },
    data: { getObjType: (id: number) => ({ stackable: id === ITEM.coins ? 1 : 0 }) },
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

sheepHerderQuest.register(registry, services);

function talk(npcId: number): void {
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing talk handler ${npcId}`);
    handler({ player, services, npc: { typeId: npcId }, option: "talk-to" } as never);
}

talk(NPC.councillorHalgrive[0]);
assert.equal(getQuestStage(player, sheepHerderQuest), STAGE_NEEDS_PROTECTIVE_CLOTHING);
assert.ok(slots.some((entry) => entry.itemId === ITEM.sheepFeed));

addItem(ITEM.coins, 100);
talk(NPC.doctorOrbon);
assert.equal(getQuestStage(player, sheepHerderQuest), STAGE_DISPOSING_SHEEP);
assert.ok(slots.some((entry) => entry.itemId === ITEM.plagueJacket));
assert.ok(slots.some((entry) => entry.itemId === ITEM.plagueTrousers));
assert.equal(activeNpcs.size, 4);

equipped.set(EquipmentSlot.BODY, ITEM.plagueJacket);
equipped.set(EquipmentSlot.LEGS, ITEM.plagueTrousers);
equipped.set(EquipmentSlot.WEAPON, ITEM.cattleprod);

for (const sheep of SHEEP) {
    let npc = [...activeNpcs.values()].find((entry) => entry.typeId === sheep.npcId);
    assert.ok(npc, `missing ${sheep.name}`);
    const prod = registry.findNpcInteractionDirect(sheep.npcId, "prod");
    assert.ok(prod);
    prod({ player, services, npc, option: "prod" } as never);
    assert.equal((varps.get(VARP_SHEEP_DISPOSAL)! >>> sheep.startBit) & 7, 1);

    npc = [...activeNpcs.values()].find((entry) => entry.typeId === sheep.npcId);
    assert.ok(npc, `missing penned ${sheep.name}`);
    const feedSlot = slots.find((entry) => entry.itemId === ITEM.sheepFeed)!.slot;
    registry.findItemOnNpc(ITEM.sheepFeed, sheep.npcId)!({
        player,
        services,
        source: { slot: feedSlot, itemId: ITEM.sheepFeed },
        target: npc,
    } as never);
    assert.equal((varps.get(VARP_SHEEP_DISPOSAL)! >>> sheep.startBit) & 7, 2);

    const boneSlot = slots.find((entry) => entry.itemId === sheep.bonesItemId)!.slot;
    registry.findItemOnLoc(sheep.bonesItemId, LOC.incinerator)!({
        player,
        services,
        source: { slot: boneSlot, itemId: sheep.bonesItemId },
        target: { locId: LOC.incinerator, tile: { x: 2606, y: 3360 }, level: 0 },
    } as never);
    assert.equal((varps.get(VARP_SHEEP_DISPOSAL)! >>> sheep.startBit) & 7, 6);
}

assert.equal(varps.get(VARP_SHEEP_DISPOSAL), 7020);
talk(NPC.councillorHalgrive[0]);
assert.equal(getQuestStage(player, sheepHerderQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 4);
assert.equal(slots.find((entry) => entry.itemId === ITEM.coins)?.quantity, 3100);

console.log("Sheep Herder quest tests passed");
