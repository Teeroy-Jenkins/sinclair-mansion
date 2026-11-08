import assert from "node:assert/strict";

import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatHitEvaluator } from "../src/game/combat/engine/CombatHitEvaluator";
import { CombatRetaliationEngine } from "../src/game/combat/engine/CombatRetaliationEngine";
import { CombatTickEngine } from "../src/game/combat/engine/CombatTickEngine";
import { CombatAttackStyle, type CombatAttackTraits } from "../src/game/combat/model/CombatAttack";
import { npcCombatEntityRef, playerCombatEntityRef } from "../src/game/combat/model/CombatEntityRef";
import { CombatPluginRegistry } from "../src/game/combat/plugins/CombatPluginRegistry";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { PlayerInteractionSystem } from "../src/game/interactions/PlayerInteractionSystem";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import type { PathService } from "../src/pathfinding/PathService";
import type { WebSocket } from "ws";

const TEST_GAMEMODE = {
    id: "combat-special-retaliation-test",
    name: "Combat special and retaliation test",
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

const pathService = {
    edgeHasWallBetween: () => false,
} as unknown as PathService;

const meleeTraits = (weaponId?: number, specialAttack: boolean = false): CombatAttackTraits => ({
    type: AttackType.Melee,
    style: CombatAttackStyle.Aggressive,
    rangeTiles: 1,
    speedTicks: weaponId === 4153 ? 7 : 4,
    weaponId,
    specialAttack,
});

function createNpc(id: number, x: number): NpcState {
    return new NpcState(id, 1, 1, -1, -1, 32, { x, y: 3200, level: 0 }, { maxHitpoints: 20 });
}

const retaliatingPlayer = new PlayerState(100, 3200, 3200, 0, TEST_GAMEMODE);
const npcAttacker = createNpc(200, 3201);
retaliatingPlayer.combatAttributes.set(CombatAttributes.ATTACK_DELAY, 91);

const retaliation = new CombatRetaliationEngine({
    pathService,
    getPlayer: (id) => (id === retaliatingPlayer.id ? retaliatingPlayer : undefined),
    getNpc: (id) => (id === npcAttacker.id ? npcAttacker : undefined),
    resolveAttackTraits: () => meleeTraits(),
});

assert.equal(retaliation.intercept(retaliatingPlayer, npcCombatEntityRef(npcAttacker.id), 50), true);
assert.deepEqual(
    retaliatingPlayer.combatAttributes.get(CombatAttributes.COMBAT_TARGET),
    npcCombatEntityRef(npcAttacker.id),
);
assert.equal(
    retaliatingPlayer.combatAttributes.get(CombatAttributes.ATTACK_DELAY),
    91,
    "auto-retaliation must preserve the absolute attack deadline",
);

const disabledPlayer = new PlayerState(101, 3200, 3200, 0, TEST_GAMEMODE);
disabledPlayer.combat.autoRetaliate = false;
const disabledRetaliation = new CombatRetaliationEngine({
    pathService,
    getPlayer: (id) => (id === disabledPlayer.id ? disabledPlayer : undefined),
    getNpc: (id) => (id === npcAttacker.id ? npcAttacker : undefined),
    resolveAttackTraits: () => meleeTraits(),
});
assert.equal(disabledRetaliation.intercept(disabledPlayer, npcCombatEntityRef(npcAttacker.id), 50), false);
assert.equal(disabledPlayer.combatAttributes.get(CombatAttributes.COMBAT_TARGET), null);

const retaliatingNpc = createNpc(203, 3201);
const npcTarget = new PlayerState(104, 3200, 3200, 0, TEST_GAMEMODE);
const npcRetaliation = new CombatRetaliationEngine({
    pathService,
    getPlayer: (id) => (id === npcTarget.id ? npcTarget : undefined),
    getNpc: (id) => (id === retaliatingNpc.id ? retaliatingNpc : undefined),
    resolveAttackTraits: () => meleeTraits(),
});
assert.equal(npcRetaliation.intercept(retaliatingNpc, playerCombatEntityRef(npcTarget.id), 50), true);
assert.equal(retaliatingNpc.combatAttributes.get(CombatAttributes.ATTACK_DELAY), 52);

const npcEngine = new CombatTickEngine({
    pathService,
    getPlayer: (id) => (id === npcTarget.id ? npcTarget : undefined),
    getNpc: (id) => (id === retaliatingNpc.id ? retaliatingNpc : undefined),
    getCombatants: () => [retaliatingNpc],
    resolveAttackTraits: () => meleeTraits(),
});
assert.equal(npcEngine.processTick(51).preparedAttacks.length, 0);
assert.equal(npcEngine.processTick(52).preparedAttacks.length, 1);

const cleanupPlayer = new PlayerState(105, 3200, 3200, 0, TEST_GAMEMODE);
const cleanupNpc = createNpc(204, 3201);
const cleanupSocket = {} as WebSocket;
cleanupPlayer.setInteraction("npc", cleanupNpc.id);
cleanupPlayer.setCombatTarget(cleanupNpc);
cleanupPlayer.combat.setInteractingNpc(cleanupNpc);
const interactionSystem = new PlayerInteractionSystem(
    {
        get: (ws) => (ws === cleanupSocket ? cleanupPlayer : undefined),
        getById: (id) => (id === cleanupPlayer.id ? cleanupPlayer : undefined),
        getSocketByPlayerId: (id) => (id === cleanupPlayer.id ? cleanupSocket : undefined),
        forEach: (callback) => callback(cleanupSocket, cleanupPlayer),
        forEachBot: () => undefined,
    },
    pathService,
);
interactionSystem.clearInteractionsWithNpc(cleanupNpc.id);
assert.equal(cleanupPlayer.getInteractionTarget(), undefined);
assert.equal(cleanupPlayer.getCombatTarget(), null);
assert.equal(cleanupPlayer.combat.getInteractingNpc(), null);

const gmaulPlayer = new PlayerState(102, 3200, 3200, 0, TEST_GAMEMODE);
const gmaulTarget = createNpc(201, 3201);
gmaulPlayer.combat.weaponItemId = 4153;
gmaulPlayer.setCombatTarget(gmaulTarget);
gmaulPlayer.specEnergy.setActivated(true);
gmaulPlayer.combatAttributes.set(CombatAttributes.ATTACK_DELAY, 500);

const gmaulEngine = new CombatTickEngine({
    pathService,
    getPlayer: (id) => (id === gmaulPlayer.id ? gmaulPlayer : undefined),
    getNpc: (id) => (id === gmaulTarget.id ? gmaulTarget : undefined),
    getCombatants: () => [gmaulPlayer],
    resolveAttackTraits: () => meleeTraits(4153, gmaulPlayer.specEnergy.isActivated()),
});
const gmaulTick = gmaulEngine.processTick(50);
assert.equal(gmaulTick.preparedAttacks.length, 1, "Gmaul must bypass an unexpired attack deadline");
assert.equal(gmaulTick.preparedAttacks[0].traits.specialAttack, true);
assert.equal(
    gmaulPlayer.combatAttributes.get(CombatAttributes.ATTACK_DELAY),
    500,
    "Gmaul must preserve the existing attack deadline",
);

const ddsPlayer = new PlayerState(103, 3200, 3200, 0, TEST_GAMEMODE);
const ddsTarget = createNpc(202, 3201);
const randomValues = [0.01, 0.2, 0.01, 0.8];
const evaluator = new CombatHitEvaluator({
    resolveEntity: (reference) =>
        reference.type === "player"
            ? reference.id === ddsPlayer.id
                ? ddsPlayer
                : undefined
            : reference.id === ddsTarget.id
              ? ddsTarget
              : undefined,
    getEquipmentBonuses: () => [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0],
    random: () => randomValues.shift() ?? 0.01,
});
const ddsAttack = {
    attacker: playerCombatEntityRef(ddsPlayer.id),
    target: npcCombatEntityRef(ddsTarget.id),
    attackClock: 50,
    traits: meleeTraits(1215, true),
} as const;
const ddsProfile = CombatPluginRegistry.shared.resolve({ weaponId: 1215 });
const ddsSpecial = ddsProfile.handleSpecialAttack?.(ddsPlayer, ddsTarget, ddsAttack);
assert.ok(ddsSpecial);
const ddsHits = evaluator.evaluateSpecialAttack(ddsAttack, ddsSpecial);
assert.equal(ddsHits.length, 2);
assert.equal(ddsHits[0].landed, true);
assert.equal(ddsHits[1].landed, true);
assert.notEqual(ddsHits[0].damage, ddsHits[1].damage, "DDS hits must perform separate damage rolls");
assert.equal(randomValues.length, 0, "DDS must consume an accuracy and damage roll per hit");

console.log("combat special and retaliation regression tests passed");
