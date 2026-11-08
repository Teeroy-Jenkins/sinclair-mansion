import assert from "node:assert/strict";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { restlessGhostQuest } from "../gamemodes/dev/quests/definitions/restlessGhost";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    VARP_RESTLESS_GHOST,
} from "../gamemodes/dev/quests/definitions/restlessGhost/constants";

assert.equal(restlessGhostQuest.varpId, VARP_RESTLESS_GHOST);
assert.equal(restlessGhostQuest.completionValue, STAGE_COMPLETE);
assert.equal(restlessGhostQuest.rewards.questPoints, 1);
assert.equal(restlessGhostQuest.rewards.xp?.[0]?.amount, 1125);

const registry = new ScriptRegistry();
restlessGhostQuest.register(registry, {} as ScriptServices);
assert.ok(registry.findNpcInteractionDirect(NPC.fatherAereck, "talk-to"));
assert.ok(registry.findNpcInteractionDirect(NPC.fatherUrhney, "talk-to"));
assert.ok(registry.findNpcInteractionDirect(NPC.restlessGhost, "talk-to"));
assert.ok(registry.findLocInteraction(LOC.closedCoffin, "open"));
assert.ok(registry.findLocInteraction(LOC.skullAltar, "search"));
assert.ok(registry.findItemOnLoc(ITEM.ghostSkull, LOC.openCoffin));
assert.ok(registry.findItemOnNpc(ITEM.ghostSkull, NPC.restlessGhost));

console.log("restless-ghost-quest.test.ts: all assertions passed");
