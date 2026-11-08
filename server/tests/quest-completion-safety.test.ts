import assert from "node:assert/strict";

import type { PlayerState } from "../src/game/player";
import type { ScriptServices } from "../src/game/scripts/types";
import { completeQuest } from "../gamemodes/dev/quests/QuestService";
import type { QuestDefinition } from "../gamemodes/dev/quests/types";

function createHarness(full = false) {
    const varps = new Map<number, number>();
    const inventory = Array.from({ length: 28 }, (_, slot) => ({
        slot,
        itemId: full ? 1000 + slot : -1,
        quantity: full ? 1 : 0,
    }));
    let xpGranted = 0;
    const player = {
        id: full ? 2 : 1,
        name: "Quest Tester",
        displayMode: 1,
        gamemode: { getQuestListGroups: () => [] },
        varps: {
            getVarpValue: (id: number) => varps.get(id) ?? 0,
            setVarpValue: (id: number, value: number) => varps.set(id, value),
        },
    } as unknown as PlayerState;
    const services = {
        data: { getObjType: () => ({ stackable: 0 }) },
        inventory: {
            getInventoryItems: () => inventory,
            addItemToInventory: (_player: PlayerState, itemId: number, quantity: number) => {
                const empty = inventory.find((entry) => entry.itemId <= 0);
                if (!empty) return { slot: -1, added: 0 };
                empty.itemId = itemId;
                empty.quantity = quantity;
                return { slot: empty.slot, added: quantity };
            },
            snapshotInventory: () => undefined,
        },
        skills: {
            addSkillXp: (_player: PlayerState, _skillId: number, amount: number) => {
                xpGranted += amount;
            },
        },
        variables: { sendVarp: () => undefined },
        sound: { sendJingle: () => undefined },
        messaging: { sendGameMessage: () => undefined },
        viewport: { getMainmodalUid: () => 0 },
        dialog: {
            closeDialog: () => undefined,
            openSubInterface: () => undefined,
            queueWidgetEvent: () => undefined,
        },
        system: { logger: { info: () => undefined, error: () => undefined } },
    } as unknown as ScriptServices;
    return { player, services, varps, inventory, getXpGranted: () => xpGranted };
}

const quest: QuestDefinition = {
    key: "completion_safety_test",
    name: "Completion Safety Test",
    varpId: 9000,
    startedValue: 1,
    completionValue: 2,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: 0, amount: 100, label: "Attack" }],
        items: [{ itemId: 2000, quantity: 1, label: "A reward" }],
    },
    buildJournal: () => [],
    register: () => undefined,
};

const success = createHarness();
assert.equal(completeQuest(success.player, success.services, quest), true);
assert.equal(completeQuest(success.player, success.services, quest), false);
assert.equal(success.varps.get(quest.varpId), quest.completionValue);
assert.equal(success.varps.get(101), 1, "quest points must not duplicate");
assert.equal(success.getXpGranted(), 100, "XP must not duplicate");
assert.equal(success.inventory.filter((entry) => entry.itemId === 2000).length, 1);

const blocked = createHarness(true);
assert.equal(completeQuest(blocked.player, blocked.services, quest), false);
assert.equal(blocked.varps.get(quest.varpId) ?? 0, 0);
assert.equal(blocked.varps.get(101) ?? 0, 0);
assert.equal(blocked.getXpGranted(), 0);

console.log("quest-completion-safety.test.ts: all assertions passed");
