import assert from "node:assert/strict";

import { ClientState } from "../game/ClientState";
import { widgetEntriesToSimple } from "../ui/menu/MenuBridge";
import { MenuOpcode, MenuState } from "../ui/menu/MenuState";

// An inventory item's right-click "Use" must select that item (slot, container and id), so the
// next click can "Use X -> target". It used to select item -1, and the use did nothing.
const INVENTORY = (149 << 16) | 0;
const SLOT = 3;
const DRAGON_LONGSWORD = 1305;

const menuState = new MenuState();
const entries = widgetEntriesToSimple(
    [
        { option: "Wield", opIndex: 2, widgetAction: { slot: SLOT, itemId: DRAGON_LONGSWORD } },
        { option: "Use", widgetAction: { slot: SLOT, itemId: DRAGON_LONGSWORD } },
    ],
    {
        ui: {},
        chosenWidget: { uid: INVENTORY + 1, parentUid: INVENTORY, childIndex: SLOT, itemId: DRAGON_LONGSWORD },
        scheduleRender: () => undefined,
        menuState,
    },
);

const use = entries.find((e) => e.option === "Use");
assert.ok(use && typeof use.menuStateIndex === "number");
const i = use.menuStateIndex;
assert.equal(menuState.opcodes[i], MenuOpcode.UseItem);
assert.equal(menuState.argument1[i], SLOT, "slot");
assert.equal(menuState.argument2[i], INVENTORY, "container");
assert.equal(menuState.itemIds[i], DRAGON_LONGSWORD, "item");

menuState.invoke(i, 0, 0);
assert.equal(ClientState.isItemSelected, 1);
assert.equal(ClientState.selectedItemId, DRAGON_LONGSWORD);
assert.equal(ClientState.selectedItemSlot, SLOT);
assert.equal(ClientState.selectedItemWidget, INVENTORY);

console.log("widget menu use item: ok");
