// Murder at Sinclair Mansion: everyone's hitpoints. The Murderer's opening (a dragon claws
// special, then one hit with the murder weapon) should kill an unarmed member of the household
// most of the time, about 4 in 5. Uses the engine's own hit evaluator and the real Slice and Dice
// special (with this game's claws damage floor), so the odds follow the live combat code.
// Usage (from server/): yarn tsx tests/sinclair-mansion-balance.test.ts [--search]
import assert from "node:assert/strict";

import { getXpForLevel, SkillId } from "../../client/rs/skill/skills";
import { MURDER_CONFIG as C } from "../gamemodes/sinclair-mansion/config";
import { WEAPON_POOL } from "../gamemodes/sinclair-mansion/mansion";
import { getItemDefinition } from "../src/data/items";
import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatHitEvaluator } from "../src/game/combat/engine/CombatHitEvaluator";
import { CombatAttackStyle, type CombatAttack } from "../src/game/combat/model/CombatAttack";
import { CombatEntityType } from "../src/game/combat/model/CombatEntityRef";
import { DRAGON_CLAWS_PROFILE } from "../src/game/combat/plugins/special-attacks/DragonClawsSpec";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { PlayerState } from "../src/game/player";

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});
const MODE = { id: "sinclair-balance", name: "Sinclair balance", initializePlayer: () => undefined, canInteract: () => true } as GamemodeDefinition;

type Stats = typeof C.pvp.stats;
function fighter(id: number, b: Stats, hitpoints: number): PlayerState {
    const p = new PlayerState(id, 3200, 3200, 0, MODE);
    const levels: Array<[SkillId, number]> = [[SkillId.Attack, b.attack], [SkillId.Strength, b.strength], [SkillId.Defence, b.defence], [SkillId.Hitpoints, hitpoints]];
    for (const [skill, level] of levels) {
        p.skillSystem.setSkillXp(skill, getXpForLevel(level));
        p.skillSystem.setSkillBoost(skill, level);
    }
    return p;
}

const TRIALS = 20000;
const SPECIAL = DRAGON_CLAWS_PROFILE.handleSpecialAttack!(undefined as never, undefined as never, undefined as never)!;

/** Chance that claws spec + one murder-weapon hit deals at least `hp` (weapon drawn from the pool). */
function killChance(b: Stats, hp: number): number {
    const murderer = fighter(1, b, hp);
    const victim = fighter(2, b, hp); // the household wear nothing
    let weapon: number = C.pvp.dragonClaws;
    const bonuses = (id: number) => (getItemDefinition(id)?.bonuses ?? []).slice();
    const evaluator = new CombatHitEvaluator({
        resolveEntity: (ref) => (ref.id === 1 ? murderer : victim),
        getEquipmentBonuses: (p) => (p === murderer ? bonuses(weapon) : new Array(14).fill(0)),
    });
    const attack = (weaponId: number, special: boolean): CombatAttack => ({
        attacker: { type: CombatEntityType.Player, id: 1 },
        target: { type: CombatEntityType.Player, id: 2 },
        attackClock: 0,
        traits: { type: AttackType.Melee, style: CombatAttackStyle.Aggressive, rangeTiles: 1, speedTicks: 4, weaponId, specialAttack: special },
    });
    let kills = 0;
    for (let i = 0; i < TRIALS; i++) {
        weapon = C.pvp.dragonClaws;
        const spec = evaluator.evaluateSpecialAttack(attack(weapon, true), SPECIAL).reduce((n, h) => n + h.damage, 0);
        weapon = WEAPON_POOL[i % WEAPON_POOL.length].itemId;
        const follow = evaluator.evaluate(attack(weapon, false)).damage;
        if (spec + follow >= hp) kills++;
    }
    return kills / TRIALS;
}

/** Most of the time: about 4 in 5 openings kill. */
const TARGET = 0.8;
const s = C.pvp.stats;
if (process.argv.includes("--search")) {
    // Print the kill chance at each hitpoints level, for setting config.ts.
    for (let hp = 10; hp <= 99; hp++) {
        const p = killChance(s, hp);
        console.log(`${hp} hitpoints -> ${(p * 100).toFixed(1)}% kill`);
        if (p < 0.3) break;
    }
} else {
    const p = killChance(s, s.hitpoints);
    console.log(`  ${s.attack}/${s.strength}/${s.defence}, ${s.hitpoints} hp: claws spec + murder weapon kills ${(p * 100).toFixed(1)}%`);
    assert.ok(Math.abs(p - TARGET) < 0.06, `${(p * 100).toFixed(1)}% is not about ${TARGET * 100}%`);
    console.log("sinclair-mansion balance checks passed.");
}
