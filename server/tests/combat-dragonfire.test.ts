import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
import {
    STANDARD_DRAGONFIRE_ATTACK,
    getStandardDragonfireMaxHit,
    isStandardChromaticDragon,
    rollStandardDragonfireDamage,
    shouldUseStandardDragonfire,
} from "../src/game/combat/Dragonfire";
import { CombatAttributeStore } from "../src/game/combat/state/CombatAttributeStore";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import { ANTIFIRE_TIMER, SUPER_ANTIFIRE_TIMER } from "../src/game/model/timer/Timers";
import { TimerMap } from "../src/game/model/timer/TimerMap";
import type { PlayerState } from "../src/game/player";
import { OverheadType } from "../src/game/prayer/OverheadType";

function createPlayer(): PlayerState {
    return {
        appearance: { equip: new Array<number>(12).fill(-1) },
        timers: new TimerMap(),
        combatAttributes: new CombatAttributeStore(),
    } as unknown as PlayerState;
}

assert.equal(isStandardChromaticDragon(260), true);
assert.equal(isStandardChromaticDragon(265), true);
assert.equal(isStandardChromaticDragon(247), true);
assert.equal(isStandardChromaticDragon(252), true);
assert.equal(isStandardChromaticDragon(5194), false, "baby dragons must not breathe fire");
assert.equal(shouldUseStandardDragonfire(() => 0), true);
assert.equal(shouldUseStandardDragonfire(() => 1 / 6), false);
assert.equal(STANDARD_DRAGONFIRE_ATTACK.attackAnimation, 81);
assert.equal(STANDARD_DRAGONFIRE_ATTACK.projectiles?.[0]?.id, 54);

const player = createPlayer();
assert.equal(getStandardDragonfireMaxHit(player, true), 50);
assert.equal(getStandardDragonfireMaxHit(player, false), 30);
assert.deepEqual(rollStandardDragonfireDamage(player, true, () => 1), {
    damage: 50,
    maxHit: 50,
});

player.timers.set(ANTIFIRE_TIMER, 600);
assert.equal(getStandardDragonfireMaxHit(player, true), 35);
assert.equal(getStandardDragonfireMaxHit(player, false), 15);

player.timers.remove(ANTIFIRE_TIMER);
player.appearance.equip[EquipmentSlot.SHIELD] = 1540;
assert.equal(getStandardDragonfireMaxHit(player, true), 5);

player.combatAttributes.set(CombatAttributes.ACTIVE_OVERHEAD_PRAYER, OverheadType.MAGIC);
player.appearance.equip[EquipmentSlot.SHIELD] = -1;
assert.equal(getStandardDragonfireMaxHit(player, true), 10);

player.timers.set(ANTIFIRE_TIMER, 600);
assert.equal(getStandardDragonfireMaxHit(player, true), 0);

player.combatAttributes.set(CombatAttributes.ACTIVE_OVERHEAD_PRAYER, OverheadType.NONE);
player.timers.remove(ANTIFIRE_TIMER);
player.appearance.equip[EquipmentSlot.SHIELD] = 22002;
assert.equal(getStandardDragonfireMaxHit(player, true), 5);
player.timers.set(ANTIFIRE_TIMER, 600);
assert.equal(getStandardDragonfireMaxHit(player, true), 0);

player.timers.set(SUPER_ANTIFIRE_TIMER, 300);
player.appearance.equip[EquipmentSlot.SHIELD] = -1;
player.timers.remove(ANTIFIRE_TIMER);
assert.equal(getStandardDragonfireMaxHit(player, true), 0);

console.log("dragonfire combat regression test passed");
