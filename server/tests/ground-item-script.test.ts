import assert from "node:assert/strict";
import type { WebSocket } from "ws";

import { InventoryActionHandler } from "../src/game/actions/handlers/InventoryActionHandler";
import type { ServerServices } from "../src/game/ServerServices";
import type { GroundItemInteractionState } from "../src/game/interactions/types";
import type { GroundItemStack } from "../src/game/items/GroundItemManager";
import type { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import type {
    GroundItemInteractionEvent,
    GroundItemInteractionHandler,
    ItemOnGroundEvent,
    ScriptServices,
} from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";
import { GroundItemHandler } from "../src/network/managers/GroundItemHandler";

const player = {
    id: 1,
    tileX: 3200,
    tileY: 3200,
    level: 0,
    worldViewId: -1,
} as PlayerState;
const socket = {} as WebSocket;
const targetStack: GroundItemStack = {
    id: 50,
    itemId: 995,
    quantity: 10,
    tile: { x: 3200, y: 3200, level: 0 },
    worldViewId: -1,
    createdTick: 1,
};
const inventory = [{ itemId: 1927, quantity: 1 }];
const registry = new ScriptRegistry();

let interaction: GroundItemInteractionState | undefined;
let queuedGroundItem: Omit<GroundItemInteractionEvent, "services"> | undefined;
let queuedItemOnGround: Omit<ItemOnGroundEvent, "services"> | undefined;
let groundItemHandled = true;
const messages: string[] = [];

const players = {
    get: (candidate: WebSocket) => (candidate === socket ? player : undefined),
    getSocketByPlayerId: (playerId: number) => (playerId === player.id ? socket : undefined),
    startGroundItemInteraction: (
        _socket: WebSocket,
        data: Omit<GroundItemInteractionState, "kind" | "lastRouteTick">,
    ) => {
        interaction = { kind: "groundItem", lastRouteTick: 0, ...data };
    },
};

const services = {
    players,
    dataLoaderService: {
        getObjType: () => ({ groundActions: [] }),
    },
    groundItems: {
        queryArea: (
            _x: number,
            _y: number,
            _level: number,
            _radius: number,
            _tick: number,
            _observerId: number,
            worldViewId: number,
        ) => (worldViewId === targetStack.worldViewId ? [targetStack] : []),
    },
    ticker: {
        currentTick: () => 100,
    },
    scriptRegistry: registry,
    scriptRuntime: {
        queueGroundItemInteraction: (event: Omit<GroundItemInteractionEvent, "services">) => {
            queuedGroundItem = event;
            return groundItemHandled;
        },
        queueItemOnGround: (event: Omit<ItemOnGroundEvent, "services">) => {
            queuedItemOnGround = event;
            return true;
        },
    },
    inventoryService: {
        getInventory: () => inventory,
    },
    messagingService: {
        queueChatMessage: (message: { text: string }) => messages.push(message.text),
    },
} as unknown as ServerServices;

const groundItemHandler = new GroundItemHandler(services);
groundItemHandler.handleGroundItemAction(socket, {
    itemId: targetStack.itemId,
    opNum: 3,
    tile: targetStack.tile,
});
assert.ok(interaction);
assert.equal(interaction.option, "take", "ground action 3 defaults to Take");
assert.equal(interaction.opNum, 3);

groundItemHandler.handleArrivedGroundItemInteraction(player, interaction);
assert.equal(queuedGroundItem?.target.stackId, targetStack.id);
assert.equal(queuedGroundItem?.target.worldViewId, player.worldViewId);
assert.equal(queuedGroundItem?.option, "take");

queuedGroundItem = undefined;
groundItemHandler.handleArrivedGroundItemInteraction(player, {
    ...interaction,
    stackId: targetStack.id + 1,
});
assert.equal(queuedGroundItem, undefined, "the exact clicked stack identity is revalidated");

let takeFallbacks = 0;
groundItemHandler.attemptTakeGroundItem = () => {
    takeFallbacks++;
};
groundItemHandled = false;
groundItemHandler.handleArrivedGroundItemInteraction(player, interaction);
assert.equal(takeFallbacks, 1, "Take falls back to normal pickup when no script handles it");

const baseItemOnGroundHandler = () => undefined;
const newestItemOnGroundHandler = () => undefined;
registry.registerItemOnGround(1927, targetStack.itemId, baseItemOnGroundHandler);
const newestItemOnGroundRegistration = registry.registerItemOnGround(
    1927,
    targetStack.itemId,
    newestItemOnGroundHandler,
);
assert.equal(registry.findItemOnGround(1927, targetStack.itemId), newestItemOnGroundHandler);
newestItemOnGroundRegistration.unregister();
assert.equal(registry.findItemOnGround(1927, targetStack.itemId), baseItemOnGroundHandler);
const inventoryAction = new InventoryActionHandler({
    inventoryService: services.inventoryService,
    groundItemHandler,
} as unknown as ServerServices);
const itemOnGroundResult = inventoryAction.executeInventoryUseOnAction(
    player,
    {
        slot: 0,
        itemId: 1927,
        target: {
            kind: "obj",
            id: targetStack.itemId,
            tile: { x: targetStack.tile.x, y: targetStack.tile.y },
        },
    },
    100,
);
assert.equal(itemOnGroundResult.ok, true);
assert.deepEqual(interaction?.source, { slot: 0, itemId: 1927 });

groundItemHandler.handleArrivedGroundItemInteraction(player, interaction!);
assert.equal(queuedItemOnGround?.source.itemId, 1927);
assert.equal(queuedItemOnGround?.target.stackId, targetStack.id);

const runtimeRegistry = new ScriptRegistry();
const scheduler = new ScriptScheduler();
const runtimeServices = { hotReloadEnabled: true } as unknown as ScriptServices;
const runtime = new ScriptRuntime({
    registry: runtimeRegistry,
    scheduler,
    services: runtimeServices,
    logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
    },
});
const baseHandler: GroundItemInteractionHandler = () => undefined;
const firstReloadHandler: GroundItemInteractionHandler = () => undefined;
const secondReloadHandler: GroundItemInteractionHandler = () => undefined;
runtimeRegistry.registerGroundItemInteraction(995, baseHandler, "take");
runtime.registerHandlers("ground-item-hot-reload", (scripts) => {
    scripts.registerGroundItemInteraction(995, firstReloadHandler, "take");
});
assert.equal(runtimeRegistry.findGroundItemInteraction(995, "take"), firstReloadHandler);

let restoredDuringReload: GroundItemInteractionHandler | undefined;
runtime.registerHandlers("ground-item-hot-reload", (scripts) => {
    restoredDuringReload = scripts.findGroundItemInteraction(995, "take");
    scripts.registerGroundItemInteraction(995, secondReloadHandler, "take");
});
assert.equal(restoredDuringReload, baseHandler);
assert.equal(runtimeRegistry.findGroundItemInteraction(995, "take"), secondReloadHandler);

let runtimeItemOnGroundEvent: ItemOnGroundEvent | undefined;
runtimeRegistry.registerItemOnGround(1927, 995, (event) => {
    runtimeItemOnGroundEvent = event;
});
assert.equal(
    runtime.queueItemOnGround({
        tick: 110,
        player,
        source: { slot: 0, itemId: 1927 },
        target: {
            stackId: 50,
            itemId: 995,
            quantity: 10,
            tile: { x: 3200, y: 3200, level: 0 },
            worldViewId: -1,
        },
    }),
    true,
);
scheduler.process(110);
assert.equal(runtimeItemOnGroundEvent?.target.stackId, 50);

console.log("ground-item-script.test.ts: all assertions passed");
