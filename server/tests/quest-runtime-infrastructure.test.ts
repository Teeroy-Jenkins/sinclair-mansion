import assert from "node:assert/strict";

import { unpackTemplateChunk } from "../../client/common/instance/InstanceTypes";
import { ServerPacketId } from "../../client/common/packets/ServerPacketId";
import { decodeServerPacket } from "../../client/network/packet/ServerBinaryDecoder";
import { CollisionMap } from "../../client/rs/scene/CollisionMap";
import type { ServerServices } from "../src/game/ServerServices";
import { TaskPriority } from "../src/game/model/queue/TaskPriority";
import { WaitCondition, createTask } from "../src/game/model/queue/QueueTask";
import type { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import { NpcAttackDecision, type ScriptServices } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";
import { ServerBinaryEncoder } from "../src/network/packet/ServerBinaryEncoder";
import { InstancedAreaManager, buildInstanceTemplate } from "../src/world/InstancedAreaManager";

const encoder = new ServerBinaryEncoder();
for (const payload of [
    { mode: "reset" } as const,
    { mode: "move", x: 2506, y: 4645, height: 500, instant: true } as const,
    { mode: "look", x: 2509, y: 4644, height: 100, instant: false } as const,
    { mode: "shake", slot: 2, randomAmplitude: 4, sineAmplitude: 8, sineFrequency: 12 } as const,
]) {
    const packet = encoder.encodeCameraControl(payload);
    assert.equal(packet[0], ServerPacketId.CAMERA_CONTROL);
    assert.deepEqual(decodeServerPacket(packet), { type: "camera", payload });
}

const scheduler = new ScriptScheduler();
const fired: string[] = [];
scheduler.scheduleIn(100, 2, () => fired.push("player"), { kind: "player", id: 1 });
scheduler.scheduleIn(100, 2, () => fired.push("npc"), { kind: "npc", id: 1 });
assert.equal(scheduler.cancelOwner({ kind: "player", id: 1 }), 1);
scheduler.process(102);
assert.deepEqual(fired, ["npc"]);

let cleanedUp = false;
const queueTask = createTask({}, TaskPriority.STRONG, function* () {
    try {
        yield new WaitCondition(10);
    } finally {
        cleanedUp = true;
    }
});
assert.equal(queueTask.invoke(), true);
queueTask.terminate();
assert.equal(cleanedUp, true, "terminating a cutscene must execute its cleanup block");

const template = buildInstanceTemplate([{
    sourceBaseX: 2504,
    sourceBaseY: 4624,
    widthChunks: 2,
    heightChunks: 2,
    sourcePlanes: [0],
    destinationChunkX: 5,
    destinationChunkY: 6,
    rotation: 1,
}]);
assert.deepEqual(unpackTemplateChunk(template[0][5][6]), {
    plane: 0,
    chunkX: 313,
    chunkY: 578,
    rotation: 1,
});
assert.deepEqual(unpackTemplateChunk(template[0][6][7]), {
    plane: 0,
    chunkX: 314,
    chunkY: 579,
    rotation: 1,
});

const lifecycle: string[] = [];
let spawnedConfig: Record<string, unknown> | undefined;
const player = {
    id: 42,
    worldViewId: -1,
    instanceNpcIds: new Set<number>(),
} as unknown as PlayerState;
const instanceServices = {
    mapService: {
        buildInstanceCollision: () => Array.from({ length: 4 }, () => new CollisionMap(104, 104)),
    },
    pathService: {
        registerWorldViewCollision: (worldViewId: number) => lifecycle.push(`register:${worldViewId}`),
        removeWorldViewCollision: (worldViewId: number) => lifecycle.push(`remove:${worldViewId}`),
    },
    npcManager: {
        spawnTransientNpc: (config: Record<string, unknown>) => {
            spawnedConfig = config;
            return { id: 700 };
        },
        removeNpcsOwnedByPlayer: (playerId: number) => lifecycle.push(`npcs:${playerId}`),
    },
    movementService: {
        teleportToInstance: () => lifecycle.push("enter"),
        teleportPlayer: (_player: PlayerState, x: number, y: number, level: number) => lifecycle.push(`exit:${x}:${y}:${level}`),
    },
    locationService: {},
    scriptScheduler: {
        cancelOwner: () => {
            lifecycle.push("tasks");
            return 0;
        },
    },
    groundItems: {
        removeOwnedByPlayer: (playerId: number, worldViewId: number) => lifecycle.push(`items:${playerId}:${worldViewId}`),
    },
} as unknown as ServerServices;
const instances = new InstancedAreaManager(instanceServices);
const handle = instances.create(player, {
    templateChunks: template,
    destination: { x: 2515, y: 4631, level: 0 },
    exit: { x: 2509, y: 3640, level: 1 },
    npcs: [{ id: 4424, offsetX: 54, offsetY: 57, level: 0 }],
});
assert(handle);
assert.equal(player.worldViewId, handle.worldViewId);
assert.equal(spawnedConfig?.worldViewId, handle.worldViewId);
assert.equal(spawnedConfig?.ownerPlayerId, player.id);
assert(player.instanceNpcIds.has(700));
assert.equal(instances.dispose(player), true);
assert.equal(player.worldViewId, -1);
assert.deepEqual(lifecycle, [
    `register:${handle.worldViewId}`,
    "enter",
    "tasks",
    `npcs:${player.id}`,
    `items:${player.id}:${handle.worldViewId}`,
    `remove:${handle.worldViewId}`,
    "exit:2509:3640:1",
]);

const registry = new ScriptRegistry();
const runtime = new ScriptRuntime({
    registry,
    scheduler: new ScriptScheduler(),
    services: {} as ScriptServices,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
});
const npc = { id: 600, typeId: 6361 };
const target = { id: 42 };
const attack = { attacker: { type: "npc", id: 600 }, target: { type: "player", id: 42 }, attackClock: 50, traits: { type: "melee", style: null, rangeTiles: 1, speedTicks: 4 } };
registry.registerNpcAttack(6361, () => NpcAttackDecision.Prevent);
assert.equal(runtime.runNpcAttack({ npc, target, attack, tick: 50 } as never), true);
const instanceAllow = registry.registerNpcAttack(600, () => NpcAttackDecision.Allow);
assert.equal(runtime.runNpcAttack({ npc, target, attack, tick: 50 } as never), false);
instanceAllow.unregister();
assert.equal(runtime.runNpcAttack({ npc, target, attack, tick: 50 } as never), true);

console.log("quest-runtime-infrastructure.test.ts: all assertions passed");
