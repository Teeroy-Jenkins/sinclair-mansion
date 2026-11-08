export const DEMON_SLAYER_KEY = "demon_slayer";

export const VARP_DEMON_SLAYER = 222;
export const VARBIT_DEMON_DRAIN = 2568;
export const DEMON_SLAYER_STAGE_BITS = { start: 0, end: 4 } as const;

export const STAGE_NOT_STARTED = 0;
export const STAGE_SPOKEN_TO_ARIS = 1;
export const STAGE_KEY_HUNT = 2;
export const STAGE_COLLECTING_BONES = 3;
export const STAGE_TRAIBORN_KEY = 28;
export const STAGE_SILVERLIGHT = 29;
export const STAGE_COMPLETE = 30;
export const BONES_REQUIRED = 25;

export const ARIS_NPC_IDS = [5082, 11868] as const;
export const ARIS_VISIBLE_NPC_ID = 11868;
export const TRAIBORN_NPC_ID = 5081;
export const SIR_PRYSIN_NPC_IDS = [5083, 5084, 12622] as const;
export const CAPTAIN_ROVIN_NPC_IDS = [5085, 12627] as const;
export const DELRITH_NPC_ID = 5079;
export const WEAKENED_DELRITH_NPC_ID = 5080;

export const TRAIBORN_KEY_ITEM_ID = 2399;
export const ROVIN_KEY_ITEM_ID = 2400;
export const PRYSIN_KEY_ITEM_ID = 2401;
export const SILVERLIGHT_ITEM_ID = 2402;
export const BONES_ITEM_ID = 526;
export const COINS_ITEM_ID = 995;
export const BUCKET_OF_WATER_ITEM_ID = 1929;
export const EMPTY_BUCKET_ITEM_ID = 1925;
export const SPINACH_ROLL_ITEM_ID = 1969;

export const DEMON_DRAIN_LOC_IDS = [2843, 17423, 17424] as const;
export const DEMON_DRAIN_TILE = { x: 3225, y: 3496, level: 0 } as const;
export const SEWER_KEY_TILE = { x: 3227, y: 9898, level: 0 } as const;

export const ARIS_ZONE = {
    id: "demon_slayer_aris_tent",
    minX: 3197,
    maxX: 3209,
    minY: 3417,
    maxY: 3431,
    levels: [0],
} as const;
export const ARIS_TILE = { x: 3203, y: 3424, level: 0 } as const;

export const DELRITH_ZONE = {
    id: "demon_slayer_stone_circle",
    minX: 3220,
    maxX: 3235,
    minY: 3362,
    maxY: 3377,
    levels: [0],
} as const;
export const DELRITH_TILE = { x: 3228, y: 3369, level: 0 } as const;

export const CORRECT_INCANTATION = "Carlem Aber Camerinthum Purchai Gabindo";
export const INCANTATION_OPTIONS = [
    "Carlem Gabindo Purchai Zaree Camerinthum",
    "Purchai Zaree Gabindo Carlem Camerinthum",
    "Purchai Camerinthum Aber Gabindo Carlem",
    CORRECT_INCANTATION,
] as const;
