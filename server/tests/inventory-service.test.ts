/**
 * Regression coverage for inventory consumption dirty-state synchronization.
 *
 * Run with: npx tsx tests/inventory-service.test.ts
 */
import assert from "node:assert/strict";

import type { ServerServices } from "../src/game/ServerServices";
import type { PlayerState } from "../src/game/player";
import { InventoryService } from "../src/game/services/InventoryService";
import { PlayerInventoryState } from "../src/game/state/PlayerInventoryState";

const createPlayer = () => {
    const items = new PlayerInventoryState();
    const player = {
        items,
        getInventoryEntries: () => items.getInventoryEntries(),
        setInventorySlot: (slot: number, itemId: number, quantity: number) =>
            items.setInventorySlot(slot, itemId, quantity),
    } as PlayerState;
    return { items, player };
};

const service = new InventoryService({} as ServerServices);

{
    const { items, player } = createPlayer();
    items.setInventorySlot(4, 385, 1);
    items.inventoryDirty = false;

    assert.equal(service.consumeItem(player, 4), true);
    assert.deepEqual(items.getInventoryEntries()[4], { itemId: -1, quantity: 0 });
    assert.equal(
        items.inventoryDirty,
        true,
        "consuming the last item must dirty the inventory so the empty slot is synchronized",
    );
}

{
    const { items, player } = createPlayer();
    items.setInventorySlot(7, 3144, 2);
    items.inventoryDirty = false;

    assert.equal(service.consumeItem(player, 7), true);
    assert.deepEqual(items.getInventoryEntries()[7], { itemId: 3144, quantity: 1 });
    assert.equal(
        items.inventoryDirty,
        true,
        "decrementing a stack must dirty the inventory so the new quantity is synchronized",
    );
}

{
    const { items, player } = createPlayer();
    items.inventoryDirty = false;

    assert.equal(service.consumeItem(player, 0), false);
    assert.equal(items.inventoryDirty, false, "a rejected consume must not dirty the inventory");
}

console.log("inventory-service tests passed");
