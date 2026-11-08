export const KNIGHTS_SWORD_QUEST_KEY = "the_knights_sword";

export const VARP_KNIGHTS_SWORD = 122;
export const STAGE_NOT_STARTED = 0;
export const STAGE_FIND_RELDO = 1;
export const STAGE_FIND_IMCANDO_DWARF = 2;
export const STAGE_GAVE_THURGO_PIE = 3;
export const STAGE_ASK_SQUIRE_FOR_PORTRAIT = 4;
export const STAGE_FIND_PORTRAIT = 5;
export const STAGE_FIND_MATERIALS = 6;
export const STAGE_COMPLETE = 7;

export const NPC = {
    squire: 4737,
    thurgo: 4733,
    sirVyvin: 4736,
    reldo: 6203,
} as const;

export const LOC = {
    vyvinCupboardClosed: 2271,
    vyvinCupboardOpen: 2272,
    bluriteRockA: 11378,
    bluriteRockB: 11379,
} as const;

export const ITEM = {
    portrait: 666,
    bluriteSword: 667,
    bluriteOre: 668,
    redberryPie: 2325,
    ironBar: 2351,
} as const;

export const VYVIN_CUPBOARD_TILE = { x: 2984, y: 3336, level: 2 } as const;
