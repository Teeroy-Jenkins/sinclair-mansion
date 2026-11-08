import assert from "node:assert/strict";

import { shieldOfArravQuest } from "../gamemodes/dev/quests/definitions/shieldOfArrav";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_CERTIFICATE,
    STAGE_COMPLETE,
    STAGE_GANG_TASK,
    STAGE_JOINED_GANG,
    STAGE_READ_BOOK,
    STAGE_STARTED,
    VARP_SHIELD_OF_ARRAV,
} from "../gamemodes/dev/quests/definitions/shieldOfArrav/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(shieldOfArravQuest.varpId, VARP_SHIELD_OF_ARRAV);
assert.equal(shieldOfArravQuest.completionValue, STAGE_COMPLETE);
assert.equal(shieldOfArravQuest.rewards.questPoints, 1);
assert.deepEqual(shieldOfArravQuest.rewards.items, [
    { itemId: ITEM.coins, quantity: 600, label: "600 Coins" },
]);
for (const npcId of Object.values(NPC)) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing Shield of Arrav NPC ${npcId}`);
}

type TestPlayer = {
    id: number;
    name: string;
    tileX: number;
    tileY: number;
    level: number;
    worldViewId: number;
    varps: {
        getVarpValue(id: number): number;
        setVarpValue(id: number, value: number): void;
    };
    gamemode: { getQuestListGroups(): never[] };
};

type Slot = { slot: number; itemId: number; quantity: number };

function createPlayer(id: number, name: string): TestPlayer {
    const values = new Map<number, number>([
        [VARP_SHIELD_OF_ARRAV, 0],
        [VARP_QUEST_POINTS, 0],
    ]);
    return {
        id,
        name,
        tileX: 3208,
        tileY: 3495,
        level: 0,
        worldViewId: -1,
        varps: {
            getVarpValue: (varpId) => values.get(varpId) ?? 0,
            setVarpValue: (varpId, value) => values.set(varpId, value),
        },
        gamemode: { getQuestListGroups: () => [] },
    };
}

const phoenix = createPlayer(1451, "Phoenix tester");
const blackArm = createPlayer(1452, "Black Arm tester");
const inventories = new Map<number, Slot[]>([
    [phoenix.id, Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }))],
    [blackArm.id, Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }))],
]);
const drops: Array<{ itemId: number; quantity: number; ownerId?: number }> = [];

function slots(player: TestPlayer): Slot[] {
    return inventories.get(player.id)!;
}

function add(player: TestPlayer, itemId: number, quantity = 1): number {
    const existing = slots(player).find((entry) => entry.itemId === itemId && entry.quantity > 0);
    if (existing) {
        existing.quantity += quantity;
        return existing.slot;
    }
    const entry = slots(player).find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
    assert.ok(entry, `no inventory space for ${player.name}`);
    Object.assign(entry, { itemId, quantity });
    return entry.slot;
}

function count(player: TestPlayer, itemId: number): number {
    return slots(player)
        .filter((entry) => entry.itemId === itemId)
        .reduce((total, entry) => total + entry.quantity, 0);
}

const services = {
    variables: { sendVarp: (player: TestPlayer, id: number, value: number) => player.varps.setVarpValue(id, value) },
    messaging: { sendGameMessage: () => undefined },
    inventory: {
        getInventoryItems: (player: TestPlayer) => slots(player),
        findOwnedItemLocation: (player: TestPlayer, itemId: number) =>
            count(player, itemId) > 0 ? { container: "inventory" } : undefined,
        hasInventorySlot: (player: TestPlayer) => slots(player).some((entry) => entry.itemId <= 0 || entry.quantity <= 0),
        collectCarriedItemIds: (player: TestPlayer) => slots(player).filter((entry) => entry.itemId > 0).map((entry) => entry.itemId),
        addItemToInventory: (player: TestPlayer, itemId: number, quantity: number) => {
            const slot = add(player, itemId, quantity);
            return { slot, added: quantity };
        },
        setInventorySlot: (player: TestPlayer, slot: number, itemId: number, quantity: number) => {
            slots(player)[slot] = { slot, itemId, quantity };
        },
        snapshotInventory: () => undefined,
    },
    data: { getObjType: (itemId: number) => ({ stackable: [ITEM.coins, ITEM.phoenixCertificateHalf, ITEM.blackArmCertificateHalf].includes(itemId) ? 1 : 0 }) },
    skills: { getSkill: () => ({ baseLevel: 99, boost: 0 }), addSkillXp: () => undefined },
    groundItems: {
        spawn: (itemId: number, quantity: number, _tile: unknown, options: { ownerId?: number }) => {
            drops.push({ itemId, quantity, ownerId: options.ownerId });
            return { stackId: drops.length, itemId };
        },
    },
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

const registry = new ScriptRegistry();
shieldOfArravQuest.register(registry, services);

function talk(player: TestPlayer, npcId: number): void {
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing talk handler ${npcId}`);
    handler({ player, services, npc: { id: npcId, typeId: npcId }, option: "talk-to" } as never);
}

function useItem(player: TestPlayer, itemId: number, option?: string): void {
    const handler = registry.findItemAction(itemId, option);
    assert.ok(handler, `missing item action ${itemId}`);
    handler({ player, services, source: { slot: 0, itemId }, target: { slot: 0, itemId }, option } as never);
}

function search(player: TestPlayer, locId: number, action: string): void {
    const handler = registry.findLocInteraction(locId, action);
    assert.ok(handler, `missing loc handler ${locId}`);
    handler({ player, services, locId, tile: { x: 0, y: 0 }, level: 0, action } as never);
}

add(phoenix, ITEM.coins, 20);
for (const player of [phoenix, blackArm]) {
    talk(player, NPC.reldo);
    assert.equal(getQuestStage(player as never, shieldOfArravQuest), STAGE_STARTED);
    search(player, LOC.bookcase, "search");
    useItem(player, ITEM.book, "read");
    assert.equal(getQuestStage(player as never, shieldOfArravQuest), STAGE_READ_BOOK);
}

talk(phoenix, NPC.baraek);
assert.equal(count(phoenix, ITEM.coins), 0);
talk(phoenix, NPC.straven);
assert.equal(getQuestStage(phoenix as never, shieldOfArravQuest), STAGE_GANG_TASK);

talk(blackArm, NPC.charlie);
talk(blackArm, NPC.katrine);
assert.equal(getQuestStage(blackArm as never, shieldOfArravQuest), STAGE_GANG_TASK);

const jonnyDecision = registry.findNpcPreDeath(NPC.jonnyTheBeard)!({
    player: phoenix,
    services,
    npc: { id: 1, typeId: NPC.jonnyTheBeard, tileX: 3223, tileY: 3395, level: 0, worldViewId: -1 },
    killer: phoenix,
    killerPlayerId: phoenix.id,
    hit: { proposedDamage: 5, style: 0, hitpointsBefore: 5, hitpointsAfter: 0, cause: "combat" },
} as never);
assert.equal(jonnyDecision, NpcPreDeathDecision.Allow);
assert.deepEqual(drops.at(-1), { itemId: ITEM.intelReport, quantity: 1, ownerId: phoenix.id });
add(phoenix, ITEM.intelReport);
talk(phoenix, NPC.straven);
assert.equal(getQuestStage(phoenix as never, shieldOfArravQuest), STAGE_JOINED_GANG);
assert.equal(count(phoenix, ITEM.weaponStoreKey), 1);

registry.findItemOnPlayer(ITEM.weaponStoreKey)!({
    player: phoenix,
    target: blackArm,
    services,
    source: { slot: 0, itemId: ITEM.weaponStoreKey },
} as never);
assert.equal(count(phoenix, ITEM.weaponStoreKey), 0);
assert.equal(count(blackArm, ITEM.weaponStoreKey), 1);
talk(phoenix, NPC.straven);
assert.equal(count(phoenix, ITEM.weaponStoreKey), 1, "Straven should replace a transferred key");

const weaponDecision = registry.findNpcPreDeath(NPC.weaponsmaster)!({
    player: blackArm,
    services,
    npc: { id: 2, typeId: NPC.weaponsmaster, tileX: 3246, tileY: 3384, level: 1, worldViewId: -1 },
    killer: blackArm,
    killerPlayerId: blackArm.id,
    hit: { proposedDamage: 10, style: 0, hitpointsBefore: 10, hitpointsAfter: 0, cause: "combat" },
} as never);
assert.equal(weaponDecision, NpcPreDeathDecision.Allow);
assert.deepEqual(drops.at(-1), { itemId: ITEM.phoenixCrossbow, quantity: 2, ownerId: undefined });
add(blackArm, ITEM.phoenixCrossbow, 2);
talk(blackArm, NPC.katrine);
assert.equal(getQuestStage(blackArm as never, shieldOfArravQuest), STAGE_JOINED_GANG);
assert.equal(count(blackArm, ITEM.phoenixCrossbow), 0);

search(phoenix, LOC.phoenixChest, "open");
search(blackArm, LOC.blackArmCupboard, "open");
assert.equal(count(phoenix, ITEM.phoenixShieldHalf), 1);
assert.equal(count(blackArm, ITEM.blackArmShieldHalf), 1);
talk(phoenix, NPC.curator);
talk(blackArm, NPC.curator);
assert.equal(getQuestStage(phoenix as never, shieldOfArravQuest), STAGE_CERTIFICATE);
assert.equal(getQuestStage(blackArm as never, shieldOfArravQuest), STAGE_CERTIFICATE);
assert.equal(count(phoenix, ITEM.phoenixCertificateHalf), 2);
assert.equal(count(blackArm, ITEM.blackArmCertificateHalf), 2);

registry.findItemOnPlayer(ITEM.phoenixCertificateHalf)!({
    player: phoenix,
    target: blackArm,
    services,
    source: { slot: 0, itemId: ITEM.phoenixCertificateHalf },
} as never);
assert.equal(count(phoenix, ITEM.phoenixCertificateHalf), 1);
assert.equal(count(phoenix, ITEM.blackArmCertificateHalf), 1);
assert.equal(count(blackArm, ITEM.phoenixCertificateHalf), 1);
assert.equal(count(blackArm, ITEM.blackArmCertificateHalf), 1);

for (const player of [phoenix, blackArm]) {
    registry.findItemOnItem(ITEM.phoenixCertificateHalf, ITEM.blackArmCertificateHalf)!({
        player,
        services,
        source: { slot: 0, itemId: ITEM.phoenixCertificateHalf },
        target: { slot: 1, itemId: ITEM.blackArmCertificateHalf },
    } as never);
    assert.equal(count(player, ITEM.certificate), 1);
    talk(player, NPC.kingRoald);
    assert.equal(getQuestStage(player as never, shieldOfArravQuest), STAGE_COMPLETE);
    assert.equal(player.varps.getVarpValue(VARP_QUEST_POINTS), 1);
    assert.equal(count(player, ITEM.coins), 600);
}

console.log("Shield of Arrav quest tests passed");
