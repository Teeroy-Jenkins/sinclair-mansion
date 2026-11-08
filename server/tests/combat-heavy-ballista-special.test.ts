import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatAttackStyle } from "../src/game/combat/model/CombatAttack";
import {
    npcCombatEntityRef,
    playerCombatEntityRef,
} from "../src/game/combat/model/CombatEntityRef";
import { CombatPluginRegistry } from "../src/game/combat/plugins/CombatPluginRegistry";
import { SpecialAttackContainer } from "../src/game/combat/plugins/SpecialAttackContainer";
import { resolveWeaponProfileValue } from "../src/game/combat/plugins/WeaponCombatProfile";
import {
    HEAVY_BALLISTA_PROFILE,
    resolveHeavyBallistaHitDelay,
    resolveHeavyBallistaProjectile,
} from "../src/game/combat/plugins/special-attacks/HeavyBallistaSpec";
import { LIGHT_BALLISTA_PROFILE } from "../src/game/combat/plugins/special-attacks/LightBallistaSpec";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";

const TEST_GAMEMODE = {
    id: "heavy-ballista-special-test",
    name: "Heavy ballista special test",
    initializePlayer: () => undefined,
    canInteract: () => true,
} as GamemodeDefinition;

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});

assert.equal(HEAVY_BALLISTA_PROFILE.specialAttackEnergyCost, 65);
assert.equal(CombatPluginRegistry.shared.resolve({ weaponId: 19481 }).id, "core:heavy_ballista");
assert.equal(CombatPluginRegistry.shared.resolve({ weaponId: 23630 }).id, "core:heavy_ballista");
assert.equal(CombatPluginRegistry.shared.resolve({ weaponId: 26712 }).id, "core:heavy_ballista");
assert.equal(CombatPluginRegistry.shared.resolve({ weaponId: 19478 }).id, "core:light_ballista");
assert.equal(CombatPluginRegistry.shared.resolve({ weaponId: 27188 }).id, "core:light_ballista");
assert.equal(SpecialAttackContainer.get(19481)?.energyCost, 65);
assert.equal(SpecialAttackContainer.get(23630)?.energyCost, 65);
assert.equal(SpecialAttackContainer.get(26712)?.energyCost, 65);
assert.equal(SpecialAttackContainer.get(19478)?.energyCost, 65);
assert.equal(SpecialAttackContainer.get(27188)?.energyCost, 65);

const player = new PlayerState(100, 3200, 3200, 0, TEST_GAMEMODE);
const target = new NpcState(
    200,
    1,
    1,
    -1,
    -1,
    32,
    { x: 3205, y: 3200, level: 0 },
    { maxHitpoints: 100 },
);
const attack = {
    attacker: playerCombatEntityRef(player.id),
    target: npcCombatEntityRef(target.id),
    attackClock: 50,
    traits: {
        type: AttackType.Ranged,
        style: CombatAttackStyle.Rapid,
        rangeTiles: 9,
        speedTicks: 6,
        weaponId: 19481,
        specialAttack: true,
    },
} as const;
const context = {
    attack,
    attacker: player,
    target,
    currentMapClock: 50,
    distanceTiles: 5,
};

const special = HEAVY_BALLISTA_PROFILE.handleSpecialAttack?.(player, target, attack);
assert.ok(special);
assert.equal(special.energyCostPercent, 65);
assert.equal(special.hitCount, 1);
assert.equal(special.accuracyMultiplier, 1.25);
assert.equal(special.damageMultiplier, 1.25);
assert.equal(special.attackAnimation, 7556);
assert.equal(special.attackSoundId, 3739);
const lightAttack = {
    ...attack,
    traits: { ...attack.traits, weaponId: 19478 },
};
const lightSpecial = LIGHT_BALLISTA_PROFILE.handleSpecialAttack?.(player, target, lightAttack);
assert.ok(lightSpecial);
assert.equal(lightSpecial.energyCostPercent, 65);
assert.equal(lightSpecial.accuracyMultiplier, 1.25);
assert.equal(lightSpecial.damageMultiplier, 1.25);
assert.equal(lightSpecial.attackAnimation, 7556);
assert.equal(resolveWeaponProfileValue(HEAVY_BALLISTA_PROFILE.attackAnimation, context), 7555);
assert.deepEqual(resolveWeaponProfileValue(HEAVY_BALLISTA_PROFILE.impactGraphic, context), {
    id: 344,
    height: 146,
});
assert.deepEqual(resolveWeaponProfileValue(HEAVY_BALLISTA_PROFILE.splashGraphic, context), {
    id: 344,
    height: 146,
});

const projectileCases = [
    [825, 200],
    [832, 201],
    [5644, 202],
    [5651, 203],
    [835, 204],
    [5653, 205],
    [19490, 1301],
    [23648, 1301],
    [21324, 1386],
] as const;
for (const [ammoId, expectedProjectileId] of projectileCases) {
    player.appearance.equip[EquipmentSlot.AMMO] = ammoId;
    const projectile = resolveHeavyBallistaProjectile(context);
    assert.equal(projectile?.id, expectedProjectileId);
    assert.equal(projectile?.startDelayTicks, 42 / 30);
    assert.equal(projectile?.lifeModel, "javelin");
}

player.appearance.equip[EquipmentSlot.AMMO] = 892; // Rune arrow: invalid ballista ammo.
assert.equal(resolveHeavyBallistaProjectile(context), undefined);
assert.equal(resolveHeavyBallistaHitDelay(1), 2);
assert.equal(resolveHeavyBallistaHitDelay(5), 2);
assert.equal(resolveHeavyBallistaHitDelay(6), 3);
assert.equal(resolveHeavyBallistaHitDelay(10), 3);

console.log("heavy ballista special attack regression tests passed");
