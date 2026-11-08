import assert from "node:assert/strict";

import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { runeMysteriesQuest } from "../gamemodes/dev/quests/definitions/runeMysteries";
import {
    AIR_TALISMAN_ITEM_ID,
    AUBURY_NPC_IDS,
    DUKE_HORACIO_NPC_ID,
    RESEARCH_NOTES_ITEM_ID,
    RESEARCH_PACKAGE_ITEM_ID,
    SEDRIDOR_NPC_IDS,
    STAGE_COMPLETE,
    STAGE_RECEIVED_NOTES,
    VARP_RUNE_MYSTERIES,
} from "../gamemodes/dev/quests/definitions/runeMysteries/constants";

assert.equal(runeMysteriesQuest.name, "Rune Mysteries");
assert.equal(runeMysteriesQuest.varpId, VARP_RUNE_MYSTERIES);
assert.equal(runeMysteriesQuest.completionValue, STAGE_COMPLETE);
assert.equal(runeMysteriesQuest.rewards.questPoints, 1);
assert.equal(runeMysteriesQuest.rewardItemId, AIR_TALISMAN_ITEM_ID);

const registry = new ScriptRegistry();
runeMysteriesQuest.register(registry, {} as ScriptServices);
assert.ok(registry.findNpcInteractionDirect(DUKE_HORACIO_NPC_ID, "talk-to"));
assert.ok(registry.findNpcInteractionDirect(SEDRIDOR_NPC_IDS[1], "talk-to"));
assert.ok(registry.findNpcInteractionDirect(SEDRIDOR_NPC_IDS[2], "teleport"));
assert.ok(registry.findNpcInteractionDirect(AUBURY_NPC_IDS[1], "talk-to"));
assert.ok(registry.findNpcInteractionDirect(AUBURY_NPC_IDS[2], "teleport"));
assert.ok(registry.findItemOnNpc(RESEARCH_NOTES_ITEM_ID, SEDRIDOR_NPC_IDS[1]));
assert.ok(registry.findItemOnNpc(RESEARCH_PACKAGE_ITEM_ID, AUBURY_NPC_IDS[1]));

const journalPlayer = {
    varps: { getVarpValue: () => STAGE_RECEIVED_NOTES },
} as never;
const journalServices = {
    inventory: {
        getInventoryItems: () => [{ slot: 0, itemId: RESEARCH_NOTES_ITEM_ID, quantity: 1 }],
    },
} as unknown as ScriptServices;
assert.ok(
    runeMysteriesQuest
        .buildJournal(journalPlayer, journalServices)
        .some((line) => line.includes("Aubury's notes")),
);

console.log("rune-mysteries-quest.test.ts: all assertions passed");

