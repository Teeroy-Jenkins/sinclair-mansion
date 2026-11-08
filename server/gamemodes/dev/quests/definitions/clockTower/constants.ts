export const CLOCK_TOWER_QUEST_KEY = "clock_tower";

export const VARP_CLOCK_TOWER = 10;
export const VARP_CLOCK_TOWER_BITS = 35;

export const STAGE_NOT_STARTED = 0;
export const STAGE_PLACE_COGS = 1;
export const STAGE_ALL_COGS_PLACED = 5;
export const STAGE_COMPLETE = 8;

export const BROTHER_KOJO_NPC_ID = 3606;

export const ITEM = {
    whiteCog: 20,
    blackCog: 21,
    blueCog: 22,
    redCog: 23,
    ratPoison: 24,
    bucket: 1925,
    bucketOfWater: 1929,
    jug: 1935,
    jugOfWater: 1937,
    coins: 995,
} as const;

export const COG_ITEM_IDS = [ITEM.whiteCog, ITEM.blackCog, ITEM.blueCog, ITEM.redCog] as const;

export const LOC = {
    redSpindle: 29,
    blackSpindle: 30,
    whiteSpindle: 31,
    blueSpindle: 32,
    leverA: 33,
    leverB: 34,
    leverAUp: 35,
    leverBDown: 36,
    ratGateA: 37,
    ratGateB: 38,
    poisonedRatGate: 39,
    foodTrough: 40,
} as const;

export const COGS = [
    { name: "White", itemId: ITEM.whiteCog, spindleLocId: LOC.whiteSpindle, placedBit: 3 },
    { name: "Black", itemId: ITEM.blackCog, spindleLocId: LOC.blackSpindle, placedBit: 2 },
    { name: "Blue", itemId: ITEM.blueCog, spindleLocId: LOC.blueSpindle, placedBit: 1 },
    { name: "Red", itemId: ITEM.redCog, spindleLocId: LOC.redSpindle, placedBit: 4 },
] as const;

export const BIT_BLACK_COG_COOLED = 0;
export const BIT_RAT_GATE_OPEN = 4;
export const BIT_FIRST_RAT_GATE_OPEN = 5;

export const ICE_GLOVE_ITEM_IDS = [1580, 17586] as const;
export const IMBUED_SMITHS_GLOVE_ITEM_IDS = [27031, 27032] as const;
