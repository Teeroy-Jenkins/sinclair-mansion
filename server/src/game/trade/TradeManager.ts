import { randomUUID } from "node:crypto";

import { getItemDefinition } from "../../data/items";
import {
    TradeAction,
    TradeActionClientPayload,
    TradeServerPayload,
    TradeStage,
} from "../../network/messages";
import { logger } from "../../utils/logger";
import { INVENTORY_EVENT_FLAGS } from "../../widgets/InterfaceService";
import type { ServerServices } from "../ServerServices";
import { getGamemodeDataDir } from "../gamemodes/GamemodeRegistry";
import { LockState, LockStateChecks } from "../model/LockState";
import { type InventoryEntry, PlayerState } from "../player";
import { buildPlayerSaveKey } from "../state/PlayerSessionKeys";
import { type SqliteDatabase, getSqliteDatabase } from "../state/SqliteDatabase";
import {
    MAX_ITEM_STACK_QUANTITY,
    canInventoryReceiveTradeOffers,
    countFreeInventorySlots,
    formatTradeFreeSlotsMessage,
} from "./TradeInventoryCapacity";

type TradeOfferState = {
    itemId: number;
    quantity: number;
};

type TradePartyState = {
    player: PlayerState;
    accountKey: string;
    offers: TradeOfferState[];
    accepted: boolean;
    confirmAccepted: boolean;
    previousLock: LockState;
    inventorySignature: string;
};

const TradeSessionStatus = {
    Active: "active",
    Closing: "closing",
    Finalizing: "finalizing",
    Closed: "closed",
} as const;
type TradeSessionStatus = (typeof TradeSessionStatus)[keyof typeof TradeSessionStatus];

type TradeSession = {
    id: string;
    parties: [TradePartyState, TradePartyState];
    stage: TradeStage;
    status: TradeSessionStatus;
};

type TradeRequestState = {
    fromId: number;
    toId: number;
    requestedAtMs: number;
};

type TradePersistenceTarget = Pick<TradePartyState, "player" | "accountKey">;

class TradeIntegrityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TradeIntegrityError";
    }
}

const REQUEST_TIMEOUT_MS = 30_000;
const TRADE_CONFIRM_GROUP_ID = 334;
const TRADE_OFFER_GROUP_ID = 335;
const TRADE_INVENTORY_GROUP_ID = 336;
const TRADE_INVENTORY_COMPONENT_UID = TRADE_INVENTORY_GROUP_ID << 16;
const TRADE_SELF_OFFER_COMPONENT_UID = (TRADE_OFFER_GROUP_ID << 16) | 25;
const TRADE_OTHER_OFFER_COMPONENT_UID = (TRADE_OFFER_GROUP_ID << 16) | 28;
const TRADE_EXAMINE_EVENT_FLAGS = 1 << 10;
const TRADE_INVENTORY_INIT_SCRIPT = 3617;

export class TradeManager {
    private readonly requests = new Map<string, TradeRequestState>();
    private readonly sessions = new Map<string, TradeSession>();
    private readonly sessionByPlayer = new Map<number, TradeSession>();
    private readonly database: SqliteDatabase;

    constructor(
        private readonly svc: ServerServices,
        database?: SqliteDatabase,
    ) {
        this.database =
            database ??
            getSqliteDatabase({
                dataDir: getGamemodeDataDir(svc.gamemode.id),
            });
    }

    /**
     * Return durable trade refunds as soon as the player has inventory space.
     * Any remaining entries stay in SQLite and will be retried next login.
     */
    restorePendingRefunds(player: PlayerState): void {
        const accountName = this.getPlayerSaveKey(player);
        if (this.hasLiveSessionForAccount(accountName)) {
            logger.error(
                `[trade] refused escrow recovery for ${accountName}: an in-memory trade is active`,
            );
            return;
        }
        this.recoverActiveEscrows(accountName);
        const refunds = this.database.connection
            .prepare(
                `SELECT id, item_id AS itemId, quantity
                 FROM pending_trade_refunds
                 WHERE account_name = ?
                 ORDER BY id ASC`,
            )
            .all(accountName) as Array<{ id: number; itemId: number; quantity: number }>;
        if (refunds.length === 0) return;

        let returnedCount = 0;
        for (const refund of refunds) {
            if (!this.isValidItemQuantity(refund.itemId, refund.quantity)) {
                logger.error(
                    `[trade] refused invalid pending refund ${refund.id} for ${accountName}`,
                );
                continue;
            }
            const inventory = this.snapshotInventory(player);
            if (!this.addItemsToInventory(player, refund.itemId, refund.quantity)) {
                // Keep the durable refund untouched if an inventory implementation
                // inserts only part of a request before reporting failure.
                this.restoreInventory(player, inventory);
                continue;
            }
            try {
                this.persistTradeMutation([{ player, accountKey: accountName }], () => {
                    const result = this.database.connection
                        .prepare(
                            `DELETE FROM pending_trade_refunds
                             WHERE id = ? AND account_name = ? AND item_id = ? AND quantity = ?`,
                        )
                        .run(refund.id, accountName, refund.itemId, refund.quantity);
                    if (Number(result.changes) !== 1) {
                        throw new TradeIntegrityError(
                            `pending refund ${refund.id} changed before it was restored`,
                        );
                    }
                });
                returnedCount++;
            } catch (err) {
                this.restoreInventory(player, inventory);
                logger.error("[trade] failed to persist restored trade refund", err);
            }
        }

        if (returnedCount > 0) {
            this.queueInventorySnapshot(player);
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                `Returned ${returnedCount} pending trade item stack${returnedCount === 1 ? "" : "s"}.`,
            );
        }
        if (returnedCount < refunds.length) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "Some returned trade items are still waiting for inventory space.",
            );
        }
    }

    private queueInventorySnapshot(player: PlayerState): void {
        const sock = this.svc.players?.getSocketByPlayerId(player.id);
        if (sock) this.svc.inventoryService.sendInventorySnapshot(sock, player);
    }

    private openTradeOfferWidgets(player: PlayerState): void {
        const interfaceService = this.svc.interfaceService;
        if (!interfaceService) {
            throw new Error("InterfaceService is unavailable");
        }

        interfaceService.openModal(player, TRADE_OFFER_GROUP_ID);
        interfaceService.openInventorySidePanel(player, {
            interfaceId: TRADE_INVENTORY_GROUP_ID,
            initScript: {
                scriptId: TRADE_INVENTORY_INIT_SCRIPT,
                args: [TRADE_INVENTORY_COMPONENT_UID],
            },
            setFlags: {
                uid: TRADE_INVENTORY_COMPONENT_UID,
                fromSlot: 0,
                toSlot: 27,
                flags: INVENTORY_EVENT_FLAGS,
            },
        });
        this.svc.queueWidgetEvent(player.id, {
            action: "set_flags_range",
            uid: TRADE_SELF_OFFER_COMPONENT_UID,
            fromSlot: 0,
            toSlot: 27,
            flags: INVENTORY_EVENT_FLAGS,
        });
        this.svc.queueWidgetEvent(player.id, {
            action: "set_flags_range",
            uid: TRADE_OTHER_OFFER_COMPONENT_UID,
            fromSlot: 0,
            toSlot: 27,
            flags: TRADE_EXAMINE_EVENT_FLAGS,
        });
    }

    private openTradeConfirmWidget(player: PlayerState): void {
        const interfaceService = this.svc.interfaceService;
        if (!interfaceService) {
            throw new Error("InterfaceService is unavailable");
        }

        interfaceService.restoreNormalInventory(player);
        interfaceService.openModal(player, TRADE_CONFIRM_GROUP_ID);
    }

    private closeTradeWidgets(player: PlayerState): void {
        const interfaceService = this.svc.interfaceService;
        const currentModal = interfaceService?.getCurrentModal(player);
        if (
            interfaceService &&
            (currentModal === TRADE_OFFER_GROUP_ID || currentModal === TRADE_CONFIRM_GROUP_ID)
        ) {
            interfaceService.closeModal(player);
        } else {
            player.widgets.close(TRADE_OFFER_GROUP_ID);
            player.widgets.close(TRADE_CONFIRM_GROUP_ID);
        }

        if (player.widgets.isOpen(TRADE_INVENTORY_GROUP_ID)) {
            if (interfaceService) interfaceService.restoreNormalInventory(player);
            else player.widgets.close(TRADE_INVENTORY_GROUP_ID);
        }
    }

    requestTrade(initiator: PlayerState, target: PlayerState, currentTick: number): void {
        if (initiator.id === target.id) return;
        if (this.getPlayerSaveKey(initiator) === this.getPlayerSaveKey(target)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                "You can't trade with yourself.",
            );
            return;
        }
        if (this.sessionByPlayer.has(initiator.id)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                "You are already in a trade.",
            );
            return;
        }
        if (!LockStateChecks.canPlayerInteract(initiator.lock)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                "You can't do that right now.",
            );
            return;
        }
        if (this.sessionByPlayer.has(target.id)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                "Other player is busy at the moment.",
            );
            return;
        }
        if (!LockStateChecks.canPlayerInteract(target.lock) || target.widgets.hasModalOpen()) {
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                "Other player is busy at the moment.",
            );
            return;
        }
        if (
            initiator.level !== target.level ||
            Math.max(
                Math.abs(initiator.tileX - target.tileX),
                Math.abs(initiator.tileY - target.tileY),
            ) > 1
        ) {
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                "You can't reach that player.",
            );
            return;
        }
        const reverseKey = this.buildRequestKey(target.id, initiator.id);
        const key = this.buildRequestKey(initiator.id, target.id);
        const reverse = this.requests.get(reverseKey);
        const pendingAtMs = initiator.pendingTradeRequests.get(target.id);
        if (pendingAtMs !== undefined && Date.now() - pendingAtMs > REQUEST_TIMEOUT_MS) {
            initiator.pendingTradeRequests.delete(target.id);
            this.requests.delete(reverseKey);
            this.svc.messagingService.sendGameMessageToPlayer(
                initiator,
                "Other player's trade request has expired.",
            );
            return;
        }
        if (reverse && pendingAtMs !== undefined) {
            this.requests.delete(reverseKey);
            this.requests.delete(key);
            initiator.pendingTradeRequests.delete(target.id);
            this.startSession(initiator, target);
            return;
        }
        if (reverse) this.requests.delete(reverseKey);
        this.requests.set(key, {
            fromId: initiator.id,
            toId: target.id,
            requestedAtMs: Date.now(),
        });
        const name = this.resolveName(initiator);
        this.svc.messagingService.sendGameMessageToPlayer(initiator, "Sending trade offer...");
        this.svc.messagingService.sendTradeRequestToPlayer(target, initiator, name);
        this.svc.broadcastService.queueTradeMessage(target.id, {
            kind: "request",
            fromId: initiator.id,
            fromName: name,
        });
    }

    handlePlayerLogout(
        player: PlayerState,
        reason: string = "Other player declined the trade.",
    ): void {
        this.clearRequestsFor(player.id);
        const session = this.getActiveSession(player);
        if (!session) return;
        const other = this.getCounterparty(session, player.id);
        const closed = this.closeSession(session, reason);
        if (closed && other) {
            this.svc.messagingService.sendGameMessageToPlayer(other.player, reason);
        }
    }

    tick(currentTick: number): void {
        for (const [key, req] of Array.from(this.requests.entries())) {
            if (Date.now() - req.requestedAtMs > REQUEST_TIMEOUT_MS) {
                this.requests.delete(key);
                const fromPlayer = this.svc.players?.getById(req.fromId);
                if (fromPlayer) {
                    this.svc.messagingService.sendGameMessageToPlayer(
                        fromPlayer,
                        "Your trade offer has expired.",
                    );
                }
            }
        }

        for (const session of Array.from(this.sessions.values())) {
            if (session.status !== TradeSessionStatus.Active) continue;
            const expectedModal =
                session.stage === TradeStage.Offer ? TRADE_OFFER_GROUP_ID : TRADE_CONFIRM_GROUP_ID;
            const interrupted = session.parties.find(
                (party) =>
                    party.player.lock !== LockState.FULL_WITH_ITEM_INTERACTION ||
                    !party.player.widgets.isOpen(expectedModal) ||
                    (session.stage === TradeStage.Offer &&
                        !party.player.widgets.isOpen(TRADE_INVENTORY_GROUP_ID)) ||
                    party.inventorySignature !== this.getInventorySignature(party.player),
            );
            const [a, b] = session.parties;
            const separated =
                a.player.level !== b.player.level ||
                Math.max(
                    Math.abs(a.player.tileX - b.player.tileX),
                    Math.abs(a.player.tileY - b.player.tileY),
                ) > 1;
            if (!interrupted && !separated) continue;

            const interruptedId = interrupted?.player.id;
            const closed = this.closeSession(session, (party) =>
                interruptedId === undefined || party.player.id === interruptedId
                    ? "Trade declined."
                    : "Other player declined trade.",
            );
            if (closed) {
                for (const party of session.parties) {
                    this.svc.messagingService.sendGameMessageToPlayer(
                        party.player,
                        interruptedId === undefined || party.player.id === interruptedId
                            ? "Trade declined."
                            : "Other player declined trade.",
                    );
                }
            }
        }
    }

    handleAction(player: PlayerState, action: TradeActionClientPayload, currentTick: number): void {
        const session = this.getActiveSession(player);
        if (!session) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "You're not currently trading.",
            );
            return;
        }
        const changedParty = session.parties.find(
            (party) => party.inventorySignature !== this.getInventorySignature(party.player),
        );
        if (changedParty) {
            this.closeSession(session, (party) =>
                party === changedParty
                    ? "Trade declined because your inventory changed."
                    : "Other player declined trade.",
            );
            return;
        }
        switch (action.action) {
            case TradeAction.Offer:
                this.handleOfferAction(
                    session,
                    player,
                    action.slot,
                    action.quantity,
                    action.itemId,
                );
                break;
            case TradeAction.Remove:
                this.handleRemoveAction(session, player, action.slot, action.quantity);
                break;
            case TradeAction.Accept:
                this.handleAccept(session, player);
                break;
            case TradeAction.Decline:
                this.declineSession(session, player);
                break;
            case TradeAction.ConfirmAccept:
                this.handleConfirmAccept(session, player);
                break;
            case TradeAction.ConfirmDecline:
                this.declineSession(session, player);
                break;
        }
    }

    handleWidgetClosed(player: PlayerState, groupId: number): boolean {
        if (
            groupId !== TRADE_OFFER_GROUP_ID &&
            groupId !== TRADE_CONFIRM_GROUP_ID &&
            groupId !== TRADE_INVENTORY_GROUP_ID
        ) {
            return false;
        }
        const session = this.getActiveSession(player);
        if (!session) return false;
        this.declineSession(session, player);
        return true;
    }

    isPlayerTrading(player: PlayerState): boolean {
        const session = this.sessionByPlayer.get(player.id);
        if (!session || session.status !== TradeSessionStatus.Active) return false;
        return session.parties.some((party) => party.player === player);
    }

    private buildRequestKey(fromId: number, toId: number): string {
        return `${fromId}->${toId}`;
    }

    private clearRequestsFor(playerId: number): void {
        for (const [key, req] of Array.from(this.requests.entries())) {
            if (req.fromId === playerId || req.toId === playerId) {
                this.requests.delete(key);
                const recipient = this.svc.players?.getById(req.toId);
                recipient?.pendingTradeRequests.delete(req.fromId);
            }
        }
    }

    private getActiveSession(player: PlayerState): TradeSession | undefined {
        const session = this.sessionByPlayer.get(player.id);
        if (
            !session ||
            session.status !== TradeSessionStatus.Active ||
            !session.parties.some((party) => party.player === player)
        ) {
            return undefined;
        }
        return session;
    }

    private hasLiveSessionForAccount(accountKey: string): boolean {
        for (const session of this.sessions.values()) {
            if (
                session.status !== TradeSessionStatus.Closed &&
                session.parties.some((party) => party.accountKey === accountKey)
            ) {
                return true;
            }
        }
        return false;
    }

    private getInventorySignature(player: PlayerState): string {
        return this.svc.inventoryService
            .getInventory(player)
            .filter((entry) => entry && (entry.itemId > 0 || entry.quantity > 0))
            .map((entry) => `${String(entry.itemId)}:${String(entry.quantity)}`)
            .sort()
            .join("|");
    }

    private refreshInventorySignature(party: TradePartyState): void {
        party.inventorySignature = this.getInventorySignature(party.player);
    }

    private startSession(a: PlayerState, b: PlayerState): void {
        this.clearRequestsFor(a.id);
        this.clearRequestsFor(b.id);
        const aParty = this.createParty(a);
        const bParty = this.createParty(b);
        if (aParty.accountKey === bParty.accountKey) {
            this.svc.messagingService.sendGameMessageToPlayer(a, "You can't trade with yourself.");
            return;
        }
        if (
            this.hasLiveSessionForAccount(aParty.accountKey) ||
            this.hasLiveSessionForAccount(bParty.accountKey)
        ) {
            this.svc.messagingService.sendGameMessageToPlayer(
                a,
                "One of the players is already in a trade.",
            );
            return;
        }
        const session: TradeSession = {
            // Escrows can survive a restart. A random ID prevents a new trade
            // from reusing an old session's durable escrow row after player
            // IDs and in-memory counters are reset.
            id: `trade:${randomUUID()}`,
            parties: [aParty, bParty],
            stage: TradeStage.Offer,
            status: TradeSessionStatus.Active,
        };
        this.sessions.set(session.id, session);
        this.sessionByPlayer.set(a.id, session);
        this.sessionByPlayer.set(b.id, session);
        try {
            for (const party of session.parties) {
                this.preparePlayerForTrade(party);
            }
            this.openTradeOfferWidgets(a);
            this.openTradeOfferWidgets(b);
            this.broadcastSession(session, "open");
        } catch (err) {
            logger.warn("[trade] failed to open trade widgets", err);
            this.finishSession(session, "The trade could not be opened. Please try again.");
            return;
        }
    }

    private closeSession(
        session: TradeSession,
        reason: string | ((party: TradePartyState) => string),
    ): boolean {
        if (session.status !== TradeSessionStatus.Active) return false;
        session.status = TradeSessionStatus.Closing;

        const inventorySnapshots = session.parties.map((party) =>
            this.snapshotInventory(party.player),
        );
        const offerSnapshots = session.parties.map((party) =>
            party.offers.map((offer) => ({ ...offer })),
        );
        const deferredParties = new Set<TradePartyState>();
        try {
            for (const party of session.parties) {
                if (this.returnOffers(party)) continue;
                deferredParties.add(party);
            }
        } catch (err) {
            for (const [index, party] of session.parties.entries()) {
                this.restoreInventory(party.player, inventorySnapshots[index]);
                party.offers = offerSnapshots[index];
                this.refreshInventorySignature(party);
            }
            session.status = TradeSessionStatus.Active;
            logger.error("[trade] failed to return items while cancelling trade", err);
            this.broadcastSession(session);
            return false;
        }
        try {
            this.persistTradeMutation(session.parties, () => {
                for (const [index, party] of session.parties.entries()) {
                    const originalOffers = offerSnapshots[index];
                    this.assertPartyEscrowMatchesOffers(session, party, originalOffers);
                    if (deferredParties.has(party)) {
                        this.storePendingRefunds(party.accountKey, originalOffers);
                    }
                    this.deleteActiveEscrow(session, party);
                }
            });
        } catch (err) {
            for (const [index, party] of session.parties.entries()) {
                this.restoreInventory(party.player, inventorySnapshots[index]);
                party.offers = offerSnapshots[index];
                this.refreshInventorySignature(party);
            }
            if (err instanceof TradeIntegrityError) {
                return this.quarantineCorruptSession(session, "cancel trade", err, reason);
            }
            session.status = TradeSessionStatus.Active;
            logger.error("[trade] failed to persist trade cancellation", err);
            this.broadcastSession(session);
            return false;
        }
        for (const party of deferredParties) {
            party.offers = [];
            try {
                this.svc.messagingService.sendGameMessageToPlayer(
                    party.player,
                    "Your offered trade items are waiting safely until you have inventory space.",
                );
            } catch (err) {
                logger.warn("[trade] failed to send deferred refund message", err);
            }
        }
        this.finishSession(session, reason);
        return true;
    }

    private finishSession(
        session: TradeSession,
        reason: string | ((party: TradePartyState) => string),
    ): void {
        if (session.status === TradeSessionStatus.Closed) return;
        session.status = TradeSessionStatus.Closed;
        if (this.sessions.get(session.id) === session) {
            this.sessions.delete(session.id);
        }
        for (const party of session.parties) {
            if (this.sessionByPlayer.get(party.player.id) === session) {
                this.sessionByPlayer.delete(party.player.id);
            }
        }

        for (const party of session.parties) {
            party.offers = [];
            try {
                this.closeTradeWidgets(party.player);
            } catch (err) {
                logger.warn("[trade] failed to close trade widgets", err);
            }
            this.restorePlayerAfterTrade(party);
            try {
                this.queueInventorySnapshot(party.player);
            } catch (err) {
                logger.warn("[trade] failed to send final inventory snapshot", err);
            }
            let partyReason = "Trade closed.";
            try {
                partyReason = typeof reason === "function" ? reason(party) : reason;
            } catch (err) {
                logger.warn("[trade] failed to resolve trade close reason", err);
            }
            try {
                this.svc.broadcastService.queueTradeMessage(party.player.id, {
                    kind: "close",
                    reason: partyReason,
                });
            } catch (err) {
                logger.warn("[trade] failed to send trade close message", err);
            }
        }
    }

    private quarantineCorruptSession(
        session: TradeSession,
        operation: string,
        integrityError: TradeIntegrityError,
        reason:
            | string
            | ((
                  party: TradePartyState,
              ) => string) = "Trade stopped because its item record was inconsistent.",
    ): boolean {
        logger.error(
            `[trade] integrity check failed while attempting to ${operation} for ${session.id}`,
            integrityError,
        );
        try {
            this.persistTradeMutation(session.parties, () => {
                for (const party of session.parties) {
                    this.moveActiveEscrowToPending(session, party);
                }
            });
        } catch (err) {
            session.status = TradeSessionStatus.Active;
            logger.error(`[trade] failed to quarantine corrupt trade ${session.id}`, err);
            for (const party of session.parties) {
                this.svc.messagingService.sendGameMessageToPlayer(
                    party.player,
                    "The trade is temporarily locked while its items are recovered. Please try again.",
                );
            }
            this.broadcastSession(session);
            return false;
        }

        this.finishSession(session, reason);
        for (const party of session.parties) {
            try {
                this.restorePendingRefunds(party.player);
            } catch (err) {
                logger.error(
                    `[trade] failed to immediately restore quarantined items for ${party.accountKey}`,
                    err,
                );
            }
        }
        return true;
    }

    private createParty(player: PlayerState): TradePartyState {
        return {
            player,
            accountKey: this.getPlayerSaveKey(player),
            offers: [],
            accepted: false,
            confirmAccepted: false,
            previousLock: player.lock,
            inventorySignature: this.getInventorySignature(player),
        };
    }

    private preparePlayerForTrade(party: TradePartyState): void {
        const player = party.player;
        party.previousLock = player.lock;
        player.interruptWeakQueues();
        this.svc.actionScheduler.cancelInterruptibleActions(player.id);
        this.svc.actionScheduler.cancelActions(
            player.id,
            (action) => action.kind.startsWith("inventory.") || action.groups.includes("inventory"),
        );
        const sock = this.svc.players?.getSocketByPlayerId(player.id);
        if (sock) {
            this.svc.players?.clearAllInteractions(sock);
            this.svc.movementService.getPendingWalkCommands().delete(sock);
        }
        player.clearPath();
        player.clearWalkDestination();
        player.clearInteraction();
        player.lock = LockState.FULL_WITH_ITEM_INTERACTION;
        this.refreshInventorySignature(party);
    }

    private restorePlayerAfterTrade(party: TradePartyState): void {
        if (party.player.lock === LockState.FULL_WITH_ITEM_INTERACTION) {
            party.player.lock = party.previousLock;
        }
    }

    private declineSession(session: TradeSession, player: PlayerState): void {
        const other = this.getCounterparty(session, player.id);
        const closed = this.closeSession(session, (party) =>
            party.player.id === player.id
                ? "You decline the trade."
                : "Other player declined trade.",
        );
        if (closed && other) {
            this.svc.messagingService.sendGameMessageToPlayer(
                other.player,
                "Other player declined trade.",
            );
        }
    }

    private getParty(session: TradeSession, playerId: number): TradePartyState | undefined {
        return session.parties.find((party) => party.player.id === playerId);
    }

    private getCounterparty(session: TradeSession, playerId: number): TradePartyState | undefined {
        return session.parties.find((party) => party.player.id !== playerId);
    }

    private resolveName(player: PlayerState): string {
        if (player.name && player.name.length > 0) return player.name;
        return `Player ${player.id}`;
    }

    private ensureTradeable(player: PlayerState, itemId: number): boolean {
        const def = getItemDefinition(itemId);
        if (def?.tradeable) return true;
        this.svc.messagingService.sendGameMessageToPlayer(player, "That item isn't tradeable.");
        return false;
    }

    private handleOfferAction(
        session: TradeSession,
        player: PlayerState,
        slotIndex: number,
        requestedQty: number,
        itemIdHint?: number,
    ): void {
        const party = this.getParty(session, player.id);
        if (!party) return;
        if (session.status !== TradeSessionStatus.Active || session.stage !== TradeStage.Offer) {
            return;
        }
        const inventory = this.svc.inventoryService.getInventory(player);
        if (
            !Number.isSafeInteger(slotIndex) ||
            slotIndex < 0 ||
            slotIndex >= inventory.length ||
            !Number.isSafeInteger(requestedQty) ||
            requestedQty <= 0 ||
            requestedQty > MAX_ITEM_STACK_QUANTITY
        ) {
            return;
        }
        const slot = slotIndex;
        const entry = inventory[slot];
        if (!entry || !this.isValidItemQuantity(entry.itemId, entry.quantity)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "That item is no longer in your inventory.",
            );
            return;
        }
        if (itemIdHint !== undefined && itemIdHint !== entry.itemId) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "That item is no longer in your inventory.",
            );
            return;
        }
        if (!this.ensureTradeable(player, entry.itemId)) return;
        const desired = requestedQty;
        let available = 0;
        for (const inventoryEntry of inventory) {
            if (
                inventoryEntry.itemId !== entry.itemId ||
                !this.isValidItemQuantity(inventoryEntry.itemId, inventoryEntry.quantity)
            ) {
                continue;
            }
            available = Math.min(desired, available + inventoryEntry.quantity);
            if (available === desired) break;
        }
        const amount = Math.min(available, desired);
        if (!(amount > 0)) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "You don't have enough of that item.",
            );
            return;
        }
        const existingOffer = party.offers.find((offer) => offer.itemId === entry.itemId);
        if (existingOffer && existingOffer.quantity > MAX_ITEM_STACK_QUANTITY - amount) {
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "You can't offer that many items.",
            );
            return;
        }
        const inventorySnapshot = this.snapshotInventory(player);
        const offerSnapshot = party.offers.map((offer) => ({ ...offer }));
        if (!this.removeItemQuantityFromInventory(player, entry.itemId, slot, amount)) {
            this.restoreInventory(player, inventorySnapshot);
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "You don't have enough of that item.",
            );
            return;
        }
        this.addOffer(party, entry.itemId, amount);
        try {
            this.persistTradeMutation([party], () => {
                this.assertPartyEscrowMatchesOffers(session, party, offerSnapshot);
                this.replacePartyEscrow(session, party, party.offers);
            });
        } catch (err) {
            this.restoreInventory(player, inventorySnapshot);
            party.offers = offerSnapshot;
            this.refreshInventorySignature(party);
            if (err instanceof TradeIntegrityError) {
                this.quarantineCorruptSession(session, "offer an item", err);
                return;
            }
            logger.error("[trade] failed to persist offered item escrow", err);
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "Your item could not be offered. Please try again.",
            );
            return;
        }
        this.refreshInventorySignature(party);
        this.resetAcceptances(session);
        this.queueInventorySnapshot(player);
        this.broadcastSession(session);
    }

    private handleRemoveAction(
        session: TradeSession,
        player: PlayerState,
        offerSlot: number,
        quantity: number,
    ): void {
        const party = this.getParty(session, player.id);
        if (!party) return;
        if (session.status !== TradeSessionStatus.Active || session.stage !== TradeStage.Offer) {
            return;
        }
        if (
            party.offers.length === 0 ||
            !Number.isSafeInteger(offerSlot) ||
            offerSlot < 0 ||
            offerSlot >= party.offers.length ||
            !Number.isSafeInteger(quantity) ||
            quantity <= 0 ||
            quantity > MAX_ITEM_STACK_QUANTITY
        ) {
            return;
        }
        const idx = offerSlot;
        const offer = party.offers[idx];
        if (!offer || !this.isValidItemQuantity(offer.itemId, offer.quantity)) return;
        const amount = Math.min(offer.quantity, quantity);
        if (!(amount > 0)) return;
        const inventorySnapshot = this.snapshotInventory(player);
        const offerSnapshot = party.offers.map((entry) => ({ ...entry }));
        if (!this.addItemsToInventory(party.player, offer.itemId, amount)) {
            this.restoreInventory(player, inventorySnapshot);
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "You don't have enough space in your inventory.",
            );
            return;
        }
        offer.quantity -= amount;
        if (offer.quantity <= 0) {
            party.offers.splice(idx, 1);
        }
        try {
            this.persistTradeMutation([party], () => {
                this.assertPartyEscrowMatchesOffers(session, party, offerSnapshot);
                this.replacePartyEscrow(session, party, party.offers);
            });
        } catch (err) {
            this.restoreInventory(player, inventorySnapshot);
            party.offers = offerSnapshot;
            this.refreshInventorySignature(party);
            if (err instanceof TradeIntegrityError) {
                this.quarantineCorruptSession(session, "remove an offered item", err);
                return;
            }
            logger.error("[trade] failed to persist removed trade offer", err);
            this.svc.messagingService.sendGameMessageToPlayer(
                player,
                "Your trade offer could not be changed. Please try again.",
            );
            return;
        }
        this.refreshInventorySignature(party);
        this.queueInventorySnapshot(player);
        this.resetAcceptances(session);
        this.broadcastSession(session);
    }

    private handleAccept(session: TradeSession, player: PlayerState): void {
        if (session.status !== TradeSessionStatus.Active || session.stage !== TradeStage.Offer) {
            return;
        }
        const party = this.getParty(session, player.id);
        if (!party) return;
        party.accepted = true;
        const other = this.getCounterparty(session, player.id);
        if (session.stage === TradeStage.Offer && other?.accepted) {
            if (!this.validateTradeCapacity(session)) {
                this.resetAcceptances(session);
                this.broadcastSession(session);
                return;
            }
            session.stage = TradeStage.Confirm;
            party.confirmAccepted = false;
            if (other) other.confirmAccepted = false;
            try {
                for (const tradeParty of session.parties) {
                    this.openTradeConfirmWidget(tradeParty.player);
                }
            } catch (err) {
                logger.warn("[trade] failed to open confirmation widgets", err);
                this.closeSession(session, "The trade could not continue.");
                return;
            }
        }
        this.broadcastSession(session);
    }

    private handleConfirmAccept(session: TradeSession, player: PlayerState): void {
        if (session.status !== TradeSessionStatus.Active || session.stage !== TradeStage.Confirm) {
            return;
        }
        const party = this.getParty(session, player.id);
        if (!party) return;
        party.confirmAccepted = true;
        const other = this.getCounterparty(session, player.id);
        if (party.confirmAccepted && other?.confirmAccepted) {
            this.finalizeTrade(session);
            return;
        }
        this.broadcastSession(session);
    }

    private finalizeTrade(session: TradeSession): void {
        if (session.status !== TradeSessionStatus.Active) return;
        session.status = TradeSessionStatus.Finalizing;
        try {
            for (const party of session.parties) {
                this.normalizeOfferLedger(party.offers);
            }
        } catch (err) {
            if (err instanceof TradeIntegrityError) {
                this.quarantineCorruptSession(session, "validate trade", err);
                return;
            }
            session.status = TradeSessionStatus.Active;
            throw err;
        }
        if (!this.validateTradeCapacity(session)) {
            session.status = TradeSessionStatus.Active;
            this.returnToOfferStage(session);
            return;
        }

        const [a, b] = session.parties;
        const aInventory = this.snapshotInventory(a.player);
        const bInventory = this.snapshotInventory(b.player);
        const aOffers = a.offers.map((offer) => ({ ...offer }));
        const bOffers = b.offers.map((offer) => ({ ...offer }));
        if (!this.transferOffers(a, b) || !this.transferOffers(b, a)) {
            this.restoreInventory(a.player, aInventory);
            this.restoreInventory(b.player, bInventory);
            a.offers = aOffers;
            b.offers = bOffers;
            this.refreshInventorySignature(a);
            this.refreshInventorySignature(b);
            session.status = TradeSessionStatus.Active;
            logger.error("[trade] failed to transfer offers after capacity preflight");
            this.returnToOfferStage(session);
            return;
        }
        try {
            this.persistTradeMutation(session.parties, () => {
                this.assertPartyEscrowMatchesOffers(session, a, aOffers);
                this.assertPartyEscrowMatchesOffers(session, b, bOffers);
                this.deleteActiveEscrow(session, a);
                this.deleteActiveEscrow(session, b);
            });
        } catch (err) {
            this.restoreInventory(a.player, aInventory);
            this.restoreInventory(b.player, bInventory);
            a.offers = aOffers;
            b.offers = bOffers;
            this.refreshInventorySignature(a);
            this.refreshInventorySignature(b);
            if (err instanceof TradeIntegrityError) {
                this.quarantineCorruptSession(session, "complete trade", err);
                return;
            }
            session.status = TradeSessionStatus.Active;
            logger.error("[trade] failed to persist completed trade", err);
            this.returnToOfferStage(session);
            return;
        }
        a.offers = [];
        b.offers = [];
        this.refreshInventorySignature(a);
        this.refreshInventorySignature(b);
        this.finishSession(session, "Accepted trade.");
        for (const party of session.parties) {
            try {
                this.svc.messagingService.sendGameMessageToPlayer(party.player, "Accepted trade.");
            } catch (err) {
                logger.warn("[trade] failed to send accepted-trade message", err);
            }
        }
    }

    private returnToOfferStage(session: TradeSession): void {
        if (session.status !== TradeSessionStatus.Active) return;
        session.stage = TradeStage.Offer;
        this.resetAcceptances(session);
        try {
            for (const party of session.parties) {
                this.openTradeOfferWidgets(party.player);
            }
        } catch (err) {
            logger.warn("[trade] failed to restore offer widgets", err);
            this.closeSession(session, "The trade could not continue.");
            return;
        }
        this.broadcastSession(session);
    }

    private transferOffers(from: TradePartyState, to: TradePartyState): boolean {
        for (const offer of from.offers) {
            if (!this.addItemsToInventory(to.player, offer.itemId, offer.quantity)) {
                return false;
            }
        }
        return true;
    }

    private removeFromInventorySlot(
        player: PlayerState,
        slot: number,
        entry: InventoryEntry,
        amount: number,
    ): void {
        const remaining = entry.quantity - amount;
        if (remaining > 0) {
            this.svc.inventoryService.setInventorySlot(player, slot, entry.itemId, remaining);
        } else {
            this.svc.inventoryService.setInventorySlot(player, slot, -1, 0);
        }
    }

    private removeItemQuantityFromInventory(
        player: PlayerState,
        itemId: number,
        preferredSlot: number,
        quantity: number,
    ): boolean {
        let remaining = quantity;
        const inventory = this.svc.inventoryService.getInventory(player);
        const slots = [
            preferredSlot,
            ...inventory.map((_, index) => index).filter((index) => index !== preferredSlot),
        ];
        for (const slot of slots) {
            if (remaining <= 0) break;
            const entry = inventory[slot];
            if (
                !entry ||
                entry.itemId !== itemId ||
                !this.isValidItemQuantity(entry.itemId, entry.quantity)
            ) {
                continue;
            }
            const amount = Math.min(remaining, entry.quantity);
            this.removeFromInventorySlot(player, slot, entry, amount);
            remaining -= amount;
        }
        return remaining === 0;
    }

    private addOffer(party: TradePartyState, itemId: number, amount: number): void {
        const existing = party.offers.find((offer) => offer.itemId === itemId);
        if (existing) existing.quantity += amount;
        else party.offers.push({ itemId, quantity: amount });
    }

    private addItemsToInventory(player: PlayerState, itemId: number, quantity: number): boolean {
        return (
            this.svc.inventoryService.addItemToInventory(player, itemId, quantity).added ===
            quantity
        );
    }

    private returnOffers(party: TradePartyState): boolean {
        const offers = this.normalizeOfferLedger(party.offers);
        if (offers.size === 0) return true;
        const inventory = this.snapshotInventory(party.player);
        for (const [itemId, quantity] of offers) {
            if (!this.addItemsToInventory(party.player, itemId, quantity)) {
                this.restoreInventory(party.player, inventory);
                return false;
            }
        }
        party.offers = [];
        return true;
    }

    private persistTradeMutation(
        targets: readonly TradePersistenceTarget[],
        mutation: () => void,
    ): void {
        this.database.connection.exec("BEGIN IMMEDIATE");
        try {
            const uniqueTargets = new Map<string, PlayerState>();
            for (const target of targets) {
                if (this.getPlayerSaveKey(target.player) !== target.accountKey) {
                    throw new TradeIntegrityError(
                        `player identity changed during trade for ${target.accountKey}`,
                    );
                }
                const existing = uniqueTargets.get(target.accountKey);
                if (existing && existing !== target.player) {
                    throw new TradeIntegrityError(
                        `multiple live players share trade account ${target.accountKey}`,
                    );
                }
                uniqueTargets.set(target.accountKey, target.player);
            }

            mutation();
            const upsertPlayerState = this.database.connection.prepare(
                `INSERT INTO player_states (account_name, state_json, updated_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(account_name) DO UPDATE SET
                    state_json = excluded.state_json,
                    updated_at = excluded.updated_at`,
            );
            const updatedAt = new Date().toISOString();
            for (const [accountName, player] of uniqueTargets) {
                upsertPlayerState.run(
                    accountName,
                    JSON.stringify(player.exportPersistentVars()),
                    updatedAt,
                );
            }
            this.database.connection.exec("COMMIT");
        } catch (err) {
            try {
                this.database.connection.exec("ROLLBACK");
            } catch {
                // Preserve the original storage error for diagnostics.
            }
            throw err;
        }
    }

    private isValidItemQuantity(itemId: number, quantity: number): boolean {
        return (
            Number.isSafeInteger(itemId) &&
            itemId > 0 &&
            Number.isSafeInteger(quantity) &&
            quantity > 0 &&
            quantity <= MAX_ITEM_STACK_QUANTITY
        );
    }

    private normalizeOfferLedger(offers: readonly TradeOfferState[]): Map<number, number> {
        const normalized = new Map<number, number>();
        for (const offer of offers) {
            if (!this.isValidItemQuantity(offer.itemId, offer.quantity)) {
                throw new TradeIntegrityError("trade contains an invalid item quantity");
            }
            const previous = normalized.get(offer.itemId) ?? 0;
            if (previous > MAX_ITEM_STACK_QUANTITY - offer.quantity) {
                throw new TradeIntegrityError("trade item quantity exceeds the stack limit");
            }
            normalized.set(offer.itemId, previous + offer.quantity);
        }
        return normalized;
    }

    private assertPartyEscrowMatchesOffers(
        session: TradeSession,
        party: TradePartyState,
        offers: readonly TradeOfferState[],
    ): void {
        const expected = this.normalizeOfferLedger(offers);
        const rows = this.database.connection
            .prepare(
                `SELECT item_id AS itemId, quantity
                 FROM active_trade_escrows
                 WHERE session_id = ? AND account_name = ?`,
            )
            .all(session.id, party.accountKey) as Array<{ itemId: number; quantity: number }>;
        const actual = new Map<number, number>();
        for (const row of rows) {
            if (!this.isValidItemQuantity(row.itemId, row.quantity) || actual.has(row.itemId)) {
                throw new TradeIntegrityError(
                    `escrow contains invalid rows for ${party.accountKey}`,
                );
            }
            actual.set(row.itemId, row.quantity);
        }
        if (actual.size !== expected.size) {
            throw new TradeIntegrityError(`escrow stack count changed for ${party.accountKey}`);
        }
        for (const [itemId, quantity] of expected) {
            if (actual.get(itemId) !== quantity) {
                throw new TradeIntegrityError(`escrow quantity changed for ${party.accountKey}`);
            }
        }
    }

    private replacePartyEscrow(
        session: TradeSession,
        party: TradePartyState,
        offers: readonly TradeOfferState[],
    ): void {
        const normalized = this.normalizeOfferLedger(offers);
        this.database.connection
            .prepare("DELETE FROM active_trade_escrows WHERE session_id = ? AND account_name = ?")
            .run(session.id, party.accountKey);
        const insert = this.database.connection.prepare(
            `INSERT INTO active_trade_escrows (
                session_id,
                account_name,
                item_id,
                quantity,
                created_at
            ) VALUES (?, ?, ?, ?, ?)`,
        );
        const createdAt = new Date().toISOString();
        for (const [itemId, quantity] of normalized) {
            insert.run(session.id, party.accountKey, itemId, quantity, createdAt);
        }
    }

    private deleteActiveEscrow(session: TradeSession, party: TradePartyState): void {
        this.database.connection
            .prepare("DELETE FROM active_trade_escrows WHERE session_id = ? AND account_name = ?")
            .run(session.id, party.accountKey);
    }

    private storePendingRefunds(accountKey: string, offers: readonly TradeOfferState[]): void {
        const insertRefund = this.database.connection.prepare(
            `INSERT INTO pending_trade_refunds (account_name, item_id, quantity, created_at)
             VALUES (?, ?, ?, ?)`,
        );
        const createdAt = new Date().toISOString();
        for (const [itemId, quantity] of this.normalizeOfferLedger(offers)) {
            insertRefund.run(accountKey, itemId, quantity, createdAt);
        }
    }

    private moveActiveEscrowToPending(session: TradeSession, party: TradePartyState): void {
        this.database.connection
            .prepare(
                `INSERT INTO pending_trade_refunds (account_name, item_id, quantity, created_at)
                 SELECT account_name, item_id, quantity, ?
                 FROM active_trade_escrows
                 WHERE session_id = ? AND account_name = ?`,
            )
            .run(new Date().toISOString(), session.id, party.accountKey);
        this.deleteActiveEscrow(session, party);
    }

    private recoverActiveEscrows(accountName: string): void {
        this.database.connection.exec("BEGIN IMMEDIATE");
        try {
            this.database.connection
                .prepare(
                    `INSERT INTO pending_trade_refunds (account_name, item_id, quantity, created_at)
                     SELECT account_name, item_id, quantity, ?
                     FROM active_trade_escrows
                     WHERE account_name = ?`,
                )
                .run(new Date().toISOString(), accountName);
            this.database.connection
                .prepare("DELETE FROM active_trade_escrows WHERE account_name = ?")
                .run(accountName);
            this.database.connection.exec("COMMIT");
        } catch (err) {
            try {
                this.database.connection.exec("ROLLBACK");
            } catch {
                // Preserve the original recovery error for diagnostics.
            }
            throw err;
        }
    }

    private getPlayerSaveKey(player: PlayerState): string {
        return player.__saveKey ?? buildPlayerSaveKey(player.name, player.id);
    }

    private snapshotInventory(player: PlayerState): InventoryEntry[] {
        return this.svc.inventoryService
            .getInventory(player)
            .map((entry: InventoryEntry) => ({ ...entry }));
    }

    private restoreInventory(player: PlayerState, inventory: InventoryEntry[]): void {
        for (const [slot, entry] of inventory.entries()) {
            this.svc.inventoryService.setInventorySlot(player, slot, entry.itemId, entry.quantity);
        }
    }

    private notifyInsufficientTradeSpace(from: TradePartyState, to: TradePartyState): void {
        this.svc.messagingService.sendGameMessageToPlayer(
            from.player,
            "Other player doesn't have enough space.",
        );
        this.svc.messagingService.sendGameMessageToPlayer(
            to.player,
            "You don't have enough space in your inventory.",
        );
    }

    private canReceiveItems(player: PlayerState, offers: TradeOfferState[]): boolean {
        return canInventoryReceiveTradeOffers(
            this.svc.inventoryService.getInventory(player),
            offers,
            (itemId) => !!getItemDefinition(itemId)?.stackable,
        );
    }

    private validateTradeCapacity(session: TradeSession): boolean {
        const [a, b] = session.parties;
        const bCanReceive = this.canReceiveItems(b.player, a.offers);
        const aCanReceive = this.canReceiveItems(a.player, b.offers);
        if (bCanReceive && aCanReceive) return true;
        if (!bCanReceive) this.notifyInsufficientTradeSpace(a, b);
        if (!aCanReceive) this.notifyInsufficientTradeSpace(b, a);
        return false;
    }

    private resetAcceptances(session: TradeSession): void {
        for (const party of session.parties) {
            party.accepted = false;
            party.confirmAccepted = false;
        }
    }

    private broadcastSession(session: TradeSession, kind: "open" | "update" = "update"): void {
        for (const party of session.parties) {
            const other = this.getCounterparty(session, party.player.id);
            const info = this.buildInfoMessage(session, party, other ?? null);
            this.queueTradeInterfaceText(session, party, other ?? null, info);
            const payload: TradeServerPayload = {
                kind,
                sessionId: session.id,
                stage: session.stage,
                self: this.buildPartyMessage(party),
                other: other ? this.buildPartyMessage(other) : { playerId: undefined, offers: [] },
                info,
            };
            this.svc.broadcastService.queueTradeMessage(party.player.id, payload);
        }
    }

    private queueTradeInterfaceText(
        session: TradeSession,
        party: TradePartyState,
        other: TradePartyState | null,
        info: string | undefined,
    ): void {
        const otherName = other ? this.resolveName(other.player) : "Other player";
        const setText = (uid: number, text: string) =>
            this.svc.queueWidgetEvent(party.player.id, {
                action: "set_text",
                uid,
                text,
            });

        if (session.stage === TradeStage.Offer) {
            const freeSlots = other
                ? countFreeInventorySlots(this.svc.inventoryService.getInventory(other.player))
                : 0;
            const freeSlotsMessage = formatTradeFreeSlotsMessage(otherName, freeSlots);
            setText((TRADE_OFFER_GROUP_ID << 16) | 9, freeSlotsMessage);
            setText((TRADE_OFFER_GROUP_ID << 16) | 24, "Your offer");
            setText((TRADE_OFFER_GROUP_ID << 16) | 27, `${otherName}'s offer`);
            setText((TRADE_OFFER_GROUP_ID << 16) | 30, info ?? "");
            setText((TRADE_OFFER_GROUP_ID << 16) | 31, `Trading with: ${otherName}`);
            return;
        }

        setText((TRADE_CONFIRM_GROUP_ID << 16) | 4, `Trading with: ${otherName}`);
        setText((TRADE_CONFIRM_GROUP_ID << 16) | 23, "You are about to give:");
        setText((TRADE_CONFIRM_GROUP_ID << 16) | 24, "In return you will receive:");
        setText((TRADE_CONFIRM_GROUP_ID << 16) | 30, info ?? "");
    }

    private buildPartyMessage(party: TradePartyState) {
        return {
            playerId: party.player.id,
            name: this.resolveName(party.player),
            offers: party.offers.map((offer, idx) => ({
                slot: idx,
                itemId: offer.itemId,
                quantity: Math.max(0, offer.quantity),
            })),
            accepted: party.accepted,
            confirmAccepted: party.confirmAccepted,
        };
    }

    private buildInfoMessage(
        session: TradeSession,
        party: TradePartyState,
        other: TradePartyState | null,
    ): string | undefined {
        if (session.stage === TradeStage.Offer) {
            if (party.accepted && other && !other.accepted)
                return "Waiting for the other player...";
            if (!party.accepted && other?.accepted) return "Other player has accepted.";
            return undefined;
        }
        if (session.stage === TradeStage.Confirm) {
            if (party.confirmAccepted && other && !other.confirmAccepted) {
                return "Waiting for the other player...";
            }
            if (!party.confirmAccepted && other?.confirmAccepted) {
                return "Other player has accepted.";
            }
            return "Please check the items carefully.";
        }
        return undefined;
    }
}
