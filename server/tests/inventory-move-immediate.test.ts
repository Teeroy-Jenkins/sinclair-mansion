/**
 * Regression coverage for immediate authoritative inventory slot swaps.
 *
 * Run with: npx tsx tests/inventory-move-immediate.test.ts
 */
import assert from "node:assert/strict";
import type { WebSocket } from "ws";

import type { PlayerState } from "../src/game/player";
import {
    InventoryMessageService,
    type InventoryMessageServiceDeps,
} from "../src/game/services/InventoryMessageService";

const player = { id: 42 } as PlayerState;
const socket = {} as WebSocket;
const inventory = Array.from({ length: 28 }, () => ({ itemId: -1, quantity: 0 }));
inventory[2] = { itemId: 385, quantity: 1 };
inventory[7] = { itemId: 995, quantity: 100 };

let snapshotCount = 0;
let scheduledActionCount = 0;
const dependencies = {
    getPlayer: (candidate: WebSocket) => (candidate === socket ? player : undefined),
    getInventory: () => inventory,
    setInventorySlot: (_player: PlayerState, slot: number, itemId: number, quantity: number) => {
        inventory[slot] = { itemId, quantity };
    },
    checkAndSendSnapshots: () => {
        snapshotCount++;
    },
    requestAction: () => {
        scheduledActionCount++;
        return { ok: true };
    },
} as unknown as InventoryMessageServiceDeps;

new InventoryMessageService(dependencies).handleInventoryMoveMessage(socket, {
    from: 2,
    to: 7,
});

assert.deepEqual(inventory[2], { itemId: 995, quantity: 100 });
assert.deepEqual(inventory[7], { itemId: 385, quantity: 1 });
assert.equal(snapshotCount, 1);
assert.equal(scheduledActionCount, 0);

console.log("immediate inventory move tests passed");
