import assert from "node:assert/strict";

import type { PlayerState } from "../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../src/game/scripts/types";
import {
    ernestTheChickenQuest,
    getErnestPuzzleDoorStates,
} from "../gamemodes/dev/quests/definitions/ernestTheChicken";
import { piratesTreasureQuest } from "../gamemodes/dev/quests/definitions/piratesTreasure";
import { vampyreSlayerQuest } from "../gamemodes/dev/quests/definitions/vampyreSlayer";
import type { QuestDefinition } from "../gamemodes/dev/quests/types";

assert.deepEqual(
    [piratesTreasureQuest, vampyreSlayerQuest, ernestTheChickenQuest].map((quest) => [
        quest.varpId,
        quest.completionValue,
        quest.rewards.questPoints,
    ]),
    [
        [71, 4, 2],
        [178, 3, 3],
        [32, 3, 4],
    ],
);
assert.equal(vampyreSlayerQuest.name, "Vampyre Slayer");
assert.deepEqual(
    vampyreSlayerQuest.rewards.xp?.map((reward) => reward.amount),
    [4825],
);
assert.deepEqual(
    piratesTreasureQuest.rewards.items?.map((reward) => reward.quantity),
    [450, 1, 1],
);
assert.deepEqual(
    ernestTheChickenQuest.rewards.items?.map((reward) => reward.quantity),
    [300],
);

function journalAt(quest: QuestDefinition, stage: number): string {
    const player = {
        varps: { getVarpValue: () => stage },
    } as unknown as PlayerState;
    return quest.buildJournal(player, {} as ScriptServices).join("\n");
}

assert.match(journalAt(piratesTreasureQuest, 1), /Karamjan rum/);
assert.match(journalAt(piratesTreasureQuest, 2), /Blue Moon Inn/);
assert.match(journalAt(piratesTreasureQuest, 3), /Falador Park/);
assert.match(journalAt(piratesTreasureQuest, 4), /QUEST COMPLETE/);
assert.match(journalAt(vampyreSlayerQuest, 1), /Dr Harlow/);
assert.match(journalAt(vampyreSlayerQuest, 2), /Count Draynor/);
assert.match(journalAt(vampyreSlayerQuest, 3), /QUEST COMPLETE/);
assert.match(journalAt(ernestTheChickenQuest, 1), /Professor Oddenstein/);
assert.match(journalAt(ernestTheChickenQuest, 2), /pressure gauge/);
assert.match(journalAt(ernestTheChickenQuest, 3), /QUEST COMPLETE/);

// Preservation/OSRS basement conditions: D opens 5-6; E up + F down opens 8-9.
assert.equal(getErnestPuzzleDoorStates(1 << 3)[3], true);
assert.equal(getErnestPuzzleDoorStates(1 << 3)[8], true);
assert.equal(getErnestPuzzleDoorStates(1 << 5)[4], true);
assert.equal(getErnestPuzzleDoorStates((1 << 4) | (1 << 5))[4], false);
assert.equal(getErnestPuzzleDoorStates(0).some(Boolean), false);

function registeredLocIds(quest: QuestDefinition): number[] {
    const ids: number[] = [];
    const registry = new Proxy(
        {},
        {
            get: (_target, property) =>
                (...args: unknown[]) => {
                    if (property === "registerLocScript") {
                        ids.push((args[0] as { locId: number }).locId);
                    }
                    if (property === "registerItemOnLoc") {
                        ids.push(args[1] as number);
                    }
                    return { dispose() {} };
                },
        },
    ) as unknown as IScriptRegistry;
    const services = { system: { eventBus: undefined } } as unknown as ScriptServices;
    quest.register(registry, services);
    return ids;
}

assert(registeredLocIds(piratesTreasureQuest).includes(2069));
assert(registeredLocIds(vampyreSlayerQuest).includes(46237));
const ernestLocs = registeredLocIds(ernestTheChickenQuest);
assert(ernestLocs.includes(152));
assert(ernestLocs.includes(11450));

console.log("Pirate's Treasure, Vampyre Slayer, and Ernest the Chicken tests passed.");
