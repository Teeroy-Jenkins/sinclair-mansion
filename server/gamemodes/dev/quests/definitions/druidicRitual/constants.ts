import type { QuestItemRequirement } from "../../types";

export const DRUIDIC_RITUAL_QUEST_KEY = "druidic_ritual";

export const KAQEMEEX_NPC_ID = 5045;
export const SANFEW_NPC_ID = 5044;
export const CAULDRON_OF_THUNDER_LOC_ID = 2142;

export const VARP_DRUIDIC_RITUAL = 80;
export const STAGE_STARTED = 1;
export const STAGE_GATHERING_MEATS = 2;
export const STAGE_RETURN_TO_KAQEMEEX = 3;
export const STAGE_COMPLETE = 4;

export const RAW_BEEF_ITEM_ID = 2132;
export const RAW_RAT_MEAT_ITEM_ID = 2134;
export const RAW_BEAR_MEAT_ITEM_ID = 2136;
export const RAW_CHICKEN_ITEM_ID = 2138;

export const ENCHANTED_BEEF_ITEM_ID = 522;
export const ENCHANTED_RAT_MEAT_ITEM_ID = 523;
export const ENCHANTED_BEAR_MEAT_ITEM_ID = 524;
export const ENCHANTED_CHICKEN_ITEM_ID = 525;

export const MEAT_TRANSFORMATIONS: ReadonlyArray<readonly [number, number]> = [
    [RAW_BEEF_ITEM_ID, ENCHANTED_BEEF_ITEM_ID],
    [RAW_RAT_MEAT_ITEM_ID, ENCHANTED_RAT_MEAT_ITEM_ID],
    [RAW_BEAR_MEAT_ITEM_ID, ENCHANTED_BEAR_MEAT_ITEM_ID],
    [RAW_CHICKEN_ITEM_ID, ENCHANTED_CHICKEN_ITEM_ID],
];

export const ENCHANTED_MEATS: QuestItemRequirement[] = [
    { itemId: ENCHANTED_BEEF_ITEM_ID, quantity: 1, journalLabel: "Enchanted beef" },
    { itemId: ENCHANTED_RAT_MEAT_ITEM_ID, quantity: 1, journalLabel: "Enchanted rat meat" },
    { itemId: ENCHANTED_BEAR_MEAT_ITEM_ID, quantity: 1, journalLabel: "Enchanted bear meat" },
    { itemId: ENCHANTED_CHICKEN_ITEM_ID, quantity: 1, journalLabel: "Enchanted chicken" },
];
