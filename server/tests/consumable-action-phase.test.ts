/**
 * End-to-end regression coverage for scripted food crossing the action phase.
 *
 * Run with: npx tsx tests/consumable-action-phase.test.ts
 */
import assert from "node:assert/strict";

import type { ServerServices } from "../src/game/ServerServices";
import { ActionScheduler } from "../src/game/actions/ActionScheduler";
import type { InventoryConsumeScriptActionData } from "../src/game/actions/actionPayloads";
import { InventoryActionHandler } from "../src/game/actions/handlers/InventoryActionHandler";
import { CombatAttributeStore } from "../src/game/combat/state/CombatAttributeStore";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import type { PlayerState } from "../src/game/player";
import { TickPhaseService } from "../src/game/services/TickPhaseService";
import type { TickFrame } from "../src/game/tick/TickPhaseOrchestrator";

const inventory = Array.from({ length: 28 }, () => ({ itemId: -1, quantity: 0 }));
inventory[4] = { itemId: 385, quantity: 1 };

const player = {
    id: 42,
    combatAttributes: new CombatAttributeStore(),
    skillSystem: {
        getHitpointsCurrent: () => 50,
    },
} as PlayerState;

const inventoryActionServices = {
    inventoryService: {
        getInventory: () => inventory,
        consumeItem: (_player: PlayerState, slot: number): boolean => {
            const entry = inventory[slot];
            if (!entry || entry.itemId <= 0 || entry.quantity <= 0) return false;
            inventory[slot] = { itemId: -1, quantity: 0 };
            return true;
        },
    },
} as unknown as ServerServices;
const inventoryActionHandler = new InventoryActionHandler(inventoryActionServices);

let foodEffectApplied = false;
const actionScheduler = new ActionScheduler((scheduledPlayer, action, tick) => {
    assert.equal(action.kind, "inventory.consume_script");
    return inventoryActionHandler.executeScriptedConsumeAction(
        scheduledPlayer,
        action.data as InventoryConsumeScriptActionData,
        tick,
    );
});
actionScheduler.registerPlayer(player);

const enqueueResult = actionScheduler.requestAction(
    player.id,
    {
        kind: "inventory.consume_script",
        data: {
            slotIndex: 4,
            itemId: 385,
            option: "eat",
            consumableType: "food",
            apply: () => {
                foodEffectApplied = true;
            },
        },
        delayTicks: 0,
        cooldownTicks: 0,
        groups: ["inventory.food"],
    },
    100,
);
assert.equal(enqueueResult.ok, true);

const phaseServices = { actionScheduler } as unknown as ServerServices;
const frame = {
    tick: 100,
    actionEffects: [],
} as unknown as TickFrame;

new TickPhaseService(phaseServices).runActionPhase(frame);

assert.deepEqual(inventory[4], { itemId: -1, quantity: 0 });
assert.equal(foodEffectApplied, true);
assert.equal(player.combatAttributes.get(CombatAttributes.FOOD_DELAY), 103);
assert.equal(player.combatAttributes.get(CombatAttributes.ATTACK_DELAY), 103);
assert.deepEqual(frame.actionEffects, [{ type: "inventorySnapshot", playerId: player.id }]);

console.log("consumable action phase tests passed");
