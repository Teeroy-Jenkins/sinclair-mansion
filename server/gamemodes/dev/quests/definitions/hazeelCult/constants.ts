export const HAZEEL_CULT_QUEST_KEY = "hazeel_cult";

export const VARP_HAZEEL_CULT = 223;
export const VARP_HAZEEL_VALVES = 224;
export const VARP_HAZEEL_SIDE = 225;

export const SIDE_CARNILLEAN = 0;
export const SIDE_HAZEEL = 1;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 2;
export const STAGE_SPOKEN_TO_CLIVET = 3;
export const STAGE_CHOSEN_SIDE = 4;
export const STAGE_POISONED_FOOD = 5;
export const STAGE_FINISHED_SIDE_TASK = 6;
export const STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL = 7;
export const STAGE_COMPLETE = 9;

export const ITEM = {
    poison: 273,
    hazeelScroll: 2403,
    chestKey: 2404,
    carnilleanArmour: 2405,
    hazeelsMark: 2406,
    coins: 995,
} as const;

export const NPC = {
    legacyCeril: 1198,
    claus: 1199,
    legacyGuard: 1200,
    philipe: 1201,
    henryeta: 1202,
    legacyJones: 1203,
    legacyAlomone: 1204,
    hazeel: 1205,
    legacyClivet: 1206,
    legacyCultist: 1207,
    ceril: 12085,
    guard: 12087,
    jones: 12089,
    alomone: 12093,
    clivet: 12095,
    cultist: 12096,
} as const;

export const LOC = {
    valves: [2844, 2845, 2846, 2847, 2848] as const,
    raft: 2849,
    evidenceCupboard: [2850, 2851] as const,
    caveEntrance: 2852,
    caveStairs: 2853,
    secretWall: [2854, 2855, 46565, 46566] as const,
    scrollChest: [2856, 2857, 46567, 46568, 46710, 46711, 46712] as const,
    keyCrate: 2858,
    poisonRange: 2859,
    armourChest: 46713,
} as const;

export const TILE = {
    caveSurface: { x: 2587, y: 3237, level: 0 },
    caveEntrance: { x: 2570, y: 9682, level: 0 },
    raftEntrance: { x: 2567, y: 9680, level: 0 },
    raftStops: [
        { x: 2578, y: 9687, level: 0 },
        { x: 2593, y: 9694, level: 0 },
        { x: 2599, y: 9712, level: 0 },
        { x: 2616, y: 9725, level: 0 },
    ] as const,
    hideout: { x: 2606, y: 9692, level: 0 },
    alomone: { x: 2609, y: 9670, level: 0 },
    hazeel: { x: 2605, y: 9670, level: 0 },
} as const;

export const MANSION_ZONE = {
    id: "hazeel-cult-mansion",
    bounds: { minX: 2559, maxX: 2577, minY: 3261, maxY: 3278 },
    levels: [0, 1, 2],
} as const;

export const CULT_ZONE = {
    id: "hazeel-cult-sewers",
    bounds: { minX: 2532, maxX: 2618, minY: 9664, maxY: 9730 },
    levels: [0],
} as const;
