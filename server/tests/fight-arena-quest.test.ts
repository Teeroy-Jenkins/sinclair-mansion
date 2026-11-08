import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
import { SkillId } from "../../client/rs/skill/skills";
import { fightArenaQuest } from "../gamemodes/dev/quests/definitions/fightArena";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_DEFEATED_BOUNCER,
    STAGE_DEFEATED_SCORPION,
    STAGE_FREED_SERVILS,
    STAGE_GUARD_DRUNK,
    STAGE_OBTAINED_ARMOUR,
    STAGE_OGRE_FIGHT,
    STAGE_SCORPION_FIGHT,
    STAGE_SPOKEN_GUARD,
    STAGE_STARTED,
    VARP_FIGHT_ARENA,
} from "../gamemodes/dev/quests/definitions/fightArena/constants";
import { getQuestStage, VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import npcSpawns from "../data/npc-spawns.json";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(fightArenaQuest.varpId, VARP_FIGHT_ARENA);
assert.equal(fightArenaQuest.completionValue, STAGE_COMPLETE);
assert.equal(fightArenaQuest.rewards.questPoints, 2);
assert.deepEqual(fightArenaQuest.rewards.xp, [
    { skillId: SkillId.Attack, amount: 12_175, label: "Attack" },
    { skillId: SkillId.Thieving, amount: 2_175, label: "Thieving" },
]);
for (const npcId of [NPC.ladyServil, NPC.barman, NPC.drunkGuard, NPC.khazardOgre, NPC.khazardScorpion, NPC.bouncer]) {
    assert.ok(npcSpawns.some((spawn) => spawn.id === npcId), `missing Fight Arena NPC ${npcId}`);
}

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_FIGHT_ARENA, 0],
    [VARP_QUEST_POINTS, 0],
]);
let slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const equipped = new Map<number, number>();
const awardedXp = new Map<number, number>();
const player = {
    id: 17,
    name: "Fight Arena tester",
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;

function addItem(itemId: number, quantity = 1): number {
    const existing = itemId === ITEM.coins ? slots.find((entry) => entry.itemId === itemId) : undefined;
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

function itemQuantity(itemId: number): number {
    return slots.filter((entry) => entry.itemId === itemId).reduce((sum, entry) => sum + entry.quantity, 0);
}

const services = {
    variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
    messaging: { sendGameMessage: () => undefined },
    inventory: {
        getInventoryItems: () => slots,
        findOwnedItemLocation: (_player: unknown, itemId: number) =>
            slots.some((entry) => entry.itemId === itemId && entry.quantity > 0) ||
            [...equipped.values()].includes(itemId)
                ? { container: "inventory" }
                : undefined,
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
    equipment: { getEquippedItem: (_player: unknown, slot: number) => equipped.get(slot) ?? -1 },
    skills: {
        getSkill: () => ({ baseLevel: 99, boost: 0 }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) =>
            awardedXp.set(skillId, (awardedXp.get(skillId) ?? 0) + amount),
    },
    data: { getObjType: (itemId: number) => ({ stackable: itemId === ITEM.coins ? 1 : 0 }) },
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

fightArenaQuest.register(registry, services);

function talk(npcId: number): void {
    const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
    assert.ok(handler, `missing talk handler ${npcId}`);
    handler({ player, services, npc: { typeId: npcId }, option: "talk-to" } as never);
}

function useKeyOnLoc(locId: number): void {
    const handler = registry.findItemOnLoc(ITEM.cellKeys, locId);
    assert.ok(handler, `missing key handler for loc ${locId}`);
    handler({ player, services, source: { slot: 0, itemId: ITEM.cellKeys }, locId } as never);
}

function defeat(npcId: number): NpcPreDeathDecision {
    const handler = registry.findNpcPreDeath(npcId);
    assert.ok(handler, `missing pre-death handler ${npcId}`);
    return handler({
        npc: { typeId: npcId },
        killer: player,
        killerPlayerId: player.id,
        services,
        hit: { proposedDamage: 10, style: 0, hitpointsBefore: 5, hitpointsAfter: 0, cause: "combat" },
    } as never);
}

talk(NPC.ladyServil);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_STARTED);
registry.findLocInteraction(LOC.armourChest, "search")!({
    player,
    services,
    locId: LOC.armourChest,
    tile: { x: 0, y: 0 },
    level: 0,
    action: "search",
} as never);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_OBTAINED_ARMOUR);
assert.equal(itemQuantity(ITEM.khazardHelmet), 1);
assert.equal(itemQuantity(ITEM.khazardArmour), 1);

equipped.set(EquipmentSlot.HEAD, ITEM.khazardHelmet);
equipped.set(EquipmentSlot.BODY, ITEM.khazardArmour);
talk(NPC.drunkGuard);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_SPOKEN_GUARD);
addItem(ITEM.coins, 5);
talk(NPC.barman);
assert.equal(itemQuantity(ITEM.coins), 0);
assert.equal(itemQuantity(ITEM.khaliBrew), 1);
talk(NPC.drunkGuard);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_GUARD_DRUNK);
assert.equal(itemQuantity(ITEM.cellKeys), 1);

useKeyOnLoc(LOC.jeremyGate[0]);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_OGRE_FIGHT);
assert.equal(defeat(NPC.khazardOgre), NpcPreDeathDecision.Allow);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_SCORPION_FIGHT);
assert.equal(defeat(NPC.khazardScorpion), NpcPreDeathDecision.Allow);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_DEFEATED_SCORPION);
assert.equal(defeat(NPC.bouncer), NpcPreDeathDecision.Allow);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_DEFEATED_BOUNCER);
useKeyOnLoc(LOC.prisonGate[0]);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_FREED_SERVILS);

talk(NPC.ladyServil);
assert.equal(getQuestStage(player, fightArenaQuest), STAGE_COMPLETE);
assert.equal(varps.get(VARP_QUEST_POINTS), 2);
assert.equal(awardedXp.get(SkillId.Attack), 12_175);
assert.equal(awardedXp.get(SkillId.Thieving), 2_175);
assert.equal(itemQuantity(ITEM.coins), 1_000);

console.log("Fight Arena quest tests passed");
