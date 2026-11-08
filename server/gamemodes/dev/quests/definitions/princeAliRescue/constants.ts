export const PRINCE_ALI_RESCUE_KEY = "prince_ali_rescue";

export const VARP_PRINCE_ALI_RESCUE = 273;
export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 10;
export const STAGE_SPOKEN_TO_OSMAN = 20;
export const STAGE_KEY_MADE = 21;
export const STAGE_KEY_CLAIMED = 22;
export const STAGE_PREPARATION_COMPLETE = 30;
export const STAGE_GUARD_DRUNK = 40;
export const STAGE_KELI_TIED = 50;
export const STAGE_PRINCE_SAVED = 100;
export const STAGE_COMPLETE = 110;

export const HASSAN_NPC_ID = 4285;
export const OSMAN_NPC_IDS = [6165, 4286] as const;
export const LEELA_NPC_ID = 4274;
export const NED_NPC_ID = 4280;
export const AGGIE_NPC_IDS = [4284, 120, 121] as const;
export const JOE_NPC_IDS = [4275, 11577] as const;
export const JOE_VISIBLE_NPC_ID = 11577;
export const LADY_KELI_NPC_IDS = [4281, 11578] as const;
export const LADY_KELI_VISIBLE_NPC_ID = 11578;
export const PRINCE_ALI_NPC_IDS = [4282, 11579, 11580] as const;
export const PRINCE_ALI_VISIBLE_NPC_ID = 11579;

export const COINS_ITEM_ID = 995;
export const JUG_OF_WATER_ITEM_ID = 1937;
export const BUCKET_OF_WATER_ITEM_ID = 1929;
export const POT_OF_FLOUR_ITEM_ID = 1933;
export const ASHES_ITEM_ID = 592;
export const REDBERRIES_ITEM_ID = 1951;
export const ONION_ITEM_ID = 1957;
export const WOAD_LEAF_ITEM_ID = 1793;
export const RED_DYE_ITEM_ID = 1763;
export const YELLOW_DYE_ITEM_ID = 1765;
export const BLUE_DYE_ITEM_ID = 1767;
export const BALL_OF_WOOL_ITEM_ID = 1759;
export const SOFT_CLAY_ITEM_ID = 1761;
export const BRONZE_BAR_ITEM_ID = 2349;
export const BEER_ITEM_ID = 1917;
export const ROPE_ITEM_ID = 954;
export const PINK_SKIRT_ITEM_ID = 1013;

export const BRONZE_KEY_ITEM_ID = 2418;
export const BLONDE_WIG_ITEM_ID = 2419;
export const GREY_WIG_ITEM_ID = 2421;
export const KEY_PRINT_ITEM_ID = 2423;
export const SKIN_PASTE_ITEM_ID = 2424;

export const PRISON_GATE_LOC_ID = 2881;
export const PRISON_GATE_TILE = { x: 3123, y: 3243, level: 0 } as const;

export const JAIL_ZONE = {
    id: "prince_ali_rescue_jail",
    minX: 3111,
    maxX: 3138,
    minY: 3231,
    maxY: 3261,
    levels: [0],
} as const;
export const JOE_TILE = { x: 3123, y: 3245, level: 0 } as const;
export const LADY_KELI_TILE = { x: 3128, y: 3244, level: 0 } as const;
export const PRINCE_ALI_TILE = { x: 3123, y: 3242, level: 0 } as const;

export const KEY_REPLACEMENT_COST = 15;
export const ROPE_COST = 15;
export const QUEST_REWARD_COINS = 700;
