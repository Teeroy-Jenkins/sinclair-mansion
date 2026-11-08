// RuneScape combat rules checked against 2009scape's behaviour: formulas, weapon speeds, NPC
// magic defence, auto-retaliate while walking, single-way combat and giving up on an unreachable
// target. (Bots are players, so they fight by these same rules.)
import assert from "node:assert/strict";

import { createWeaponDataProvider } from "../gamemodes/dev/data/weapons";
import { getItemDefinition } from "../src/data/items";
import { AttackType } from "../src/game/combat/AttackType";
import { MultiCombatSystem } from "../src/game/combat/MultiCombatZones";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatHitEvaluator } from "../src/game/combat/engine/CombatHitEvaluator";
import {
    CombatInteractionProcessor,
    UNREACHABLE_TIMEOUT_TICKS,
} from "../src/game/combat/engine/CombatInteractionProcessor";
import { CombatRangeValidator } from "../src/game/combat/engine/CombatRangeValidator";
import { CombatRetaliationEngine } from "../src/game/combat/engine/CombatRetaliationEngine";
import { CombatTargetResolver } from "../src/game/combat/engine/CombatTargetResolver";
import {
    calculateAttackRoll,
    calculateDefenceRoll,
    calculateHitChance,
} from "../src/game/combat/formulas/Accuracy";
import { calculateMeleeMaxHit } from "../src/game/combat/formulas/MeleeMaxHit";
import { CombatAttackStyle } from "../src/game/combat/model/CombatAttack";
import { npcCombatEntityRef, playerCombatEntityRef } from "../src/game/combat/model/CombatEntityRef";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import type { PathService } from "../src/pathfinding/PathService";

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});

const GAMEMODE = {
    id: "runescape-rules-test",
    name: "RuneScape rules test",
    initializePlayer: () => undefined,
    canInteract: () => true,
} as GamemodeDefinition;

let passed = 0;
function check(name: string, fn: () => void): void {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
}

check("melee max hit: 99 Strength unarmed on aggressive is 11, with a dragon scimitar (+66) is 22", () => {
    // Effective strength = 99 + 3 (aggressive) + 8.
    assert.equal(calculateMeleeMaxHit(110, 0), 11);
    assert.equal(calculateMeleeMaxHit(110, 66), 22);
});

check("accuracy: rolls are effective level x (bonus + 64), and the chance follows the attack/defence split", () => {
    assert.equal(calculateAttackRoll(110, 0), 7040);
    assert.equal(calculateDefenceRoll(10, 0), 640);
    // attack > defence: 1 - (def + 2) / (2 * (att + 1))
    assert.equal(calculateHitChance(7040, 640), Math.round((1 - 642 / (2 * 7041)) * 10_000));
    // attack <= defence: att / (2 * (def + 1))
    assert.equal(calculateHitChance(640, 7040), Math.round((640 / (2 * 7041)) * 10_000));
});

check("weapon attack speeds match RuneScape: daggers/scimitars/claws 4, longswords and maces 5, battleaxes 6, granite maul 7", () => {
    const weapons = createWeaponDataProvider();
    const expect: Record<number, number> = {
        1213: 4, 1215: 4, 1333: 4, 4587: 4, 13652: 4, // rune/dragon dagger, rune/dragon scimitar, dragon claws
        1303: 5, 1305: 5, 1432: 5, 1434: 5, // rune/dragon longsword, rune/dragon mace
        1373: 6, 1377: 6, // rune/dragon battleaxe
        4153: 7, // granite maul
    };
    for (const [id, ticks] of Object.entries(expect)) {
        assert.equal(weapons.getAttackSpeed(Number(id)), ticks, `${getItemDefinition(Number(id))?.name} should be ${ticks} ticks`);
    }
});

check("an NPC defends against magic with its Magic level alone (not 70% Magic + 30% Defence)", () => {
    const caster = new PlayerState(1, 3200, 3200, 0, GAMEMODE);
    const chanceAgainst = (magicLevel: number, defenceLevel: number): number => {
        const npc = new NpcState(2, 1, 1, -1, -1, 32, { x: 3201, y: 3200, level: 0 }, { maxHitpoints: 50 });
        npc.configureCombat({ hitpoints: 50, combatLevel: 50, profile: { magicLevel, defenceLevel, defenceMagic: 0 } });
        const evaluator = new CombatHitEvaluator({
            resolveEntity: (ref) => (ref.type === "player" ? caster : npc),
            getEquipmentBonuses: () => new Array(14).fill(0),
            random: () => 0.5,
        });
        return evaluator.evaluate({
            attacker: playerCombatEntityRef(caster.id),
            target: npcCombatEntityRef(npc.id),
            attackClock: 1,
            traits: { type: AttackType.Magic, style: CombatAttackStyle.Accurate, rangeTiles: 10, speedTicks: 5 },
        }).hitChance;
    };
    // A high-Defence, low-Magic NPC is easy to hit with spells; its Defence doesn't count.
    assert.equal(chanceAgainst(1, 99), chanceAgainst(1, 1));
    assert.ok(chanceAgainst(1, 99) > chanceAgainst(99, 1));
});

check("a player only auto-retaliates while standing still, not while walking away", () => {
    const pathService = { edgeHasWallBetween: () => false } as unknown as PathService;
    const npc = new NpcState(20, 1, 1, -1, -1, 32, { x: 3201, y: 3200, level: 0 }, { maxHitpoints: 20 });
    const make = (id: number) => new PlayerState(id, 3200, 3200, 0, GAMEMODE);
    const engineFor = (player: PlayerState) =>
        new CombatRetaliationEngine({
            pathService,
            getPlayer: (id) => (id === player.id ? player : undefined),
            getNpc: (id) => (id === npc.id ? npc : undefined),
            resolveAttackTraits: () => ({ type: AttackType.Melee, style: null, rangeTiles: 1, speedTicks: 4 }),
        });

    const walking = make(10);
    walking.setPath([{ x: 3199, y: 3200 }, { x: 3198, y: 3200 }], false);
    assert.equal(engineFor(walking).intercept(walking, npcCombatEntityRef(npc.id), 5), false);
    assert.equal(walking.combatAttributes.get(CombatAttributes.COMBAT_TARGET), null);

    const standing = make(11);
    assert.equal(engineFor(standing).intercept(standing, npcCombatEntityRef(npc.id), 5), true);
});

check("a player who can't reach its target gives the fight up after 10 ticks standing still", () => {
    const pathService = {
        edgeHasWallBetween: () => false,
        findPathSteps: () => ({ ok: false }),
        getCollisionFlagAt: () => 0,
    } as unknown as PathService;
    const player = new PlayerState(30, 3200, 3200, 0, GAMEMODE);
    const npc = new NpcState(31, 1, 1, -1, -1, 32, { x: 3205, y: 3200, level: 0 }, { maxHitpoints: 20 });
    const registry = {
        getPlayer: (id: number) => (id === player.id ? player : undefined),
        getNpc: (id: number) => (id === npc.id ? npc : undefined),
    };
    const processor = new CombatInteractionProcessor(
        new CombatTargetResolver(registry),
        new CombatRangeValidator(pathService),
        pathService,
    );
    const traits = () => ({ type: AttackType.Melee, style: null, rangeTiles: 1, speedTicks: 4 });
    player.combatAttributes.set(CombatAttributes.COMBAT_TARGET, npcCombatEntityRef(npc.id));
    for (let clock = 100; clock < 100 + UNREACHABLE_TIMEOUT_TICKS; clock++) {
        assert.equal(processor.process(player, clock, traits).status, "unreachable");
    }
    assert.equal(processor.process(player, 100 + UNREACHABLE_TIMEOUT_TICKS, traits).status, "ended");
    assert.equal(player.combatAttributes.get(CombatAttributes.COMBAT_TARGET), null);
});

check("single-way combat: only who is attacking each side counts", () => {
    const zones = new MultiCombatSystem();
    // Sinclair Mansion is single-way.
    const at = (x: number) => ({ tileX: x, tileY: 3580, level: 0 }) as unknown as PlayerState;
    const murderer = at(2740), victim = at(2741), detective = at(2742), bystander = at(2743);
    zones.recordEngagement(murderer, victim, 100);

    assert.equal(zones.canAttack(detective, victim, 101).reason, "Someone else is fighting that.");
    assert.equal(zones.canAttack(victim, detective, 101).reason, "I'm already under attack.");
    assert.equal(zones.canAttack(victim, murderer, 101).allowed, true, "the victim can always hit back");
    // The murderer's own attack doesn't stop anyone hitting the murderer, nor the murderer switching targets.
    assert.equal(zones.canAttack(detective, murderer, 101).allowed, true);
    assert.equal(zones.canAttack(murderer, bystander, 101).allowed, true);
    // It wears off 10 seconds after the last hit (17 ticks).
    assert.equal(zones.canAttack(detective, victim, 116).allowed, false);
    assert.equal(zones.canAttack(detective, victim, 117).allowed, true);
});

console.log(`\n${passed} RuneScape combat rule checks passed.`);
