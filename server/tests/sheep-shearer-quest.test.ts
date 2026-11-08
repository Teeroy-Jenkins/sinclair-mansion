import assert from "node:assert/strict";

import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { sheepShearerQuest } from "../gamemodes/dev/quests/definitions/sheepShearer";
import {
    BALL_OF_WOOL_ITEM_ID,
    COINS_ITEM_ID,
    FRED_THE_FARMER_NPC_ID,
    STAGE_COMPLETE,
    VARP_SHEEP_SHEARER,
} from "../gamemodes/dev/quests/definitions/sheepShearer/constants";
import { VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";

function createHarness(stackability: number) {
    const registry = new ScriptRegistry();
    const varps = new Map<number, number>([[VARP_SHEEP_SHEARER, 16]]);
    const inventory = Array.from({ length: 28 }, (_, slot) => ({
        slot,
        itemId: slot === 0 ? COINS_ITEM_ID : slot <= 5 ? BALL_OF_WOOL_ITEM_ID : 10_000 + slot,
        quantity: slot === 0 ? 55 : 1,
    }));
    let craftingXp = 0;
    let completionScrolls = 0;
    let dialogCloses = 0;
    const player = {
        id: 179,
        name: "Sheep tester",
        displayMode: 1,
        gamemode: { getQuestListGroups: () => [] },
        varps: {
            getVarpValue: (id: number) => varps.get(id) ?? 0,
            setVarpValue: (id: number, value: number) => varps.set(id, value),
        },
    } as never;
    const services = {
        data: { getObjType: () => ({ stackability }) },
        variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
        messaging: { sendGameMessage: () => undefined },
        inventory: {
            getInventoryItems: () => inventory,
            playerHasItem: (_player: unknown, itemId: number) =>
                inventory.some((entry) => entry.itemId === itemId && entry.quantity > 0),
            setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => {
                inventory[slot] = { slot, itemId, quantity };
            },
            addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
                if (itemId === COINS_ITEM_ID && stackability === 1) {
                    const coins = inventory.find((entry) => entry.itemId === COINS_ITEM_ID);
                    if (coins) {
                        coins.quantity += quantity;
                        return { slot: coins.slot, added: quantity };
                    }
                }
                const empty = inventory.filter((entry) => entry.itemId <= 0 || entry.quantity <= 0);
                if (empty.length < quantity) return { slot: -1, added: 0 };
                for (let i = 0; i < quantity; i++) {
                    empty[i].itemId = itemId;
                    empty[i].quantity = 1;
                }
                return { slot: empty[0]?.slot ?? -1, added: quantity };
            },
            snapshotInventory: () => undefined,
        },
        skills: {
            addSkillXp: (_player: unknown, _skillId: number, amount: number) => {
                craftingXp += amount;
            },
        },
        sound: { sendJingle: () => undefined },
        viewport: { getMainmodalUid: () => 0 },
        dialog: {
            getInterfaceService: () => ({ getCurrentChatboxModal: () => undefined }),
            openDialog: (_player: unknown, request: { onContinue?: () => void }) => request.onContinue?.(),
            openDialogOptions: () => undefined,
            closeDialog: () => {
                dialogCloses++;
            },
            openSubInterface: () => {
                completionScrolls++;
            },
            queueWidgetEvent: () => undefined,
        },
        system: { logger: { info: () => undefined, error: () => undefined } },
    } as unknown as ScriptServices;

    sheepShearerQuest.register(registry, services);
    const talk = registry.findNpcInteractionDirect(FRED_THE_FARMER_NPC_ID, "talk-to");
    assert.ok(talk);
    talk({ player, services, npc: { typeId: FRED_THE_FARMER_NPC_ID } } as never);

    return {
        varps,
        inventory,
        getCraftingXp: () => craftingXp,
        getCompletionScrolls: () => completionScrolls,
        getDialogCloses: () => dialogCloses,
    };
}

const success = createHarness(1);
assert.equal(success.varps.get(VARP_SHEEP_SHEARER), STAGE_COMPLETE);
assert.equal(success.varps.get(VARP_QUEST_POINTS), 1);
assert.equal(success.getCraftingXp(), 150);
assert.equal(success.getCompletionScrolls(), 1);
assert.equal(
    success.inventory.find((entry) => entry.itemId === COINS_ITEM_ID)?.quantity,
    115,
);
assert.equal(
    success.inventory.reduce(
        (total, entry) => total + (entry.itemId === BALL_OF_WOOL_ITEM_ID ? entry.quantity : 0),
        0,
    ),
    0,
);

const rejected = createHarness(0);
assert.equal(rejected.varps.get(VARP_SHEEP_SHEARER), 16);
assert.equal(rejected.varps.get(VARP_QUEST_POINTS) ?? 0, 0);
assert.equal(rejected.getCraftingXp(), 0);
assert.equal(rejected.getCompletionScrolls(), 0);
assert.ok(rejected.getDialogCloses() > 0);
assert.equal(
    rejected.inventory.reduce(
        (total, entry) => total + (entry.itemId === BALL_OF_WOOL_ITEM_ID ? entry.quantity : 0),
        0,
    ),
    5,
    "a rejected completion must return all five balls of wool",
);

console.log("sheep-shearer-quest.test.ts: all assertions passed");
