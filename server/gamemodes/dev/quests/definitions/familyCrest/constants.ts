export const FAMILY_CREST_QUEST_KEY = "family_crest";
export const VARP_FAMILY_CREST = 148;
export const VARP_FAMILY_CREST_AUX = 149;

export const STAGE_NOT_STARTED = 0;
export const STAGE_SPOKEN_DIMINTHEIS = 1;
export const STAGE_SPOKEN_CALEB = 2;
export const STAGE_CALEB_PIECE = 3;
export const STAGE_SEEKING_AVAN = 4;
export const STAGE_SPOKEN_GEM_TRADER = 5;
export const STAGE_SPOKEN_AVAN = 6;
export const STAGE_SPOKEN_BOOT = 7;
export const STAGE_AVAN_PIECE = 8;
export const STAGE_SPOKEN_JOHNATHON = 9;
export const STAGE_CURED_JOHNATHON = 10;
export const STAGE_COMPLETE = 11;

export const ITEM = {
    shrimps: 315,
    salmon: 329,
    tuna: 361,
    bass: 365,
    swordfish: 373,
    perfectGoldOre: 446,
    perfectGoldBar: 2365,
    ruby: 1603,
    ringMould: 1592,
    necklaceMould: 1597,
    perfectRing: 773,
    perfectNecklace: 774,
    cookingGauntlets: 775,
    goldsmithGauntlets: 776,
    chaosGauntlets: 777,
    steelGauntlets: 778,
    calebCrest: 779,
    avanCrest: 780,
    johnathonCrest: 781,
    familyCrest: 782,
} as const;

export const NPC = {
    avan: 4983,
    dimintheis: 4984,
    boot: 4985,
    caleb: 4986,
    chronozon: 4987,
    johnathon: 4988,
    gemTrader: 2874,
} as const;

export const LOC = {
    perfectGoldRock: 11371,
    northLever: [2421, 2422] as const,
    southLever: [2423, 2424] as const,
    northRoomLever: [2425, 2426] as const,
    doors: [2427, 2429, 2430, 2431] as const,
} as const;

export const PERFECT_GOLD_TILES = new Set([
    "2732:9680",
    "2740:9700",
    "2743:9676",
    "2743:9699",
]);

export const SPELL = {
    windBlast: [3294, 1172] as const,
    waterBlast: [3297, 1175] as const,
    earthBlast: [3302, 1177] as const,
    fireBlast: [3307, 1181] as const,
} as const;

export const AUX_BIT = {
    windBlast: 0,
    waterBlast: 1,
    earthBlast: 2,
    fireBlast: 3,
    northRoomLever: 4,
    northLever: 5,
    southLever: 6,
    cookingGauntlets: 7,
    goldsmithGauntlets: 8,
    chaosGauntlets: 9,
} as const;

export const PICKAXES = [1275, 1271, 1273, 1269, 1267, 1265, 13243, 11920, 12297, 23680] as const;
