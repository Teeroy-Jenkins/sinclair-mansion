import type { QuestItemRequirement } from "../../types";

export const WITCHS_POTION_KEY = "witchs_potion";

export const HETTY_NPC_ID = 4619;
export const HETTYS_CAULDRON_LOC_ID = 2024;

export const VARP_WITCHS_POTION = 67;
export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_INGREDIENTS_GIVEN = 2;
export const STAGE_COMPLETE = 3;

export const RATS_TAIL_ITEM_ID = 300;
export const BURNT_MEAT_ITEM_ID = 2146;
export const EYE_OF_NEWT_ITEM_ID = 221;
export const ONION_ITEM_ID = 1957;

export const RAT_NPC_IDS = [
    1020, 1021, 1022, 2492, 2513, 2854, 2855, 4610, 4611, 4612, 4613, 4614, 4615, 4616,
    4617, 4618, 6224, 6225, 6226, 6227, 6228, 6229,
] as const;

export const REQUIRED_ITEMS: QuestItemRequirement[] = [
    { itemId: EYE_OF_NEWT_ITEM_ID, quantity: 1, journalLabel: "An eye of newt" },
    { itemId: RATS_TAIL_ITEM_ID, quantity: 1, journalLabel: "A rat's tail" },
    { itemId: ONION_ITEM_ID, quantity: 1, journalLabel: "An onion" },
    { itemId: BURNT_MEAT_ITEM_ID, quantity: 1, journalLabel: "A piece of burnt meat" },
];

