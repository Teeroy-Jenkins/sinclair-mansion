/**
 * Regression coverage for RSMod's under-target combat movement rule.
 *
 * Run with: npx tsx tests/combat-large-npc-overlap.test.ts
 */
import assert from "node:assert/strict";

import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatTickEngine } from "../src/game/combat/engine/CombatTickEngine";
import type { CombatAttackTraits } from "../src/game/combat/model/CombatAttack";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import type { PathService } from "../src/pathfinding/PathService";

const TEST_GAMEMODE = {
    id: "large-npc-overlap-test",
    name: "Large NPC overlap test",
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

const MELEE_TRAITS: CombatAttackTraits = Object.freeze({
    type: AttackType.Melee,
    style: null,
    rangeTiles: 1,
    speedTicks: 4,
});

const player = new PlayerState(1, 3200, 3200, 0, TEST_GAMEMODE);
const dragon = new NpcState(
    2,
    1,
    3,
    -1,
    -1,
    32,
    { x: 3200, y: 3200, level: 0 },
    { maxHitpoints: 10 },
);

player.setCombatTarget(dragon);
dragon.engageCombat(player.id, 100, { tileX: player.tileX, tileY: player.tileY });

let npcPathCalls = 0;
const pathService = {
    edgeHasWallBetween: () => false,
    findPathSteps: (_request: unknown, options: { routeStrategy: unknown }) => {
        const strategy = options.routeStrategy as {
            hasArrived: (x: number, y: number, level: number, size: number) => boolean;
        };
        const end = { x: 3199, y: 3200 };
        assert.equal(strategy.hasArrived(end.x, end.y, 0, 1), true);
        return { ok: true, steps: [end], end };
    },
    findNpcPathStep: () => {
        npcPathCalls++;
        return { x: 3199, y: 3200 };
    },
} as unknown as PathService;

const engine = new CombatTickEngine({
    pathService,
    getPlayer: (id) => (id === player.id ? player : undefined),
    getNpc: (id) => (id === dragon.id ? dragon : undefined),
    getCombatants: () => [player, dragon],
    resolveAttackTraits: () => MELEE_TRAITS,
});

const overlapTick = engine.processTick(100);
assert.equal(overlapTick.statuses.get("moving"), 1);
assert.equal(overlapTick.statuses.get("unreachable"), 1);
assert.equal(player.hasPath(), true, "the attacking player should route out of the NPC footprint");
assert.equal(dragon.hasPath(), false, "a large NPC must hold while its overlapping target is busy");
assert.equal(npcPathCalls, 0, "the NPC must not compete with the player's escape route");

player.teleport(3199, 3200, 0);
const adjacentTick = engine.processTick(101);
assert.equal(adjacentTick.statuses.get("ready"), 2);
assert.equal(adjacentTick.preparedAttacks.length, 2);
assert.equal(npcPathCalls, 0);

console.log("large NPC overlap combat regression test passed");
