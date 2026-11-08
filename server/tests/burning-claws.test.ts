import assert from "node:assert/strict";

import {
    BURNING_CLAWS_SPEC,
    takeDueBurningClawBurns,
} from "../src/game/combat/plugins/special-attacks/BurningClawsSpec";
import { setWeaponSpecialAttackRuntimeMetadata } from "../src/game/combat/plugins/WeaponSpecialAttackScript";
import type { CombatAttack } from "../src/game/combat/model/CombatAttack";

const attacker = { id: "burning-claws-attacker" };
const target = { id: "burning-claws-target" };
const attack = {} as CombatAttack;
setWeaponSpecialAttackRuntimeMetadata(attack, { firstSuccessfulAccuracyRoll: 3 });

const originalRandom = Math.random;
Math.random = () => 0;
try {
    // Third-roll accuracy grants the 45% burn chance. A zero roll guarantees
    // the proc, letting this cover the five-stack cap deterministically.
    for (let index = 0; index < 6; index++) {
        BURNING_CLAWS_SPEC.onHitAppliedWithAttack?.(attacker, target, 0, 0, attack);
    }
} finally {
    Math.random = originalRandom;
}

assert.equal(takeDueBurningClawBurns(3).length, 0);
for (let tick = 4; tick <= 40; tick += 4) {
    const due = takeDueBurningClawBurns(tick);
    assert.equal(due.length, 5, `expected five burn stacks at tick ${tick}`);
    assert.ok(due.every((burn) => burn.attacker === attacker && burn.target === target));
}
assert.equal(takeDueBurningClawBurns(44).length, 0);

console.log("burning claws regression test passed");
