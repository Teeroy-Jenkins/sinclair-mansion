import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { knightsSwordQuest } from "../gamemodes/dev/quests/definitions/knightsSword";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_FIND_IMCANDO_DWARF,
    STAGE_FIND_MATERIALS,
    STAGE_FIND_PORTRAIT,
    STAGE_FIND_RELDO,
    STAGE_GAVE_THURGO_PIE,
    VARP_KNIGHTS_SWORD,
    VYVIN_CUPBOARD_TILE,
} from "../gamemodes/dev/quests/definitions/knightsSword/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import { resolveMiningRockByName } from "../gamemodes/dev/skills/mining/miningData";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(knightsSwordQuest.name, "The Knight's Sword");
assert.equal(knightsSwordQuest.varpId, VARP_KNIGHTS_SWORD);
assert.equal(knightsSwordQuest.completionValue, STAGE_COMPLETE);
assert.equal(knightsSwordQuest.requirements?.skills?.[0]?.level, 10);
assert.equal(knightsSwordQuest.rewards.xp?.[0]?.amount, 12725);

const bluriteRock = resolveMiningRockByName("Blurite rocks");
assert.equal(bluriteRock?.level, 10);
assert.equal(bluriteRock?.xp, 17.5);
assert.equal(bluriteRock?.oreItemId, ITEM.bluriteOre);
assert.deepEqual(bluriteRock?.respawnTicks, { min: 80, max: 80 });

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_KNIGHTS_SWORD, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
let temporaryLocReplacements = 0;
let smithingXp = 0;
const messages: string[] = [];
const player = {
    id: 81,
    name: "Knight tester",
    tileX: 2984,
    tileY: 3336,
    level: 2,
    worldViewId: -1,
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;

function addItem(itemId: number, quantity = 1): number {
    const entry = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
    assert.ok(entry);
    entry.itemId = itemId;
    entry.quantity = quantity;
    return entry.slot;
}

const services = {
    variables: {
        sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value),
    },
    messaging: {
        sendGameMessage: (_player: unknown, message: string) => messages.push(message),
    },
    inventory: {
        getInventoryItems: () => slots,
        collectCarriedItemIds: () => slots.filter((slot) => slot.itemId > 0).map((slot) => slot.itemId),
        findOwnedItemLocation: (_player: unknown, itemId: number) => {
            const entry = slots.find((slot) => slot.itemId === itemId && slot.quantity > 0);
            return entry ? { type: "inventory", slot: entry.slot } : undefined;
        },
        findInventorySlotWithItem: (_player: unknown, itemId: number) =>
            slots.find((slot) => slot.itemId === itemId && slot.quantity > 0)?.slot,
        playerHasItem: (_player: unknown, itemId: number) =>
            slots.some((slot) => slot.itemId === itemId && slot.quantity > 0),
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const entry = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
            if (!entry) return { slot: -1, added: 0, remaining: quantity };
            entry.itemId = itemId;
            entry.quantity = quantity;
            return { slot: entry.slot, added: quantity, remaining: 0 };
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
    equipment: { getEquippedItem: () => -1 },
    location: {
        replaceTemporaryLoc: () => temporaryLocReplacements++,
    },
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
    data: { getObjType: () => ({ stackable: 0 }) },
    skills: {
        addSkillXp: (_player: unknown, skillId: number, amount: number) => {
            if (skillId === SkillId.Smithing) smithingXp += amount;
        },
    },
    sound: { sendJingle: () => undefined },
    system: { logger: { info: () => undefined, error: () => undefined } },
} as unknown as ScriptServices;

knightsSwordQuest.register(registry, services);
const squireTalk = registry.findNpcInteractionDirect(NPC.squire, "talk-to");
const reldoTalk = registry.findNpcInteractionDirect(NPC.reldo, "talk-to");
const thurgoTalk = registry.findNpcInteractionDirect(NPC.thurgo, "talk-to");
assert.ok(squireTalk);
assert.ok(reldoTalk);
assert.ok(thurgoTalk);
assert.ok(registry.findLocInteraction(LOC.vyvinCupboardClosed, "open"));
assert.ok(registry.findLocInteraction(LOC.vyvinCupboardOpen, "search"));

squireTalk!({ player, services, npc: { typeId: NPC.squire } } as never);
assert.equal(getQuestStage(player, knightsSwordQuest), STAGE_FIND_RELDO);

reldoTalk!({ player, services, npc: { typeId: NPC.reldo } } as never);
assert.equal(getQuestStage(player, knightsSwordQuest), STAGE_FIND_IMCANDO_DWARF);

addItem(ITEM.redberryPie);
thurgoTalk!({ player, services, npc: { typeId: NPC.thurgo } } as never);
assert.equal(getQuestStage(player, knightsSwordQuest), STAGE_GAVE_THURGO_PIE);
assert.equal(slots.some((slot) => slot.itemId === ITEM.redberryPie), false);

thurgoTalk!({ player, services, npc: { typeId: NPC.thurgo } } as never);
squireTalk!({ player, services, npc: { typeId: NPC.squire } } as never);
assert.equal(getQuestStage(player, knightsSwordQuest), STAGE_FIND_PORTRAIT);

registry.findLocInteraction(LOC.vyvinCupboardClosed, "open")!({
    player,
    services,
    locId: LOC.vyvinCupboardClosed,
    tile: VYVIN_CUPBOARD_TILE,
    level: VYVIN_CUPBOARD_TILE.level,
} as never);
assert.equal(temporaryLocReplacements, 1);
registry.findLocInteraction(LOC.vyvinCupboardOpen, "search")!({
    player,
    services,
    locId: LOC.vyvinCupboardOpen,
    tile: VYVIN_CUPBOARD_TILE,
    level: VYVIN_CUPBOARD_TILE.level,
} as never);
assert.equal(slots.some((slot) => slot.itemId === ITEM.portrait), true);

thurgoTalk!({ player, services, npc: { typeId: NPC.thurgo } } as never);
assert.equal(getQuestStage(player, knightsSwordQuest), STAGE_FIND_MATERIALS);
assert.equal(slots.some((slot) => slot.itemId === ITEM.portrait), false);

addItem(ITEM.bluriteOre);
addItem(ITEM.ironBar, 2);
thurgoTalk!({ player, services, npc: { typeId: NPC.thurgo } } as never);
assert.equal(slots.some((slot) => slot.itemId === ITEM.bluriteOre), false);
assert.equal(slots.some((slot) => slot.itemId === ITEM.ironBar), false);
assert.equal(slots.some((slot) => slot.itemId === ITEM.bluriteSword), true);

squireTalk!({ player, services, npc: { typeId: NPC.squire } } as never);
assert.equal(getQuestStage(player, knightsSwordQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 1);
assert.equal(smithingXp, 12725);
assert.equal(slots.some((slot) => slot.itemId === ITEM.bluriteSword), false);
assert.match(knightsSwordQuest.buildJournal(player, services).join("\n"), /QUEST COMPLETE/);

squireTalk!({ player, services, npc: { typeId: NPC.squire } } as never);
assert.equal(varps.get(VARP_QUEST_POINTS), 1, "post-quest dialogue must not duplicate rewards");
assert.equal(smithingXp, 12725, "post-quest dialogue must not duplicate XP");
assert.ok(messages.some((message) => message.includes("open the cupboard")));

console.log("knights-sword-quest.test.ts: all assertions passed");
