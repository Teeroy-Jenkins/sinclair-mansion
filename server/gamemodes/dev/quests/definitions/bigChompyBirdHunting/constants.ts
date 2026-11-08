export const BIG_CHOMPY_BIRD_HUNTING_QUEST_KEY = "big_chompy_bird_hunting";

export const VARP_CHOMPY_BIRD = 293;
export const VARP_CHOMPY_KILLS = 294;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 5;
export const STAGE_GIVEN_ARROWS = 10;
export const STAGE_KIDS_EXPLAINED_TOADS = 15;
export const STAGE_OPENED_CHEST = 20;
export const STAGE_SHOWN_TOAD = 25;
export const STAGE_DROPPED_TOAD = 30;
export const STAGE_CHOMPY_SPAWNED = 35;
export const STAGE_RANTZ_MISSED = 40;
export const STAGE_GIVEN_BOW = 45;
export const STAGE_KILLED_CHOMPY = 50;
export const STAGE_TOLD_TO_COOK = 55;
export const STAGE_CHOMPY_COOKED = 60;
export const STAGE_COMPLETE = 65;

export const MADE_ARROWS_BIT = 1 << 0;
export const RANTZ_ONION_BIT = 1 << 1;
export const BUGS_FLAVOUR_SHIFT = 2;
export const FYCIE_FLAVOUR_SHIFT = 4;
export const BOUGHT_FEATHERS_BIT = 1 << 6;
export const BOUGHT_TOOLS_BIT = 1 << 7;

export const ITEM = {
    coins: 995,
    knife: 946,
    chisel: 1755,
    feather: 314,
    wolfBones: 2859,
    wolfboneArrowtips: 2861,
    acheyLogs: 2862,
    ogreArrowShaft: 2864,
    flightedOgreArrow: 2865,
    ogreArrow: 2866,
    ogreBellows: 2871,
    ogreBellows3: 2872,
    ogreBellows2: 2873,
    ogreBellows1: 2874,
    bloatedToad: 2875,
    rawChompy: 2876,
    cookedChompy: 2878,
    ruinedChompy: 2880,
    seasonedChompy: 2882,
    ogreBow: 2883,
    potato: 1942,
    onion: 1957,
    cabbage: 1965,
    tomato: 1982,
    equaLeaves: 2128,
    doogleLeaves: 1573,
} as const;

export const NPC = {
    rantz: [1470, 6259],
    fycie: 1471,
    bugs: 1472,
    swampToad: 1473,
    livingChompy: 1475,
    deadChompy: 1476,
} as const;

export const LOC = {
    swampBubbles: [684, 735],
    spitRoastEmpty: 3375,
    chestClosed: 3377,
    chestOpen: 3378,
    caveEntrance: 3379,
    caveExits: [3380, 3381],
} as const;

export const TILE = {
    caveOutside: { x: 2630, y: 2981, level: 0 },
    caveInside: { x: 2647, y: 9395, level: 0 },
} as const;

export const QUEST_HUNT_ZONE = {
    id: "big-chompy-quest-clearing",
    minX: 2631,
    maxX: 2639,
    minY: 2970,
    maxY: 2979,
    levels: [0],
} as const;

export const CHOMPY_HAT_REWARDS = [
    { kills: 30, itemId: 2978, title: "Ogre Bowman" },
    { kills: 40, itemId: 2979, title: "Bowman" },
    { kills: 50, itemId: 2980, title: "Ogre Yeoman" },
    { kills: 70, itemId: 2981, title: "Yeoman" },
    { kills: 95, itemId: 2982, title: "Ogre Marksman" },
    { kills: 125, itemId: 2983, title: "Marksman" },
    { kills: 170, itemId: 2984, title: "Ogre Woodsman" },
    { kills: 225, itemId: 2985, title: "Woodsman" },
    { kills: 300, itemId: 2986, title: "Ogre Forester" },
    { kills: 400, itemId: 2987, title: "Forester" },
    { kills: 550, itemId: 2988, title: "Ogre Bowmaster" },
    { kills: 700, itemId: 2989, title: "Bowmaster" },
    { kills: 1_000, itemId: 2990, title: "Ogre Expert" },
    { kills: 1_300, itemId: 2991, title: "Expert" },
    { kills: 1_700, itemId: 2992, title: "Ogre Dragon Archer" },
    { kills: 2_250, itemId: 2993, title: "Dragon Archer" },
    { kills: 3_000, itemId: 2994, title: "Expert Ogre Dragon Archer" },
    { kills: 4_000, itemId: 2995, title: "Expert Dragon Archer" },
] as const;
