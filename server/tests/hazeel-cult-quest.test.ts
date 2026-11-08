import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { hazeelCultQuest } from "../gamemodes/dev/quests/definitions/hazeelCult";
import {
    ITEM,
    LOC,
    NPC,
    SIDE_CARNILLEAN,
    SIDE_HAZEEL,
    STAGE_CHOSEN_SIDE,
    STAGE_COMPLETE,
    STAGE_FINISHED_SIDE_TASK,
    STAGE_POISONED_FOOD,
    STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL,
    STAGE_SPOKEN_TO_CLIVET,
    STAGE_STARTED,
    TILE,
    VARP_HAZEEL_CULT,
    VARP_HAZEEL_SIDE,
    VARP_HAZEEL_VALVES,
} from "../gamemodes/dev/quests/definitions/hazeelCult/constants";
import { VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { NpcPreDeathDecision, type ScriptServices } from "../src/game/scripts/types";

assert.equal(hazeelCultQuest.varpId, VARP_HAZEEL_CULT);
assert.equal(hazeelCultQuest.completionValue, STAGE_COMPLETE);
assert.equal(hazeelCultQuest.rewards.questPoints, 1);
assert.deepEqual(hazeelCultQuest.rewards.xp, [
    { skillId: SkillId.Thieving, amount: 1_500, label: "Thieving" },
]);
assert.deepEqual(hazeelCultQuest.rewards.items, [
    { itemId: ITEM.coins, quantity: 2_000, label: "Coins" },
]);

type Slot = { slot: number; itemId: number; quantity: number };

function createHarness(choice: number) {
    const registry = new ScriptRegistry();
    const varps = new Map<number, number>([
        [VARP_HAZEEL_CULT, 0],
        [VARP_HAZEEL_VALVES, 0],
        [VARP_HAZEEL_SIDE, 0],
        [VARP_QUEST_POINTS, 0],
    ]);
    const slots: Slot[] = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
    const xp = new Map<number, number>();
    const drops: number[] = [];
    const teleports: Array<{ x: number; y: number; level: number }> = [];
    const activeNpcs: Array<{ id: number; typeId: number; tileX: number; tileY: number; level: number }> = [];
    const choices = [0, 0, choice];
    const player = {
        id: choice + 50,
        name: choice === 0 ? "Cult tester" : "Carnillean tester",
        tileX: 2570,
        tileY: 9682,
        level: 0,
        worldViewId: -1,
        varps: {
            getVarpValue: (id: number) => varps.get(id) ?? 0,
            setVarpValue: (id: number, value: number) => varps.set(id, value),
        },
        gamemode: { getQuestListGroups: () => [] },
    } as never;

    function count(itemId: number): number {
        return slots.filter((slot) => slot.itemId === itemId).reduce((sum, slot) => sum + slot.quantity, 0);
    }
    function add(itemId: number, quantity = 1): number {
        const existing = slots.find((slot) => slot.itemId === itemId && slot.quantity > 0);
        if (existing) {
            existing.quantity += quantity;
            return existing.slot;
        }
        const free = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
        assert.ok(free, `no free slot for ${itemId}`);
        Object.assign(free, { itemId, quantity });
        return free.slot;
    }

    const services = {
        variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
        messaging: { sendGameMessage: () => undefined },
        inventory: {
            getInventoryItems: () => slots,
            findOwnedItemLocation: (_player: unknown, itemId: number) => count(itemId) > 0 ? { container: "inventory" } : undefined,
            hasInventorySlot: () => slots.some((slot) => slot.itemId <= 0 || slot.quantity <= 0),
            collectCarriedItemIds: () => slots.filter((slot) => slot.itemId > 0).map((slot) => slot.itemId),
            addItemToInventory: (_player: unknown, itemId: number, quantity: number) => ({ slot: add(itemId, quantity), added: quantity }),
            setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => Object.assign(slots[slot], { itemId, quantity }),
            snapshotInventory: () => undefined,
        },
        skills: {
            addSkillXp: (_player: unknown, skillId: number, amount: number) => xp.set(skillId, (xp.get(skillId) ?? 0) + amount),
        },
        data: { getObjType: (itemId: number) => ({ stackable: itemId === ITEM.coins ? 1 : 0 }) },
        movement: {
            teleportPlayer: (_player: unknown, x: number, y: number, level: number) => {
                teleports.push({ x, y, level });
                Object.assign(player, { tileX: x, tileY: y, level });
            },
        },
        groundItems: {
            spawn: (itemId: number) => {
                drops.push(itemId);
                return { stackId: drops.length, itemId };
            },
        },
        npc: {
            findNearbyNpc: (_player: unknown, typeId: number) => activeNpcs.find((npc) => npc.typeId === typeId),
            spawnNpc: (config: { id: number; x: number; y: number; level: number }) => {
                const npc = { id: 10_000 + activeNpcs.length, typeId: config.id, tileX: config.x, tileY: config.y, level: config.level };
                activeNpcs.push(npc);
                return npc;
            },
            removeNpc: () => true,
        },
        dialog: {
            getInterfaceService: () => ({ getCurrentChatboxModal: () => undefined }),
            openDialog: (_player: unknown, spec: { onContinue?: () => void }) => spec.onContinue?.(),
            openDialogOptions: (_player: unknown, spec: { onSelect?: (value: number) => void }) => spec.onSelect?.(choices.shift() ?? 0),
            closeDialog: () => undefined,
            openSubInterface: () => undefined,
            queueWidgetEvent: () => undefined,
        },
        viewport: { getMainmodalUid: () => 0 },
        sound: { sendJingle: () => undefined },
        system: { getCurrentTick: () => 100, logger: { info: () => undefined, error: () => undefined }, eventBus: { on: () => undefined } },
    } as unknown as ScriptServices;

    hazeelCultQuest.register(registry, services);

    function npc(npcId: number): void {
        const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
        assert.ok(handler, `missing NPC ${npcId}`);
        handler({
            player,
            services,
            npc: { id: npcId, typeId: npcId, tileX: 0, tileY: 0, level: 0, engageCombat: () => undefined },
            option: "talk-to",
            tick: 100,
        } as never);
    }
    function loc(locId: number, action: string, x = 0): void {
        const handler = registry.findLocInteraction(locId, action);
        assert.ok(handler, `missing ${action} for loc ${locId}`);
        handler({ player, services, locId, tile: { x, y: 0 }, level: 0, action } as never);
    }
    function itemOnLoc(itemId: number, locId: number): void {
        const handler = registry.findItemOnLoc(itemId, locId);
        assert.ok(handler, `missing item ${itemId} on loc ${locId}`);
        handler({ player, services, source: { slot: 0, itemId }, target: { locId, tile: { x: 0, y: 0 }, level: 0 } } as never);
    }

    return { add, count, drops, loc, itemOnLoc, npc, player, registry, services, teleports, varps, xp };
}

const evil = createHarness(0);
evil.npc(NPC.ceril);
assert.equal(evil.varps.get(VARP_HAZEEL_CULT), STAGE_STARTED);
evil.npc(NPC.clivet);
assert.equal(evil.varps.get(VARP_HAZEEL_CULT), STAGE_SPOKEN_TO_CLIVET);
evil.npc(NPC.clivet);
assert.equal(evil.varps.get(VARP_HAZEEL_CULT), STAGE_CHOSEN_SIDE);
assert.equal(evil.varps.get(VARP_HAZEEL_SIDE), SIDE_HAZEEL);
assert.equal(evil.count(ITEM.poison), 1);
evil.itemOnLoc(ITEM.poison, LOC.poisonRange);
assert.equal(evil.varps.get(VARP_HAZEEL_CULT), STAGE_POISONED_FOOD);
evil.npc(NPC.clivet);
assert.equal(evil.count(ITEM.hazeelsMark), 1);
LOC.valves.forEach((locId) => evil.loc(locId, "turn"));
assert.equal(evil.varps.get(VARP_HAZEEL_VALVES), 31);
evil.loc(LOC.raft, "board", 2567);
assert.deepEqual(evil.teleports.at(-1), TILE.hideout);
evil.npc(NPC.alomone);
assert.equal(evil.varps.get(VARP_HAZEEL_CULT), STAGE_FINISHED_SIDE_TASK);
evil.loc(LOC.keyCrate, "search");
assert.equal(evil.count(ITEM.chestKey), 1);
evil.loc(LOC.scrollChest[0], "search");
assert.equal(evil.count(ITEM.hazeelScroll), 1);
assert.equal(evil.varps.get(VARP_HAZEEL_CULT), STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL);
evil.npc(NPC.alomone);
assert.equal(evil.varps.get(VARP_HAZEEL_CULT), STAGE_COMPLETE);
assert.equal(evil.count(ITEM.hazeelScroll), 0);
assert.equal(evil.count(ITEM.coins), 2_000);
assert.equal(evil.varps.get(VARP_QUEST_POINTS), 1);
assert.equal(evil.xp.get(SkillId.Thieving), 1_500);

const good = createHarness(1);
good.npc(NPC.ceril);
good.npc(NPC.clivet);
good.npc(NPC.clivet);
assert.equal(good.varps.get(VARP_HAZEEL_SIDE), SIDE_CARNILLEAN);
const death = good.registry.findNpcPreDeath(NPC.alomone);
assert.ok(death);
assert.equal(death({
    player: good.player,
    services: good.services,
    npc: { id: 99, typeId: NPC.alomone, tileX: 2609, tileY: 9670, level: 0 },
    killer: good.player,
    killerPlayerId: 51,
    hit: { proposedDamage: 3, style: 0, hitpointsBefore: 3, hitpointsAfter: 0, cause: "combat" },
} as never), NpcPreDeathDecision.Allow);
assert.equal(good.varps.get(VARP_HAZEEL_CULT), STAGE_FINISHED_SIDE_TASK);
assert.deepEqual(good.drops, [ITEM.carnilleanArmour]);
good.loc(LOC.armourChest, "search");
assert.equal(good.count(ITEM.carnilleanArmour), 1);
good.npc(NPC.ceril);
assert.equal(good.varps.get(VARP_HAZEEL_CULT), STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL);
assert.equal(good.count(ITEM.carnilleanArmour), 0);
assert.equal(good.count(ITEM.coins), 5);
good.loc(LOC.evidenceCupboard[1], "search");
assert.equal(good.varps.get(VARP_HAZEEL_CULT), STAGE_COMPLETE);
assert.equal(good.count(ITEM.coins), 2_005);
assert.equal(good.varps.get(VARP_QUEST_POINTS), 1);
assert.equal(good.xp.get(SkillId.Thieving), 1_500);

console.log("Hazeel Cult quest tests passed");
