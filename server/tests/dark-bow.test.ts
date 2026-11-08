import assert from "node:assert/strict";

import {
    calculateAmmoConsumption,
    isAmmoCompatible,
    isDarkBowWeapon,
} from "../src/game/combat/AmmoSystem";
import {
    isDragonArrow,
    resolveDarkBowSpecialConfiguration,
} from "../src/game/combat/plugins/special-attacks/DarkBowSpec";

const darkBowIds = [11235, 12765, 12766, 12767, 12768];
const dragonArrowIds = [11212, 11227, 11228, 11229];

const darkness = resolveDarkBowSpecialConfiguration(892);
assert.equal(darkness.dragonArrows, false);
assert.equal(darkness.damageMultiplier, 1.3);
assert.equal(darkness.minimumDamage, 5);
assert.equal(darkness.maximumDamage, undefined);
assert.equal(darkness.projectile.id, 1101);
assert.equal(darkness.impactGraphic.id, 1103);

for (const ammoId of dragonArrowIds) {
    assert.equal(isDragonArrow(ammoId), true);
    const dragons = resolveDarkBowSpecialConfiguration(ammoId);
    assert.equal(dragons.dragonArrows, true);
    assert.equal(dragons.damageMultiplier, 1.5);
    assert.equal(dragons.minimumDamage, 8);
    assert.equal(dragons.maximumDamage, 48);
    assert.equal(dragons.projectile.id, 1099);
    assert.equal(dragons.impactGraphic.id, 1100);
}

for (const weaponId of darkBowIds) {
    assert.equal(isDarkBowWeapon(weaponId), true);
    for (const ammoId of dragonArrowIds) {
        assert.equal(isAmmoCompatible(weaponId, ammoId), true);
    }
    const consumption = calculateAmmoConsumption(
        weaponId,
        11212,
        10,
        -1,
        3200,
        3200,
        () => 0.99,
    );
    assert.equal(consumption.quantityUsed, 2);
    assert.equal(consumption.dropQuantity, 0);
}

const mixedRecoveryRolls = [0.1, 0.9];
const mixedRecovery = calculateAmmoConsumption(
    11235,
    11212,
    10,
    22109,
    3200,
    3200,
    () => mixedRecoveryRolls.shift() ?? 0,
);
assert.equal(mixedRecovery.quantityUsed, 1);
assert.equal(mixedRecovery.dropQuantity, 0);
assert.equal(mixedRecovery.broke, true);

console.log("dark bow regression test passed");
