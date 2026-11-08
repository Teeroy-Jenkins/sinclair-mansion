// An NPC that changes floor on the same x, y (the mansion's bots taking the stairs) must be found
// on its new floor: player NPC sync looks NPCs up through NpcManager.getNearby.
import assert from "node:assert/strict";

import type { BasTypeLoader } from "../../client/rs/config/bastype/BasTypeLoader";
import type { NpcType } from "../../client/rs/config/npctype/NpcType";
import type { NpcTypeLoader } from "../../client/rs/config/npctype/NpcTypeLoader";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { NpcManager } from "../src/game/npcManager";
import type { PathService } from "../src/pathfinding/PathService";
import type { MapCollisionService } from "../src/world/MapCollisionService";

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});

const npcType = {
    id: 32001,
    name: "Stair climber",
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
        findNpcPathStep: () => undefined,
    } as unknown as PathService,
    { load: () => npcType } as unknown as NpcTypeLoader,
    {} as BasTypeLoader,
);

const ids = (level: number) => manager.getNearby(2736, 3580, level, 5).map((n) => n.id);

const npc = manager.spawnTransientNpc({ id: npcType.id, x: 2736, y: 3580, level: 0, wanderRadius: 0 });
assert.ok(npc);
npc.scriptControlled = true;
assert.deepEqual(ids(0), [npc.id]);
assert.deepEqual(ids(1), []);

// Up the stairs: same x, y, one floor up.
npc.teleport(2736, 3580, 1);
manager.tick(1, new Set([npc.id]));
assert.deepEqual(ids(1), [npc.id], "found upstairs after climbing");
assert.deepEqual(ids(0), [], "no longer listed downstairs");

// Up a floor and a step away in the same tick, then back down again.
npc.teleport(2737, 3580, 0);
manager.tick(2, new Set([npc.id]));
assert.deepEqual(manager.getNearby(2737, 3580, 0, 0).map((n) => n.id), [npc.id]);
assert.deepEqual(ids(1), []);

// A scripted teleport is filed straight away, before the NPC's next tick: NPCs are only ticked
// when a lookup near a player finds them, so a stale entry would never get fixed.
npc.teleport(2736, 3580, 1);
manager.syncIndex(npc);
assert.deepEqual(ids(1), [npc.id], "found upstairs without waiting for a tick");
assert.deepEqual(ids(0), []);

console.log("npc floor change: ok");
