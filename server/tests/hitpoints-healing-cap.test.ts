/**
 * Regression coverage for ordinary healing and explicitly permitted overheal.
 *
 * Run with: npx tsx tests/hitpoints-healing-cap.test.ts
 */
import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { PlayerSkillSystem } from "../src/game/state/PlayerSkillSystem";
import { PlayerStatusState } from "../src/game/state/PlayerStatusState";

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});

const skills = new PlayerSkillSystem(
    new PlayerStatusState(),
    () => false,
    () => undefined,
);
const hitpoints = skills.getSkill(SkillId.Hitpoints);

assert.equal(hitpoints.baseLevel, 10);
assert.equal(skills.getHitpointsCurrent(), 10);

skills.applyHitpointsDamage(2);
assert.equal(skills.getHitpointsCurrent(), 8);

skills.applyHitpointsHeal(20);
assert.equal(skills.getHitpointsCurrent(), 10);
assert.equal(hitpoints.boost, 0);

skills.applyHitpointsOverheal(20, 13);
assert.equal(skills.getHitpointsCurrent(), 13);
assert.equal(hitpoints.boost, 3);

skills.applyHitpointsDamage(2);
skills.applyHitpointsHeal(20);
assert.equal(skills.getHitpointsCurrent(), 11);

skills.applyHitpointsOverheal(20, 13);
assert.equal(skills.getHitpointsCurrent(), 13);

skills.applyHitpointsOverheal(20, 13);
assert.equal(skills.getHitpointsCurrent(), 13);

console.log("hitpoints healing cap tests passed");
