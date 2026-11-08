import assert from "node:assert/strict";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { sheepShearerQuest } from "../gamemodes/dev/quests/definitions/sheepShearer";
import {
    FRED_THE_FARMER_NPC_ID,
    STRANGE_SHEEP_NPC_ID,
    getDeliveredWool,
    getRemainingWool,
} from "../gamemodes/dev/quests/definitions/sheepShearer/constants";

assert.equal(getDeliveredWool(1), 0);
assert.equal(getDeliveredWool(7), 6);
assert.equal(getDeliveredWool(21), 20);
assert.equal(getRemainingWool(1), 20);
assert.equal(getRemainingWool(20), 1);
assert.equal(getRemainingWool(21), 0);
assert.equal(sheepShearerQuest.rewardItemId, 995);

const registry = new ScriptRegistry();
registry.registerNpcScript({ npcId: STRANGE_SHEEP_NPC_ID, option: "shear", handler: () => undefined });
sheepShearerQuest.register(registry, {} as ScriptServices);
assert.ok(registry.findNpcInteractionDirect(FRED_THE_FARMER_NPC_ID, "talk-to"));
assert.ok(registry.findNpcInteractionDirect(STRANGE_SHEEP_NPC_ID, "shear"));

console.log("sheep-shearer-parity.test.ts: all assertions passed");
