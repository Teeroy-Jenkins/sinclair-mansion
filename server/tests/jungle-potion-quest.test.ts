import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import type { ScriptServices } from "../src/game/scripts/types";
import { junglePotionQuest } from "../gamemodes/dev/quests/definitions/junglePotion";
import {
    ARDRIGAL_PALM_LOC_ID,
    DRUIDIC_RITUAL_COMPLETE,
    GRIMY_SNAKE_WEED_ITEM_ID,
    JUNGLE_POTION_HERBS,
    POTHOLE_EXIT_LOC_ID,
    POTHOLE_EXTERIOR_X,
    POTHOLE_EXTERIOR_Y,
    SNAKE_VINE_LOC_ID,
    SNAKE_WEED_ITEM_ID,
    STAGE_FOUND_SNAKE_WEED,
    STAGE_GET_ARDRIGAL,
    STAGE_GET_SNAKE_WEED,
    TRUFITUS_NPC_ID,
    VARP_DRUIDIC_RITUAL,
    VARP_JUNGLE_POTION,
} from "../gamemodes/dev/quests/definitions/junglePotion/constants";

assert.equal(junglePotionQuest.name, "Jungle Potion");
assert.equal(junglePotionQuest.varpId, VARP_JUNGLE_POTION);
assert.equal(junglePotionQuest.rewards.questPoints, 1);
assert.equal(junglePotionQuest.rewards.xp?.[0].amount, 775);
assert.equal(junglePotionQuest.requirements?.quests?.[0].varpId, VARP_DRUIDIC_RITUAL);
assert.equal(junglePotionQuest.requirements?.quests?.[0].minValue, DRUIDIC_RITUAL_COMPLETE);

const registry = new ScriptRegistry();
const varps = new Map<number, number>([
    [VARP_JUNGLE_POTION, STAGE_GET_SNAKE_WEED],
    [VARP_DRUIDIC_RITUAL, DRUIDIC_RITUAL_COMPLETE],
]);
const slots = Array.from({ length: 28 }, (_, slot) => ({ slot, itemId: -1, quantity: 0 }));
let herbloreXp = 0;
let teleported: { x: number; y: number; level: number } | undefined;

const player = {
    id: 44,
    name: "Jungle tester",
    varps: {
        getVarpValue: (id: number) => varps.get(id) ?? 0,
        setVarpValue: (id: number, value: number) => varps.set(id, value),
    },
    gamemode: { getQuestListGroups: () => [] },
} as never;

const services = {
    variables: { sendVarp: (_player: unknown, id: number, value: number) => varps.set(id, value) },
    messaging: { sendGameMessage: () => undefined },
    skills: {
        getSkill: (_player: unknown, skillId: number) => ({
            baseLevel: skillId === SkillId.Herblore ? 3 : 1,
        }),
        addSkillXp: (_player: unknown, skillId: number, amount: number) => {
            if (skillId === SkillId.Herblore) herbloreXp += amount;
        },
    },
    inventory: {
        getInventoryItems: () => slots,
        addItemToInventory: (_player: unknown, itemId: number, quantity: number) => {
            const slot = slots.find((entry) => entry.itemId <= 0 || entry.quantity <= 0);
            if (!slot) return { added: 0, remaining: quantity };
            slot.itemId = itemId;
            slot.quantity = quantity;
            return { added: quantity, remaining: 0 };
        },
        setInventorySlot: (_player: unknown, slot: number, itemId: number, quantity: number) => {
            slots[slot] = { slot, itemId, quantity };
        },
        snapshotInventory: () => undefined,
        snapshotInventoryImmediate: () => undefined,
    },
    dialog: {
        getInterfaceService: () => ({ getCurrentChatboxModal: () => undefined }),
        openDialog: (_player: unknown, spec: { onContinue?: () => void }) => spec.onContinue?.(),
        openDialogOptions: (_player: unknown, spec: { onSelect?: (choice: number) => void }) =>
            spec.onSelect?.(0),
        closeDialog: () => undefined,
        queueWidgetEvent: () => undefined,
    },
    movement: {
        teleportPlayer: (_player: unknown, x: number, y: number, level: number) => {
            teleported = { x, y, level };
        },
    },
} as unknown as ScriptServices;

junglePotionQuest.register(registry, services);
assert.ok(registry.findNpcInteractionDirect(TRUFITUS_NPC_ID, "talk-to"));
assert.ok(registry.findLocInteraction(SNAKE_VINE_LOC_ID, "search"));
assert.ok(registry.findLocInteraction(ARDRIGAL_PALM_LOC_ID, "search"));
assert.ok(registry.findLocInteraction(POTHOLE_EXIT_LOC_ID, "climb"));
for (const herb of JUNGLE_POTION_HERBS) {
    assert.ok(registry.findItemAction(herb.grimyItemId, "clean"));
    assert.ok(registry.findItemOnNpc(herb.cleanItemId, TRUFITUS_NPC_ID));
}

registry.findLocInteraction(SNAKE_VINE_LOC_ID, "search")!({
    player,
    services,
    target: { locId: SNAKE_VINE_LOC_ID, tile: { x: 2760, y: 3019 }, level: 0 },
} as never);
assert.equal(varps.get(VARP_JUNGLE_POTION), STAGE_FOUND_SNAKE_WEED);
assert.equal(slots[0].itemId, GRIMY_SNAKE_WEED_ITEM_ID);

registry.findItemAction(GRIMY_SNAKE_WEED_ITEM_ID, "clean")!({
    player,
    services,
    source: { slot: 0, itemId: GRIMY_SNAKE_WEED_ITEM_ID, quantity: 1 },
} as never);
assert.equal(slots[0].itemId, SNAKE_WEED_ITEM_ID);
assert.equal(herbloreXp, 2.5);

registry.findItemOnNpc(SNAKE_WEED_ITEM_ID, TRUFITUS_NPC_ID)!({
    player,
    services,
    source: { slot: 0, itemId: SNAKE_WEED_ITEM_ID, quantity: 1 },
    target: { npcId: 1, npcTypeId: TRUFITUS_NPC_ID },
} as never);
assert.equal(varps.get(VARP_JUNGLE_POTION), STAGE_GET_ARDRIGAL);
assert.equal(slots[0].itemId, -1);

registry.findLocInteraction(POTHOLE_EXIT_LOC_ID, "climb")!({ player, services } as never);
assert.deepEqual(teleported, { x: POTHOLE_EXTERIOR_X, y: POTHOLE_EXTERIOR_Y, level: 0 });

console.log("jungle-potion-quest.test.ts: all assertions passed");
