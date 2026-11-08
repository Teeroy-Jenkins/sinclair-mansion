/**
 * Regression coverage for player-to-player trade inventory capacity.
 *
 * Run with: npx tsx tests/trade-inventory-capacity.test.ts
 */
import assert from "node:assert/strict";

import type { ServerServices } from "../src/game/ServerServices";
import type { PlayerState } from "../src/game/player";
import type { SqliteDatabase } from "../src/game/state/SqliteDatabase";
import {
    MAX_ITEM_STACK_QUANTITY,
    canInventoryReceiveTradeOffers,
    countFreeInventorySlots,
    formatTradeFreeSlotsMessage,
} from "../src/game/trade/TradeInventoryCapacity";
import { TradeManager } from "../src/game/trade/TradeManager";
import { TradeAction, TradeStage } from "../src/network/messages";

type InventorySlot = { itemId: number; quantity: number };

const emptyInventory = (): InventorySlot[] =>
    Array.from({ length: 28 }, () => ({ itemId: -1, quantity: 0 }));
const fullInventory = (): InventorySlot[] =>
    Array.from({ length: 28 }, (_, slot) => ({ itemId: 1_000 + slot, quantity: 1 }));
const isStackable = (itemId: number) => itemId === 995 || itemId === 561;

assert.equal(countFreeInventorySlots(emptyInventory()), 28);
assert.equal(countFreeInventorySlots(fullInventory()), 0);

const oneFreeSlot = fullInventory();
oneFreeSlot[12] = { itemId: -1, quantity: 0 };
assert.equal(countFreeInventorySlots(oneFreeSlot), 1);
assert.equal(formatTradeFreeSlotsMessage("Alice", 1), "Alice has 1 free inventory slot.");
assert.equal(formatTradeFreeSlotsMessage("Alice", 28), "Alice has 28 free inventory slots.");

assert.equal(
    canInventoryReceiveTradeOffers(oneFreeSlot, [{ itemId: 4151, quantity: 1 }], isStackable),
    true,
    "one free slot should receive one non-stackable item",
);
assert.equal(
    canInventoryReceiveTradeOffers(oneFreeSlot, [{ itemId: 4151, quantity: 2 }], isStackable),
    false,
    "one free slot must not receive two non-stackable items",
);

const fullWithCoins = fullInventory();
fullWithCoins[0] = { itemId: 995, quantity: 1_000 };
assert.equal(
    canInventoryReceiveTradeOffers(fullWithCoins, [{ itemId: 995, quantity: 50_000 }], isStackable),
    true,
    "an incoming stackable item should merge into an existing stack",
);
assert.equal(
    canInventoryReceiveTradeOffers(
        fullInventory(),
        [{ itemId: 995, quantity: 50_000 }],
        isStackable,
    ),
    false,
    "a new stackable item still needs one free slot",
);

assert.equal(
    canInventoryReceiveTradeOffers(
        oneFreeSlot,
        [
            { itemId: 995, quantity: 1_000 },
            { itemId: 561, quantity: 1_000 },
        ],
        isStackable,
    ),
    false,
    "distinct new stacks must consume distinct free slots",
);

const nearMaxCoins = fullInventory();
nearMaxCoins[0] = { itemId: 995, quantity: MAX_ITEM_STACK_QUANTITY - 10 };
assert.equal(
    canInventoryReceiveTradeOffers(nearMaxCoins, [{ itemId: 995, quantity: 10 }], isStackable),
    true,
    "reaching the signed-int stack limit exactly should be valid",
);
assert.equal(
    canInventoryReceiveTradeOffers(nearMaxCoins, [{ itemId: 995, quantity: 11 }], isStackable),
    false,
    "stack overflow must prevent the trade",
);

const alice = { id: 1, name: "Alice" } as PlayerState;
const bob = { id: 2, name: "Bob" } as PlayerState;
const playerInventories = new Map<number, InventorySlot[]>([
    [alice.id, emptyInventory()],
    [bob.id, oneFreeSlot],
]);
const gameMessages: Array<{ playerId: number; message: string }> = [];
const widgetEvents: Array<{ playerId: number; event: any }> = [];
const openedModals: Array<{ playerId: number; groupId: number }> = [];
const services = {
    inventoryService: {
        getInventory: (player: PlayerState) => playerInventories.get(player.id)!,
    },
    messagingService: {
        sendGameMessageToPlayer: (player: PlayerState, message: string) => {
            gameMessages.push({ playerId: player.id, message });
        },
    },
    queueWidgetEvent: (playerId: number, event: any) => {
        widgetEvents.push({ playerId, event });
    },
    broadcastService: {
        queueTradeMessage: () => undefined,
    },
    interfaceService: {
        restoreNormalInventory: () => undefined,
        openModal: (player: PlayerState, groupId: number) => {
            openedModals.push({ playerId: player.id, groupId });
        },
    },
} as unknown as ServerServices;
const manager = new TradeManager(services, {} as SqliteDatabase);
const session = {
    id: "capacity-test",
    stage: TradeStage.Offer,
    status: "active",
    parties: [
        {
            player: alice,
            accountKey: "alice",
            offers: [{ itemId: 4151, quantity: 2 }],
            accepted: false,
            confirmAccepted: false,
            previousLock: 0,
            inventorySignature: (manager as any).getInventorySignature(alice),
        },
        {
            player: bob,
            accountKey: "bob",
            offers: [],
            accepted: false,
            confirmAccepted: false,
            previousLock: 0,
            inventorySignature: (manager as any).getInventorySignature(bob),
        },
    ],
};
(manager as any).sessionByPlayer.set(alice.id, session);
(manager as any).sessionByPlayer.set(bob.id, session);

manager.handleAction(alice, { action: TradeAction.Accept }, 0);
manager.handleAction(bob, { action: TradeAction.Accept }, 0);

assert.equal(
    session.stage,
    TradeStage.Offer,
    "an impossible trade must not advance to confirmation",
);
assert.equal(session.parties[0].accepted, false, "failed capacity should reset acceptance");
assert.equal(session.parties[1].accepted, false, "failed capacity should reset acceptance");
assert.equal(openedModals.length, 0, "confirmation widgets must remain closed");
assert.ok(
    gameMessages.some(
        ({ playerId, message }) =>
            playerId === alice.id && message === "Other player doesn't have enough space.",
    ),
    "the offerer should be told that the recipient lacks space",
);
assert.ok(
    gameMessages.some(
        ({ playerId, message }) =>
            playerId === bob.id && message === "You don't have enough space in your inventory.",
    ),
    "the recipient should be told that their inventory lacks space",
);

const slotIndicatorUid = (335 << 16) | 9;
const aliceSlotIndicator = widgetEvents
    .filter(
        ({ playerId, event }) =>
            playerId === alice.id && event.action === "set_text" && event.uid === slotIndicatorUid,
    )
    .at(-1)?.event.text;
assert.equal(
    aliceSlotIndicator,
    "Bob has 1 free inventory slot.",
    "the centred orange label should show the other player's authoritative free-slot count",
);
const initialBottomStatus = widgetEvents
    .filter(
        ({ playerId, event }) =>
            playerId === alice.id &&
            event.action === "set_text" &&
            event.uid === ((335 << 16) | 30),
    )
    .at(-1)?.event.text;
assert.equal(
    initialBottomStatus,
    "",
    "the white bottom status line should remain empty before either player accepts",
);

session.parties[0].offers[0].quantity = 1;
gameMessages.length = 0;
widgetEvents.length = 0;
manager.handleAction(alice, { action: TradeAction.Accept }, 0);
manager.handleAction(bob, { action: TradeAction.Accept }, 0);

assert.equal(session.stage, TradeStage.Confirm, "a trade that fits should advance to confirmation");
assert.deepEqual(
    openedModals,
    [
        { playerId: alice.id, groupId: 334 },
        { playerId: bob.id, groupId: 334 },
    ],
    "both players should receive the confirmation window",
);

widgetEvents.length = 0;
manager.handleAction(alice, { action: TradeAction.ConfirmAccept }, 0);

const confirmationStatusUid = (334 << 16) | 30;
const latestConfirmationStatus = (playerId: number) =>
    widgetEvents
        .filter(
            ({ playerId: eventPlayerId, event }) =>
                eventPlayerId === playerId &&
                event.action === "set_text" &&
                event.uid === confirmationStatusUid,
        )
        .at(-1)?.event.text;
assert.equal(
    latestConfirmationStatus(alice.id),
    "Waiting for the other player...",
    "the accepting player should see that the confirmation is waiting",
);
assert.equal(
    latestConfirmationStatus(bob.id),
    "Other player has accepted.",
    "the other player should be notified when their partner accepts confirmation",
);

console.log("trade inventory capacity regression test passed");
