import assert from "node:assert/strict";

import type { CombatEntity } from "../src/game/combat/engine/CombatTargetResolver";
import type { CombatAttack } from "../src/game/combat/model/CombatAttack";
import { SpecialAttackContainer } from "../src/game/combat/plugins/SpecialAttackContainer";
import { ROSEWOOD_BLOWPIPE_PROFILE } from "../src/game/combat/plugins/special-attacks/RosewoodBlowpipeSpec";

assert.deepEqual(ROSEWOOD_BLOWPIPE_PROFILE.itemIds, [31586]);
const special = ROSEWOOD_BLOWPIPE_PROFILE.handleSpecialAttack?.(
    {} as CombatEntity,
    {} as CombatEntity,
    {} as CombatAttack,
);
assert.ok(special);
assert.equal(special.energyCostPercent, 25);
assert.equal(special.hitCount, 2);
assert.equal(special.accuracyMultiplier, 0.8);
assert.equal(special.damageMultiplier, 1.1);
assert.deepEqual(special.hitDelayTicks, [0, 1]);
assert.equal(special.attackAnimation, 5061);

const script = SpecialAttackContainer.get(31586);
assert.ok(script);
assert.equal(script.energyCost, 25);

console.log("rosewood blowpipe regression test passed");
