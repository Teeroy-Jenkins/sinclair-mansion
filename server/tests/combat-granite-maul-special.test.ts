import assert from "node:assert/strict";

import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatHitProcessor } from "../src/game/combat/engine/CombatHitProcessor";
import { CombatTickEngine } from "../src/game/combat/engine/CombatTickEngine";
import {
    CombatAttackStyle,
    type CombatAttackTraits,
} from "../src/game/combat/model/CombatAttack";
import { SpecialAttackContainer } from "../src/game/combat/plugins/SpecialAttackContainer";
import {
    getGraniteMaulSpecialAttackEnergyCost,
    queueGraniteMaulSpecialAttackInput,
} from "../src/game/combat/plugins/special-attacks/GraniteMaulSpecialAttack";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import type { ServerServices } from "../src/game/ServerServices";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import type { PathService } from "../src/pathfinding/PathService";

const TEST_GAMEMODE = {
    id: "combat-granite-maul-special-test",
    name: "Combat granite maul special test",
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

function createPlayer(id: number, weaponId: number): PlayerState {
    const player = new PlayerState(id, 3200, 3200, 0, TEST_GAMEMODE);
    player.combat.weaponItemId = weaponId;
    return player;
}

function createTarget(id: number): NpcState {
    return new NpcState(id, 1, 1, -1, -1, 32, { x: 3201, y: 3200, level: 0 }, {
        maxHitpoints: 100,
    });
}

function traits(weaponId: number, specialAttack: boolean): CombatAttackTraits {
    return {
        type: AttackType.Melee,
        style: CombatAttackStyle.Aggressive,
        rangeTiles: 1,
        speedTicks: 7,
        weaponId,
        specialAttack,
    };
}

function createEngine(player: PlayerState, target: NpcState): CombatTickEngine {
    return new CombatTickEngine({
        pathService,
        getPlayer: (id) => (id === player.id ? player : undefined),
        getNpc: (id) => (id === target.id ? target : undefined),
        getCombatants: () => [player],
        resolveAttackTraits: () =>
            traits(player.combat.weaponItemId, player.specEnergy.isActivated()),
    });
}

assert.equal(getGraniteMaulSpecialAttackEnergyCost(4153), 60);
assert.equal(getGraniteMaulSpecialAttackEnergyCost(12848), 60);
assert.equal(getGraniteMaulSpecialAttackEnergyCost(24225), 50);
assert.equal(SpecialAttackContainer.get(4153)?.energyCost, 60);
assert.equal(SpecialAttackContainer.get(12848)?.energyCost, 60);
assert.equal(SpecialAttackContainer.get(24225)?.energyCost, 50);

const standardPlayer = createPlayer(100, 4153);
const standardTarget = createTarget(200);
standardPlayer.setCombatTarget(standardTarget);
assert.equal(
    queueGraniteMaulSpecialAttackInput(standardPlayer, 4153, 50, "varp").queued,
    true,
);
assert.equal(
    queueGraniteMaulSpecialAttackInput(standardPlayer, 4153, 50, "button").queued,
    false,
    "the IF_BUTTON paired with one varp change must not duplicate one click",
);
assert.equal(
    queueGraniteMaulSpecialAttackInput(standardPlayer, 4153, 50, "varp")
        .insufficientEnergy,
    true,
    "the 60% standard maul cannot queue two specials from 100% energy",
);

const ornatePlayer = createPlayer(101, 24225);
const ornateTarget = createTarget(201);
ornatePlayer.setCombatTarget(ornateTarget);
ornatePlayer.combatAttributes.set(CombatAttributes.ATTACK_DELAY, 80);
for (let click = 0; click < 2; click++) {
    assert.equal(
        queueGraniteMaulSpecialAttackInput(ornatePlayer, 24225, 50, "varp").queued,
        true,
    );
    assert.equal(
        queueGraniteMaulSpecialAttackInput(ornatePlayer, 24225, 50, "button").queued,
        false,
    );
}
assert.equal(ornatePlayer.combat.countQueuedInstantSpecialAttacks(24225), 2);

const doubleSpecTick = createEngine(ornatePlayer, ornateTarget).processTick(50);
assert.equal(doubleSpecTick.preparedAttacks.length, 2);
assert.deepEqual(
    doubleSpecTick.preparedAttacks.map((attack) => attack.traits.specialAttack),
    [true, true],
);
assert.equal(
    ornatePlayer.combatAttributes.get(CombatAttributes.ATTACK_DELAY),
    80,
    "two Quick Smashes must not alter an existing attack deadline",
);

const hitProcessor = new CombatHitProcessor({
    players: {
        getById: (id: number) => (id === ornatePlayer.id ? ornatePlayer : undefined),
        getAllPlayersForSync: () => [ornatePlayer],
    },
    npcManager: {
        getById: (id: number) => (id === ornateTarget.id ? ornateTarget : undefined),
        forEach: (callback: (npc: NpcState) => void) => callback(ornateTarget),
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
const processedDoubleSpec = hitProcessor.processPreparedAttacks(
    doubleSpecTick.preparedAttacks,
    50,
);
assert.equal(processedDoubleSpec.processedAttacks, 2);
assert.equal(processedDoubleSpec.queuedHits, 2);
assert.equal(processedDoubleSpec.rejectedAttacks, 0);
assert.equal(hitProcessor.getPendingHitCount(), 2);
assert.equal(ornatePlayer.specEnergy.getUnits(), 0);
assert.equal(ornatePlayer.specEnergy.isActivated(), false);

const tripleStackPlayer = createPlayer(102, 24225);
const tripleStackTarget = createTarget(202);
tripleStackPlayer.setCombatTarget(tripleStackTarget);
tripleStackPlayer.combatAttributes.set(CombatAttributes.ATTACK_DELAY, 49);
tripleStackPlayer.combatAttributes.set(CombatAttributes.LAST_COMBAT_CLOCK, 45);
for (let click = 0; click < 2; click++) {
    queueGraniteMaulSpecialAttackInput(tripleStackPlayer, 24225, 50, "varp");
    queueGraniteMaulSpecialAttackInput(tripleStackPlayer, 24225, 50, "button");
}

const tripleStackTick = createEngine(tripleStackPlayer, tripleStackTarget).processTick(50);
assert.equal(tripleStackTick.preparedAttacks.length, 3);
assert.deepEqual(
    tripleStackTick.preparedAttacks.map((attack) => attack.traits.specialAttack),
    [false, true, true],
    "a due normal swing must stack with both queued ornate-maul specials",
);
assert.equal(tripleStackPlayer.combatAttributes.get(CombatAttributes.ATTACK_DELAY), 57);

const initiatingPlayer = createPlayer(103, 24225);
const initiatingTarget = createTarget(203);
for (let click = 0; click < 2; click++) {
    queueGraniteMaulSpecialAttackInput(initiatingPlayer, 24225, 50, "varp");
    queueGraniteMaulSpecialAttackInput(initiatingPlayer, 24225, 50, "button");
}
initiatingPlayer.setCombatTarget(initiatingTarget);

const initiatingTick = createEngine(initiatingPlayer, initiatingTarget).processTick(50);
assert.equal(initiatingTick.preparedAttacks.length, 2);
assert.deepEqual(
    initiatingTick.preparedAttacks.map((attack) => attack.traits.specialAttack),
    [true, true],
    "an untargeted Quick Smash activation must not add a free normal opener",
);
assert.equal(initiatingPlayer.combatAttributes.get(CombatAttributes.ATTACK_DELAY), -1);

// The hit processor consumes both prepared specials and clears the active varp
// before the following world cycle.
initiatingPlayer.specEnergy.setActivated(false);
const followingTick = createEngine(initiatingPlayer, initiatingTarget).processTick(51);
assert.equal(followingTick.preparedAttacks.length, 1);
assert.equal(followingTick.preparedAttacks[0].traits.specialAttack, false);
assert.equal(initiatingPlayer.combatAttributes.get(CombatAttributes.ATTACK_DELAY), 58);

const unarmedPlayer = createPlayer(105, 0);
const unarmedTarget = createTarget(205);
unarmedPlayer.setCombatTarget(unarmedTarget);
const unarmedAttack = createEngine(unarmedPlayer, unarmedTarget).processTick(60).preparedAttacks[0];
const blockAnimations: number[] = [];
const unarmedProcessor = new CombatHitProcessor({
    players: {
        getById: (id: number) => (id === unarmedPlayer.id ? unarmedPlayer : undefined),
        getAllPlayersForSync: () => [unarmedPlayer],
    },
    npcManager: {
        getById: (id: number) => (id === unarmedTarget.id ? unarmedTarget : undefined),
        forEach: (callback: (npc: NpcState) => void) => callback(unarmedTarget),
    },
    equipmentService: {
        computeEquipmentStatBonuses: () => new Array<number>(14).fill(0),
    },
    combatDataService: {
        getNpcDefinition: () => ({ animations: { defence: 425 } }),
    },
    combatEffectService: {
        broadcastNpcSequence: (_npc: NpcState, seqId: number) => blockAnimations.push(seqId),
    },
    skillService: { awardCombatXp: () => undefined },
    messagingService: { queueChatMessage: () => undefined },
    variableService: { queueVarp: () => undefined },
    queueCombatState: () => undefined,
    broadcastService: {
        enqueueSpotAnimation: () => undefined,
        queueBroadcastSound: () => undefined,
    },
} as unknown as ServerServices);
assert.ok(unarmedAttack);
unarmedProcessor.processPreparedAttacks([unarmedAttack], 60);
assert.deepEqual(blockAnimations, [425]);
const hitFrame = { hitsplats: [], actionEffects: [] } as any;
assert.equal(unarmedProcessor.processDeferredHits(60, hitFrame).length, 0);
assert.equal(unarmedProcessor.processDeferredHits(61, hitFrame).length, 1);
assert.deepEqual(blockAnimations, [425]);

const expiringPlayer = createPlayer(104, 24225);
const unusedTarget = createTarget(204);
queueGraniteMaulSpecialAttackInput(expiringPlayer, 24225, 50, "varp");
assert.equal(expiringPlayer.specEnergy.isActivated(), true);
createEngine(expiringPlayer, unusedTarget).processTick(54);
assert.equal(expiringPlayer.combat.countQueuedInstantSpecialAttacks(24225), 0);
assert.equal(expiringPlayer.specEnergy.isActivated(), false);

console.log("granite maul special regression tests passed");
