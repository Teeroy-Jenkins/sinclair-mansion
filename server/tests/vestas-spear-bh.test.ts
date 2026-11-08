import assert from "node:assert/strict";

import type { CombatEntity } from "../src/game/combat/engine/CombatTargetResolver";
import type { CombatAttack } from "../src/game/combat/model/CombatAttack";
import { SpecialAttackContainer } from "../src/game/combat/plugins/SpecialAttackContainer";
import { VESTAS_SPEAR_BH_PROFILE } from "../src/game/combat/plugins/special-attacks/VestasSpearBhSpec";

const special = VESTAS_SPEAR_BH_PROFILE.handleSpecialAttack?.(
    {} as CombatEntity,
    {} as CombatEntity,
    {} as CombatAttack,
);
assert.ok(special);
assert.equal(special.energyCostPercent, 50);
assert.equal(special.hitCount, 1);
assert.equal(special.accuracyMultiplier, 1);
assert.equal(special.damageMultiplier, 1);
assert.equal(SpecialAttackContainer.get(27900)?.energyCost, 50);

console.log("vesta's spear (bh) regression test passed");
