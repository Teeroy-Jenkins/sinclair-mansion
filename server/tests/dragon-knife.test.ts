import assert from "node:assert/strict";

import type { CombatEntity } from "../src/game/combat/engine/CombatTargetResolver";
import type { CombatAttack } from "../src/game/combat/model/CombatAttack";
import { SpecialAttackContainer } from "../src/game/combat/plugins/SpecialAttackContainer";
import { DRAGON_KNIFE_PROFILE } from "../src/game/combat/plugins/special-attacks/DragonKnifeSpec";

const DRAGON_KNIFE_VARIANTS = [22804, 22806, 22808, 22810];

assert.deepEqual(DRAGON_KNIFE_PROFILE.itemIds, DRAGON_KNIFE_VARIANTS);
assert.equal(DRAGON_KNIFE_PROFILE.attackAnimation, 929);
assert.equal(DRAGON_KNIFE_PROFILE.projectile?.id, 1166);

const special = DRAGON_KNIFE_PROFILE.handleSpecialAttack?.(
    {} as CombatEntity,
    {} as CombatEntity,
    {} as CombatAttack,
);
assert.ok(special);
assert.equal(special.energyCostPercent, 25);
assert.equal(special.hitCount, 2);
assert.equal(special.accuracyMultiplier, 1);
assert.equal(special.damageMultiplier, 1);
assert.deepEqual(special.hitDelayTicks, [0, 0]);
assert.equal(special.projectiles?.length, 2);
assert.ok(special.projectiles?.every((projectile) => projectile.id === 1166));

for (const itemId of DRAGON_KNIFE_VARIANTS) {
    const script = SpecialAttackContainer.get(itemId);
    assert.ok(script, `Dragon knife variant ${itemId} must be registered`);
    assert.equal(script.energyCost, 25);
}

console.log("dragon knife regression test passed");
