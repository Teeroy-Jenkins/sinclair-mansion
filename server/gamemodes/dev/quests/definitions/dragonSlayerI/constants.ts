export const DRAGON_SLAYER_I_QUEST_KEY = "dragon_slayer_i";
export const VARP_DRAGON_SLAYER = 176;
export const VARP_DRAGON_AUX = 177;
export const VARP_NED_HIRED = 183;
export const VARP_ORACLE = 184;

export const STAGE_NOT_STARTED = 0;
export const STAGE_GUILDMASTER = 1;
export const STAGE_OZIACH = 2;
export const STAGE_BOUGHT_SHIP = 3;
export const STAGE_REPAIR_1 = 4;
export const STAGE_REPAIR_2 = 5;
export const STAGE_REPAIR_3 = 7;
export const STAGE_NED_READY = 8;
export const STAGE_CRANDOR = 9;
export const STAGE_COMPLETE = 10;

export const ITEM = {
    coins: 995,
    silk: 950,
    plank: 960,
    lobsterPot: 301,
    wizardMindBomb: 1907,
    unfiredBowl: 1791,
    steelNails: 1539,
    antiDragonShield: 1540,
    mapMelzar: 1535,
    mapWormbrain: 1536,
    mapOracle: 1537,
    crandorMap: 1538,
    mazeKey: 1542,
    redKey: 1543,
    orangeKey: 1544,
    yellowKey: 1545,
    blueKey: 1546,
    magentaKey: 1547,
    greenKey: 1548,
} as const;

export const NPC = {
    guildmaster: 814,
    dukeHoracio: 815,
    elvarg: 816,
    captainNed: [818, 5865],
    klarense: 819,
    wormbrain: 820,
    oracle: 821,
    oziach: 822,
    melzar: [753, 823],
    mazeKeyDroppers: [748, 749, 750, 751, 753, 752],
    lesserDemon: [752, 2005, 3982],
} as const;

export const LOC = {
    magicDoor: 2586,
    oracleChest: [2587, 2588],
    shipHole: 2589,
    shipGangplanks: [2593, 2594],
    melzarEntrance: 2595,
    mazeDoors: [2596, 2597, 2598, 2599, 2600, 2601],
    melzarChest: [2603, 2604],
    elvargGates: [2607, 2608],
    crandorOpening: 2609,
    crandorRope: 2610,
} as const;

export const TILE = {
    melzarInside: { x: 2933, y: 3248, level: 0 },
    shipDeck: { x: 3048, y: 3207, level: 1 },
    crandor: { x: 2835, y: 3235, level: 0 },
    elvargLair: { x: 2852, y: 9637, level: 0 },
    crandorSurface: { x: 2833, y: 3255, level: 0 },
} as const;

export const MAP_MELZAR_BIT = 1 << 0;
export const MAP_WORMBRAIN_BIT = 1 << 1;
export const MAP_ORACLE_BIT = 1 << 2;
