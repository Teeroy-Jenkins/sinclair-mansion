/**
 * Adversarial regression coverage for player-to-player trade item safety.
 *
 * Run with: npx tsx tests/trade-dupe-safety.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ServerServices } from "../src/game/ServerServices";
import { LockState } from "../src/game/model/LockState";
import type { PlayerState } from "../src/game/player";
import { SqliteDatabase } from "../src/game/state/SqliteDatabase";
import { TradeManager } from "../src/game/trade/TradeManager";
import { TradeAction, TradeStage } from "../src/network/messages";

type InventorySlot = { itemId: number; quantity: number };
type Offer = { itemId: number; quantity: number };
type TestPlayer = PlayerState & { __saveKey: string };

const WHIP = 4151;

function emptyInventory(): InventorySlot[] {
    return Array.from({ length: 28 }, () => ({ itemId: -1, quantity: 0 }));
}

function itemCount(inventory: readonly InventorySlot[], itemId: number): number {
    return inventory.reduce(
        (total, slot) => total + (slot.itemId === itemId ? slot.quantity : 0),
        0,
    );
}

function createHarness() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "trade-dupe-safety-"));
    const database = new SqliteDatabase({ dataDir: tempDir });
    const inventories = new Map<number, InventorySlot[]>();
    const openWidgets = new Map<number, Set<number>>();
    const messages: Array<{ playerId: number; message: string }> = [];
    let forcePartialInsertion = false;

    const createPlayer = (id: number, name: string, accountKey: string): TestPlayer => {
        inventories.set(id, emptyInventory());
        openWidgets.set(id, new Set([334, 335, 336]));
        const player = {
            id,
            name,
            __saveKey: accountKey,
            lock: LockState.FULL_WITH_ITEM_INTERACTION,
            widgets: {
                close: (groupId: number) => openWidgets.get(id)!.delete(groupId),
                isOpen: (groupId: number) => openWidgets.get(id)!.has(groupId),
            },
            exportPersistentVars: () => ({
                inventory: inventories.get(id)!.map((slot) => ({ ...slot })),
            }),
        } as unknown as TestPlayer;
        return player;
    };

    const alice = createPlayer(1, "Alice", "alice");
    const bob = createPlayer(2, "Bob", "bob");

    const services = {
        inventoryService: {
            getInventory: (player: PlayerState) => inventories.get(player.id)!,
            setInventorySlot: (
                player: PlayerState,
                slot: number,
                itemId: number,
                quantity: number,
            ) => {
                inventories.get(player.id)![slot] = { itemId, quantity };
            },
            addItemToInventory: (player: PlayerState, itemId: number, quantity: number) => {
                const inventory = inventories.get(player.id)!;
                if (forcePartialInsertion && quantity > 1) {
                    forcePartialInsertion = false;
                    const freeSlot = inventory.findIndex(
                        (slot) => slot.itemId <= 0 || slot.quantity <= 0,
                    );
                    if (freeSlot >= 0) inventory[freeSlot] = { itemId, quantity: 1 };
                    return { slot: freeSlot, added: freeSlot >= 0 ? 1 : 0 };
                }

                const freeSlots = inventory
                    .map((slot, index) => (slot.itemId <= 0 || slot.quantity <= 0 ? index : -1))
                    .filter((slot) => slot >= 0);
                if (freeSlots.length < quantity) return { slot: -1, added: 0 };
                for (let index = 0; index < quantity; index++) {
                    inventory[freeSlots[index]] = { itemId, quantity: 1 };
                }
                return { slot: freeSlots[0] ?? -1, added: quantity };
            },
            sendInventorySnapshot: () => undefined,
        },
        messagingService: {
            sendGameMessageToPlayer: (player: PlayerState, message: string) => {
                messages.push({ playerId: player.id, message });
            },
        },
        broadcastService: {
            queueTradeMessage: () => undefined,
        },
        interfaceService: {
            getCurrentModal: () => undefined,
            closeModal: () => undefined,
            restoreNormalInventory: (player: PlayerState) => {
                openWidgets.get(player.id)!.delete(336);
            },
            openModal: () => undefined,
        },
        queueWidgetEvent: () => undefined,
    } as unknown as ServerServices;
    const manager = new TradeManager(services, database);

    const installSession = (
        id: string,
        stage: TradeStage,
        aliceOffers: Offer[],
        bobOffers: Offer[] = [],
    ) => {
        alice.lock = LockState.FULL_WITH_ITEM_INTERACTION;
        bob.lock = LockState.FULL_WITH_ITEM_INTERACTION;
        const session = {
            id,
            stage,
            status: "active",
            parties: [
                {
                    player: alice,
                    accountKey: "alice",
                    offers: aliceOffers.map((offer) => ({ ...offer })),
                    accepted: stage === TradeStage.Confirm,
                    confirmAccepted: false,
                    previousLock: LockState.NONE,
                    inventorySignature: (manager as any).getInventorySignature(alice),
                },
                {
                    player: bob,
                    accountKey: "bob",
                    offers: bobOffers.map((offer) => ({ ...offer })),
                    accepted: stage === TradeStage.Confirm,
                    confirmAccepted: false,
                    previousLock: LockState.NONE,
                    inventorySignature: (manager as any).getInventorySignature(bob),
                },
            ],
        };
        (manager as any).sessions.set(id, session);
        (manager as any).sessionByPlayer.set(alice.id, session);
        (manager as any).sessionByPlayer.set(bob.id, session);
        return session;
    };

    const seedEscrow = (sessionId: string, accountKey: string, offers: Offer[]) => {
        const insert = database.connection.prepare(
            `INSERT INTO active_trade_escrows (
                session_id,
                account_name,
                item_id,
                quantity,
                created_at
            ) VALUES (?, ?, ?, ?, ?)`,
        );
        for (const offer of offers) {
            insert.run(
                sessionId,
                accountKey,
                offer.itemId,
                offer.quantity,
                new Date().toISOString(),
            );
        }
    };

    const seedPendingRefund = (accountKey: string, itemId: number, quantity: number) => {
        database.connection
            .prepare(
                `INSERT INTO pending_trade_refunds (
                    account_name,
                    item_id,
                    quantity,
                    created_at
                ) VALUES (?, ?, ?, ?)`,
            )
            .run(accountKey, itemId, quantity, new Date().toISOString());
    };

    const tableCount = (table: "active_trade_escrows" | "pending_trade_refunds"): number => {
        const row = database.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
            count: number;
        };
        return Number(row.count);
    };

    const cleanup = () => {
        database.connection.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    };

    return {
        manager,
        database,
        inventories,
        messages,
        alice,
        bob,
        installSession,
        seedEscrow,
        seedPendingRefund,
        tableCount,
        forcePartialInsertion: () => {
            forcePartialInsertion = true;
        },
        cleanup,
    };
}

{
    const harness = createHarness();
    try {
        harness.installSession("complete-once", TradeStage.Confirm, [
            { itemId: WHIP, quantity: 1 },
        ]);
        harness.seedEscrow("complete-once", "alice", [{ itemId: WHIP, quantity: 1 }]);

        harness.manager.handleAction(harness.alice, { action: TradeAction.ConfirmAccept }, 0);
        harness.manager.handleAction(harness.bob, { action: TradeAction.ConfirmAccept }, 0);

        assert.equal(itemCount(harness.inventories.get(harness.alice.id)!, WHIP), 0);
        assert.equal(itemCount(harness.inventories.get(harness.bob.id)!, WHIP), 1);
        assert.equal(harness.tableCount("active_trade_escrows"), 0);
        assert.deepEqual(
            harness.messages
                .filter(({ message }) => message === "Accepted trade.")
                .map(({ playerId }) => playerId)
                .sort(),
            [harness.alice.id, harness.bob.id],
            "both players should receive the successful-trade chat message",
        );

        harness.manager.handleAction(harness.bob, { action: TradeAction.ConfirmAccept }, 0);
        assert.equal(
            itemCount(harness.inventories.get(harness.bob.id)!, WHIP),
            1,
            "replaying final acceptance must not execute a completed trade twice",
        );
        assert.equal(
            harness.messages.filter(({ message }) => message === "Accepted trade.").length,
            2,
            "replaying final acceptance must not repeat the successful-trade message",
        );
    } finally {
        harness.cleanup();
    }
}

{
    const harness = createHarness();
    try {
        harness.inventories.get(harness.alice.id)![0] = { itemId: WHIP, quantity: 1 };
        harness.installSession("offer-replay", TradeStage.Offer, []);

        const replayedOffer = {
            action: TradeAction.Offer,
            slot: 0,
            quantity: 1,
            itemId: WHIP,
        } as const;
        harness.manager.handleAction(harness.alice, replayedOffer, 0);
        harness.manager.handleAction(harness.alice, replayedOffer, 0);
        harness.manager.handleAction(harness.alice, { action: TradeAction.Decline }, 0);

        assert.equal(
            itemCount(harness.inventories.get(harness.alice.id)!, WHIP),
            1,
            "replaying an offer packet must not escrow or return the same item twice",
        );
        assert.equal(harness.tableCount("active_trade_escrows"), 0);
        assert.equal(harness.tableCount("pending_trade_refunds"), 0);
    } finally {
        harness.cleanup();
    }
}

{
    const harness = createHarness();
    try {
        harness.installSession("decline-once", TradeStage.Offer, [{ itemId: WHIP, quantity: 1 }]);
        harness.seedEscrow("decline-once", "alice", [{ itemId: WHIP, quantity: 1 }]);

        harness.manager.handleAction(harness.alice, { action: TradeAction.Decline }, 0);
        harness.manager.handleAction(harness.alice, { action: TradeAction.Decline }, 0);

        assert.equal(
            itemCount(harness.inventories.get(harness.alice.id)!, WHIP),
            1,
            "replaying decline must return escrow exactly once",
        );
        assert.equal(harness.tableCount("active_trade_escrows"), 0);
        assert.equal(harness.tableCount("pending_trade_refunds"), 0);
    } finally {
        harness.cleanup();
    }
}

{
    const harness = createHarness();
    try {
        harness.installSession("already-recovered", TradeStage.Offer, [
            { itemId: WHIP, quantity: 1 },
        ]);
        // Simulate restart recovery racing with a stale in-memory session: the
        // item is already in the durable refund ledger, not active escrow.
        harness.seedPendingRefund("alice", WHIP, 1);

        harness.manager.handleAction(
            harness.alice,
            { action: TradeAction.Remove, slot: 0, quantity: 1 },
            0,
        );

        assert.equal(
            itemCount(harness.inventories.get(harness.alice.id)!, WHIP),
            1,
            "a stale offer must not mint a second copy of an already-recovered item",
        );
        assert.equal(harness.tableCount("active_trade_escrows"), 0);
        assert.equal(harness.tableCount("pending_trade_refunds"), 0);
        assert.equal(harness.manager.isPlayerTrading(harness.alice), false);
    } finally {
        harness.cleanup();
    }
}

{
    const harness = createHarness();
    try {
        harness.installSession("missing-final-escrow", TradeStage.Confirm, [
            { itemId: WHIP, quantity: 1 },
        ]);

        harness.manager.handleAction(harness.alice, { action: TradeAction.ConfirmAccept }, 0);
        harness.manager.handleAction(harness.bob, { action: TradeAction.ConfirmAccept }, 0);

        assert.equal(itemCount(harness.inventories.get(harness.alice.id)!, WHIP), 0);
        assert.equal(
            itemCount(harness.inventories.get(harness.bob.id)!, WHIP),
            0,
            "completion must fail closed when durable escrow is missing",
        );
        assert.equal(harness.manager.isPlayerTrading(harness.alice), false);
    } finally {
        harness.cleanup();
    }
}

{
    const harness = createHarness();
    try {
        harness.seedPendingRefund("alice", WHIP, 2);
        harness.forcePartialInsertion();
        harness.manager.restorePendingRefunds(harness.alice);

        assert.equal(
            itemCount(harness.inventories.get(harness.alice.id)!, WHIP),
            0,
            "a partial refund insertion must be rolled back",
        );
        assert.equal(
            harness.tableCount("pending_trade_refunds"),
            1,
            "a failed refund must remain durable for retry",
        );

        harness.manager.restorePendingRefunds(harness.alice);
        harness.manager.restorePendingRefunds(harness.alice);
        assert.equal(
            itemCount(harness.inventories.get(harness.alice.id)!, WHIP),
            2,
            "a durable refund must be redeemable exactly once",
        );
        assert.equal(harness.tableCount("pending_trade_refunds"), 0);
    } finally {
        harness.cleanup();
    }
}

{
    const harness = createHarness();
    try {
        harness.installSession("player-id-reuse", TradeStage.Offer, [
            { itemId: WHIP, quantity: 1 },
        ]);
        harness.seedEscrow("player-id-reuse", "alice", [{ itemId: WHIP, quantity: 1 }]);
        const impostor = {
            ...harness.alice,
            __saveKey: "impostor",
        } as TestPlayer;

        harness.manager.handleAction(impostor, { action: TradeAction.Decline }, 0);
        assert.equal(
            harness.manager.isPlayerTrading(harness.alice),
            true,
            "a new player object reusing an ID must not control an old trade",
        );
        assert.equal(itemCount(harness.inventories.get(harness.alice.id)!, WHIP), 0);

        harness.manager.handleAction(harness.alice, { action: TradeAction.Decline }, 0);
        assert.equal(itemCount(harness.inventories.get(harness.alice.id)!, WHIP), 1);
    } finally {
        harness.cleanup();
    }
}

{
    const harness = createHarness();
    try {
        assert.throws(
            () => harness.seedPendingRefund("alice", WHIP, 0),
            /invalid pending trade refund/,
            "the durable refund ledger must reject non-positive quantities",
        );
        assert.throws(
            () => harness.seedEscrow("invalid-ledger", "alice", [{ itemId: WHIP, quantity: 0 }]),
            /invalid active trade escrow/,
            "the active escrow ledger must reject non-positive quantities",
        );
    } finally {
        harness.cleanup();
    }
}

console.log("trade dupe safety regression test passed");
