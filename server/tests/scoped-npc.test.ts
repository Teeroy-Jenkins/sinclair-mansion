import assert from "node:assert/strict";

import type { BasTypeLoader } from "../../client/rs/config/bastype/BasTypeLoader";
import type { NpcType } from "../../client/rs/config/npctype/NpcType";
import type { NpcTypeLoader } from "../../client/rs/config/npctype/NpcTypeLoader";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { isNpcVisibleToPlayer, NpcState } from "../src/game/npc";
import { NpcManager } from "../src/game/npcManager";
import { PlayerState } from "../src/game/player";
import type { ServerServices } from "../src/game/ServerServices";
import type { PathService } from "../src/pathfinding/PathService";
import type { MapCollisionService } from "../src/world/MapCollisionService";
import { NpcPacketEncoder, type NpcTickFrameData } from "../src/network/encoding/NpcPacketEncoder";
import { NpcSyncSession } from "../src/network/NpcSyncSession";
import { NpcSyncManager } from "../src/network/managers/NpcSyncManager";

const TEST_GAMEMODE = {
    id: "scoped-npc-test",
    name: "Scoped NPC test",
    initializePlayer: () => undefined,
    canInteract: () => true,
} as GamemodeDefinition;

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});

function createPlayer(id: number, worldViewId: number): PlayerState {
    const player = new PlayerState(id, 3200, 3200, 0, TEST_GAMEMODE);
    player.worldViewId = worldViewId;
    return player;
}

function createNpc(id: number, worldViewId: number, ownerPlayerId?: number): NpcState {
    return new NpcState(
        id,
        32000,
        1,
        -1,
        -1,
        32,
        { x: 3200, y: 3200, level: 0 },
        { worldViewId, ownerPlayerId },
    );
}

const owner = createPlayer(1, 5);
const other = createPlayer(2, 5);
const topLevelPlayer = createPlayer(3, -1);
const topLevelNpc = createNpc(10, -1);
const sharedInstanceNpc = createNpc(11, 5);
const ownerNpc = createNpc(12, 5, owner.id);
const otherOwnerNpc = createNpc(13, 5, other.id);
const nearbyNpcs = [topLevelNpc, sharedInstanceNpc, ownerNpc, otherOwnerNpc];

assert.equal(isNpcVisibleToPlayer(topLevelNpc, owner), false);
assert.equal(isNpcVisibleToPlayer(sharedInstanceNpc, owner), true);
assert.equal(isNpcVisibleToPlayer(ownerNpc, owner), true);
assert.equal(isNpcVisibleToPlayer(otherOwnerNpc, owner), false);
assert.equal(isNpcVisibleToPlayer(topLevelNpc, topLevelPlayer), true);

const syncServices = {
    npcManager: {
        getNearby: () => nearbyNpcs,
        getById: (npcId: number) => nearbyNpcs.find((npc) => npc.id === npcId),
    },
    pendingNpcPackets: new Map(),
} as unknown as ServerServices;

const syncManager = new NpcSyncManager(syncServices);
syncManager.updateNpcViewForPlayer(owner);
assert.deepEqual([...owner.visibleNpcIds], [sharedInstanceNpc.id, ownerNpc.id]);
syncManager.updateNpcViewForPlayer(other);
assert.deepEqual([...other.visibleNpcIds], [sharedInstanceNpc.id, otherOwnerNpc.id]);
syncManager.updateNpcViewForPlayer(topLevelPlayer);
assert.deepEqual([...topLevelPlayer.visibleNpcIds], [topLevelNpc.id]);

const frame: NpcTickFrameData = {
    tick: 1,
    tickMs: 600,
    npcUpdates: [],
    hitsplats: [],
    npcEffectEvents: [],
    spotAnimations: [],
    colorOverrides: new Map(),
};
const packetEncoder = new NpcPacketEncoder(syncServices);
const ownerSession = new NpcSyncSession();
packetEncoder.buildNpcSyncPacket(owner, frame, ownerSession);
assert.deepEqual(ownerSession.npcIndices, [sharedInstanceNpc.id, ownerNpc.id]);
const otherSession = new NpcSyncSession();
packetEncoder.buildNpcSyncPacket(other, frame, otherSession);
assert.deepEqual(otherSession.npcIndices, [sharedInstanceNpc.id, otherOwnerNpc.id]);
const topLevelSession = new NpcSyncSession();
packetEncoder.buildNpcSyncPacket(topLevelPlayer, frame, topLevelSession);
assert.deepEqual(topLevelSession.npcIndices, [topLevelNpc.id]);

const npcType = {
    id: 32000,
    name: "Scoped test NPC",
    size: 1,
    rotationSpeed: 32,
    spawnDirection: 0,
    hitpoints: 10,
    combatLevel: -1,
    attackSpeed: 4,
    attackLevel: 1,
    strengthLevel: 1,
    defenceLevel: 1,
    magicLevel: 1,
    rangedLevel: 1,
    actions: [],
    params: new Map(),
    getIdleSeqId: () => -1,
    getWalkSeqId: () => -1,
} as unknown as NpcType;
const manager = new NpcManager(
    {} as MapCollisionService,
    {
        findPathSteps: () => ({ ok: false, steps: [] }),
        getCollisionFlagAt: () => 0,
    } as unknown as PathService,
    { load: () => npcType } as unknown as NpcTypeLoader,
    {} as BasTypeLoader,
);

let stateObservedAfterIndexing:
    | { worldViewId: number; ownerPlayerId?: number; indexed: boolean }
    | undefined;
manager.setLifecycleHooks({
    onReset: (npcId) => {
        const npc = manager.getById(npcId);
        assert.ok(npc);
        stateObservedAfterIndexing = {
            worldViewId: npc.worldViewId,
            ownerPlayerId: npc.ownerPlayerId,
            indexed: manager
                .getNearby(npc.tileX, npc.tileY, npc.level, 0)
                .some((candidate) => candidate.id === npcId),
        };
    },
});

const expiringNpc = manager.spawnTransientNpc({
    id: npcType.id,
    x: 3210,
    y: 3210,
    level: 0,
    wanderRadius: 0,
    worldViewId: 7,
    ownerPlayerId: 42,
    lifetimeTicks: 2,
});
assert.ok(expiringNpc);
assert.deepEqual(stateObservedAfterIndexing, {
    worldViewId: 7,
    ownerPlayerId: 42,
    indexed: true,
});
manager.tick(1, new Set());
assert.equal(manager.getById(expiringNpc.id), expiringNpc);
manager.tick(2, new Set());
assert.equal(manager.getById(expiringNpc.id), undefined, "lifetime expiry safely despawns the NPC");

const sharedNpc = manager.spawnTransientNpc({
    id: npcType.id,
    x: 3211,
    y: 3210,
    level: 0,
    worldViewId: 7,
});
const cleanupNpc = manager.spawnTransientNpc({
    id: npcType.id,
    x: 3212,
    y: 3210,
    level: 0,
    worldViewId: 7,
    ownerPlayerId: 42,
});
assert.ok(sharedNpc);
assert.ok(cleanupNpc);
assert.equal(manager.removeNpcsOwnedByPlayer(42), 1);
assert.equal(manager.getById(cleanupNpc.id), undefined);
assert.equal(manager.getById(sharedNpc.id), sharedNpc, "shared instance NPCs are not owner-cleaned");

const pendingRespawnNpc = manager.spawnTransientNpc({
    id: npcType.id,
    x: 3213,
    y: 3210,
    level: 0,
    worldViewId: 7,
    ownerPlayerId: 42,
});
assert.ok(pendingRespawnNpc);
assert.equal(manager.queueRespawn(pendingRespawnNpc.id, 100), true);
assert.equal(manager.removeNpcsOwnedByPlayer(42), 1, "owner cleanup also cancels pending respawns");
manager.tick(100, new Set());
assert.equal(manager.getById(pendingRespawnNpc.id), undefined);

console.log("scoped-npc.test.ts passed");
