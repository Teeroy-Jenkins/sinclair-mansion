import assert from "node:assert/strict";

import { PRAYER_HEAD_ICON_IDS } from "../../client/rs/prayer/prayers";
import { SkillId } from "../../client/rs/skill/skills";
import type { ServerServices } from "../src/game/ServerServices";
import { AttackType } from "../src/game/combat/AttackType";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { CombatHitEvaluator } from "../src/game/combat/engine/CombatHitEvaluator";
import type { CombatAttack } from "../src/game/combat/model/CombatAttack";
import {
    npcCombatEntityRef,
    playerCombatEntityRef,
} from "../src/game/combat/model/CombatEntityRef";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { DEFAULT_NPC_COMBAT_PROFILE, NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import { OverheadType } from "../src/game/prayer/OverheadType";
import { PrayerDrainProcessor } from "../src/game/prayer/engine/PrayerDrainProcessor";

const TEST_GAMEMODE = {
    id: "prayer-overhead-regression",
    name: "Prayer overhead regression",
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

assert.deepEqual(PRAYER_HEAD_ICON_IDS, {
    protect_melee: 0,
    protect_missiles: 1,
    protect_magic: 2,
    retribution: 3,
    smite: 4,
    redemption: 5,
});

const target = new PlayerState(1, 3200, 3200, 0, TEST_GAMEMODE);
target.prayer.setActivePrayers(["protect_from_melee"]);
assert.equal(
    target.combatAttributes.get(CombatAttributes.ACTIVE_OVERHEAD_PRAYER),
    OverheadType.MELEE,
);

const npc = new NpcState(
    2,
    7,
    1,
    -1,
    -1,
    32,
    { x: 3201, y: 3200, level: 0 },
    {
        combatProfile: {
            ...DEFAULT_NPC_COMBAT_PROFILE,
            attackLevel: 99,
            attackBonus: 100,
            maxHit: 10,
        },
    },
);

const npcAttack: CombatAttack = Object.freeze({
    attacker: npcCombatEntityRef(npc.id),
    target: playerCombatEntityRef(target.id),
    attackClock: 1,
    traits: Object.freeze({
        type: AttackType.Melee,
        style: null,
        rangeTiles: 1,
        speedTicks: 4,
    }),
});

const npcRandom = [0, 0.99];
const npcEvaluator = new CombatHitEvaluator({
    resolveEntity: (reference) =>
        reference.type === "npc"
            ? reference.id === npc.id
                ? npc
                : undefined
            : reference.id === target.id
              ? target
              : undefined,
    getEquipmentBonuses: () => new Array<number>(14).fill(0),
    random: () => npcRandom.shift() ?? 0,
});
const protectedNpcHit = npcEvaluator.evaluate(npcAttack);
assert.equal(protectedNpcHit.landed, true);
assert.equal(protectedNpcHit.damage, 0, "matching protection must fully block NPC damage");

const attacker = new PlayerState(3, 3201, 3200, 0, TEST_GAMEMODE);
attacker.skillSystem.getSkill(SkillId.Attack).baseLevel = 99;
attacker.skillSystem.getSkill(SkillId.Strength).baseLevel = 99;
const pvpAttack: CombatAttack = Object.freeze({
    attacker: playerCombatEntityRef(attacker.id),
    target: playerCombatEntityRef(target.id),
    attackClock: 2,
    traits: Object.freeze({
        type: AttackType.Melee,
        style: null,
        rangeTiles: 1,
        speedTicks: 4,
    }),
});
const equipmentBonuses = new Array<number>(14).fill(0);
equipmentBonuses[0] = 100;
equipmentBonuses[10] = 100;

const evaluatePvp = (protectedTarget: boolean): number => {
    target.combatAttributes.set(
        CombatAttributes.ACTIVE_OVERHEAD_PRAYER,
        protectedTarget ? OverheadType.MELEE : OverheadType.NONE,
    );
    const random = [0, 0.99];
    return new CombatHitEvaluator({
        resolveEntity: (reference) =>
            reference.id === attacker.id ? attacker : reference.id === target.id ? target : undefined,
        getEquipmentBonuses: () => equipmentBonuses,
        random: () => random.shift() ?? 0,
    }).evaluate(pvpAttack).damage;
};

const unprotectedPvpDamage = evaluatePvp(false);
const protectedPvpDamage = evaluatePvp(true);
assert.ok(unprotectedPvpDamage > 0);
assert.equal(protectedPvpDamage, Math.floor(unprotectedPvpDamage * 0.6));
// A gamemode can make protection block players' hits fully (Sinclair Mansion's prayer potion).
target.protectionBlocksPlayers = true;
assert.equal(evaluatePvp(true), 0, "full block when the gamemode asks for it");
assert.equal(evaluatePvp(false), unprotectedPvpDamage, "and only while the prayer is up");
target.protectionBlocksPlayers = false;

const messages: string[] = [];
let sidebarRefreshes = 0;
const services = {
    soundService: { sendSound: () => undefined },
    messagingService: {
        queueChatMessage: (message: { text: string }) => messages.push(message.text),
    },
    queueCombatState: () => sidebarRefreshes++,
} as unknown as ServerServices;
const drainPlayer = new PlayerState(4, 3200, 3200, 0, TEST_GAMEMODE);
drainPlayer.skillSystem.getSkill(SkillId.Prayer).baseLevel = 1;
drainPlayer.skillSystem.getSkill(SkillId.Prayer).boost = 0;
drainPlayer.prayer.setActivePrayers(["smite"]);
const drainProcessor = new PrayerDrainProcessor(services);

for (let tick = 1; tick <= 5; tick++) {
    drainProcessor.processPlayer(drainPlayer);
}

assert.equal(drainPlayer.prayer.getActivePrayers().size, 0);
assert.equal(
    drainPlayer.combatAttributes.get(CombatAttributes.ACTIVE_OVERHEAD_PRAYER),
    OverheadType.NONE,
);
assert.equal(
    drainPlayer.combatAttributes.get(CombatAttributes.PRAYER_POINTS_CURRENT),
    0,
);
assert.deepEqual(messages, ["You have run out of prayer points!"]);
assert.equal(sidebarRefreshes, 1);

console.log("prayer overhead regression tests passed");
