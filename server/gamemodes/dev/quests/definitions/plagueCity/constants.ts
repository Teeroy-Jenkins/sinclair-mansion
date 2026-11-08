export const PLAGUE_CITY_QUEST_KEY = "plague_city";

export const VARP_PLAGUE_CITY = 165;

export const STAGE_NOT_STARTED = 0;
export const STAGE_FIND_DWELLBERRIES = 1;
export const STAGE_GAS_MASK = 2;
export const STAGE_SOFTEN_MUD = 3;
export const STAGE_WATER_1 = 4;
export const STAGE_WATER_2 = 5;
export const STAGE_WATER_3 = 6;
export const STAGE_WATER_4 = 7;
export const STAGE_TUNNEL_OPEN = 8;
export const STAGE_ROPE_TIED = 9;
export const STAGE_PIPE_OPEN = 10;
export const STAGE_SHOWN_PICTURE = 20;
export const STAGE_RETURNED_BOOK = 21;
export const STAGE_SPOKE_TO_REHNISONS = 22;
export const STAGE_SPOKE_TO_MILLI = 23;
export const STAGE_NEED_CLEARANCE = 24;
export const STAGE_CLERK_PERMISSION = 25;
export const STAGE_NEED_HANGOVER_CURE = 26;
export const STAGE_HAVE_WARRANT = 27;
export const STAGE_FREED_ELENA = 28;
export const STAGE_COMPLETE = 29;
export const STAGE_READ_SCROLL = 30;

export const NPC = {
    alrena: 4249,
    bravek: 4252,
    clerk: 4255,
    edmond: 4256,
    elena: 4257,
    tedRehnison: 4263,
    marthaRehnison: 4264,
    billyRehnison: 4265,
    milliRehnison: 4266,
    jethick: [8806, 8974],
} as const;

export const ITEM = {
    warrant: 1503,
    hangoverCure: 1504,
    ardougneTeleportScroll: 1505,
    gasMask: 1506,
    smallKey: 1507,
    scruffyNote: 1508,
    book: 1509,
    picture: 1510,
    bucketOfMilk: 1927,
    bucketOfWater: 1929,
    chocolateDust: 1975,
    chocolateyMilk: 1977,
    dwellberries: 2126,
    snapeGrass: 231,
    spade: 952,
    rope: 954,
    emptyBucket: 1925,
} as const;

export const LOC = {
    plagueHouseStairsDown: 2522,
    plagueHouseStairsUp: 2523,
    alrenaCupboardClosed: 2524,
    alrenaCupboardOpen: 2525,
    elenaCellDoor: 2526,
    bravekDoor: 2528,
    keyBarrel: 2530,
    mudPatch: 2531,
    mudPile: 2533,
    plagueHouseDoorClosed: 2535,
    plagueHouseDoorOpen: 2536,
    rehnisonDoor: 2537,
    rehnisonStairsUp: 2539,
    rehnisonStairsDown: 2540,
    sewerPipe: 2541,
    westArdougneManholeClosed: 2543,
    westArdougneManholeOpen: 2544,
} as const;

export const TILE = {
    garden: { x: 2562, y: 3337, level: 0 },
    sewerMudPile: { x: 2562, y: 9737, level: 0 },
    sewerPipe: { x: 2530, y: 9703, level: 0 },
    westArdougneManhole: { x: 2529, y: 3304, level: 0 },
    rehnisonGround: { x: 2527, y: 3332, level: 0 },
    rehnisonFirst: { x: 2527, y: 3332, level: 1 },
    plagueHouseGround: { x: 2536, y: 3268, level: 0 },
    plagueHouseBasement: { x: 2536, y: 9671, level: 0 },
    elenaCell: { x: 2538, y: 9672, level: 0 },
} as const;

