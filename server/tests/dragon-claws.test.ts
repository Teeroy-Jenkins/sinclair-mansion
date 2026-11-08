import assert from "node:assert/strict";

import type { CombatEntity } from "../src/game/combat/engine/CombatTargetResolver";
import type { CombatAttack } from "../src/game/combat/model/CombatAttack";
import {
    DRAGON_CLAWS_ALL_MISS_PATTERNS,
    DRAGON_CLAWS_PROFILE,
    calculateDragonClawsHitDistribution,
} from "../src/game/combat/plugins/special-attacks/DragonClawsSpec";

assert.deepEqual(calculateDragonClawsHitDistribution(1, 35), [35, 17, 8, 9]);
assert.deepEqual(calculateDragonClawsHitDistribution(1, 45), [45, 22, 11, 12]);
assert.deepEqual(calculateDragonClawsHitDistribution(2, 30), [0, 30, 15, 16]);
assert.deepEqual(calculateDragonClawsHitDistribution(3, 22), [0, 0, 22, 23]);
assert.deepEqual(calculateDragonClawsHitDistribution(4, 46), [0, 0, 0, 46]);

assert.equal(DRAGON_CLAWS_ALL_MISS_PATTERNS.length, 6);
assert.equal(
    DRAGON_CLAWS_ALL_MISS_PATTERNS.filter((pattern) =>
        pattern.every((damage) => damage === 0),
    ).length,
    2,
);
assert.equal(
    DRAGON_CLAWS_ALL_MISS_PATTERNS.filter(
        (pattern) => pattern.reduce((total, damage) => total + damage, 0) === 2,
    ).length,
    4,
);

assert.deepEqual(DRAGON_CLAWS_PROFILE.itemIds, [13652, 20784]);
const special = DRAGON_CLAWS_PROFILE.handleSpecialAttack?.(
    {} as CombatEntity,
    {} as CombatEntity,
    {} as CombatAttack,
);
assert.ok(special);
assert.equal(special.energyCostPercent, 70);
assert.equal(special.hitCount, 4);
assert.equal(special.accuracyMultiplier, 1);
assert.equal(special.meleeDefenceBonusIndex, 1);
assert.equal(special.firstSuccessfulAccuracyDamageRanges?.length, 4);
assert.equal(
    special.firstSuccessfulAccuracyDamageRanges?.[0].maximumDamageReduction,
    1,
);
assert.deepEqual(special.hitDelayTicks, [0, 0, 1, 1]);
assert.deepEqual(special.impactSoundIds, [4138, 4140, 4141, 4141]);
assert.equal(special.attackAnimation, 7514);
assert.equal(special.castGraphic?.id, 1171);

console.log("dragon claws regression test passed");
