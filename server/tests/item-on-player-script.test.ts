import assert from "node:assert/strict";

import type { ServerServices } from "../src/game/ServerServices";
import type { InventoryUseOnActionData } from "../src/game/actions/actionPayloads";
import { InventoryActionHandler } from "../src/game/actions/handlers/InventoryActionHandler";
import type { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import type { ScriptServices } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";

const registry = new ScriptRegistry();
const scheduler = new ScriptScheduler();
const runtime = new ScriptRuntime({ registry, scheduler, services: {} as ScriptServices });
const player = { id: 42 } as PlayerState;
const target = { id: 77 } as PlayerState;
let handledTargetId: number | undefined;

runtime.registerHandlers("item-on-player-test", (scripts) => {
    scripts.registerItemOnPlayer(11173, (event) => {
        handledTargetId = event.target.id;
    });
});

assert.equal(
    runtime.queueItemOnPlayer({
        tick: 100,
        player,
        source: { slot: 3, itemId: 11173 },
        target,
    }),
    true,
);
assert.equal(handledTargetId, undefined);
scheduler.process(100);
assert.equal(handledTargetId, target.id);

let queuedTargetId: number | undefined;
const inventoryPlayer = {
    id: 43,
    tileX: 100,
    tileY: 100,
    level: 0,
    worldViewId: -1,
    getPathQueue: () => [],
} as unknown as PlayerState;
const nearbyTarget = {
    id: 44,
    tileX: 101,
    tileY: 100,
    level: 0,
    worldViewId: -1,
} as PlayerState;
const inventoryServices = {
    inventoryService: { getInventory: () => [{ itemId: 11173, quantity: 1 }] },
    players: { getById: (id: number) => (id === nearbyTarget.id ? nearbyTarget : undefined) },
    scriptRuntime: {
        queueItemOnPlayer: (event: { target: PlayerState }) => {
            queuedTargetId = event.target.id;
            return true;
        },
    },
} as unknown as ServerServices;

const result = new InventoryActionHandler(inventoryServices).executeInventoryUseOnAction(
    inventoryPlayer,
    {
        slot: 0,
        itemId: 11173,
        target: { kind: "player", id: nearbyTarget.id },
    } as InventoryUseOnActionData,
    101,
);
assert.equal(result.ok, true);
assert.equal(queuedTargetId, nearbyTarget.id);

runtime.reset();
assert.equal(registry.findItemOnPlayer(11173), undefined);

console.log("item-on-player-script.test.ts: all assertions passed");
