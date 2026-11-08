import assert from "node:assert/strict";

import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { blackKnightsFortressQuest } from "../gamemodes/dev/quests/definitions/blackKnightsFortress";
import {
    CABBAGE_HOLE_LOC_ID,
    CABBAGE_ITEM_ID,
    DOSSIER_ITEM_ID,
    FORTRESS_ENTRANCE_DOOR_LOC_ID,
    LISTENING_GRILL_LOC_ID,
    REQUIRED_QUEST_POINTS,
    SIR_AMIK_VARZE_NPC_ID,
    STAGE_INVESTIGATE,
    STAGE_RETURN_TO_AMIK,
    STAGE_SABOTAGE,
    VARP_BLACK_KNIGHTS_FORTRESS,
} from "../gamemodes/dev/quests/definitions/blackKnightsFortress/constants";
import { VARP_QUEST_POINTS } from "../gamemodes/dev/quests/QuestService";

assert.equal(blackKnightsFortressQuest.name, "Black Knights' Fortress");
assert.equal(blackKnightsFortressQuest.varpId, 130);
assert.equal(blackKnightsFortressQuest.completionValue, 4);
assert.equal(blackKnightsFortressQuest.requirements?.questPoints, REQUIRED_QUEST_POINTS);
assert.deepEqual(
    blackKnightsFortressQuest.rewards.items?.map((reward) => [reward.itemId, reward.quantity]),
    [[995, 2500]],
);

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_QUEST_POINTS, REQUIRED_QUEST_POINTS],
    [VARP_BLACK_KNIGHTS_FORTRESS, 0],
]);
const slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
const player = {
    id: 51,
    name: "Fortress tester",
    tileX: 3026,
    tileY: 3508,
    level: 0,
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;
const services = {
    variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
    messaging: { sendGameMessage: () => undefined },
    inventory: {
        getInventoryItems: () => slots,
        playerHasItem: (_player: unknown, itemId: number) =>
            slots.some((entry) => entry.itemId === itemId && entry.quantity > 0),
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const slot = slots.find((entry) => entry.itemId <= 0 || entry.quantity <= 0);
            if (!slot) return { added: 0, remaining: quantity };
            slot.itemId = itemId;
            slot.quantity = quantity;
            return { added: quantity, remaining: 0 };
        },
        consumeItem: (_player: unknown, slot: number) => {
            if (slots[slot].quantity <= 0) return false;
            slots[slot] = { slot, itemId: -1, quantity: 0 };
            return true;
        },
        snapshotInventory: () => undefined,
    },
    equipment: { getEquippedItem: () => -1 },
    dialog: {
        getInterfaceService: () => ({ getCurrentChatboxModal: () => undefined }),
        openDialog: (_player: unknown, spec: { onContinue?: () => void }) => spec.onContinue?.(),
        openDialogOptions: (_player: unknown, spec: { onSelect?: (choice: number) => void }) =>
            spec.onSelect?.(0),
        closeDialog: () => undefined,
        queueWidgetEvent: () => undefined,
    },
    movement: { teleportPlayer: () => undefined },
} as unknown as ScriptServices;

blackKnightsFortressQuest.register(registry, services);
assert.ok(registry.findNpcInteractionDirect(SIR_AMIK_VARZE_NPC_ID, "talk-to"));
assert.ok(registry.findLocInteraction(FORTRESS_ENTRANCE_DOOR_LOC_ID, "open"));
assert.ok(registry.findLocInteraction(LISTENING_GRILL_LOC_ID, "listen-at"));
assert.ok(registry.findItemOnLoc(CABBAGE_ITEM_ID, CABBAGE_HOLE_LOC_ID));

registry.findNpcInteractionDirect(SIR_AMIK_VARZE_NPC_ID, "talk-to")!({
    player,
    services,
    npc: { typeId: SIR_AMIK_VARZE_NPC_ID },
} as never);
assert.equal(slots[0].itemId, DOSSIER_ITEM_ID);
assert.equal(varps.get(VARP_BLACK_KNIGHTS_FORTRESS), 0);

registry.findItemAction(DOSSIER_ITEM_ID, "read")!({
    player,
    services,
    source: { slot: 0, itemId: DOSSIER_ITEM_ID, quantity: 1 },
} as never);
assert.equal(varps.get(VARP_BLACK_KNIGHTS_FORTRESS), STAGE_INVESTIGATE);
assert.equal(slots[0].itemId, -1);

registry.findLocInteraction(LISTENING_GRILL_LOC_ID, "listen-at")!({
    player,
    services,
    locId: LISTENING_GRILL_LOC_ID,
    tile: { x: 3026, y: 3507 },
    level: 0,
} as never);
assert.equal(varps.get(VARP_BLACK_KNIGHTS_FORTRESS), STAGE_SABOTAGE);

slots[0] = { slot: 0, itemId: CABBAGE_ITEM_ID, quantity: 1 };
registry.findItemOnLoc(CABBAGE_ITEM_ID, CABBAGE_HOLE_LOC_ID)!({
    player,
    services,
    source: { slot: 0, itemId: CABBAGE_ITEM_ID },
    target: { locId: CABBAGE_HOLE_LOC_ID, tile: { x: 3031, y: 3507 }, level: 1 },
} as never);
assert.equal(varps.get(VARP_BLACK_KNIGHTS_FORTRESS), STAGE_RETURN_TO_AMIK);
assert.equal(slots[0].itemId, -1);

console.log("black-knights-fortress-quest.test.ts: all assertions passed");
