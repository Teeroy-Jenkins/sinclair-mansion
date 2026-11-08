import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { familyCrestQuest } from "../gamemodes/dev/quests/definitions/familyCrest";
import {
    AUX_BIT,
    ITEM,
    LOC,
    NPC,
    SPELL,
    STAGE_AVAN_PIECE,
    STAGE_CALEB_PIECE,
    STAGE_COMPLETE,
    STAGE_CURED_JOHNATHON,
    STAGE_SEEKING_AVAN,
    STAGE_SPOKEN_AVAN,
    STAGE_SPOKEN_BOOT,
    STAGE_SPOKEN_CALEB,
    STAGE_SPOKEN_DIMINTHEIS,
    STAGE_SPOKEN_GEM_TRADER,
    STAGE_SPOKEN_JOHNATHON,
    VARP_FAMILY_CREST,
    VARP_FAMILY_CREST_AUX,
} from "../gamemodes/dev/quests/definitions/familyCrest/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(familyCrestQuest.varpId, VARP_FAMILY_CREST);
assert.equal(familyCrestQuest.completionValue, STAGE_COMPLETE);
assert.equal(familyCrestQuest.rewards.questPoints, 1);
assert.deepEqual(familyCrestQuest.requirements?.skills, [
    { skillId: SkillId.Mining, level: 40, label: "Mining" },
    { skillId: SkillId.Smithing, level: 40, label: "Smithing" },
    { skillId: SkillId.Magic, level: 59, label: "Magic" },
    { skillId: SkillId.Crafting, level: 40, label: "Crafting" },
]);
for (const npcId of Object.values(NPC)) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing Family Crest NPC ${npcId}`);
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_FAMILY_CREST, 0],
    [VARP_FAMILY_CREST_AUX, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const xp = new Map<number, number>();
const drops: Array<{ itemId: number; ownerId?: number }> = [];
const player = {
    id: 148,
    name: "Family Crest tester",
    tileX: 2732,
    tileY: 9681,
    level: 0,
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
        consumeItem: (_player: unknown, slot: number) => {
            if (!slots[slot] || slots[slot].quantity <= 0) return false;
            slots[slot] = { slot, itemId: -1, quantity: 0 };
            return true;
        },
        snapshotInventory: () => undefined,
    },
    skills: {
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) =>
            xp.set(skillId, (xp.get(skillId) ?? 0) + amount),
    },
    data: {
        getObjType: (itemId: number) => ({
            stackable: 0,
            name: itemId === 175 ? "Antipoison(3)" : `Item ${itemId}`,
        }),
        getLocDefinition: () => ({ name: "Furnace" }),
    },
    groundItems: {
        spawn: (itemId: number, _quantity: number, _tile: unknown, options: { ownerId?: number }) => {
            drops.push({ itemId, ownerId: options.ownerId });
            return { stackId: drops.length, itemId };
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
    movement: { teleportPlayer: () => undefined },
    viewport: { getMainmodalUid: () => 0 },
    sound: { sendJingle: () => undefined },
    system: {
        getCurrentTick: () => 100,
        logger: { info: () => undefined, error: () => undefined },
        eventBus: { on: () => undefined },
    },
} as unknown as ScriptServices;

familyCrestQuest.register(registry, services);

function talk(npcId: number): void {
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing talk handler ${npcId}`);
    handler({ player, services, npc: { typeId: npcId }, option: "talk-to" } as never);
}

talk(NPC.dimintheis);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_SPOKEN_DIMINTHEIS);
talk(NPC.caleb);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_SPOKEN_CALEB);
for (const itemId of [ITEM.shrimps, ITEM.salmon, ITEM.tuna, ITEM.bass, ITEM.swordfish]) addItem(itemId);
talk(NPC.caleb);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_CALEB_PIECE);
assert.equal(count(ITEM.calebCrest), 1);
talk(NPC.caleb);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_SEEKING_AVAN);
talk(NPC.gemTrader);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_SPOKEN_GEM_TRADER);
talk(NPC.avan);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_SPOKEN_AVAN);
talk(NPC.boot);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_SPOKEN_BOOT);

addItem(1275);
const mine = registry.findLocInteraction(LOC.perfectGoldRock, "mine");
assert.ok(mine);
for (let i = 0; i < 2; i++) {
    mine({
        player,
        services,
        locId: LOC.perfectGoldRock,
        tile: { x: 2732, y: 9680 },
        level: 0,
        action: "mine",
    } as never);
}
assert.equal(count(ITEM.perfectGoldOre), 2);
const smeltOre = registry.findItemOnLoc(ITEM.perfectGoldOre, 1000);
assert.ok(smeltOre);
for (let i = 0; i < 2; i++) {
    smeltOre({ player, services, source: { slot: 0, itemId: ITEM.perfectGoldOre }, target: { locId: 1000 } } as never);
}
assert.equal(count(ITEM.perfectGoldBar), 2);
addItem(ITEM.ruby, 2);
addItem(ITEM.ringMould);
addItem(ITEM.necklaceMould);
const craft = registry.findItemOnLoc(ITEM.perfectGoldBar, 1000);
assert.ok(craft);
for (let i = 0; i < 2; i++) {
    craft({ player, services, source: { slot: 0, itemId: ITEM.perfectGoldBar }, target: { locId: 1000 } } as never);
}
assert.equal(count(ITEM.perfectRing), 1);
assert.equal(count(ITEM.perfectNecklace), 1);
assert.equal(xp.get(SkillId.Mining), 130);
assert.equal(xp.get(SkillId.Smithing), 45);
assert.equal(xp.get(SkillId.Crafting), 145);

talk(NPC.avan);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_AVAN_PIECE);
assert.equal(count(ITEM.avanCrest), 1);
talk(NPC.johnathon);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_SPOKEN_JOHNATHON);
const antipoisonSlot = addItem(175);
registry.findItemOnNpc(175, NPC.johnathon)!({
    player,
    services,
    source: { slot: antipoisonSlot, itemId: 175 },
    target: { typeId: NPC.johnathon },
} as never);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_CURED_JOHNATHON);

const chronozon = {
    id: 9001,
    typeId: NPC.chronozon,
    tileX: 3087,
    tileY: 9937,
    level: 0,
    heal: () => ({ current: 60, max: 60 }),
};
const magicHit = registry.findNpcMagicHit(NPC.chronozon);
assert.ok(magicHit);
for (const spellId of [SPELL.windBlast[0], SPELL.waterBlast[0], SPELL.earthBlast[0], SPELL.fireBlast[0]]) {
    magicHit({ player, services, npc: chronozon, spellId, damage: 1, tick: 100 } as never);
}
assert.equal(varps.get(VARP_FAMILY_CREST_AUX)! & 0xf, 0xf);
const decision = registry.findNpcPreDeath(NPC.chronozon)!({
    player,
    services,
    npc: chronozon,
    killer: player,
    killerPlayerId: player.id,
    hit: { proposedDamage: 10, style: 0, hitpointsBefore: 5, hitpointsAfter: 0, cause: "combat" },
} as never);
assert.equal(decision, NpcPreDeathDecision.Allow);
assert.deepEqual(drops, [{ itemId: ITEM.johnathonCrest, ownerId: player.id }]);
addItem(ITEM.johnathonCrest);

registry.findItemOnItem(ITEM.calebCrest, ITEM.avanCrest)!({ player, services } as never);
assert.equal(count(ITEM.familyCrest), 1);
assert.equal(count(ITEM.calebCrest), 0);
assert.equal(count(ITEM.avanCrest), 0);
assert.equal(count(ITEM.johnathonCrest), 0);
talk(NPC.dimintheis);
assert.equal(getQuestStage(player, familyCrestQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 1);
assert.equal(count(ITEM.steelGauntlets), 1);

talk(NPC.caleb);
assert.equal(count(ITEM.steelGauntlets), 0);
assert.equal(count(ITEM.cookingGauntlets), 1);
assert.notEqual(varps.get(VARP_FAMILY_CREST_AUX)! & (1 << AUX_BIT.cookingGauntlets), 0);

console.log("Family Crest quest tests passed");
