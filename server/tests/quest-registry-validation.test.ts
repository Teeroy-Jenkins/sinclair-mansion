import assert from "node:assert/strict";
import {
    getQuestDefinitionByKey,
    getQuestDefinitionByName,
    registerQuestDefinition,
} from "../gamemodes/dev/quests/QuestRegistry";
import type { QuestDefinition } from "../gamemodes/dev/quests/types";

function definition(key: string, name: string, varpId: number): QuestDefinition {
    return {
        key,
        name,
        varpId,
        startedValue: 1,
        completionValue: 2,
        rewards: { questPoints: 1 },
        buildJournal: () => [],
        register: () => undefined,
    };
}

const quest = definition("registry-test-a", "Registry Test A", 60000);
registerQuestDefinition(quest);
registerQuestDefinition(quest);
const hotReloadedQuest = definition("registry-test-a", "Registry Test A", 60000);
registerQuestDefinition(hotReloadedQuest);
assert.equal(getQuestDefinitionByKey("REGISTRY-TEST-A"), hotReloadedQuest);
assert.equal(getQuestDefinitionByName("registry test a"), hotReloadedQuest);

assert.throws(
    () => registerQuestDefinition(definition("registry-test-a", "Another Name", 60001)),
    /Duplicate quest key/,
);
assert.throws(
    () => registerQuestDefinition(definition("another-key", "Registry Test A", 60002)),
    /Duplicate quest name/,
);
assert.throws(
    () => registerQuestDefinition(definition("third-key", "Third Quest", 60000)),
    /Duplicate quest varp/,
);
assert.throws(
    () => registerQuestDefinition(definition("", "Missing Key", 60003)),
    /key cannot be empty/,
);

console.log("quest-registry-validation.test.ts: all assertions passed");
