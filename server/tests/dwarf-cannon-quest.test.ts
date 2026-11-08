import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { dwarfCannonQuest } from "../gamemodes/dev/quests/definitions/dwarfCannon";
import {
    CANNON_REPAIR_MASK,
    ITEM,
    LOC,
    NPC,
    RAIL_MASK,
    STAGE_CANNON_REPAIRED,
    STAGE_CHECK_WATCHTOWER,
    STAGE_COMPLETE,
    STAGE_FIND_CAVE,
    STAGE_FIND_LOLLK,
    STAGE_INSPECTED_CANNON,
    STAGE_REPAIR_CANNON,
    STAGE_REPAIR_RAILINGS,
    STAGE_RETURN_NOTES,
    STAGE_RETURN_TO_LAWGOF,
    STAGE_SPEAK_TO_NULODION,
    VARP_DWARF_CANNON,
    VARP_DWARF_CANNON_MULTI,
} from "../gamemodes/dev/quests/definitions/dwarfCannon/constants";
import { VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

assert.equal(dwarfCannonQuest.varpId, VARP_DWARF_CANNON);
assert.equal(dwarfCannonQuest.completionValue, STAGE_COMPLETE);
assert.equal(dwarfCannonQuest.rewards.questPoints, 1);
assert.deepEqual(dwarfCannonQuest.rewards.xp, [
    { skillId: SkillId.Crafting, amount: 750, label: "Crafting" },
]);

type Slot = { slot: number; itemId: number; quantity: number };

function createHarness() {
    const registry = new ScriptRegistry();
    const varps = new Map<number, number>([
        [VARP_DWARF_CANNON, 0],
        [VARP_DWARF_CANNON_MULTI, 0],
        [VARP_QUEST_POINTS, 0],
    ]);
    const slots: Slot[] = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
    const xp = new Map<number, number>();
    const teleports: Array<{ x: number; y: number; level: number }> = [];
    const temporaryLocs: Array<{ oldId: number; newId: number }> = [];
    const spawnedNpcs: number[] = [];
    let tick = 100;
    const player = {
        id: 7,
        name: "Cannon tester",
        tileX: 2567,
        tileY: 3460,
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
        if (itemId === ITEM.coins) {
            const stack = slots.find((entry) => entry.itemId === itemId && entry.quantity > 0);
            if (stack) {
                stack.quantity += quantity;
                return stack.slot;
            }
            const free = slots.find((entry) => entry.itemId < 0 || entry.quantity <= 0);
            assert.ok(free, `no free slot for ${itemId}`);
            Object.assign(free, { itemId, quantity });
            return free.slot;
        }
        let firstSlot = -1;
        for (let index = 0; index < quantity; index++) {
            const free = slots.find((entry) => entry.itemId < 0 || entry.quantity <= 0);
            assert.ok(free, `no free slot for ${itemId}`);
            Object.assign(free, { itemId, quantity: 1 });
            if (firstSlot < 0) firstSlot = free.slot;
        }
        return firstSlot;
    }

    const services = {
        variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
        messaging: { sendGameMessage: () => undefined },
        inventory: {
            getInventoryItems: () => slots,
            findOwnedItemLocation: (_player: unknown, itemId: number) => count(itemId) > 0 ? { container: "inventory" } : undefined,
            addItemToInventory: (_player: unknown, itemId: number, quantity: number) => ({ slot: add(itemId, quantity), added: quantity }),
            setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => Object.assign(slots[slot], { itemId, quantity }),
            snapshotInventory: () => undefined,
        },
        skills: {
            getSkill: () => ({ baseLevel: 99, boost: 0 }),
            addSkillXp: (_player: unknown, skillId: number, amount: number) => xp.set(skillId, (xp.get(skillId) ?? 0) + amount),
        },
        data: { getObjType: (itemId: number) => ({ stackable: itemId === ITEM.coins ? 1 : 0 }) },
        movement: {
            teleportPlayer: (_player: unknown, x: number, y: number, level: number) => {
                teleports.push({ x, y, level });
                Object.assign(player, { tileX: x, tileY: y, level });
            },
        },
        location: {
            replaceTemporaryLoc: (_scope: unknown, oldId: number, newId: number) => {
                temporaryLocs.push({ oldId, newId });
                return {};
            },
            clearTemporaryLoc: () => true,
        },
        npc: {
            spawnNpc: (config: { id: number }) => {
                spawnedNpcs.push(config.id);
                return { id: 10_000 + spawnedNpcs.length, typeId: config.id };
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
        viewport: { getMainmodalUid: () => 0 },
        sound: { sendJingle: () => undefined },
        system: { getCurrentTick: () => tick, logger: { info: () => undefined, error: () => undefined }, eventBus: { on: () => undefined } },
    } as unknown as ScriptServices;

    dwarfCannonQuest.register(registry, services);

    function npc(npcId: number): void {
        const handler = registry.findNpcInteractionDirect(npcId, "talk-to");
        assert.ok(handler, `missing NPC ${npcId}`);
        handler({
            player,
            services,
            npc: { id: npcId, typeId: npcId, name: npcId === NPC.lawgof ? "Captain Lawgof" : "Nulodion" },
            option: "talk-to",
            tick: tick++,
        } as never);
    }
    function loc(locId: number, action = "repair"): void {
        const handler = registry.findLocInteraction(locId, action);
        assert.ok(handler, `missing loc ${locId}`);
        handler({ player, services, locId, tile: { x: 0, y: 0 }, level: 0, action, tick: tick++ } as never);
    }
    function itemOnLoc(itemId: number, locId: number): void {
        const handler = registry.findItemOnLoc(itemId, locId);
        assert.ok(handler, `missing item ${itemId} on loc ${locId}`);
        handler({ player, services, source: { slot: 0, itemId }, target: { locId, tile: { x: 0, y: 0 }, level: 0 } } as never);
    }

    return { add, count, itemOnLoc, loc, npc, player, registry, services, spawnedNpcs, temporaryLocs, teleports, varps, xp };
}

const harness = createHarness();
harness.npc(NPC.lawgof);
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_REPAIR_RAILINGS);
assert.equal(harness.count(ITEM.railing), 6);
assert.equal(harness.count(ITEM.hammer), 1);
for (const locId of LOC.legacyRailings) harness.loc(locId);
assert.equal((harness.varps.get(VARP_DWARF_CANNON_MULTI) ?? 0) & RAIL_MASK, RAIL_MASK);
assert.equal(harness.count(ITEM.railing), 0);

harness.npc(NPC.lawgof);
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_CHECK_WATCHTOWER);
assert.ok(harness.temporaryLocs.some((entry) => entry.newId === LOC.dwarfRemains[1]));
harness.loc(LOC.dwarfRemains[1], "take");
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_FIND_CAVE);
assert.equal(harness.count(ITEM.dwarfRemains), 1);
harness.loc(LOC.caveEntrance, "enter");
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_FIND_LOLLK);
harness.loc(LOC.lollkCrate, "search");
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_RETURN_TO_LAWGOF);
assert.deepEqual(harness.spawnedNpcs, [NPC.lollk]);

harness.npc(NPC.lawgof);
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_REPAIR_CANNON);
assert.equal(harness.count(ITEM.toolkit), 1);
harness.loc(LOC.brokenCannon, "inspect");
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_INSPECTED_CANNON);
for (let index = 0; index < 3; index++) harness.itemOnLoc(ITEM.toolkit, LOC.brokenCannon);
assert.equal((harness.varps.get(VARP_DWARF_CANNON_MULTI) ?? 0) & CANNON_REPAIR_MASK, CANNON_REPAIR_MASK);
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_CANNON_REPAIRED);

harness.npc(NPC.lawgof);
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_SPEAK_TO_NULODION);
harness.npc(NPC.nulodion);
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_RETURN_NOTES);
assert.equal(harness.count(ITEM.nulodionsNotes), 1);
assert.equal(harness.count(ITEM.ammoMould), 1);
harness.npc(NPC.lawgof);
assert.equal(harness.varps.get(VARP_DWARF_CANNON), STAGE_COMPLETE);
assert.equal(harness.count(ITEM.nulodionsNotes), 0);
assert.equal(harness.count(ITEM.ammoMould), 1);
assert.equal(harness.varps.get(VARP_QUEST_POINTS), 1);
assert.equal(harness.xp.get(SkillId.Crafting), 750);

harness.add(ITEM.coins, 750_000);
harness.npc(NPC.nulodion);
for (const itemId of [ITEM.cannonBase, ITEM.cannonStand, ITEM.cannonBarrels, ITEM.cannonFurnace, ITEM.instructionManual]) {
    assert.equal(harness.count(itemId), 1, `missing purchased item ${itemId}`);
}
assert.equal(harness.count(ITEM.ammoMould), 2);
assert.equal(harness.count(ITEM.coins), 0);

console.log("Dwarf Cannon quest tests passed");
