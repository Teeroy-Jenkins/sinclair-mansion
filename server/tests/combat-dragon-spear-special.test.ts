import assert from "node:assert/strict";

import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatHitProcessor } from "../src/game/combat/engine/CombatHitProcessor";
import type { CombatEntity } from "../src/game/combat/engine/CombatTargetResolver";
import { CombatAttackStyle, type CombatAttack } from "../src/game/combat/model/CombatAttack";
import {
    npcCombatEntityRef,
    playerCombatEntityRef,
} from "../src/game/combat/model/CombatEntityRef";
import { CombatPluginRegistry } from "../src/game/combat/plugins/CombatPluginRegistry";
import { SpecialAttackContainer } from "../src/game/combat/plugins/SpecialAttackContainer";
import {
    DRAGON_SPEAR_ITEM_IDS,
    DRAGON_SPEAR_PROFILE,
} from "../src/game/combat/plugins/special-attacks/DragonSpearSpec";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import type { ServerServices } from "../src/game/ServerServices";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { STUN_TIMER } from "../src/game/model/timer/Timers";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";

const TEST_GAMEMODE = {
    id: "combat-dragon-spear-special-test",
    name: "Combat dragon spear special test",
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

const TICK = 50;
const WEAPON_ID = 1249;

function createPlayer(id: number, x: number, y: number): PlayerState {
    const player = new PlayerState(id, x, y, 0, TEST_GAMEMODE);
    player.combat.weaponItemId = WEAPON_ID;
    player.specEnergy.setActivated(true);
    return player;
}

function createNpc(id: number, x: number, y: number, size = 1): NpcState {
    return new NpcState(id, 1, size, -1, -1, 32, { x, y, level: 0 }, {
        maxHitpoints: 100,
        combatLevel: 32,
    });
}

function createAttack(attacker: PlayerState, target: CombatEntity): CombatAttack {
    return Object.freeze({
        attacker: playerCombatEntityRef(attacker.id),
        target: target instanceof PlayerState
            ? playerCombatEntityRef(target.id)
            : npcCombatEntityRef(target.id),
        attackClock: TICK,
        traits: Object.freeze({
            type: AttackType.Melee,
            style: CombatAttackStyle.Controlled,
            rangeTiles: 1,
            speedTicks: 4,
            weaponId: WEAPON_ID,
            specialAttack: true,
        }),
    });
}

function processShove(
    attacker: PlayerState,
    target: CombatEntity,
    canStep = true,
): {
    result: ReturnType<CombatHitProcessor["processPreparedAttacks"]>;
    messages: string[];
    sounds: number[];
    spots: number[];
    frame: { npcUpdates: Array<{ id: number; directions?: number[] }>; playerSteps: Map<number, unknown[]> };
} {
    const players = [attacker, ...(target instanceof PlayerState ? [target] : [])];
    const npcs = target instanceof NpcState ? [target] : [];
    const messages: string[] = [];
    const sounds: number[] = [];
    const spots: number[] = [];
    const frame = { npcUpdates: [], playerSteps: new Map<number, unknown[]>() };
    const processor = new CombatHitProcessor({
        players: {
            getById: (id: number) => players.find((player) => player.id === id),
            getAllPlayersForSync: () => players,
        },
        npcManager: {
            getById: (id: number) => npcs.find((npc) => npc.id === id),
            forEach: (callback: (npc: NpcState) => void) => npcs.forEach(callback),
            hasNpcOption: () => true,
        },
        pathService: { canActorStep: () => canStep },
        messagingService: {
            queueChatMessage: (message: { text: string }) => messages.push(message.text),
        },
        activeFrame: frame,
        variableService: { queueVarp: () => undefined },
        queueCombatState: () => undefined,
        broadcastService: {
            enqueueSpotAnimation: (spot: { spotId: number }) => spots.push(spot.spotId),
            queueBroadcastSound: (sound: { soundId: number }) => sounds.push(sound.soundId),
        },
    } as unknown as ServerServices);
    return {
        result: processor.processPreparedAttacks([createAttack(attacker, target)], TICK),
        messages,
        sounds,
        spots,
        frame,
    };
}

for (const itemId of DRAGON_SPEAR_ITEM_IDS) {
    assert.equal(SpecialAttackContainer.get(itemId)?.energyCost, 25);
    assert.equal(CombatPluginRegistry.shared.resolve({ weaponId: itemId }).id, "core:dragon_spear");
}

const special = DRAGON_SPEAR_PROFILE.handleSpecialAttack?.(
    createPlayer(1, 3200, 3200),
    createPlayer(2, 3201, 3200),
    createAttack(createPlayer(3, 3200, 3200), createPlayer(4, 3201, 3200)),
);
assert.ok(special);
assert.equal(special.energyCostPercent, 25);
assert.equal(special.skipAttack, true);
assert.equal(special.hitCount, 0);
assert.equal(special.attackAnimation, 1064);
assert.equal(special.attackSoundId, 2544);

// Cardinal shove: one tile away, no hitsplat, five-tick stun, then immunity.
const attacker = createPlayer(10, 3200, 3200);
const playerTarget = createPlayer(11, 3201, 3200);
const cardinal = processShove(attacker, playerTarget);
assert.deepEqual(cardinal.result, { processedAttacks: 1, queuedHits: 0, rejectedAttacks: 0 });
assert.equal(attacker.specEnergy.getPercent(), 75);
assert.equal(playerTarget.tileX, 3202);
assert.equal(playerTarget.tileY, 3200);
assert.equal(playerTarget.timers.getOrDefault(STUN_TIMER), 5);
assert.equal(playerTarget.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK), 55);
assert.equal(playerTarget.combatAttributes.get(CombatAttributes.STUN_IMMUNITY_UNTIL_CLOCK), 56);
assert.equal(playerTarget.combatAttributes.get(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK), 60);
assert.equal(playerTarget.prepareMovementFrame(TICK + 1), false);
assert.equal(attacker.popPendingSeq()?.seqId, 1064);
assert.deepEqual(cardinal.sounds, [2544]);
assert.deepEqual(cardinal.spots, [253, 80]);

// Repeated Shove during the stun/immunity window fails without spending energy.
attacker.specEnergy.setActivated(true);
const repeated = processShove(attacker, playerTarget);
assert.deepEqual(repeated.result, { processedAttacks: 0, queuedHits: 0, rejectedAttacks: 1 });
assert.equal(attacker.specEnergy.getPercent(), 75);

// Static collision prevents displacement, but the valid target is still stunned.
const blockedAttacker = createPlayer(20, 3210, 3200);
const blockedTarget = createPlayer(21, 3211, 3200);
const blocked = processShove(blockedAttacker, blockedTarget, false);
assert.equal(blocked.result.processedAttacks, 1);
assert.equal(blockedTarget.tileX, 3211);
assert.equal(blockedTarget.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK), 55);
assert.equal(blockedAttacker.specEnergy.getPercent(), 75);

// Diagonal attackers shove along the same facing line.
const diagonalAttacker = createPlayer(30, 3220, 3220);
const diagonalTarget = createNpc(31, 3221, 3221);
processShove(diagonalAttacker, diagonalTarget);
assert.deepEqual([diagonalTarget.tileX, diagonalTarget.tileY], [3222, 3222]);
assert.equal(diagonalTarget.combatAttributes.get(CombatAttributes.ATTACK_DELAY), 55);
assert.equal(diagonalTarget.prepareMovementFrame(TICK + 1), false);
assert.equal(diagonalTarget.isFrozen(TICK + 1), true);
assert.equal(diagonalTarget.getCombatTargetPlayerId(), diagonalAttacker.id);

// NPC movement happens during combat, after normal movement syncing. The Shove
// step must therefore be in the active frame rather than waiting a tick.
const syncedAttacker = createPlayer(35, 3220, 3230);
const syncedTarget = createNpc(36, 3221, 3230);
const synced = processShove(syncedAttacker, syncedTarget);
assert.deepEqual(synced.frame.npcUpdates, [{
    id: syncedTarget.id,
    x: syncedTarget.x,
    y: syncedTarget.y,
    level: syncedTarget.level,
    rot: syncedTarget.rot,
    orientation: syncedTarget.getOrientation() & 2047,
    moved: true,
    directions: [4],
    traversals: [1],
    typeId: syncedTarget.typeId,
    size: syncedTarget.size,
    spawnX: syncedTarget.spawnX,
    spawnY: syncedTarget.spawnY,
    spawnLevel: syncedTarget.spawnLevel,
}]);

// NPC footprints larger than 1x1 reject the special and preserve energy.
const largeAttacker = createPlayer(40, 3230, 3200);
const largeTarget = createNpc(41, 3231, 3200, 2);
const large = processShove(largeAttacker, largeTarget);
assert.deepEqual(large.result, { processedAttacks: 0, queuedHits: 0, rejectedAttacks: 1 });
assert.equal(largeAttacker.specEnergy.getPercent(), 100);
assert.deepEqual([largeTarget.tileX, largeTarget.tileY], [3231, 3200]);
assert.deepEqual(large.messages, ["That creature is too large to knock back!"]);

console.log("dragon spear special regression tests passed");
