import assert from "node:assert/strict";

import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { romeoAndJulietQuest } from "../gamemodes/dev/quests/definitions/romeoAndJuliet";
import {
    APOTHECARY_NPC_ID,
    CADAVA_BERRIES_ITEM_ID,
    CADAVA_BUSH_LOC_IDS,
    CADAVA_POTION_ITEM_ID,
    FATHER_LAWRENCE_NPC_ID,
    JULIETS_MESSAGE_ITEM_ID,
    JULIET_NPC_IDS,
    ROMEO_NPC_ID,
    STAGE_COMPLETE,
    STAGE_SPOKEN_TO_APOTHECARY,
    VARP_ROMEO_AND_JULIET,
} from "../gamemodes/dev/quests/definitions/romeoAndJuliet/constants";

assert.equal(romeoAndJulietQuest.name, "Romeo & Juliet");
assert.equal(romeoAndJulietQuest.varpId, VARP_ROMEO_AND_JULIET);
assert.equal(romeoAndJulietQuest.completionValue, STAGE_COMPLETE);
assert.equal(romeoAndJulietQuest.rewards.questPoints, 5);
assert.equal(romeoAndJulietQuest.rewardItemId, CADAVA_POTION_ITEM_ID);
assert.equal(JULIETS_MESSAGE_ITEM_ID, 755);

const registry = new ScriptRegistry();
romeoAndJulietQuest.register(registry, {} as ScriptServices);
assert.ok(registry.findNpcInteractionDirect(ROMEO_NPC_ID, "talk-to"));
assert.ok(registry.findNpcInteractionDirect(JULIET_NPC_IDS[0], "talk-to"));
assert.ok(registry.findNpcInteractionDirect(JULIET_NPC_IDS[1], "talk-to"));
assert.ok(registry.findNpcInteractionDirect(FATHER_LAWRENCE_NPC_ID, "talk-to"));
assert.ok(registry.findNpcInteractionDirect(APOTHECARY_NPC_ID, "talk-to"));
for (const locId of CADAVA_BUSH_LOC_IDS) {
    assert.ok(registry.findLocInteraction(locId, "pick-from"));
}

const journalPlayer = {
    varps: { getVarpValue: () => STAGE_SPOKEN_TO_APOTHECARY },
} as never;
const journalServices = {
    inventory: {
        getInventoryItems: () => [{ slot: 0, itemId: CADAVA_BERRIES_ITEM_ID, quantity: 1 }],
    },
} as unknown as ScriptServices;
assert.ok(
    romeoAndJulietQuest
        .buildJournal(journalPlayer, journalServices)
        .some((line) => line.includes("Apothecary")),
);

console.log("romeo-and-juliet-quest.test.ts: all assertions passed");

