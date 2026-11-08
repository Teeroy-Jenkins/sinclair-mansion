import type { QuestItemRequirement } from "../../types";

export const COOKS_ASSISTANT_QUEST_KEY = "cooks_assistant";

export const COOK_NPC_ID = 4626;
export const COOKING_RANGE_LOC_ID = 114;

export const VARP_COOKS_ASSISTANT = 29;
export const STAGE_STARTED = 1;
export const STAGE_COMPLETE = 2;

export const BUCKET_OF_MILK_ITEM_ID = 1927;
export const POT_OF_FLOUR_ITEM_ID = 1933;
export const EGG_ITEM_ID = 1944;
export const CAKE_ITEM_ID = 1891;

export const REQUIRED_ITEMS: QuestItemRequirement[] = [
    { itemId: BUCKET_OF_MILK_ITEM_ID, quantity: 1, journalLabel: "A bucket of milk" },
    { itemId: EGG_ITEM_ID, quantity: 1, journalLabel: "An egg" },
    { itemId: POT_OF_FLOUR_ITEM_ID, quantity: 1, journalLabel: "A pot of flour" },
];
