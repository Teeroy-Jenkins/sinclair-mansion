import assert from "node:assert/strict";

import type { ServerServices } from "../src/game/ServerServices";
import type { InventoryUseOnActionData } from "../src/game/actions/actionPayloads";
import { InventoryActionHandler } from "../src/game/actions/handlers/InventoryActionHandler";
import type { NpcState } from "../src/game/npc";
import type { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import type { ScriptServices } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";

const registry = new ScriptRegistry();
const scheduler = new ScriptScheduler();
const services = {} as ScriptServices;
const runtime = new ScriptRuntime({ registry, scheduler, services });
const player = { id: 42 } as PlayerState;
const npc = { id: 77, typeId: 4626, tileX: 101, tileY: 100, size: 1 } as NpcState;

let handledEvent: { itemId: number; npcId: number } | undefined;
runtime.registerHandlers("item-on-npc-test", (scripts) => {
    scripts.registerItemOnNpc(1927, 4626, (event) => {
        handledEvent = { itemId: event.source.itemId, npcId: event.target.id };
    });
});

assert.equal(
    runtime.queueItemOnNpc({
        tick: 100,
        player,
        source: { slot: 3, itemId: 1927 },
        target: npc,
    }),
    true,
);
assert.equal(handledEvent, undefined, "script execution remains tick-scheduled");
scheduler.process(100);
assert.deepEqual(handledEvent, { itemId: 1927, npcId: 77 });

let queuedNpcId: number | undefined;
const inventoryPlayer = {
    id: 43,
    tileX: 100,
    tileY: 100,
    level: 0,
    getPathQueue: () => [],
} as unknown as PlayerState;
const inventoryServices = {
    inventoryService: {
        getInventory: () => [{ itemId: 1927, quantity: 1 }],
    },
    npcManager: {
        getById: (id: number) => (id === npc.id ? npc : undefined),
    },
    scriptRuntime: {
        queueItemOnNpc: (event: { target: NpcState }) => {
            queuedNpcId = event.target.id;
            return true;
        },
    },
} as unknown as ServerServices;

const result = new InventoryActionHandler(inventoryServices).executeInventoryUseOnAction(
    inventoryPlayer,
    {
        slot: 0,
        itemId: 1927,
        target: { kind: "npc", id: npc.id },
    } as InventoryUseOnActionData,
    101,
);

assert.equal(result.ok, true);
assert.equal(queuedNpcId, npc.id);

runtime.reset();
assert.equal(registry.findItemOnNpc(1927, 4626), undefined);

console.log("item-on-npc-script.test.ts: all assertions passed");
