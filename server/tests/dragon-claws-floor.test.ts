// Murder at Sinclair Mansion: dragon claws always deal at least half their potential, a miss
// included (DRAGON_CLAWS_MINIMUM_DAMAGE_FRACTION), and Slice and Dice hits twice as hard as in
// OSRS (DRAGON_CLAWS_SPECIAL_DAMAGE_MULTIPLIER), so the Murderer's opening usually kills.
// Other weapons still miss as usual.
import assert from "node:assert/strict";

import { getXpForLevel, SkillId } from "../../client/rs/skill/skills";
import { getItemDefinition } from "../src/data/items";
import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatHitEvaluator } from "../src/game/combat/engine/CombatHitEvaluator";
import { CombatAttackStyle, type CombatAttack } from "../src/game/combat/model/CombatAttack";
import { CombatEntityType } from "../src/game/combat/model/CombatEntityRef";
import {
    DRAGON_CLAWS_PROFILE,
    DRAGON_CLAWS_SPECIAL_DAMAGE_MULTIPLIER,
    calculateDragonClawsHitDistribution,
    dragonClawsMinimumHits,
} from "../src/game/combat/plugins/special-attacks/DragonClawsSpec";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { PlayerState } from "../src/game/player";

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});
const MODE = { id: "claws-floor", name: "Claws floor", initializePlayer: () => undefined, canInteract: () => true } as GamemodeDefinition;

const CLAWS = 13652;
const SCIMITAR = 4587;
function fighter(id: number, attack: number, strength: number, defence: number): PlayerState {
    const p = new PlayerState(id, 3200, 3200, 0, MODE);
    for (const [skill, level] of [[SkillId.Attack, attack], [SkillId.Strength, strength], [SkillId.Defence, defence], [SkillId.Hitpoints, 99]] as const) {
        p.skillSystem.setSkillXp(skill, getXpForLevel(level));
        p.skillSystem.setSkillBoost(skill, level);
    }
    return p;
}
// A weak attacker against a tank: almost every roll misses.
const murderer = fighter(1, 1, 99, 1);
const victim = fighter(2, 1, 1, 99);
let weapon = CLAWS;
const evaluator = new CombatHitEvaluator({
    resolveEntity: (ref) => (ref.id === 1 ? murderer : victim),
    getEquipmentBonuses: (p) => (p === murderer ? (getItemDefinition(weapon)?.bonuses ?? []).slice() : new Array(14).fill(500)),
});
const attack = (special: boolean): CombatAttack => ({
    attacker: { type: CombatEntityType.Player, id: 1 },
    target: { type: CombatEntityType.Player, id: 2 },
    attackClock: 0,
    traits: { type: AttackType.Melee, style: CombatAttackStyle.Aggressive, rangeTiles: 1, speedTicks: 4, weaponId: weapon, specialAttack: special },
});
const SPECIAL = DRAGON_CLAWS_PROFILE.handleSpecialAttack!(undefined as never, undefined as never, undefined as never)!;
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// The floor itself: half a swing's max hit; half Slice and Dice's best four-hit total.
assert.deepEqual(dragonClawsMinimumHits(30, 1), [15]);
assert.deepEqual(dragonClawsMinimumHits(31, 1), [16]);
const best = sum(calculateDragonClawsHitDistribution(1, 30 * DRAGON_CLAWS_SPECIAL_DAMAGE_MULTIPLIER));
assert.ok(sum(dragonClawsMinimumHits(30, 4)) >= best / 2, "the special's floor is half its best total");

weapon = CLAWS;
const maxHit = evaluator.evaluate(attack(false)).maxHit;
assert.ok(maxHit > 10, `claws max hit ${maxHit}`);
let normalMin = Infinity;
let specialMin = Infinity;
for (let i = 0; i < 2000; i++) {
    normalMin = Math.min(normalMin, evaluator.evaluate(attack(false)).damage);
    specialMin = Math.min(specialMin, sum(evaluator.evaluateSpecialAttack(attack(true), SPECIAL).map((h) => h.damage)));
}
assert.ok(normalMin >= Math.ceil(maxHit / 2), `a claws swing hits at least half its max (${normalMin} of ${maxHit})`);
assert.ok(specialMin >= sum(calculateDragonClawsHitDistribution(1, maxHit * DRAGON_CLAWS_SPECIAL_DAMAGE_MULTIPLIER)) / 2, `Slice and Dice deals at least half its best total (${specialMin})`);
// Slice and Dice hits twice as hard as in OSRS (this game's balance).
let specialMax = 0;
for (let i = 0; i < 2000; i++) specialMax = Math.max(specialMax, evaluator.evaluateSpecialAttack(attack(true), SPECIAL)[0].maxHit);
assert.ok(specialMax > maxHit * 1.5, `the special's first hit can reach about twice a swing's max (${specialMax} vs ${maxHit})`);

// Any other weapon still misses.
weapon = SCIMITAR;
let scimitarMisses = 0;
for (let i = 0; i < 500; i++) if (evaluator.evaluate(attack(false)).damage === 0) scimitarMisses++;
assert.ok(scimitarMisses > 100, `the scimitar still misses (${scimitarMisses}/500)`);

console.log(`dragon claws floor: ok (max ${maxHit}, worst swing ${normalMin}, worst special ${specialMin})`);
