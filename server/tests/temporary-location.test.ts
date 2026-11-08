import assert from "node:assert/strict";
import { WebSocket } from "ws";

import { CollisionMap } from "../../client/rs/scene/CollisionMap";
import { decodeServerPacket } from "../../client/network/packet/ServerBinaryDecoder";
import type { PlayerState } from "../src/game/player";
import type { ServerServices } from "../src/game/ServerServices";
import { LocationService } from "../src/game/services/LocationService";
import { PathService } from "../src/pathfinding/PathService";
import { CollisionFlag } from "../src/pathfinding/legacy/pathfinder/flag/CollisionFlag";
import { CollisionOverlayStore } from "../src/world/CollisionOverlayStore";
import type { MapCollisionService, ServerMapSquare } from "../src/world/MapCollisionService";

const tile = { x: 3203, y: 3203 };
const collisionMaps = Array.from({ length: 4 }, () => new CollisionMap(64, 64));
collisionMaps[0].setFlag(
    tile.x - 3200,
    tile.y - 3200,
    CollisionFlag.OBJECT | CollisionFlag.OBJECT_PROJECTILE_BLOCKER,
);
const mapSquare = {
    mapX: 50,
    mapY: 50,
    borderSize: 0,
    baseX: 3200,
    baseY: 3200,
    size: 64,
    collisionMaps,
} as ServerMapSquare;
const mapService = {
    getMapSquare: (mapX: number, mapY: number) =>
        mapX === 50 && mapY === 50 ? mapSquare : undefined,
    getCollisionPlaneAt: () => 0,
} as unknown as MapCollisionService;
const pathService = new PathService(mapService, 16);
const doorOverlays = new CollisionOverlayStore();
doorOverlays.addFlags(tile.x, tile.y, 0, CollisionFlag.WALL_NORTH);
pathService.setCollisionOverlays(doorOverlays);

const owner = {
    id: 1,
    tileX: 3200,
    tileY: 3200,
    level: 0,
    worldViewId: 5,
} as PlayerState;
const other = {
    id: 2,
    tileX: 3200,
    tileY: 3200,
    level: 0,
    worldViewId: 5,
} as PlayerState;
const topLevel = {
    id: 3,
    tileX: 3200,
    tileY: 3200,
    level: 0,
    worldViewId: -1,
} as PlayerState;
const ownerSocket = { readyState: WebSocket.OPEN } as WebSocket;
const otherSocket = { readyState: WebSocket.OPEN } as WebSocket;
const topLevelSocket = { readyState: WebSocket.OPEN } as WebSocket;
const sockets = new Map<PlayerState, WebSocket>([
    [owner, ownerSocket],
    [other, otherSocket],
    [topLevel, topLevelSocket],
]);
const players = [owner, other, topLevel];
let currentTick = 10;
const sent: Array<{ socket: WebSocket; packet: Uint8Array; context: string }> = [];

const services = {
    ticker: { currentTick: () => currentTick },
    pathService,
    locTypeLoader: {
        load: (locId: number) => {
            if (locId === 100 || locId === 300) {
                return {
                    id: locId,
                    clipType: 2,
                    blocksProjectile: true,
                    sizeX: 1,
                    sizeY: 1,
                };
            }
            return {
                id: locId,
                clipType: 0,
                blocksProjectile: false,
                sizeX: 1,
                sizeY: 1,
            };
        },
    },
    players: {
        getSocketByPlayerId: (playerId: number) =>
            sockets.get(players.find((player) => player.id === playerId) as PlayerState),
        forEach: (callback: (socket: WebSocket, player: PlayerState) => void) => {
            for (const player of players) callback(sockets.get(player) as WebSocket, player);
        },
    },
    playerSyncSessions: new Map(),
    playerDynamicLocSceneKeys: new Map(),
    dynamicLocState: { queryScene: () => [] },
    networkLayer: {
        withDirectSendBypass: (_reason: string, callback: () => void) => callback(),
        sendWithGuard: (socket: WebSocket, packet: Uint8Array, context: string) => {
            sent.push({ socket, packet, context });
            return true;
        },
    },
} as unknown as ServerServices;
const locations = new LocationService(services);

const ownerScope = { worldViewId: owner.worldViewId, ownerPlayerId: owner.id };
locations.removeTemporaryLoc(ownerScope, 100, tile, 0, { lifetimeTicks: 2 });
assert.equal(sent.length, 1);
assert.equal(sent[0].socket, ownerSocket, "an owner-only change is sent only to its owner");
assert.deepEqual(decodeServerPacket(sent[0].packet), {
    type: "loc_change",
    payload: {
        oldId: 100,
        newId: 0,
        tile,
        level: 0,
        oldTile: tile,
        newTile: undefined,
        oldRotation: 0,
        newRotation: 0,
    },
});
assert.equal(
    pathService.getScopedCollisionOverlays(owner.worldViewId),
    undefined,
    "owner-only visuals do not leak collision to other players in the view",
);
assert.equal(
    pathService.canActorStep({ x: 3202, y: 3203, plane: 0 }, tile, 1, owner.worldViewId),
    false,
);

sent.length = 0;
locations.replayTemporaryLocsForPlayer(owner);
assert.equal(sent.length, 1, "stored owner state replays after a rebuild");
sent.length = 0;
locations.replayTemporaryLocsForPlayer(other);
assert.equal(sent.length, 0);

const sharedScope = { worldViewId: owner.worldViewId };
locations.removeTemporaryLoc(sharedScope, 100, tile, 0);
assert.equal(
    sent.length,
    3,
    "world-view state is sent to both players and the owner's override is applied last",
);
assert.ok(sent.every((entry) => entry.socket !== topLevelSocket));
assert.deepEqual(
    locations.getTemporaryLocsVisibleToPlayer(owner).map((state) => state.scope.ownerPlayerId),
    [undefined, owner.id],
    "shared state replays before the owner override",
);
assert.equal(locations.getTemporaryLocsVisibleToPlayer(other).length, 1);
assert.equal(locations.getTemporaryLocsVisibleToPlayer(topLevel).length, 0);

const scopedFlags = pathService.getCollisionFlagAt(tile.x, tile.y, 0, owner.worldViewId) ?? 0;
assert.equal(scopedFlags & CollisionFlag.OBJECT, 0);
assert.notEqual(
    scopedFlags & CollisionFlag.WALL_NORTH,
    0,
    "scoped collision composes after the independent global door layer",
);
assert.equal(
    pathService.canActorStep({ x: 3202, y: 3203, plane: 0 }, tile, 1, owner.worldViewId),
    true,
    "shared removal is authoritative on the movement-validation tick",
);
assert.equal(
    pathService.canActorStep({ x: 3202, y: 3203, plane: 0 }, tile, 1, -1),
    false,
    "the same base loc remains blocked outside the scoped view",
);

sent.length = 0;
currentTick = 11;
assert.equal(locations.processTemporaryLocs(currentTick), 0);
currentTick = 12;
assert.equal(locations.processTemporaryLocs(currentTick), 1);
assert.equal(sent.length, 2, "the shared state is replayed after removing the owner override");
const ownerRestore = decodeServerPacket(sent[0].packet) as {
    type: string;
    payload: { oldId: number; newId: number };
};
assert.equal(ownerRestore.type, "loc_change");
assert.deepEqual(
    { oldId: ownerRestore.payload.oldId, newId: ownerRestore.payload.newId },
    { oldId: 100, newId: 100 },
);

sent.length = 0;
locations.replaceTemporaryLoc(ownerScope, 0, 300, { x: 3204, y: 3203 }, 0, {
    newShape: 10,
    lifetimeTicks: 1,
});
assert.ok(sent.some((entry) => decodeServerPacket(entry.packet)?.type === "loc_add_change"));
sent.length = 0;
currentTick = 13;
assert.equal(locations.processTemporaryLocs(currentTick), 1);
assert.equal(decodeServerPacket(sent[0].packet)?.type, "loc_del");

sent.length = 0;
assert.equal(locations.clearTemporaryLoc(sharedScope, 100, tile, 0), true);
assert.equal(sent.length, 2);
assert.equal(pathService.getScopedCollisionOverlays(owner.worldViewId), undefined);
const topLevelFlags = pathService.getCollisionFlagAt(tile.x, tile.y, 0, -1) ?? 0;
assert.notEqual(topLevelFlags & CollisionFlag.OBJECT, 0);
assert.notEqual(
    topLevelFlags & CollisionFlag.WALL_NORTH,
    0,
    "clearing temporary collision leaves the global door overlay intact",
);

locations.replaceTemporaryLoc(ownerScope, 100, 200, tile, 0);
sent.length = 0;
locations.maybeReplayDynamicLocState(ownerSocket, owner, true);
assert.equal(sent.length, 1, "login/scene rebuild replay includes scoped state");
owner.worldViewId = 6;
sent.length = 0;
locations.maybeReplayDynamicLocState(ownerSocket, owner, false);
assert.equal(sent.length, 0, "world-view changes invalidate replay scope without leaking state");

console.log("temporary-location.test.ts passed");
