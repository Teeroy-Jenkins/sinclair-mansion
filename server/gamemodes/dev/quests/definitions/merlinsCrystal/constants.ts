export const MERLINS_CRYSTAL_QUEST_KEY = "merlins_crystal";
export const VARP_MERLINS_CRYSTAL = 14;
export const STAGE_BITS = { start: 0, end: 2 } as const;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_SPOKEN_GAWAIN = 2;
export const STAGE_SPOKEN_LANCELOT = 3;
export const STAGE_SPOKEN_MORGAN = 4;
export const STAGE_EXCALIBUR_BOUND = 5;
export const STAGE_MERLIN_FREED = 6;
export const STAGE_COMPLETE = 7;

export const AUX = {
    chaosWordsKnown: 1 << 3,
    blackCandleRequested: 1 << 4,
    excaliburTestStarted: 1 << 5,
    beggarSpoken: 1 << 6,
    excaliburRewarded: 1 << 7,
    beehiveRepelled: 1 << 8,
} as const;

export const ITEM = {
    insectRepellent: 28,
    bucketOfWax: 30,
    litBlackCandle: 32,
    excalibur: 35,
    blackCandle: 38,
    batBones: 530,
    tinderbox: 590,
    coins: 995,
    bucket: 1925,
    bread: 2309,
} as const;

export const NPC = {
    renegadeKnight: 3517,
    thrantax: 3518,
    sirLancelot: 3519,
    sirGawain: 3520,
    sirMordred: 3527,
    morganLeFaye: 3528,
    merlin: 3529,
    ladyOfTheLake: 3530,
    kingArthur: 3531,
    beggar: 3532,
    candleMaker: 3199,
    arhein: 3200,
} as const;

export const LOC = {
    jewellersDoor: 59,
    jewellersLadder: 60,
    chaosAltar: 61,
    merlinsCrystal: 62,
    catherbyCrate: 63,
    keepCrate: 64,
    bucketCrate: 67,
    beehive: 68,
    arheinGangplank: 69,
    keepDoors: [71, 72] as const,
} as const;

export const TILE = {
    catherbyCrate: { x: 2802, y: 3441, level: 0 },
    keepCrate: { x: 2778, y: 3401, level: 0 },
    morgan: { x: 2770, y: 3403, level: 2 },
    ritual: { x: 2780, y: 3515, level: 0 },
} as const;

export const RITUAL_WORDS = "Snarthon Candtrick Termanto";
