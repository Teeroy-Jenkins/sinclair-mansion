/**
 * Regression coverage for typed combat targets surviving neither death nor
 * registry-slot reuse after an NPC respawn.
 *
 * Run with: npx tsx tests/combat-engagement-lifecycle.test.ts
 */
import assert from "node:assert/strict";

import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatTickEngine } from "../src/game/combat/engine/CombatTickEngine";
import type { CombatAttackTraits } from "../src/game/combat/model/CombatAttack";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import type { PathService } from "../src/pathfinding/PathService";

const TEST_GAMEMODE = {
    id: "combat-lifecycle-test",
    name: "Combat lifecycle test",
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

function createNpc(id: number): NpcState {
    return new NpcState(id, 1, 1, -1, -1, 32, { x: 3201, y: 3200, level: 0 }, { maxHitpoints: 2 });
}

const player = new PlayerState(30, 3200, 3200, 0, TEST_GAMEMODE);
let currentNpc: NpcState | undefined = createNpc(3);
player.setCombatTarget(currentNpc);
player.setPath([{ x: 3201, y: 3200 }], false);

const engine = new CombatTickEngine({
    pathService: {} as PathService,
    getPlayer: (id) => (id === player.id ? player : undefined),
    getNpc: (id) => (id === currentNpc?.id ? currentNpc : undefined),
    getCombatants: () => [player],
    resolveAttackTraits: () => MELEE_TRAITS,
});

currentNpc.applyDamage(currentNpc.getHitpoints());
const deathTick = engine.processTick(201);

assert.equal(deathTick.activeInteractions, 1);
assert.equal(deathTick.statuses.get("ended"), 1);
assert.equal(player.combatAttributes.get(CombatAttributes.COMBAT_TARGET), null);
assert.equal(player.hasPath(), false);

currentNpc = createNpc(3);
const respawnTick = engine.processTick(202);

assert.equal(respawnTick.activeInteractions, 0);
assert.equal(respawnTick.preparedAttacks.length, 0);
assert.equal(
    player.combatAttributes.get(CombatAttributes.COMBAT_TARGET),
    null,
    "registry reuse must not resurrect a cleared combat interaction",
);

// Stun is an action/movement lock, not a combat disengage. The NPC retains
// aggro and can immediately attack again once the Shove stun expires.
const stunnedNpc = createNpc(4);
stunnedNpc.engageCombat(player.id, 300, player);
stunnedNpc.combatAttributes.set(CombatAttributes.STUN_UNTIL_CLOCK, 305);
const stunnedEngine = new CombatTickEngine({
    pathService: { edgeHasWallBetween: () => false } as PathService,
    getPlayer: (id) => (id === player.id ? player : undefined),
    getNpc: (id) => (id === stunnedNpc.id ? stunnedNpc : undefined),
    getCombatants: () => [stunnedNpc],
    resolveAttackTraits: () => MELEE_TRAITS,
});
const stunnedTick = stunnedEngine.processTick(301);
assert.equal(stunnedTick.statuses.get("unavailable"), 1);
assert.deepEqual(stunnedNpc.getCombatTargetPlayerId(), player.id);
const resumedTick = stunnedEngine.processTick(305);
assert.equal(resumedTick.preparedAttacks.length, 1);

console.log("combat engagement lifecycle regression test passed");
