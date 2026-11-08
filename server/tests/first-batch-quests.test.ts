import assert from "node:assert/strict";

import type { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { druidicRitualQuest } from "../gamemodes/dev/quests/definitions/druidicRitual";
import {
    CAULDRON_OF_THUNDER_LOC_ID,
    ENCHANTED_BEEF_ITEM_ID,
    KAQEMEEX_NPC_ID,
    RAW_BEEF_ITEM_ID,
    SANFEW_NPC_ID,
    STAGE_GATHERING_MEATS,
    VARP_DRUIDIC_RITUAL,
} from "../gamemodes/dev/quests/definitions/druidicRitual/constants";
import { goblinDiplomacyQuest } from "../gamemodes/dev/quests/definitions/goblinDiplomacy";
import {
    BLUE_DYE_ITEM_ID,
    GENERAL_BENTNOZE_NPC_ID,
    GOBLIN_MAIL_CRATE_LOC_IDS,
    GOBLIN_MAIL_ITEM_ID,
    ORANGE_GOBLIN_MAIL_ITEM_ID,
    STAGE_ORANGE_REJECTED,
    VARP_GOBLIN_DIPLOMACY,
} from "../gamemodes/dev/quests/definitions/goblinDiplomacy/constants";
import { monksFriendQuest } from "../gamemodes/dev/quests/definitions/monksFriend";
import {
    BROTHER_CEDRIC_NPC_ID,
    BROTHER_OMAD_NPC_ID,
    CAVE_LADDER_LOC_ID,
    CHILDS_BLANKET_ITEM_ID,
    HIDDEN_LADDER_LOC_ID,
    JUG_OF_WATER_ITEM_ID,
    LAW_RUNE_ITEM_ID,
    STAGE_FIXED_CART,
    VARP_MONKS_FRIEND,
} from "../gamemodes/dev/quests/definitions/monksFriend/constants";

function playerAt(varpId: number, stage: number): PlayerState {
    return {
        varps: { getVarpValue: (id: number) => (id === varpId ? stage : 0) },
    } as unknown as PlayerState;
}

function journalServices(itemIds: number[] = []): ScriptServices {
    return {
        inventory: {
            getInventoryItems: () =>
                itemIds.map((itemId, slot) => ({ slot, itemId, quantity: 1 })),
        },
    } as unknown as ScriptServices;
}

assert.equal(druidicRitualQuest.varpId, VARP_DRUIDIC_RITUAL);
assert.equal(druidicRitualQuest.completionValue, 4);
assert.equal(druidicRitualQuest.rewards.questPoints, 4);
assert.deepEqual(druidicRitualQuest.rewards.xp, [
    { skillId: 15, amount: 250, label: "Herblore" },
]);
const druidRegistry = new ScriptRegistry();
druidicRitualQuest.register(druidRegistry, {} as ScriptServices);
assert.ok(druidRegistry.findNpcInteractionDirect(KAQEMEEX_NPC_ID, "talk-to"));
assert.ok(druidRegistry.findNpcInteractionDirect(SANFEW_NPC_ID));
assert.ok(druidRegistry.findItemOnLoc(RAW_BEEF_ITEM_ID, CAULDRON_OF_THUNDER_LOC_ID));
assert.ok(druidRegistry.findItemOnNpc(ENCHANTED_BEEF_ITEM_ID, SANFEW_NPC_ID));
let cauldronResult = -1;
druidRegistry.findItemOnLoc(RAW_BEEF_ITEM_ID, CAULDRON_OF_THUNDER_LOC_ID)?.({
    player: playerAt(VARP_DRUIDIC_RITUAL, STAGE_GATHERING_MEATS),
    services: {
        inventory: {
            setInventorySlot: (_player: PlayerState, _slot: number, itemId: number) => {
                cauldronResult = itemId;
            },
            snapshotInventory: () => undefined,
        },
        messaging: { sendGameMessage: () => undefined },
    } as unknown as ScriptServices,
    tick: 0,
    source: { slot: 2, itemId: RAW_BEEF_ITEM_ID },
    target: {
        locId: CAULDRON_OF_THUNDER_LOC_ID,
        tile: { x: 2892, y: 9831 },
        level: 0,
    },
});
assert.equal(cauldronResult, ENCHANTED_BEEF_ITEM_ID);
assert.match(
    druidicRitualQuest
        .buildJournal(
            playerAt(VARP_DRUIDIC_RITUAL, STAGE_GATHERING_MEATS),
            journalServices([ENCHANTED_BEEF_ITEM_ID]),
        )
        .join(" "),
    /<str>Enchanted beef<\/str>/,
);

assert.equal(monksFriendQuest.varpId, VARP_MONKS_FRIEND);
assert.equal(monksFriendQuest.completionValue, 80);
assert.deepEqual(monksFriendQuest.rewards.items, [
    { itemId: LAW_RUNE_ITEM_ID, quantity: 8, label: "8 Law runes" },
]);
const monkRegistry = new ScriptRegistry();
monksFriendQuest.register(monkRegistry, {} as ScriptServices);
assert.ok(monkRegistry.findNpcInteractionDirect(BROTHER_OMAD_NPC_ID, "talk-to"));
assert.ok(monkRegistry.findNpcInteractionDirect(BROTHER_CEDRIC_NPC_ID));
assert.ok(monkRegistry.findItemOnNpc(CHILDS_BLANKET_ITEM_ID, BROTHER_OMAD_NPC_ID));
assert.ok(monkRegistry.findItemOnNpc(JUG_OF_WATER_ITEM_ID, BROTHER_CEDRIC_NPC_ID));
assert.ok(monkRegistry.findLocInteraction(HIDDEN_LADDER_LOC_ID, "climb-down"));
assert.ok(monkRegistry.findLocInteraction(CAVE_LADDER_LOC_ID, "climb-up"));
let ladderDestination = "";
monkRegistry.findLocInteraction(HIDDEN_LADDER_LOC_ID, "climb-down")?.({
    player: playerAt(VARP_MONKS_FRIEND, 10),
    services: {
        movement: {
            teleportPlayer: (_player: PlayerState, x: number, y: number, level: number) => {
                ladderDestination = `${x}:${y}:${level}`;
            },
        },
    } as unknown as ScriptServices,
    tick: 0,
    locId: HIDDEN_LADDER_LOC_ID,
    tile: { x: 2561, y: 3222 },
    level: 0,
    action: "climb-down",
});
assert.equal(ladderDestination, "2561:9621:0");
assert.match(
    monksFriendQuest
        .buildJournal(playerAt(VARP_MONKS_FRIEND, STAGE_FIXED_CART), journalServices())
        .join(" "),
    /return to <col=800000>Brother Omad/,
);

assert.equal(goblinDiplomacyQuest.varpId, VARP_GOBLIN_DIPLOMACY);
assert.equal(goblinDiplomacyQuest.completionValue, 6);
assert.equal(goblinDiplomacyQuest.rewards.questPoints, 5);
const goblinRegistry = new ScriptRegistry();
goblinDiplomacyQuest.register(goblinRegistry, {} as ScriptServices);
assert.ok(goblinRegistry.findNpcInteractionDirect(GENERAL_BENTNOZE_NPC_ID, "talk-to"));
assert.ok(goblinRegistry.findLocInteraction(GOBLIN_MAIL_CRATE_LOC_IDS[0], "search"));
assert.ok(goblinRegistry.findItemOnItem(BLUE_DYE_ITEM_ID, GOBLIN_MAIL_ITEM_ID));
assert.ok(goblinRegistry.findItemOnNpc(ORANGE_GOBLIN_MAIL_ITEM_ID, GENERAL_BENTNOZE_NPC_ID));
const dyeInventory = [
    { slot: 0, itemId: BLUE_DYE_ITEM_ID, quantity: 1 },
    { slot: 1, itemId: GOBLIN_MAIL_ITEM_ID, quantity: 1 },
];
goblinRegistry.findItemOnItem(BLUE_DYE_ITEM_ID, GOBLIN_MAIL_ITEM_ID)?.({
    player: playerAt(VARP_GOBLIN_DIPLOMACY, 1),
    services: {
        inventory: {
            getInventoryItems: () => dyeInventory,
            setInventorySlot: (
                _player: PlayerState,
                slot: number,
                itemId: number,
                quantity: number,
            ) => {
                dyeInventory[slot] = { slot, itemId, quantity };
            },
            snapshotInventory: () => undefined,
        },
        messaging: { sendGameMessage: () => undefined },
    } as unknown as ScriptServices,
    tick: 0,
    source: { slot: 0, itemId: BLUE_DYE_ITEM_ID },
    target: { slot: 1, itemId: GOBLIN_MAIL_ITEM_ID },
});
assert.equal(dyeInventory[0].itemId, -1);
assert.equal(dyeInventory[1].itemId, 287);
assert.match(
    goblinDiplomacyQuest
        .buildJournal(
            playerAt(VARP_GOBLIN_DIPLOMACY, STAGE_ORANGE_REJECTED),
            journalServices(),
        )
        .join(" "),
    /blue goblin mail/,
);

console.log("first-batch-quests.test.ts: all assertions passed");
