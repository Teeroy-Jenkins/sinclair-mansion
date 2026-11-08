import assert from "node:assert/strict";

import { registerQuestHandlers, getRegisteredQuests } from "../gamemodes/dev/quests";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";

const noop = (): undefined => undefined;
const emptyFacade = new Proxy({}, { get: () => noop });
const services = new Proxy(
    { system: { logger: { debug: noop, info: noop, warn: noop, error: noop } } },
    {
        get: (target, property) =>
            property in target
                ? target[property as keyof typeof target]
                : emptyFacade,
    },
) as unknown as ScriptServices;

registerQuestHandlers(new ScriptRegistry(), services);

const quests = getRegisteredQuests();
assert.equal(quests.length, 64);
assert.equal(new Set(quests.map((quest) => quest.key)).size, quests.length);
assert.equal(new Set(quests.map((quest) => quest.varpId)).size, quests.length);

for (const expected of [
    "Big Chompy Bird Hunting",
    "Biohazard",
    "Dragon Slayer I",
    "Eadgar's Ruse",
    "Horror from the Deep",
    "Legend's Quest",
    "Observatory Quest",
    "Regicide",
    "Shilo Village",
    "Tai Bwo Wannai Trio",
    "The Fremennik Trials",
    "Underground Pass",
    "Watchtower",
]) {
    assert(quests.some((quest) => quest.name === expected), `${expected} was not registered`);
}

console.log(`All ${quests.length} quest definitions registered without state collisions.`);
