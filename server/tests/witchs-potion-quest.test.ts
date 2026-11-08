import assert from "node:assert/strict";

import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { witchsPotionQuest } from "../gamemodes/dev/quests/definitions/witchsPotion";
import {
    HETTYS_CAULDRON_LOC_ID,
    HETTY_NPC_ID,
    REQUIRED_ITEMS,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_WITCHS_POTION,
} from "../gamemodes/dev/quests/definitions/witchsPotion/constants";

assert.equal(witchsPotionQuest.name, "Witch's Potion");
assert.equal(witchsPotionQuest.varpId, VARP_WITCHS_POTION);
assert.equal(witchsPotionQuest.completionValue, STAGE_COMPLETE);
assert.equal(witchsPotionQuest.rewards.questPoints, 1);
assert.deepEqual(witchsPotionQuest.rewards.xp, [
    { skillId: 6, amount: 325, label: "Magic" },
]);
assert.deepEqual(
    REQUIRED_ITEMS.map(({ itemId }) => itemId),
    [221, 300, 1957, 2146],
);

const registry = new ScriptRegistry();
const services = { system: {} } as ScriptServices;
witchsPotionQuest.register(registry, services);
assert.ok(registry.findNpcInteractionDirect(HETTY_NPC_ID, "talk-to"));
assert.ok(registry.findLocInteraction(HETTYS_CAULDRON_LOC_ID, "drink-from"));

const journalPlayer = {
    varps: { getVarpValue: () => STAGE_STARTED },
} as never;
const journalServices = {
    inventory: {
        getInventoryItems: () => [{ slot: 0, itemId: 221, quantity: 1 }],
    },
} as unknown as ScriptServices;
const journal = witchsPotionQuest.buildJournal(journalPlayer, journalServices);
assert.ok(journal.includes("<str>An eye of newt</str>"));
assert.ok(journal.includes("A rat's tail"));

const eventHandlers = new Map<string, Array<(payload: unknown) => void>>();
const eventBus = {
    on: (eventName: string, handler: (payload: unknown) => void) => {
        const handlers = eventHandlers.get(eventName) ?? [];
        handlers.push(handler);
        eventHandlers.set(eventName, handlers);
    },
};
let spawnedDrop:
    | {
          itemId: number;
          quantity: number;
          tile: { x: number; z: number; level: number };
          options: { ownerId?: number; isMonsterDrop?: boolean };
      }
    | undefined;
const dropServices = {
    system: { eventBus },
    inventory: { findOwnedItemLocation: () => undefined },
    groundItems: {
        spawn: (
            itemId: number,
            quantity: number,
            tile: { x: number; z: number; level: number },
            options: { ownerId?: number; isMonsterDrop?: boolean },
        ) => {
            spawnedDrop = { itemId, quantity, tile, options };
        },
    },
} as unknown as ScriptServices;
witchsPotionQuest.register(new ScriptRegistry(), dropServices);
const dropPlayer = {
    id: 42,
    varps: { getVarpValue: () => STAGE_STARTED },
} as never;
eventHandlers.get("player:login")?.[0]?.({ player: dropPlayer });
eventHandlers.get("npc:death")?.[0]?.({
    npcTypeId: 2854,
    killerPlayerId: 42,
    tile: { x: 3200, z: 3200, level: 0 },
});
assert.deepEqual(spawnedDrop, {
    itemId: 300,
    quantity: 1,
    tile: { x: 3200, z: 3200, level: 0 },
    options: {
        ownerId: 42,
        privateTicks: 100,
        durationTicks: 200,
        isMonsterDrop: true,
    },
});

console.log("witchs-potion-quest.test.ts: all assertions passed");
