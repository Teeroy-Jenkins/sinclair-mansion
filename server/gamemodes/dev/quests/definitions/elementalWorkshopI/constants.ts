export const ELEMENTAL_WORKSHOP_I_QUEST_KEY = "elemental_workshop_i";
export const VARP_ELEMENTAL_WORKSHOP = 244;

export const BIT = {
    readBook: 1 << 1,
    slashedBook: 1 << 2,
    waterLeft: 1 << 3,
    waterRight: 1 << 4,
    waterFlowing: 1 << 5,
    bellowsRepaired: 1 << 6,
    furnaceLit: 1 << 7,
    airBlowing: 1 << 9,
    enteredWorkshop: 1 << 13,
    leatherFound: 1 << 14,
    needleFound: 1 << 15,
    complete: 1 << 20,
} as const;

export const ITEM = {
    batteredBook: 2886,
    batteredKey: 2887,
    emptyBowl: 2888,
    lavaBowl: 2889,
    elementalShield: 2890,
    elementalOre: 2892,
    elementalMetal: 2893,
    coal: 453,
    knife: 946,
    needle: 1733,
    thread: 1734,
    leather: 1741,
    hammer: 2347,
} as const;

export const NPC = {
    earthElemental: 1366,
    elementalRock: 1368,
} as const;

export const LOC = {
    bookcase: 26113,
    oddWalls: [26114, 26115] as const,
    openOddWall: 18505,
    bowlCrate: 3394,
    needleCrate: 3395,
    leatherCrate: 3397,
    workbench: 3402,
    waterValveBases: [3403, 3404] as const,
    waterValves: [18509, 18510] as const,
    waterLever: 3406,
    bellowsBase: 3407,
    bellows: [18515, 18516] as const,
    airLever: 3409,
    furnaceBase: 3410,
    furnaces: [18525, 18526] as const,
    surfaceStairs: 3415,
    workshopStairs: 3416,
    lavaTroughs: [18519, 18520, 18521, 18522, 18523] as const,
} as const;

export const TILE = {
    workshopEntry: { x: 2716, y: 9888, level: 0 },
    surfaceEntry: { x: 2709, y: 3497, level: 0 },
} as const;

export const PICKAXES = [1275, 1271, 1273, 1269, 1267, 1265, 13243, 11920, 12297, 23680] as const;
