import assert from "node:assert/strict";

import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import {
    DeferredHitQueue,
    DeferredHitsplatType,
} from "../src/game/combat/engine/DeferredHitQueue";
import type { CombatAttack } from "../src/game/combat/model/CombatAttack";
import {
    npcCombatEntityRef,
    playerCombatEntityRef,
} from "../src/game/combat/model/CombatEntityRef";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import {
    NpcPreDeathDecision,
    type NpcPreDeathEvent,
    type ScriptServices,
} from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";
import type { TickFrame } from "../src/network/wsServerTypes";

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});

const gamemode = {
    id: "npc-pre-death-test",
    name: "NPC pre-death test",
    initializePlayer: () => undefined,
    canInteract: () => true,
} as GamemodeDefinition;

function createRuntime(registry: ScriptRegistry): ScriptRuntime {
    return new ScriptRuntime({
        registry,
        scheduler: new ScriptScheduler(),
        services: { hotReloadEnabled: true } as unknown as ScriptServices,
        logger: {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined,
        },
    });
}

function createNpc(id = 500): NpcState {
    return new NpcState(
        id,
        777,
        1,
        -1,
        -1,
        32,
        { x: 3201, y: 3200, level: 0 },
        { maxHitpoints: 5 },
    );
}

const player = new PlayerState(10, 3200, 3200, 0, gamemode);
const npc = createNpc();
const registry = new ScriptRegistry();
const runtime = createRuntime(registry);
const baseHandler = () => NpcPreDeathDecision.Prevent;
registry.registerNpcPreDeath(npc.typeId, baseHandler);

runtime.registerHandlers("quest-boss-finisher", (scripts) => {
    scripts.registerNpcPreDeath(npc.typeId, () => NpcPreDeathDecision.Allow);
});
const event: Omit<NpcPreDeathEvent, "services"> = {
    npc,
    killer: player,
    killerPlayerId: player.id,
    tick: 100,
    hit: {
        proposedDamage: 8,
        style: 1,
        maxHit: 8,
        hitpointsBefore: 5,
        hitpointsAfter: 0,
        cause: "combat",
    },
};
assert.equal(runtime.runNpcPreDeath(event), false, "the newest registration must win");

let restoredDuringReload: unknown;
runtime.registerHandlers("quest-boss-finisher", (scripts) => {
    restoredDuringReload = scripts.findNpcPreDeath(npc.typeId);
    scripts.registerNpcPreDeath(npc.typeId, () => NpcPreDeathDecision.Prevent);
});
assert.equal(
    restoredDuringReload,
    baseHandler,
    "hot reload must unregister the previous generation before registering the next",
);
assert.equal(runtime.runNpcPreDeath(event), true);

const instanceAllow = registry.registerNpcPreDeath(npc.id, () => NpcPreDeathDecision.Allow);
assert.equal(
    runtime.runNpcPreDeath(event),
    false,
    "an instance-specific guard must take precedence over the NPC type guard",
);
instanceAllow.unregister();
assert.equal(runtime.runNpcPreDeath(event), true, "unregister must restore the type guard");

const combatRegistry = new ScriptRegistry();
const combatRuntime = createRuntime(combatRegistry);
let observedEvent: NpcPreDeathEvent | undefined;
const guard = combatRegistry.registerNpcPreDeath(777, (lethalEvent) => {
    observedEvent = lethalEvent;
    return NpcPreDeathDecision.Prevent;
});
let currentNpc = createNpc(600);
let downstreamDeaths = 0;
const queue = new DeferredHitQueue({
    resolveEntity: (reference) =>
        reference.id === player.id
            ? player
            : reference.id === currentNpc.id
              ? currentNpc
              : undefined,
    onNpcLethalHit: ({
        npc: target,
        source,
        proposedDamage,
        style,
        hitpointsBefore,
        appliedClock,
        pending,
    }) =>
        combatRuntime.runNpcPreDeath({
            npc: target,
            killer: source instanceof PlayerState ? source : undefined,
            killerPlayerId: source instanceof PlayerState ? source.id : undefined,
            tick: appliedClock,
            hit: {
                proposedDamage,
                style,
                maxHit: pending.maxHit,
                hitpointsBefore,
                hitpointsAfter: Math.max(0, hitpointsBefore - proposedDamage),
                cause: "combat",
            },
        }),
    onHitApplied: (hit) => {
        if (hit.hpCurrent <= 0) downstreamDeaths++;
    },
});
const attack: CombatAttack = Object.freeze({
    attacker: playerCombatEntityRef(player.id),
    target: npcCombatEntityRef(currentNpc.id),
    attackClock: 200,
    traits: Object.freeze({
        type: AttackType.Melee,
        style: null,
        rangeTiles: 1,
        speedTicks: 4,
    }),
});
const enqueueLethalHit = (revealClock: number): void => {
    queue.enqueue({
        attack,
        source: playerCombatEntityRef(player.id),
        target: npcCombatEntityRef(currentNpc.id),
        damage: 8,
        maxHit: 8,
        landed: true,
        hitsplatType: DeferredHitsplatType.Normal,
        attackType: AttackType.Melee,
        revealClock,
        profileId: "test:quest-finisher",
    });
};

enqueueLethalHit(200);
const protectedFrame = { hitsplats: [] } as unknown as TickFrame;
const protectedHits = queue.processTick(200, protectedFrame);
assert.equal(protectedHits[0]?.amount, 4);
assert.equal(currentNpc.getHitpoints(), 1);
assert.equal(downstreamDeaths, 0, "prevented hits must not enter normal death processing");
assert.equal(observedEvent?.npc, currentNpc);
assert.equal(observedEvent?.killer, player);
assert.equal(observedEvent?.killerPlayerId, player.id);
assert.equal(observedEvent?.hit.proposedDamage, 8);
assert.equal(observedEvent?.hit.hitpointsBefore, 5);
assert.equal(observedEvent?.hit.hitpointsAfter, 0);

guard.unregister();
currentNpc = createNpc(600);
enqueueLethalHit(201);
const ordinaryFrame = { hitsplats: [] } as unknown as TickFrame;
const ordinaryHits = queue.processTick(201, ordinaryFrame);
assert.equal(ordinaryHits[0]?.amount, 5);
assert.equal(currentNpc.getHitpoints(), 0);
assert.equal(downstreamDeaths, 1, "unhandled lethal hits must preserve ordinary death behavior");

console.log("npc-pre-death-script.test.ts: all assertions passed");
