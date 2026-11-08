import assert from "node:assert/strict";

import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatHitProcessor } from "../src/game/combat/engine/CombatHitProcessor";
import {
    CombatAttackStyle,
    type CombatAttack,
} from "../src/game/combat/model/CombatAttack";
import {
    npcCombatEntityRef,
    playerCombatEntityRef,
} from "../src/game/combat/model/CombatEntityRef";
import { CombatPluginRegistry } from "../src/game/combat/plugins/CombatPluginRegistry";
import { SpecialAttackContainer } from "../src/game/combat/plugins/SpecialAttackContainer";
import type { ServerServices } from "../src/game/ServerServices";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";

const TEST_GAMEMODE = {
    id: "combat-dragon-halberd-special-test",
    name: "Combat dragon halberd special test",
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

const DRAGON_HALBERD_ITEM_ID = 3204;

function createPlayer(id: number, x: number, y: number): PlayerState {
    const player = new PlayerState(id, x, y, 0, TEST_GAMEMODE);
    player.combat.weaponItemId = DRAGON_HALBERD_ITEM_ID;
    player.specEnergy.setActivated(true);
    return player;
}

function createNpc(id: number, x: number, y: number, size = 1): NpcState {
    return new NpcState(id, 1, size, -1, -1, 32, { x, y, level: 0 }, {
        maxHitpoints: 100,
        combatLevel: 32,
    });
}

function createAttack(player: PlayerState, target: NpcState): CombatAttack {
    return Object.freeze({
        attacker: playerCombatEntityRef(player.id),
        target: npcCombatEntityRef(target.id),
        attackClock: 50,
        traits: Object.freeze({
            type: AttackType.Melee,
            style: CombatAttackStyle.Aggressive,
            rangeTiles: 2,
            speedTicks: 7,
            weaponId: DRAGON_HALBERD_ITEM_ID,
            specialAttack: true,
        }),
    });
}

function processSweep(player: PlayerState, npcs: readonly NpcState[]) {
    const processor = new CombatHitProcessor({
        players: {
            getById: (id: number) => (id === player.id ? player : undefined),
            getAllPlayersForSync: () => [player],
        },
        npcManager: {
            getById: (id: number) => npcs.find((npc) => npc.id === id),
            forEach: (callback: (npc: NpcState) => void) => npcs.forEach(callback),
            hasNpcOption: () => true,
        },
        equipmentService: {
            computeEquipmentStatBonuses: () => new Array<number>(14).fill(0),
        },
        messagingService: { queueChatMessage: () => undefined },
        variableService: { queueVarp: () => undefined },
        queueCombatState: () => undefined,
        broadcastService: {
            enqueueSpotAnimation: () => undefined,
            queueBroadcastSound: () => undefined,
        },
    } as unknown as ServerServices);
    const result = processor.processPreparedAttacks([createAttack(player, npcs[0])], 50);
    return { processor, result };
}

assert.equal(SpecialAttackContainer.get(DRAGON_HALBERD_ITEM_ID)?.energyCost, 30);
const profile = CombatPluginRegistry.shared.resolve({ weaponId: DRAGON_HALBERD_ITEM_ID });
assert.equal(profile.id, "core:dragon_halberd");
const profilePlayer = createPlayer(1, 3200, 5700);
const profileTarget = createNpc(2, 3200, 5702);
const special = profile.handleSpecialAttack?.(
    profilePlayer,
    profileTarget,
    createAttack(profilePlayer, profileTarget),
);
assert.ok(special);
assert.equal(special.damageMultiplier, 1.1);
assert.equal(special.meleeAttackBonusIndex, 1);
assert.equal(special.meleeDefenceBonusIndex, 1);
assert.equal(special.attackAnimation, 1203);
assert.equal(special.castGraphic?.id, 282);
assert.equal(special.targeting?.width, 3);
assert.equal(special.targeting?.maxTargets, 10);
assert.equal(special.targeting?.largeTargetExtraHit?.accuracyMultiplier, 0.75);

// Facing north: Sweep covers the primary tile and one tile to either side.
const areaPlayer = createPlayer(10, 3210, 5700);
const primary = createNpc(20, 3210, 5702);
const left = createNpc(21, 3209, 5702);
const right = createNpc(22, 3211, 5702);
const stacked = createNpc(23, 3210, 5702);
const outside = createNpc(24, 3212, 5702);
const area = processSweep(areaPlayer, [primary, left, right, stacked, outside]);
assert.equal(area.result.processedAttacks, 1);
assert.equal(area.result.queuedHits, 4);
assert.equal(area.processor.getPendingHitCount(), 4);
assert.equal(areaPlayer.specEnergy.getPercent(), 70);

// A footprint qualifies when any occupied tile intersects the sweep line.
const footprintPlayer = createPlayer(30, 3210, 5700);
const footprintPrimary = createNpc(40, 3210, 5702);
const footprintTarget = createNpc(41, 3208, 5702, 2);
const footprint = processSweep(footprintPlayer, [footprintPrimary, footprintTarget]);
assert.equal(footprint.result.queuedHits, 2);

// In single combat, a small target receives only the primary hit.
const singlePlayer = createPlayer(50, 3200, 3200);
const singlePrimary = createNpc(60, 3200, 3202);
const singleAdjacent = createNpc(61, 3199, 3202);
const single = processSweep(singlePlayer, [singlePrimary, singleAdjacent]);
assert.equal(single.result.queuedHits, 1);

// A large primary replaces the area sweep with one independent second hit.
const largePlayer = createPlayer(70, 3210, 5700);
const largePrimary = createNpc(80, 3210, 5702, 3);
const largeAdjacent = createNpc(81, 3209, 5702);
const large = processSweep(largePlayer, [largePrimary, largeAdjacent]);
assert.equal(large.result.queuedHits, 2);
assert.equal(large.processor.getPendingHitCount(), 2);

// The OSRS cap includes the primary target, leaving at most nine area targets.
const cappedPlayer = createPlayer(90, 3210, 5700);
const cappedPrimary = createNpc(100, 3210, 5702);
const stackedTargets = Array.from({ length: 12 }, (_, index) =>
    createNpc(101 + index, 3211, 5702),
);
const capped = processSweep(cappedPlayer, [cappedPrimary, ...stackedTargets]);
assert.equal(capped.result.queuedHits, 10);

console.log("dragon halberd special regression tests passed");
