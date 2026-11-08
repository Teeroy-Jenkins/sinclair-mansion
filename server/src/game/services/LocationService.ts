import { WebSocket } from "ws";

import { faceAngleRs } from "../../../../client/rs/utils/rotation";
import { encodeMessage } from "../../network/messages";
import { CollisionFlag } from "../../pathfinding/legacy/pathfinder/flag/CollisionFlag";
import { logger } from "../../utils/logger";
import { CollisionOverlayStore } from "../../world/CollisionOverlayStore";
import {
    DoorCollisionService,
    LocModelType,
    type LocModelTypeValue,
} from "../../world/DoorCollisionService";
import {
    deriveConnectedLocCollisionRect,
    type LocCollisionRect,
} from "../../world/LocCollisionRect";
import type { ServerServices } from "../ServerServices";
import type { NpcState } from "../npc";
import type { PlayerState } from "../player";

const TILE_UNIT = 128;
const DEFAULT_LOC_SHAPE = 10;
const SCENE_SIZE = 104;

export interface TemporaryLocScope {
    worldViewId: number;
    /**
     * Omit to share the change with every player in the world view. Owner-only
     * state is visual and interactive; collision is applied only to shared
     * scopes because pathfinding has no safe per-player global collision layer.
     */
    ownerPlayerId?: number;
}

export interface TemporaryLocChangeOptions {
    oldShape?: number;
    oldRotation?: number;
    newShape?: number;
    newRotation?: number;
    /** Non-positive and omitted values mean the change does not expire automatically. */
    lifetimeTicks?: number;
}

export interface TemporaryLocChange {
    scope: TemporaryLocScope;
    oldId: number;
    newId: number;
    tile: { x: number; y: number };
    level: number;
    oldShape: number;
    oldRotation: number;
    newShape: number;
    newRotation: number;
    expiresAtTick?: number;
}

type StoredTemporaryLocChange = TemporaryLocChange & { revision: number };

export interface LocChangePayload {
    oldId: number;
    newId: number;
    tile: { x: number; y: number };
    level: number;
    oldTile: { x: number; y: number };
    newTile: { x: number; y: number };
    oldRotation?: number;
    newRotation?: number;
    newShape?: number;
}

export class LocationService {
    private readonly temporaryLocs = new Map<string, StoredTemporaryLocChange>();
    private nextTemporaryLocRevision = 1;

    constructor(private readonly services: ServerServices) {}

    replaceTemporaryLoc(
        scope: TemporaryLocScope,
        oldId: number,
        newId: number,
        tile: { x: number; y: number },
        level: number,
        options: TemporaryLocChangeOptions = {},
    ): TemporaryLocChange {
        const normalizedScope = this.normalizeTemporaryLocScope(scope);
        const oldShape = this.normalizeShape(options.oldShape);
        const oldRotation = this.normalizeRotation(options.oldRotation);
        const newShape = this.normalizeShape(options.newShape ?? oldShape);
        const newRotation = this.normalizeRotation(options.newRotation ?? oldRotation);
        const lifetimeTicks = Math.trunc(options.lifetimeTicks ?? 0);
        const state: StoredTemporaryLocChange = {
            scope: normalizedScope,
            oldId: Math.max(0, Math.trunc(oldId)),
            newId: Math.max(0, Math.trunc(newId)),
            tile: { x: Math.trunc(tile.x), y: Math.trunc(tile.y) },
            level: Math.max(0, Math.min(3, Math.trunc(level))),
            oldShape,
            oldRotation,
            newShape,
            newRotation,
            expiresAtTick:
                lifetimeTicks > 0
                    ? this.services.ticker.currentTick() + lifetimeTicks
                    : undefined,
            revision: this.nextTemporaryLocRevision++,
        };
        const key = this.makeTemporaryLocKey(state.scope, state.oldId, state.tile, state.level, oldShape);
        this.temporaryLocs.set(key, state);
        this.rebuildTemporaryCollision(state.scope.worldViewId);
        this.sendTemporaryLocToVisiblePlayers(state);
        return this.copyTemporaryLoc(state);
    }

    removeTemporaryLoc(
        scope: TemporaryLocScope,
        oldId: number,
        tile: { x: number; y: number },
        level: number,
        options: TemporaryLocChangeOptions = {},
    ): TemporaryLocChange {
        return this.replaceTemporaryLoc(scope, oldId, 0, tile, level, options);
    }

    clearTemporaryLoc(
        scope: TemporaryLocScope,
        oldId: number,
        tile: { x: number; y: number },
        level: number,
        oldShape: number = DEFAULT_LOC_SHAPE,
    ): boolean {
        const normalizedScope = this.normalizeTemporaryLocScope(scope);
        const key = this.makeTemporaryLocKey(
            normalizedScope,
            Math.max(0, Math.trunc(oldId)),
            { x: Math.trunc(tile.x), y: Math.trunc(tile.y) },
            Math.max(0, Math.min(3, Math.trunc(level))),
            this.normalizeShape(oldShape),
        );
        const state = this.temporaryLocs.get(key);
        if (!state) return false;
        this.temporaryLocs.delete(key);
        this.rebuildTemporaryCollision(state.scope.worldViewId);
        this.sendTemporaryLocRestoreToVisiblePlayers(state);
        return true;
    }

    clearTemporaryLocsOwnedByPlayer(playerId: number): number {
        const ownerPlayerId = Math.trunc(playerId);
        let removed = 0;
        const removedStates: StoredTemporaryLocChange[] = [];
        const affectedViews = new Set<number>();
        for (const [key, state] of [...this.temporaryLocs]) {
            if (state.scope.ownerPlayerId !== ownerPlayerId) continue;
            this.temporaryLocs.delete(key);
            removedStates.push(state);
            affectedViews.add(state.scope.worldViewId);
            removed++;
        }
        for (const worldViewId of affectedViews) this.rebuildTemporaryCollision(worldViewId);
        for (const state of removedStates) this.sendTemporaryLocRestoreToVisiblePlayers(state);
        return removed;
    }

    processTemporaryLocs(currentTick: number): number {
        const tick = Math.max(0, Math.trunc(currentTick));
        const expired: StoredTemporaryLocChange[] = [];
        const affectedViews = new Set<number>();
        for (const [key, state] of [...this.temporaryLocs]) {
            if (state.expiresAtTick === undefined || tick < state.expiresAtTick) continue;
            this.temporaryLocs.delete(key);
            expired.push(state);
            affectedViews.add(state.scope.worldViewId);
        }
        for (const worldViewId of affectedViews) {
            this.rebuildTemporaryCollision(worldViewId);
        }
        for (const state of expired) {
            this.sendTemporaryLocRestoreToVisiblePlayers(state);
        }
        return expired.length;
    }

    getTemporaryLocsVisibleToPlayer(player: PlayerState): TemporaryLocChange[] {
        return this.getStoredTemporaryLocsVisibleToPlayer(player).map((state) =>
            this.copyTemporaryLoc(state),
        );
    }

    replayTemporaryLocsForPlayer(player: PlayerState): void {
        const ws = this.services.players?.getSocketByPlayerId(player.id);
        if (!ws) return;
        const scene = this.getDynamicLocSceneKey(ws, player);
        this.services.networkLayer.withDirectSendBypass("temporary_loc_replay", () =>
            this.sendTemporaryLocsForScene(ws, player, scene.baseX, scene.baseY),
        );
    }

    emitLocChange(
        oldId: number,
        newId: number,
        tile: { x: number; y: number },
        level: number,
        opts?: {
            oldTile?: { x: number; y: number };
            newTile?: { x: number; y: number };
            oldRotation?: number;
            newRotation?: number;
            newShape?: number;
        },
    ): void {
        const oldTile = opts?.oldTile ?? tile;
        const newTile = opts?.newTile ?? tile;
        const payload: LocChangePayload = {
            oldId,
            newId,
            tile: { x: tile.x, y: tile.y },
            level,
            oldTile: { x: oldTile.x, y: oldTile.y },
            newTile: { x: newTile.x, y: newTile.y },
            oldRotation: opts?.oldRotation,
            newRotation: opts?.newRotation,
            newShape: opts?.newShape,
        };
        try {
            this.services.doorManager?.observeLocChange({
                oldId: payload.oldId,
                newId: payload.newId,
                level: payload.level,
                oldTile: payload.oldTile,
                newTile: payload.newTile,
            });
        } catch (err) {
            logger.warn("[Door] Failed to observe loc change for runtime mapping capture", err);
        }
        try {
            this.services.dynamicLocState.observeLocChange({
                oldId: payload.oldId,
                newId: payload.newId,
                level: payload.level,
                oldTile: payload.oldTile,
                newTile: payload.newTile,
                oldRotation: payload.oldRotation,
                newRotation: payload.newRotation,
            });
        } catch (err) {
            logger.warn("[loc] Failed to update dynamic loc state store", err);
        }
        const frame = this.services.activeFrame;
        if (frame && !this.services.networkLayer.getIsBroadcastPhase()) {
            frame.locChanges.push(payload);
            return;
        }
        if (frame) {
            this.services.broadcastScheduler.queueLocChange(payload);
            return;
        }
        const msg = encodeMessage({ type: "loc_change", payload });
        this.services.networkLayer.withDirectSendBypass("loc_change", () =>
            this.services.broadcastService.broadcast(msg, "loc_change"),
        );
    }

    sendLocChangeToPlayer(
        player: PlayerState,
        oldId: number,
        newId: number,
        tile: { x: number; y: number },
        level: number,
    ): void {
        const payload: LocChangePayload = {
            oldId,
            newId,
            tile: { x: tile.x, y: tile.y },
            level,
            oldTile: { x: tile.x, y: tile.y },
            newTile: { x: tile.x, y: tile.y },
        };
        const ws = this.services.players?.getSocketByPlayerId(player.id);
        if (!ws) return;
        const msg = encodeMessage({ type: "loc_change", payload });
        this.services.networkLayer.withDirectSendBypass("loc_change_player", () =>
            this.services.networkLayer.sendWithGuard(ws, msg, "loc_change"),
        );
    }

    spawnLocForPlayer(
        player: PlayerState,
        locId: number,
        tile: { x: number; y: number },
        level: number,
        shape: number,
        rotation: number,
    ): void {
        const ws = this.services.players?.getSocketByPlayerId(player.id);
        if (!ws) return;
        const msg = encodeMessage({
            type: "loc_add_change",
            payload: { locId, tile, level, shape, rotation },
        } as unknown as Parameters<typeof encodeMessage>[0]);
        this.services.networkLayer.withDirectSendBypass("loc_add_change", () =>
            this.services.networkLayer.sendWithGuard(ws, msg, "loc_add_change"),
        );
    }

    isAdjacentToTile(player: PlayerState, tile: { x: number; y: number }, radius = 1): boolean {
        const dx = Math.abs(player.tileX - tile.x);
        const dy = Math.abs(player.tileY - tile.y);
        return dx <= radius && dy <= radius;
    }

    isAdjacentToNpc(player: PlayerState, npc: NpcState): boolean {
        const size = Math.max(1, npc.size);
        const minX = npc.tileX;
        const minY = npc.tileY;
        const maxX = minX + size - 1;
        const maxY = minY + size - 1;
        const px = player.tileX;
        const py = player.tileY;
        const clampedX = Math.max(minX, Math.min(px, maxX));
        const clampedY = Math.max(minY, Math.min(py, maxY));
        const distance = Math.max(Math.abs(px - clampedX), Math.abs(py - clampedY));
        return distance === 1;
    }

    faceTile(player: PlayerState, tile: { x: number; y: number }): void {
        const targetX = tile.x * TILE_UNIT + TILE_UNIT / 2;
        const targetY = tile.y * TILE_UNIT + TILE_UNIT / 2;
        try {
            player.setForcedOrientation(faceAngleRs(player.x, player.y, targetX, targetY));
        } catch (err) {
            logger.warn("[location] failed to set gathering face orientation", err);
        }
    }

    isAdjacentToLoc(
        player: PlayerState,
        locId: number,
        tile: { x: number; y: number },
        level: number,
    ): boolean {
        if (!(locId > 0)) {
            return this.isAdjacentToTile(player, tile);
        }
        const rect = this.getLocAdjacencyRect(locId, tile, level, player.worldViewId);
        if (!rect) {
            return this.isAdjacentToTile(player, tile);
        }
        const minX = rect.tile.x;
        const minY = rect.tile.y;
        const maxX = minX + Math.max(1, rect.sizeX) - 1;
        const maxY = minY + Math.max(1, rect.sizeY) - 1;
        const px = player.tileX;
        const py = player.tileY;
        const clampedX = Math.max(minX, Math.min(px, maxX));
        const clampedY = Math.max(minY, Math.min(py, maxY));
        return Math.abs(px - clampedX) <= 1 && Math.abs(py - clampedY) <= 1;
    }

    getLocAdjacencyRect(
        locId: number,
        tile: { x: number; y: number },
        level: number,
        worldViewId?: number,
    ): { tile: { x: number; y: number }; sizeX: number; sizeY: number } | undefined {
        const size = this.getLocSize(locId);
        if (!size) return undefined;
        const rect = this.deriveLocCollisionRectForTile(
            tile,
            size.sizeX,
            size.sizeY,
            level,
            worldViewId,
        );
        if (rect) return rect;
        return {
            tile: { x: tile.x, y: tile.y },
            sizeX: Math.max(1, size.sizeX),
            sizeY: Math.max(1, size.sizeY),
        };
    }

    getLocSize(locId: number): { sizeX: number; sizeY: number } | undefined {
        const loader = this.services.locTypeLoader;
        if (!loader?.load) return undefined;
        try {
            const loc = loader.load(locId);
            if (!loc) return undefined;
            const sizeX = Math.max(1, loc.sizeX);
            const sizeY = Math.max(1, loc.sizeY);
            return { sizeX, sizeY };
        } catch {
            return undefined;
        }
    }

    deriveLocCollisionRectForTile(
        tile: { x: number; y: number },
        sizeX: number,
        sizeY: number,
        level: number,
        worldViewId?: number,
    ): LocCollisionRect | undefined {
        const pathService = this.services.pathService;
        if (!pathService?.getCollisionFlagAt) {
            return undefined;
        }
        return deriveConnectedLocCollisionRect(
            (x, y, p) => pathService.getCollisionFlagAt(x, y, p, worldViewId),
            tile,
            sizeX,
            sizeY,
            level,
        );
    }

    resolveSceneBaseCoordinate(currentBase: number, playerTile: number): number {
        const centeredBase = Math.max(0, (playerTile - 48) & ~7);
        if (currentBase < 0) {
            return centeredBase;
        }
        const local = playerTile - currentBase;
        if (local < 16 || local >= 88) {
            return centeredBase;
        }
        return currentBase;
    }

    getDynamicLocSceneKey(
        ws: WebSocket | undefined,
        player: PlayerState,
    ): { key: string; baseX: number; baseY: number } {
        const session = ws ? this.services.playerSyncSessions?.get(ws) : undefined;
        const baseX = this.resolveSceneBaseCoordinate(session?.baseTileX ?? -1, player.tileX);
        const baseY = this.resolveSceneBaseCoordinate(session?.baseTileY ?? -1, player.tileY);
        return {
            key: `${player.worldViewId}:${player.level}:${baseX}:${baseY}`,
            baseX,
            baseY,
        };
    }

    maybeReplayDynamicLocState(ws: WebSocket, player: PlayerState, force: boolean = false): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }

        const playerId = player.id;
        if (!(playerId >= 0)) {
            return;
        }

        const sceneKeys = this.services.playerDynamicLocSceneKeys;
        const scene = this.getDynamicLocSceneKey(ws, player);
        const lastSceneKey = sceneKeys?.get(playerId);
        if (!force && lastSceneKey === scene.key) {
            return;
        }

        const visibleStates = this.services.dynamicLocState.queryScene(
            scene.baseX,
            scene.baseY,
            player.level,
        );
        const doSend = () => {
            for (const state of visibleStates) {
                this.services.networkLayer.sendWithGuard(
                    ws,
                    encodeMessage({
                        type: "loc_change",
                        payload: {
                            oldId: state.oldId,
                            newId: state.newId,
                            tile: { x: state.oldTile.x, y: state.oldTile.y },
                            level: state.level,
                            oldTile: { x: state.oldTile.x, y: state.oldTile.y },
                            newTile: { x: state.newTile.x, y: state.newTile.y },
                            oldRotation: state.oldRotation,
                            newRotation: state.newRotation,
                        },
                    }),
                    "loc_change_replay",
                );
            }
            this.sendTemporaryLocsForScene(ws, player, scene.baseX, scene.baseY);
        };
        this.services.networkLayer.withDirectSendBypass("loc_change_replay", doSend);

        sceneKeys?.set(playerId, scene.key);
    }

    private normalizeTemporaryLocScope(scope: TemporaryLocScope): TemporaryLocScope {
        const worldViewId = Number.isFinite(scope.worldViewId)
            ? Math.trunc(scope.worldViewId)
            : -1;
        const ownerPlayerId = Number.isFinite(scope.ownerPlayerId)
            ? Math.trunc(scope.ownerPlayerId as number)
            : undefined;
        return { worldViewId, ownerPlayerId };
    }

    private normalizeShape(shape: number | undefined): number {
        if (!Number.isFinite(shape)) return DEFAULT_LOC_SHAPE;
        return Math.max(0, Math.min(22, Math.trunc(shape as number)));
    }

    private normalizeRotation(rotation: number | undefined): number {
        if (!Number.isFinite(rotation)) return 0;
        return Math.trunc(rotation as number) & 3;
    }

    private makeTemporaryLocKey(
        scope: TemporaryLocScope,
        oldId: number,
        tile: { x: number; y: number },
        level: number,
        oldShape: number,
    ): string {
        return `${scope.worldViewId}:${scope.ownerPlayerId ?? "*"}:${level}:${tile.x}:${tile.y}:${oldId}:${oldShape}`;
    }

    private copyTemporaryLoc(state: StoredTemporaryLocChange): TemporaryLocChange {
        return {
            scope: { ...state.scope },
            oldId: state.oldId,
            newId: state.newId,
            tile: { ...state.tile },
            level: state.level,
            oldShape: state.oldShape,
            oldRotation: state.oldRotation,
            newShape: state.newShape,
            newRotation: state.newRotation,
            expiresAtTick: state.expiresAtTick,
        };
    }

    private isTemporaryLocVisibleToPlayer(
        state: StoredTemporaryLocChange,
        player: PlayerState,
    ): boolean {
        return (
            state.scope.worldViewId === player.worldViewId &&
            (state.scope.ownerPlayerId === undefined || state.scope.ownerPlayerId === player.id)
        );
    }

    private getStoredTemporaryLocsVisibleToPlayer(
        player: PlayerState,
    ): StoredTemporaryLocChange[] {
        const visible = [...this.temporaryLocs.values()].filter((state) =>
            this.isTemporaryLocVisibleToPlayer(state, player),
        );
        visible.sort((a, b) => {
            const aOwned = a.scope.ownerPlayerId === player.id ? 1 : 0;
            const bOwned = b.scope.ownerPlayerId === player.id ? 1 : 0;
            if (aOwned !== bOwned) return aOwned - bOwned;
            return a.revision - b.revision;
        });
        return visible;
    }

    private isTemporaryLocInScene(
        state: StoredTemporaryLocChange,
        baseX: number,
        baseY: number,
        level: number,
    ): boolean {
        return (
            state.level === level &&
            state.tile.x >= baseX &&
            state.tile.x < baseX + SCENE_SIZE &&
            state.tile.y >= baseY &&
            state.tile.y < baseY + SCENE_SIZE
        );
    }

    private sendTemporaryLocsForScene(
        ws: WebSocket,
        player: PlayerState,
        baseX: number,
        baseY: number,
    ): void {
        for (const state of this.getStoredTemporaryLocsVisibleToPlayer(player)) {
            if (!this.isTemporaryLocInScene(state, baseX, baseY, player.level)) continue;
            this.sendTemporaryLocState(ws, state);
        }
    }

    private sendTemporaryLocToVisiblePlayers(state: StoredTemporaryLocChange): void {
        this.services.players?.forEach((ws, player) => {
            if (!this.isTemporaryLocVisibleToPlayer(state, player)) return;
            const scene = this.getDynamicLocSceneKey(ws, player);
            if (!this.isTemporaryLocInScene(state, scene.baseX, scene.baseY, player.level)) return;
            this.services.networkLayer.withDirectSendBypass("temporary_loc_change", () =>
                this.sendTemporaryLocsForScene(ws, player, scene.baseX, scene.baseY),
            );
        });
    }

    private sendTemporaryLocRestoreToVisiblePlayers(state: StoredTemporaryLocChange): void {
        this.services.players?.forEach((ws, player) => {
            if (!this.isTemporaryLocVisibleToPlayer(state, player)) return;
            const scene = this.getDynamicLocSceneKey(ws, player);
            if (!this.isTemporaryLocInScene(state, scene.baseX, scene.baseY, player.level)) return;
            this.services.networkLayer.withDirectSendBypass("temporary_loc_restore", () => {
                this.sendTemporaryLocRestore(ws, state);
                this.sendTemporaryLocsForScene(ws, player, scene.baseX, scene.baseY);
            });
        });
    }

    private sendTemporaryLocState(ws: WebSocket, state: StoredTemporaryLocChange): void {
        if (state.oldId === 0) {
            if (state.newId === 0) return;
            this.services.networkLayer.sendWithGuard(
                ws,
                encodeMessage({
                    type: "loc_add_change",
                    payload: {
                        locId: state.newId,
                        tile: state.tile,
                        level: state.level,
                        shape: state.newShape,
                        rotation: state.newRotation,
                    },
                } as unknown as Parameters<typeof encodeMessage>[0]),
                "temporary_loc_add",
            );
            return;
        }
        this.services.networkLayer.sendWithGuard(
            ws,
            encodeMessage({
                type: "loc_change",
                payload: {
                    oldId: state.oldId,
                    newId: state.newId,
                    tile: state.tile,
                    oldTile: state.tile,
                    level: state.level,
                    oldRotation: state.oldRotation,
                    newRotation: state.newRotation,
                },
            }),
            "temporary_loc_change",
        );
    }

    private sendTemporaryLocRestore(ws: WebSocket, state: StoredTemporaryLocChange): void {
        if (state.oldId === 0) {
            this.services.networkLayer.sendWithGuard(
                ws,
                encodeMessage({
                    type: "loc_del",
                    payload: {
                        tile: state.tile,
                        level: state.level,
                        shape: state.newShape,
                        rotation: state.newRotation,
                    },
                } as unknown as Parameters<typeof encodeMessage>[0]),
                "temporary_loc_del",
            );
            return;
        }
        this.services.networkLayer.sendWithGuard(
            ws,
            encodeMessage({
                type: "loc_change",
                payload: {
                    oldId: state.oldId,
                    newId: state.oldId,
                    tile: state.tile,
                    oldTile: state.tile,
                    level: state.level,
                    oldRotation: state.oldRotation,
                    newRotation: state.oldRotation,
                },
            }),
            "temporary_loc_restore",
        );
    }

    private rebuildTemporaryCollision(worldViewId: number): void {
        const pathService = this.services.pathService;
        if (!pathService?.setScopedCollisionOverlays) return;
        const states = [...this.temporaryLocs.values()]
            .filter(
                (state) =>
                    state.scope.worldViewId === worldViewId &&
                    state.scope.ownerPlayerId === undefined,
            )
            .sort((a, b) => a.revision - b.revision);
        if (states.length === 0) {
            pathService.setScopedCollisionOverlays(worldViewId, undefined);
            return;
        }
        const overlays = new CollisionOverlayStore();
        const wallCollision = new DoorCollisionService(overlays);
        for (const state of states) {
            this.applyTemporaryLocCollision(
                overlays,
                wallCollision,
                state.oldId,
                state.oldShape,
                state.oldRotation,
                state.tile,
                state.level,
                false,
            );
            this.applyTemporaryLocCollision(
                overlays,
                wallCollision,
                state.newId,
                state.newShape,
                state.newRotation,
                state.tile,
                state.level,
                true,
            );
        }
        pathService.setScopedCollisionOverlays(
            worldViewId,
            overlays.hasOverlays() ? overlays : undefined,
        );
    }

    private applyTemporaryLocCollision(
        overlays: CollisionOverlayStore,
        wallCollision: DoorCollisionService,
        locId: number,
        shape: number,
        rotation: number,
        tile: { x: number; y: number },
        level: number,
        add: boolean,
    ): void {
        if (locId <= 0) return;
        let loc:
            | {
                  clipType: number;
                  blocksProjectile: boolean;
                  sizeX: number;
                  sizeY: number;
              }
            | undefined;
        try {
            loc = this.services.locTypeLoader?.load(locId);
        } catch {
            return;
        }
        if (!loc || loc.clipType === 0) return;
        if (shape >= LocModelType.WALL && shape <= LocModelType.WALL_RECT_CORNER) {
            const operation = add
                ? wallCollision.addWallCollision.bind(wallCollision)
                : wallCollision.removeWallCollision.bind(wallCollision);
            operation(
                tile.x,
                tile.y,
                level,
                rotation,
                shape as LocModelTypeValue,
                loc.blocksProjectile,
            );
            return;
        }
        if (shape === 22) {
            if (loc.clipType !== 1) return;
            const operation = add ? overlays.addFlags.bind(overlays) : overlays.removeFlags.bind(overlays);
            operation(tile.x, tile.y, level, CollisionFlag.FLOOR_DECORATION);
            return;
        }
        if (shape !== 9 && shape !== 10 && shape !== 11) return;
        const rotated = (rotation & 1) !== 0;
        const sizeX = Math.max(1, rotated ? loc.sizeY : loc.sizeX);
        const sizeY = Math.max(1, rotated ? loc.sizeX : loc.sizeY);
        let flags = CollisionFlag.OBJECT;
        if (loc.blocksProjectile) flags |= CollisionFlag.OBJECT_PROJECTILE_BLOCKER;
        const operation = add ? overlays.addFlags.bind(overlays) : overlays.removeFlags.bind(overlays);
        for (let x = tile.x; x < tile.x + sizeX; x++) {
            for (let y = tile.y; y < tile.y + sizeY; y++) {
                operation(x, y, level, flags);
            }
        }
    }
}
