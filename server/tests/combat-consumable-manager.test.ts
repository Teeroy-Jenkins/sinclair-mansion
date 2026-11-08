/**
 * Regression coverage for absolute food, potion, and attack deadlines.
 *
 * Run with: npx tsx tests/combat-consumable-manager.test.ts
 */
import assert from "node:assert/strict";

import { combatConsumableManager } from "../src/game/combat/engine/CombatConsumableManager";
import { CombatAttributeStore } from "../src/game/combat/state/CombatAttributeStore";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import type { PlayerState } from "../src/game/player";

const createPlayer = (): PlayerState =>
    ({ combatAttributes: new CombatAttributeStore() }) as PlayerState;

{
    const player = createPlayer();

    assert.equal(combatConsumableManager.canEatFood(player, 100), true);
    assert.equal(combatConsumableManager.canDrinkPotion(player, 100), true);

    combatConsumableManager.applyFoodDelay(player, 100);

    assert.equal(player.combatAttributes.get(CombatAttributes.FOOD_DELAY), 103);
    assert.equal(player.combatAttributes.get(CombatAttributes.ATTACK_DELAY), 103);
    assert.equal(combatConsumableManager.canEatFood(player, 102), false);
    assert.equal(combatConsumableManager.canEatFood(player, 103), true);
    assert.equal(combatConsumableManager.canDrinkPotion(player, 100), true);
}

{
    const player = createPlayer();
    player.combatAttributes.set(CombatAttributes.ATTACK_DELAY, 110);

    combatConsumableManager.applyFoodDelay(player, 100);

    assert.equal(player.combatAttributes.get(CombatAttributes.ATTACK_DELAY), 113);
}

{
    const player = createPlayer();
    player.combatAttributes.set(CombatAttributes.ATTACK_DELAY, 205);

    combatConsumableManager.applyPotionDelay(player, 200);

    assert.equal(player.combatAttributes.get(CombatAttributes.POTION_DELAY), 203);
    assert.equal(player.combatAttributes.get(CombatAttributes.ATTACK_DELAY), 205);
    assert.equal(combatConsumableManager.canDrinkPotion(player, 202), false);
    assert.equal(combatConsumableManager.canDrinkPotion(player, 203), true);
    assert.equal(combatConsumableManager.canEatFood(player, 200), true);
}

{
    const player = createPlayer();
    player.combatAttributes.set(CombatAttributes.ATTACK_DELAY, 305);

    combatConsumableManager.applyComboFoodAttackDelay(player, 300);

    assert.equal(player.combatAttributes.get(CombatAttributes.ATTACK_DELAY), 307);
}

console.log("combat consumable manager tests passed");
