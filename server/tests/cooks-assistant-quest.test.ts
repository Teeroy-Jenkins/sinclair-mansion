import assert from "node:assert/strict";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { cooksAssistantQuest } from "../gamemodes/dev/quests/definitions/cooksAssistant";
import {
    COOKING_RANGE_LOC_ID,
    COOK_NPC_ID,
    EGG_ITEM_ID,
    REQUIRED_ITEMS,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_COOKS_ASSISTANT,
} from "../gamemodes/dev/quests/definitions/cooksAssistant/constants";

assert.equal(cooksAssistantQuest.name, "Cook's Assistant");
assert.equal(cooksAssistantQuest.varpId, VARP_COOKS_ASSISTANT);
assert.equal(cooksAssistantQuest.startedValue, STAGE_STARTED);
assert.equal(cooksAssistantQuest.completionValue, STAGE_COMPLETE);
assert.equal(cooksAssistantQuest.rewards.questPoints, 1);
assert.deepEqual(cooksAssistantQuest.rewards.xp, [
    { skillId: 7, amount: 300, label: "Cooking" },
]);
assert.equal(REQUIRED_ITEMS.length, 3);

const registry = new ScriptRegistry();
registry.registerLocAction("cook", () => undefined);
const services = {
    system: {
        logger: {
            warn: () => undefined,
        },
    },
} as unknown as ScriptServices;

cooksAssistantQuest.register(registry, services);

assert.ok(registry.findNpcInteractionDirect(COOK_NPC_ID, "talk-to"));
assert.ok(registry.findNpcInteractionDirect(COOK_NPC_ID));
assert.ok(registry.findLocInteraction(COOKING_RANGE_LOC_ID, "cook"));
assert.ok(registry.findItemOnLoc(EGG_ITEM_ID, COOKING_RANGE_LOC_ID));

console.log("cooks-assistant-quest.test.ts: all assertions passed");
