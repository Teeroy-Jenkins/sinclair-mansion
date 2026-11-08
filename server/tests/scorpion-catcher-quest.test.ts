import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { BARCRAWL_CARD, BARCRAWL_COMPLETE, BARS, COINS, VARP_BARCRAWL } from "../gamemodes/dev/quests/definitions/barCrawl/constants";
import { scorpionCatcherQuest } from "../gamemodes/dev/quests/definitions/scorpionCatcher";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_FIRST_HINT,
    STAGE_SECOND_HINT,
    STAGE_STARTED,
    VARP_SCORPION_CATCHER,
} from "../gamemodes/dev/quests/definitions/scorpionCatcher/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(scorpionCatcherQuest.varpId, VARP_SCORPION_CATCHER);
assert.equal(scorpionCatcherQuest.completionValue, STAGE_COMPLETE);
assert.equal(scorpionCatcherQuest.requirements?.skills?.[0].level, 31);
assert.equal(scorpionCatcherQuest.rewards.xp?.[0].amount, 6625);
for (const npcId of [NPC.firstScorpion, NPC.secondScorpion, NPC.thirdScorpion, NPC.thormac]) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing Scorpion Catcher NPC ${npcId}`);
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_SCORPION_CATCHER, 0],
    [VARP_BARCRAWL, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
let strengthXp = 0;
const optionChoices: number[] = [];
const player = {
    id: 82,
    name: "Scorpion tester",
    tileX: 2544,
    tileY: 3569,
    level: 0,
    worldViewId: -1,
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    skillSystem: { adjustSkillBoost: () => undefined },
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
            const existing = slots.find((entry) => entry.itemId === itemId && entry.quantity > 0);
            if (existing && (itemId === COINS || itemId === BARCRAWL_CARD)) {
                existing.quantity += quantity;
                return { slot: existing.slot, added: quantity };
            }
            const entry = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
            if (!entry) return { slot: -1, added: 0 };
            entry.itemId = itemId;
            entry.quantity = quantity;
            return { slot: entry.slot, added: quantity };
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
        teleportPlayer: (_player: unknown, x: number, y: number, level: number) => {
            (player as { tileX: number }).tileX = x;
            (player as { tileY: number }).tileY = y;
            (player as { level: number }).level = level;
        },
    },
    combat: {
        applyPlayerHitsplat: () => ({ amount: 3, style: 0, hpCurrent: 7, hpMax: 10 }),
    },
    npc: { stopNpcMovement: () => undefined },
    skills: {
        getSkill: (_player: unknown, skillId: number) => ({
            baseLevel: skillId === SkillId.Prayer ? 31 : 1,
            boost: 0,
        }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) => {
            if (skillId === SkillId.Strength) strengthXp += amount;
        },
    },
    data: { getObjType: () => ({ stackable: 0 }) },
    dialog: {
        getInterfaceService: () => ({ getCurrentChatboxModal: () => undefined }),
        openDialog: (_player: unknown, spec: { onContinue?: () => void }) => spec.onContinue?.(),
        openDialogOptions: (_player: unknown, spec: { onSelect?: (choice: number) => void }) =>
            spec.onSelect?.(optionChoices.shift() ?? 0),
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

scorpionCatcherQuest.register(registry, services);

function talk(npcId: number): void {
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing talk handler for ${npcId}`);
    handler({ player, services, npc: { typeId: npcId }, option: "talk-to" } as never);
}

function useItemOnNpc(itemId: number, npcId: number): void {
    const slot = slots.find((entry) => entry.itemId === itemId && entry.quantity > 0)?.slot;
    assert.notEqual(slot, undefined, `missing item ${itemId}`);
    const handler = registry.findItemOnNpc(itemId, npcId);
    assert.ok(handler, `missing item-on-npc ${itemId} -> ${npcId}`);
    handler({
        player,
        services,
        source: { slot, itemId },
        target: { id: npcId + 100_000, typeId: npcId },
    } as never);
}

optionChoices.push(0, 1);
talk(5227);
assert.equal(varps.get(VARP_BARCRAWL), 1);
assert.ok(slots.some((entry) => entry.itemId === BARCRAWL_CARD));
addItem(COINS, 500);
for (const bar of BARS) useItemOnNpc(BARCRAWL_CARD, bar.npcIds[0]);
talk(5227);
assert.equal(varps.get(VARP_BARCRAWL), BARCRAWL_COMPLETE);
assert.ok(!slots.some((entry) => entry.itemId === BARCRAWL_CARD && entry.quantity > 0));

optionChoices.push(0);
talk(NPC.thormac);
assert.equal(getQuestStage(player, scorpionCatcherQuest), STAGE_STARTED);
assert.ok(slots.some((entry) => entry.itemId === ITEM.emptyCage));

talk(NPC.seer);
assert.equal(getQuestStage(player, scorpionCatcherQuest), STAGE_FIRST_HINT);
useItemOnNpc(ITEM.emptyCage, NPC.firstScorpion);
assert.ok(slots.some((entry) => entry.itemId === ITEM.first));
talk(NPC.seer);
assert.equal(getQuestStage(player, scorpionCatcherQuest), STAGE_SECOND_HINT);

useItemOnNpc(ITEM.first, NPC.secondScorpion);
assert.ok(slots.some((entry) => entry.itemId === ITEM.firstSecond));
useItemOnNpc(ITEM.firstSecond, NPC.thirdScorpion);
assert.ok(slots.some((entry) => entry.itemId === ITEM.fullCage));

talk(NPC.thormac);
assert.equal(getQuestStage(player, scorpionCatcherQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 1);
assert.equal(strengthXp, 6625);
assert.ok(!slots.some((entry) => entry.itemId === ITEM.fullCage && entry.quantity > 0));

const wall = registry.findLocInteraction(LOC.secretWall, "search") ?? registry.findLocInteraction(LOC.secretWall, undefined);
assert.ok(wall);

console.log("Scorpion Catcher quest tests passed");
