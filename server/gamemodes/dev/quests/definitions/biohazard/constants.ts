export const BIOHAZARD_QUEST_KEY = "biohazard";
export const VARP_BIOHAZARD = 68;
export const VARP_BIO_ERRAND = 69;
export const VARP_BIO_DUMMIES = 70;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_SPOKEN_TO_JERICO = 2;
export const STAGE_USED_BIRD_FEED = 3;
export const STAGE_RELEASED_PIGEONS = 4;
export const STAGE_CLIMBED_LADDER = 5;
export const STAGE_POISONED_STEW = 6;
export const STAGE_FOUND_DISTILLATOR = 7;
export const STAGE_GIVEN_DISTILLATOR = 10;
export const STAGE_SPOKEN_TO_CHEMIST = 12;
export const STAGE_FOUND_SECRET = 14;
export const STAGE_REPORTED_TO_ELENA = 15;
export const STAGE_COMPLETE = 16;

export const ERRAND = {
    hopsCorrect: 1,
    chancyCorrect: 2,
    daVinciCorrect: 3,
    hopsGiven: 4,
    chancyGiven: 5,
    daVinciGiven: 6,
    hopsWrong: 7,
    chancyWrong: 8,
    daVinciWrong: 9,
} as const;

export const ITEM = {
    ethenea: 415,
    liquidHoney: 416,
    sulphuricBroline: 417,
    plagueSample: 418,
    touchPaper: 419,
    distillator: 420,
    lathasAmulet: 421,
    birdFeed: 422,
    mournerKey: 423,
    pigeonCage: 424,
    emptyPigeonCage: 425,
    priestGownTop: 426,
    priestGownBottom: 428,
    medicalGown: 430,
    rottenApple: 1982,
} as const;

export const NPC = {
    elena: 4257,
    daVinciRimmington: 1103,
    daVinciVarrock: 1104,
    chancyRimmington: 1105,
    chancyVarrock: 1106,
    hopsRimmington: 1107,
    hopsVarrock: 1108,
    julie: 1109,
    guidor: 1110,
    varrockGuards: [1111, 1112],
    jerico: 1145,
    chemist: 1146,
    nurseSarah: 1152,
    omart: [8804, 8836, 8840, 9002],
    kilron: [8805, 8837, 9001],
    kingLathas: [8046, 8842, 9005, 11022],
} as const;

export const LOC = {
    trainingDummy: 2038,
    trainingCampGates: [2039, 2041],
    rottenAppleTrough: 2044,
    mournerCauldron: [2045, 2047],
    guidorDoor: 2054,
    jericoCupboard: [2056, 2057],
    mournerHqGates: [2058, 2060],
    nurseCupboard: [2062, 2063],
    distillatorCrate: 2064,
    ropeLadder: 2065,
    watchtower: [2066, 2067],
} as const;

export const DISTRACTION_ZONE = {
    id: "biohazard_watchtower",
    bounds: { minX: 2558, maxX: 2566, minY: 3298, maxY: 3308 },
} as const;

export const DANCING_DONKEY_ZONE = {
    id: "biohazard_dancing_donkey",
    bounds: { minX: 3272, maxX: 3285, minY: 3384, maxY: 3397 },
} as const;

export const TILE = {
    westWallInside: { x: 2556, y: 3266, level: 0 },
    westWallOutside: { x: 2559, y: 3266, level: 0 },
    daVinciVarrock: { x: 3275, y: 3390, level: 0 },
    chancyVarrock: { x: 3278, y: 3390, level: 0 },
    hopsVarrock: { x: 3281, y: 3390, level: 0 },
} as const;

