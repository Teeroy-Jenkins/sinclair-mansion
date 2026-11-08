import type { QuestItemRequirement } from "../../types";

export const DORICS_QUEST_KEY = "dorics_quest";

export const DORIC_NPC_ID = 3893;

export const VARP_DORICS_QUEST = 31;
export const STAGE_STARTED = 10;
export const STAGE_COMPLETE = 100;

export const CLAY_ITEM_ID = 434;
export const COPPER_ORE_ITEM_ID = 436;
export const IRON_ORE_ITEM_ID = 440;
export const COINS_ITEM_ID = 995;
export const BRONZE_PICKAXE_ITEM_ID = 1265;
export const STEEL_PICKAXE_ITEM_ID = 1269;

export const REQUIRED_ITEMS: QuestItemRequirement[] = [
    { itemId: CLAY_ITEM_ID, quantity: 6, journalLabel: "6 Clay" },
    { itemId: COPPER_ORE_ITEM_ID, quantity: 4, journalLabel: "4 Copper ore" },
    { itemId: IRON_ORE_ITEM_ID, quantity: 2, journalLabel: "2 Iron ore" },
];

export const DORIC_ANVIL_LOC_ID = 2031;
export const DORIC_WHETSTONE_LOC_ID = 10641;
export const DORIC_ANVIL_AREA = { minX: 2949, maxX: 2952, minY: 3450, maxY: 3453, level: 0 };
