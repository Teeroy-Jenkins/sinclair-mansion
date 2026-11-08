import assert from "node:assert/strict";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { doricsQuest } from "../gamemodes/dev/quests/definitions/dorics";
import {
    BRONZE_PICKAXE_ITEM_ID,
    DORIC_ANVIL_LOC_ID,
    DORIC_NPC_ID,
    DORIC_WHETSTONE_LOC_ID,
    REQUIRED_ITEMS,
} from "../gamemodes/dev/quests/definitions/dorics/constants";

assert.equal(doricsQuest.name, "Doric's Quest");
assert.equal(doricsQuest.rewards.questPoints, 1);
assert.equal(doricsQuest.rewards.items?.[0]?.quantity, 180);
assert.equal(doricsQuest.rewards.xp?.[0]?.amount, 1300);
assert.equal(BRONZE_PICKAXE_ITEM_ID, 1265);
assert.deepEqual(
    REQUIRED_ITEMS.map(({ quantity }) => quantity),
    [6, 4, 2],
);

const registry = new ScriptRegistry();
registry.registerLocAction("smith", () => undefined);
const services = {
    system: { logger: { warn: () => undefined } },
} as unknown as ScriptServices;
doricsQuest.register(registry, services);

assert.ok(registry.findNpcInteractionDirect(DORIC_NPC_ID, "talk-to"));
assert.ok(registry.findNpcInteractionDirect(DORIC_NPC_ID));
assert.ok(registry.findLocInteraction(DORIC_ANVIL_LOC_ID, "smith"));
assert.ok(registry.findLocInteraction(DORIC_WHETSTONE_LOC_ID, "use"));

console.log("dorics-quest-parity.test.ts: all assertions passed");
