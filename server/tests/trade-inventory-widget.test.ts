/**
 * Regression coverage for the native trade inventory side-panel scripts.
 *
 * Run with: npx tsx tests/trade-inventory-widget.test.ts
 */
import assert from "node:assert/strict";

import { loadCache, loadCacheInfos, loadCacheList } from "../../client/scripts/cache/load-util";
import { resolveTradeActionQuantity } from "../../client/game/trade/TradeActionQuantity";
import { CacheSystem } from "../../client/rs/cache/CacheSystem";
import { IndexType } from "../../client/rs/cache/IndexType";
import { getCacheLoaderFactory } from "../../client/rs/cache/loader/CacheLoaderFactory";
import { VarManager } from "../../client/rs/config/vartype/VarManager";
import { Cs2Vm, createScriptEvent } from "../../client/rs/cs2/Cs2Vm";
import { type Script, parseScriptFromBytes } from "../../client/rs/cs2/Script";
import { Inventory } from "../../client/rs/inventory/Inventory";
import { WidgetManager } from "../../client/widgets/WidgetManager";
import { deriveMenuEntriesForWidget, hasContextMenuOption } from "../../client/widgets/menu/utils";

const cacheInfo = loadCacheList(loadCacheInfos()).latest;
const loadedCache = loadCache(cacheInfo);
const cacheSystem = CacheSystem.fromFiles("dat2", loadedCache.files);
const objTypeLoader = getCacheLoaderFactory(cacheInfo, cacheSystem).getObjTypeLoader();
const scriptIndex = cacheSystem.getIndex(IndexType.DAT2.clientScript);

function loadScript(id: number): Script | null {
    const archive = scriptIndex.getArchive(id);
    const file = archive.getFile(0);
    return file ? parseScriptFromBytes(id, file.data) : null;
}

const widgetManager = new WidgetManager(cacheSystem);
assert.ok(widgetManager.loadGroup(336), "trade inventory widget group should load");

const inventory = new Inventory();
inventory.setSlot(0, 995, 12_345);
inventory.setSlot(7, 4151, 1);
const selfOffer = new Inventory();
selfOffer.setSlot(0, 995, 500);
const otherOffer = new Inventory();
otherOffer.setSlot(0, 555, 1);

const vm = new Cs2Vm({
    widgetManager,
    varManager: new VarManager({
        load: () => ({ baseVar: 0, startBit: 0, endBit: 1 }),
    } as any),
    loadScript,
    clientRevision: cacheInfo.revision,
    objTypeLoader,
    inventories: new Map([
        [93, inventory],
        [90, selfOffer],
        [90 + 32768, otherOffer],
    ]),
});

const componentUid = 336 << 16;
const initScript = loadScript(3617);
assert.ok(initScript, "native trade inventory initializer should exist");
vm.run(initScript, [componentUid], []);

const component = widgetManager.getWidgetByUid(componentUid);
assert.ok(component, "trade inventory root component should exist");
assert.equal(component.width, 162, "trade inventory's native container width should be preserved");
assert.equal(
    component.children?.filter(Boolean).length,
    Inventory.SLOT_COUNT,
    "initializer should create all 28 inventory slot widgets",
);
assert.equal(component.children?.[0]?.itemId, 995, "slot 0 should display its item");
assert.equal(component.children?.[0]?.itemQuantity, 12_345, "slot 0 should display its quantity");
assert.equal(
    component.children?.[7]?.itemId,
    4151,
    "non-contiguous inventory items should display",
);
assert.equal(
    component.children?.[1]?.itemId,
    6512,
    "empty inventory slots should retain the native transparent placeholder",
);
assert.equal(component.children?.[0]?.x, 0, "trade inventory should align its first column");
assert.equal(component.children?.[3]?.x, 126, "trade inventory's fourth column should fit");
assert.equal(component.children?.[3]?.x! + 36, component.width, "the final column must not clip");

inventory.setSlot(0, 1337, 42);
const refreshScript = loadScript(3619);
assert.ok(refreshScript, "native trade inventory refresh script should exist");
vm.run(refreshScript, [componentUid, inventory.capacity], []);

assert.equal(component.children?.[0]?.itemId, 1337, "refresh should read the latest item");
assert.equal(component.children?.[0]?.itemQuantity, 42, "refresh should read the latest quantity");
assert.equal(component.children?.[3]?.x, 126, "trade refresh must reapply the fitted layout");

const offerGroup = widgetManager.loadGroup(335);
assert.ok(offerGroup, "trade offer widget group should load");
const offerInitComponent = Array.from(offerGroup.widgetsByUid.values()).find(
    (widget) => widget.onLoad?.[0] === 755,
);
assert.ok(offerInitComponent?.onLoad, "trade offer initializer should be attached");
assert.equal(
    vm.runScriptEvent(
        createScriptEvent({
            args: offerInitComponent.onLoad,
            widget: offerInitComponent,
        }),
    ),
    true,
    "trade offer initializer should execute",
);

const selfOfferComponent = widgetManager.getWidgetByUid((335 << 16) | 25);
const otherOfferComponent = widgetManager.getWidgetByUid((335 << 16) | 28);
assert.equal(
    selfOfferComponent?.children?.slice(0, Inventory.SLOT_COUNT).filter(Boolean).length,
    Inventory.SLOT_COUNT,
    "self offer should display all 28 available slots",
);
assert.equal(
    otherOfferComponent?.children?.slice(0, Inventory.SLOT_COUNT).filter(Boolean).length,
    Inventory.SLOT_COUNT,
    "other offer should display all 28 available slots",
);
assert.equal(selfOfferComponent?.children?.[0]?.itemId, 995, "self offer item should display");
assert.equal(otherOfferComponent?.children?.[0]?.itemId, 555, "other offer item should display");
const otherOfferItem = otherOfferComponent?.children?.[0];
assert.equal(
    otherOfferItem?.actions?.[9],
    "Examine",
    "the native counterparty item should expose its Examine action",
);
widgetManager.setWidgetFlagsByKey((335 << 16) | 28, 0, 1 << 10);
assert.equal(
    widgetManager.getWidgetFlags(otherOfferItem),
    1 << 10,
    "the runtime IF_SETEVENTS key should reach the counterparty item",
);
const otherOfferMenu = deriveMenuEntriesForWidget(otherOfferItem, false, (widget) =>
    widgetManager.getWidgetFlags(widget),
);
const otherOfferExamine = otherOfferMenu.find((entry) => entry.option === "Examine");
assert.ok(otherOfferExamine, "the counterparty offer flags should make Examine visible");
assert.match(
    otherOfferExamine.target ?? "",
    /Water rune/i,
    "the Examine option should identify the counterparty's item",
);
assert.equal(
    hasContextMenuOption(otherOfferMenu),
    true,
    "an Examine-only counterparty item must still open a right-click menu",
);
assert.equal(
    otherOfferMenu.some((entry) => entry.option.startsWith("Remove")),
    false,
    "counterparty items must not expose the local player's Remove actions",
);
assert.equal(
    selfOfferComponent?.children?.[0]?.actions?.[0],
    "Remove",
    "native one-item offer action should be unsuffixed",
);
assert.equal(
    widgetManager.getWidgetByUid((335 << 16) | 10)?.actions?.[0],
    "Accept",
    "offer-stage Accept button should expose its native action",
);
assert.equal(
    widgetManager.getWidgetByUid((335 << 16) | 13)?.actions?.[0],
    "Decline",
    "offer-stage Decline button should expose its native action",
);
assert.equal(
    widgetManager.getWidgetByUid((335 << 16) | 9)?.textColor,
    0xff981f,
    "the native free-slot indicator should use the centred orange trade label",
);

const confirmGroup = widgetManager.loadGroup(334);
assert.ok(confirmGroup, "trade confirmation widget group should load");
const confirmInitComponent = Array.from(confirmGroup.widgetsByUid.values()).find(
    (widget) => widget.onLoad?.[0] === 142,
);
assert.ok(confirmInitComponent?.onLoad, "trade confirmation initializer should be attached");
assert.equal(
    widgetManager.getWidgetByUid((334 << 16) | 13)?.actions?.[0],
    "Accept",
    "confirmation-stage Accept button should expose its native action",
);
assert.equal(
    widgetManager.getWidgetByUid((334 << 16) | 14)?.actions?.[0],
    "Decline",
    "confirmation-stage Decline button should expose its native action",
);
assert.equal(
    widgetManager.getWidgetByUid((334 << 16) | 32)?.actions?.[0],
    "Close",
    "confirmation close button should expose its native action",
);

assert.equal(resolveTradeActionQuantity("remove", 500), 1, "native Remove should return one item");
assert.equal(resolveTradeActionQuantity("remove5", 500), 5, "Remove-5 should return five items");
assert.equal(resolveTradeActionQuantity("remove10", 500), 10, "Remove-10 should return ten items");
assert.equal(
    resolveTradeActionQuantity("removeall", 500),
    500,
    "Remove-All should return the full offer",
);

console.log("trade inventory widget regression test passed");
