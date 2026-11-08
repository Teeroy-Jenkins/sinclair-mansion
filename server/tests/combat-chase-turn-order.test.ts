/**
 * Melee against a target that starts walking away, under OSRS turn order: NPCs, then players in
 * PID order, each moving and then interacting with players/NPCs. The engine moves everyone first,
 * so combat must see a target whose turn comes later where it stood at the start of the tick.
 *
 * Run with: npx tsx tests/combat-chase-turn-order.test.ts
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

const MODE = { id: "chase-test", name: "Chase test", initializePlayer: () => undefined, canInteract: () => true } as GamemodeDefinition;
registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});
const MELEE: CombatAttackTraits = Object.freeze({ type: AttackType.Melee, style: null, rangeTiles: 1, speedTicks: 4 });
// Open ground; routing isn't under test (a chaser that can't hit just reports "moving"/"unreachable").
const pathService = {
    edgeHasWallBetween: () => false,
    findPathSteps: () => ({ ok: false }),
    findNpcPathStep: () => undefined,
} as unknown as PathService;

/** One tick: everyone's turn-start tile, then the target walks a tile east, then combat runs. */
function chaseTick(attacker: PlayerState | NpcState, target: PlayerState, tick: number): number {
    if (attacker instanceof PlayerState) attacker.markTurnStart(tick);
    target.markTurnStart(tick);
    target.teleport(target.tileX + 1, target.tileY, target.level); // a one-tile walk
    const engine = new CombatTickEngine({
        pathService,
        getPlayer: (id) => (id === target.id ? target : id === attacker.id && attacker instanceof PlayerState ? attacker : undefined),
        getNpc: (id) => (attacker instanceof NpcState && id === attacker.id ? attacker : undefined),
        getCombatants: () => [attacker],
        resolveAttackTraits: () => MELEE,
    });
    return engine.processTick(tick).preparedAttacks.length;
}

function players(attackerPid: number, targetPid: number) {
    const attacker = new PlayerState(1, 3200, 3200, 0, MODE);
    const target = new PlayerState(2, 3201, 3200, 0, MODE); // adjacent, east
    attacker.setPidPriority(attackerPid);
    target.setPidPriority(targetPid);
    attacker.setCombatTarget(target);
    return { attacker, target };
}

// Attacker's turn first (lower PID): the target is still beside them, so the hit lands as they leave.
{
    const { attacker, target } = players(10, 20);
    assert.equal(chaseTick(attacker, target, 100), 1, "attacker with the lower PID hits a target walking away");
}

// Target's turn first: it has already stepped away, so no hit this tick (as in OSRS).
{
    const { attacker, target } = players(20, 10);
    assert.equal(chaseTick(attacker, target, 100), 0, "attacker with the higher PID sees the target already gone");
}

// NPCs take their turn before every player, so an NPC beside a fleeing player still hits it.
{
    const target = new PlayerState(2, 3201, 3200, 0, MODE);
    const npc = new NpcState(5, 1, 1, -1, -1, 32, { x: 3200, y: 3200, level: 0 }, { maxHitpoints: 10 });
    npc.engageCombat(target.id, 99, target);
    assert.equal(chaseTick(npc, target, 100), 1, "an NPC hits a player who walks away from beside it");
}

// A teleport isn't a walk: the old tile doesn't count.
{
    const { attacker, target } = players(10, 20);
    attacker.markTurnStart(200);
    target.markTurnStart(200);
    target.teleport(3220, 3200, 0);
    const engine = new CombatTickEngine({
        pathService,
        getPlayer: (id) => (id === target.id ? target : id === attacker.id ? attacker : undefined),
        getNpc: () => undefined,
        getCombatants: () => [attacker],
        resolveAttackTraits: () => MELEE,
    });
    assert.equal(engine.processTick(200).preparedAttacks.length, 0, "no hit on a target that teleported away");
}

console.log("combat chase turn-order test passed");
