import assert from "node:assert/strict";

import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocEvent,
    ItemOnLocHandler,
    ItemOnNpcEvent,
    ItemOnNpcHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import { fishingContestQuest } from "../gamemodes/dev/quests/definitions/fishingContest";
import { gertrudesCatQuest } from "../gamemodes/dev/quests/definitions/gertrudesCat";
import type { QuestDefinition } from "../gamemodes/dev/quests/types";

assert.deepEqual(
    [fishingContestQuest, gertrudesCatQuest].map((quest) => [
        quest.varpId,
        quest.completionValue,
        quest.rewards.questPoints,
    ]),
    [
        [11, 5, 1],
        [180, 6, 1],
    ],
);
assert.equal(fishingContestQuest.requirements?.skills?.[0].level, 10);
assert.equal(fishingContestQuest.rewards.xp?.[0].amount, 2437.5);
assert.equal(gertrudesCatQuest.rewards.xp?.[0].amount, 1525);
assert.deepEqual(
    gertrudesCatQuest.rewards.items?.map((reward) => reward.itemId),
    [1555, 1897, 2003],
);

function journalAt(quest: QuestDefinition, stage: number): string {
    const player = {
        varps: { getVarpValue: () => stage },
    } as unknown as PlayerState;
    return quest.buildJournal(player, {} as ScriptServices).join("\n");
}

assert.match(journalAt(fishingContestQuest, 0), /level 10 Fishing/);
assert.match(journalAt(fishingContestQuest, 3), /red vine worms/);
assert.match(journalAt(fishingContestQuest, 4), /trophy/);
assert.match(journalAt(fishingContestQuest, 5), /QUEST COMPLETE/);
assert.match(journalAt(gertrudesCatQuest, 1), /Shilop and Wilough/);
assert.match(journalAt(gertrudesCatQuest, 4), /kitten mewing/);
assert.match(journalAt(gertrudesCatQuest, 5), /Gertrude/);
assert.match(journalAt(gertrudesCatQuest, 6), /QUEST COMPLETE/);

function registrations(quest: QuestDefinition): string[] {
    const calls: string[] = [];
    const registry = new Proxy(
        {},
        {
            get: (_target, property) =>
                (...args: unknown[]) => {
                    if (property === "registerNpcScript") {
                        calls.push(`npc:${(args[0] as { npcId: number }).npcId}`);
                    } else if (property === "registerItemOnNpc") {
                        calls.push(`item-npc:${args[0]}:${args[1]}`);
                    } else if (property === "registerItemOnLoc") {
                        calls.push(`item-loc:${args[0]}:${args[1]}`);
                    } else if (property === "registerLocScript") {
                        calls.push(`loc:${(args[0] as { locId: number }).locId}`);
                    }
                    return { dispose() {} };
                },
        },
    ) as unknown as IScriptRegistry;
    quest.register(registry, {} as ScriptServices);
    return calls;
}

const fishingCalls = registrations(fishingContestQuest);
assert(fishingCalls.includes("npc:4077"));
assert(fishingCalls.includes("npc:4069"));
assert(fishingCalls.includes("item-loc:1550:41"));
assert(fishingCalls.includes("item-loc:952:58"));
assert(fishingCalls.includes("item-loc:952:2994"));
assert(fishingCalls.includes("loc:54"));
assert(fishingCalls.includes("loc:55"));
assert(fishingCalls.includes("loc:56"));
assert(fishingCalls.includes("loc:57"));
const catCalls = registrations(gertrudesCatQuest);
assert(catCalls.includes("npc:3500"));
assert(catCalls.includes("npc:3499"));
assert(catCalls.includes("item-npc:1927:3497"));
assert(catCalls.includes("item-npc:327:3497"));
assert(catCalls.includes("item-npc:1554:3497"));

function interactionRegistry(capture: {
    itemOnLoc?: ItemOnLocHandler;
    itemOnNpc?: ItemOnNpcHandler;
}): IScriptRegistry {
    return new Proxy(
        {},
        {
            get: (_target, property) =>
                (...args: unknown[]) => {
                    if (property === "registerItemOnLoc" && args[0] === 1550) {
                        capture.itemOnLoc = args[2] as ItemOnLocHandler;
                    }
                    if (property === "registerItemOnNpc" && args[0] === 1927) {
                        capture.itemOnNpc = args[2] as ItemOnNpcHandler;
                    }
                    return { dispose() {} };
                },
        },
    ) as unknown as IScriptRegistry;
}

{
    const values = new Map<number, number>([[11, 2]]);
    const consumed: number[] = [];
    const player = {
        id: 1,
        gamemode: { getQuestListGroups: () => [] },
        varps: {
            getVarpValue: (id: number) => values.get(id) ?? 0,
            setVarpValue: (id: number, value: number) => values.set(id, value),
        },
    } as unknown as PlayerState;
    const services = {
        inventory: {
            consumeItem: (_player: PlayerState, slot: number) => {
                consumed.push(slot);
                return true;
            },
        },
        variables: { sendVarp: () => undefined },
        messaging: { sendGameMessage: () => undefined },
        dialog: { queueWidgetEvent: () => undefined },
    } as unknown as ScriptServices;
    const capture: { itemOnLoc?: ItemOnLocHandler } = {};
    fishingContestQuest.register(interactionRegistry(capture), services);
    capture.itemOnLoc?.({
        tick: 0,
        player,
        services,
        source: { slot: 7, itemId: 1550 },
        target: { locId: 41, tile: { x: 2630, y: 3442 }, level: 0 },
    } satisfies ItemOnLocEvent);
    assert.deepEqual(consumed, [7]);
    assert.equal(values.get(13), 1);
    assert.equal(values.get(11), 3);
}

{
    const values = new Map<number, number>([[180, 2]]);
    const consumed: number[] = [];
    const granted: number[] = [];
    const player = {
        id: 2,
        gamemode: { getQuestListGroups: () => [] },
        varps: {
            getVarpValue: (id: number) => values.get(id) ?? 0,
            setVarpValue: (id: number, value: number) => values.set(id, value),
        },
    } as unknown as PlayerState;
    const services = {
        inventory: {
            consumeItem: (_player: PlayerState, slot: number) => {
                consumed.push(slot);
                return true;
            },
            addItemToInventory: (_player: PlayerState, itemId: number) => {
                granted.push(itemId);
                return { slot: 0, added: 1 };
            },
            snapshotInventory: () => undefined,
        },
        variables: { sendVarp: () => undefined },
        messaging: { sendGameMessage: () => undefined },
        dialog: { queueWidgetEvent: () => undefined },
    } as unknown as ScriptServices;
    const capture: { itemOnNpc?: ItemOnNpcHandler } = {};
    gertrudesCatQuest.register(interactionRegistry(capture), services);
    capture.itemOnNpc?.({
        tick: 100,
        player,
        services,
        source: { slot: 4, itemId: 1927 },
        target: {},
    } as ItemOnNpcEvent);
    assert.deepEqual(consumed, [4]);
    assert.deepEqual(granted, [1925]);
    assert.equal(values.get(180), 3);
}

console.log("Fishing Contest and Gertrude's Cat tests passed.");
