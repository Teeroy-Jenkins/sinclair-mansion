import assert from "node:assert/strict";

import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import type {
    EquipmentActionHandler,
    ItemOnItemHandler,
    ItemOnLocHandler,
    ItemOnNpcHandler,
    LocInteractionEvent,
    LocInteractionHandler,
    NpcInteractionHandler,
    ScriptRegistrationResult,
    ScriptServices,
    WidgetActionEvent,
    WidgetActionHandler,
} from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";

function assertRestoresPrevious<T>(
    register: (handler: T) => ScriptRegistrationResult,
    find: () => T | undefined,
    previous: T,
    newest: T,
): void {
    const previousRegistration = register(previous);
    const newestRegistration = register(newest);
    assert.equal(find(), newest);
    newestRegistration.unregister();
    assert.equal(find(), previous);
    previousRegistration.unregister();
    assert.equal(find(), undefined);
}

const registry = new ScriptRegistry();

const baseNpcHandler: NpcInteractionHandler = () => undefined;
const middleNpcHandler: NpcInteractionHandler = () => undefined;
const newestNpcHandler: NpcInteractionHandler = () => undefined;
const baseNpcRegistration = registry.registerNpcInteraction(1, baseNpcHandler, "talk-to");
const middleNpcRegistration = registry.registerNpcInteraction(1, middleNpcHandler, "talk-to");
const newestNpcRegistration = registry.registerNpcInteraction(1, newestNpcHandler, "talk-to");
assert.equal(registry.findNpcInteractionDirect(1, "talk-to"), newestNpcHandler);
middleNpcRegistration.unregister();
assert.equal(
    registry.findNpcInteractionDirect(1, "talk-to"),
    newestNpcHandler,
    "unregistering a shadowed handler must not remove the active handler",
);
newestNpcRegistration.unregister();
assert.equal(registry.findNpcInteractionDirect(1, "talk-to"), baseNpcHandler);
baseNpcRegistration.unregister();
assert.equal(registry.findNpcInteractionDirect(1, "talk-to"), undefined);

const locCalls: string[] = [];
const baseLocHandler: LocInteractionHandler = () => {
    locCalls.push("base");
};
const baseLocRegistration = registry.registerLocInteraction(2, baseLocHandler, "use");
const wrappedLocHandler = registry.findLocInteraction(2, "use");
assert.ok(wrappedLocHandler);
const wrapperRegistration = registry.registerLocInteraction(
    2,
    (event) => {
        locCalls.push("wrapper");
        wrappedLocHandler(event);
    },
    "use",
);
registry.findLocInteraction(2, "use")?.({} as LocInteractionEvent);
assert.deepEqual(locCalls, ["wrapper", "base"]);
wrapperRegistration.unregister();
assert.equal(registry.findLocInteraction(2, "use"), baseLocHandler);
baseLocRegistration.unregister();

const previousLocAction: LocInteractionHandler = () => undefined;
const newestLocAction: LocInteractionHandler = () => undefined;
assertRestoresPrevious(
    (handler) => registry.registerLocAction("open", handler),
    () => registry.findLocInteraction(999, "open"),
    previousLocAction,
    newestLocAction,
);

const previousNpcAction: NpcInteractionHandler = () => undefined;
const newestNpcAction: NpcInteractionHandler = () => undefined;
assertRestoresPrevious(
    (handler) => registry.registerNpcAction("talk-to", handler),
    () => registry.findNpcAction("talk-to"),
    previousNpcAction,
    newestNpcAction,
);

const previousItemOnItem: ItemOnItemHandler = () => undefined;
const newestItemOnItem: ItemOnItemHandler = () => undefined;
const previousItemPair = registry.registerItemOnItem(10, 20, previousItemOnItem);
const newestItemPair = registry.registerItemOnItem(20, 10, newestItemOnItem);
assert.equal(registry.findItemOnItem(10, 20), newestItemOnItem);
assert.equal(registry.findItemOnItem(20, 10), newestItemOnItem);
newestItemPair.unregister();
assert.equal(registry.findItemOnItem(10, 20), previousItemOnItem);
assert.equal(registry.findItemOnItem(20, 10), previousItemOnItem);
previousItemPair.unregister();
assert.equal(registry.findItemOnItem(10, 20), undefined);

const sameItemBase = registry.registerItemOnItem(30, 30, previousItemOnItem);
const sameItemNewest = registry.registerItemOnItem(30, 30, newestItemOnItem);
sameItemNewest.unregister();
assert.equal(registry.findItemOnItem(30, 30), previousItemOnItem);
sameItemBase.unregister();
assert.equal(registry.findItemOnItem(30, 30), undefined);

const previousItemOnLoc: ItemOnLocHandler = () => undefined;
const newestItemOnLoc: ItemOnLocHandler = () => undefined;
assertRestoresPrevious(
    (handler) => registry.registerItemOnLoc(40, 50, handler),
    () => registry.findItemOnLoc(40, 50),
    previousItemOnLoc,
    newestItemOnLoc,
);

const previousItemOnNpc: ItemOnNpcHandler = () => undefined;
const newestItemOnNpc: ItemOnNpcHandler = () => undefined;
assertRestoresPrevious(
    (handler) => registry.registerItemOnNpc(60, 70, handler),
    () => registry.findItemOnNpc(60, 70),
    previousItemOnNpc,
    newestItemOnNpc,
);

const previousItemAction: ItemOnItemHandler = () => undefined;
const newestItemAction: ItemOnItemHandler = () => undefined;
assertRestoresPrevious(
    (handler) => registry.registerItemAction(80, handler, "rub"),
    () => registry.findItemAction(80, "rub"),
    previousItemAction,
    newestItemAction,
);

const previousEquipmentAction: EquipmentActionHandler = () => undefined;
const newestEquipmentAction: EquipmentActionHandler = () => undefined;
assertRestoresPrevious(
    (handler) => registry.registerEquipmentAction(90, handler, "operate"),
    () => registry.findEquipmentAction(90, "operate"),
    previousEquipmentAction,
    newestEquipmentAction,
);

const previousEquipmentOption: EquipmentActionHandler = () => undefined;
const newestEquipmentOption: EquipmentActionHandler = () => undefined;
assertRestoresPrevious(
    (handler) => registry.registerEquipmentOption("remove", handler),
    () => registry.findEquipmentAction(999, "remove"),
    previousEquipmentOption,
    newestEquipmentOption,
);

const widgetCalls: string[] = [];
const firstWidgetHandler: WidgetActionHandler = () => {
    widgetCalls.push("first");
};
const secondWidgetHandler: WidgetActionHandler = () => {
    widgetCalls.push("second");
};
const firstWidgetRegistration = registry.registerWidgetAction({
    widgetId: 100,
    opId: 1,
    option: "select",
    handler: firstWidgetHandler,
});
registry.registerWidgetAction({
    widgetId: 100,
    opId: 1,
    option: "select",
    handler: secondWidgetHandler,
});
registry.findWidgetAction(100, 1, "select")?.({} as WidgetActionEvent);
assert.deepEqual(widgetCalls, ["first", "second"]);
firstWidgetRegistration.unregister();
assert.equal(registry.findWidgetAction(100, 1, "select"), secondWidgetHandler);
// An interface's own op on an item (a shop's Value is op 1) beats the item's op 1 (Drink).
assert.equal(registry.hasWidgetActionFor(100, 1), true);
assert.equal(registry.hasWidgetActionFor(100, 2), false, "only the ops it handles");
assert.equal(registry.hasWidgetActionFor(101, 1), false, "only that widget");
registry.registerWidgetAction({ opId: 3, handler: () => undefined }); // any widget
assert.equal(registry.hasWidgetActionFor(102, 3), false, "wildcard-widget handlers don't count");

const hotReloadRegistry = new ScriptRegistry();
const scheduler = new ScriptScheduler();
const services = { hotReloadEnabled: true } as unknown as ScriptServices;
const runtime = new ScriptRuntime({
    registry: hotReloadRegistry,
    scheduler,
    services,
    logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
    },
});
const baseHotReloadHandler: NpcInteractionHandler = () => undefined;
const firstHotReloadHandler: NpcInteractionHandler = () => undefined;
const secondHotReloadHandler: NpcInteractionHandler = () => undefined;
hotReloadRegistry.registerNpcInteraction(200, baseHotReloadHandler, "talk-to");
runtime.registerHandlers("stack-hot-reload", (scripts) => {
    scripts.registerNpcInteraction(200, firstHotReloadHandler, "talk-to");
});
assert.equal(hotReloadRegistry.findNpcInteractionDirect(200, "talk-to"), firstHotReloadHandler);

let restoredDuringReload: NpcInteractionHandler | undefined;
runtime.registerHandlers("stack-hot-reload", (scripts) => {
    restoredDuringReload = scripts.findNpcInteraction(200, "talk-to");
    scripts.registerNpcInteraction(200, secondHotReloadHandler, "talk-to");
});
assert.equal(
    restoredDuringReload,
    baseHotReloadHandler,
    "hot reload must restore the handler shadowed by the previous script generation",
);
assert.equal(hotReloadRegistry.findNpcInteractionDirect(200, "talk-to"), secondHotReloadHandler);

console.log("script-registry-handler-stacks.test.ts: all assertions passed");
