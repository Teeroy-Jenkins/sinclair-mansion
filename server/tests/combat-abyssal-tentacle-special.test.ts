import assert from "node:assert/strict";

import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatAttackStyle, type CombatAttack } from "../src/game/combat/model/CombatAttack";
import { CombatPluginRegistry } from "../src/game/combat/plugins/CombatPluginRegistry";
import { SpecialAttackContainer } from "../src/game/combat/plugins/SpecialAttackContainer";
import {
    ABYSSAL_TENTACLE_PROFILE,
    AbyssalTentacleSpec,
    applyBindingTentacleEffects,
} from "../src/game/combat/plugins/special-attacks/AbyssalTentacleSpec";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";

const TEST_GAMEMODE = {
    id: "combat-abyssal-tentacle-special-test",
    name: "Combat abyssal tentacle special test",
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

const TENTACLE_ITEM_ID = 12006;
const TICK = 50;
const player = new PlayerState(1, 3200, 3200, 0, TEST_GAMEMODE);
const target = new NpcState(2, 1, 1, -1, -1, 32, { x: 3201, y: 3200, level: 0 }, {
    maxHitpoints: 100,
    combatLevel: 32,
});
const attack: CombatAttack = Object.freeze({
    attacker: { type: "player", id: player.id },
    target: { type: "npc", id: target.id },
    attackClock: TICK,
    traits: Object.freeze({
        type: AttackType.Melee,
        style: CombatAttackStyle.Aggressive,
        rangeTiles: 1,
        speedTicks: 4,
        weaponId: TENTACLE_ITEM_ID,
        specialAttack: true,
    }),
});

assert.equal(SpecialAttackContainer.get(TENTACLE_ITEM_ID)?.energyCost, 50);
assert.equal(CombatPluginRegistry.shared.resolve({ weaponId: TENTACLE_ITEM_ID }).id, "core:abyssal_tentacle");

const special = ABYSSAL_TENTACLE_PROFILE.handleSpecialAttack?.(player, target, attack);
assert.ok(special);
assert.equal(special.energyCostPercent, 50);
assert.equal(special.accuracyMultiplier, 1.25);
assert.equal(special.damageMultiplier, 1);
assert.equal(special.meleeAttackBonusIndex, 1);
assert.equal(special.meleeDefenceBonusIndex, 1);

let poisonCalls = 0;
target.inflictPoison = () => {
    poisonCalls++;
};
applyBindingTentacleEffects(target, TICK, () => 0.499999);
assert.equal(target.isFrozen(TICK + 7), true);
assert.equal(target.isFrozen(TICK + 8), false);
assert.equal(poisonCalls, 1);

const noPoisonTarget = new NpcState(3, 1, 1, -1, -1, 32, { x: 3202, y: 3200, level: 0 }, {
    maxHitpoints: 100,
    combatLevel: 32,
});
let noPoisonCalls = 0;
noPoisonTarget.inflictPoison = () => {
    noPoisonCalls++;
};
applyBindingTentacleEffects(noPoisonTarget, TICK, () => 0.5);
assert.equal(noPoisonTarget.isFrozen(TICK), true);
assert.equal(noPoisonCalls, 0);

const script = new AbyssalTentacleSpec();
script.modifyAttackTraits(attack);
assert.equal(script.onSpecialActivated(player, target, TICK), undefined);

console.log("abyssal tentacle special regression tests passed");
