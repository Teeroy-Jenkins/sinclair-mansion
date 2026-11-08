export const NATURE_SPIRIT_QUEST_KEY = "nature_spirit";
export const VARP_NATURE_SPIRIT = 307;
export const VARP_NATURE_SPIRIT_BITS = 308;

export const STAGE_STARTED = 5;
export const STAGE_ENTERED_SWAMP = 10;
export const STAGE_FAILED_TALK = 15;
export const STAGE_SPOKEN_FILLIMAN = 20;
export const STAGE_SHOWN_MIRROR = 25;
export const STAGE_GIVEN_JOURNAL = 30;
export const STAGE_RECEIVED_SPELL = 35;
export const STAGE_BLESSED = 40;
export const STAGE_CAST_SPELL = 45;
export const STAGE_PICKED_FUNGI = 50;
export const STAGE_SPOKEN_FILLIMAN_2 = 55;
export const STAGE_PERFORMED_RITUAL = 60;
export const STAGE_ENTERED_GROTTO = 65;
export const STAGE_FULL_TRANSFORM = 70;
export const STAGE_BLESSED_SICKLE = 75;
export const STAGE_CAST_SICKLE_BLOOM = 80;
export const STAGE_PICKED_SICKLE_BLOOM = 85;
export const STAGE_ADDED_POUCH = 90;
export const STAGE_KILLED_GHAST_1 = 95;
export const STAGE_KILLED_GHAST_2 = 100;
export const STAGE_KILLED_GHAST_3 = 105;
export const STAGE_COMPLETE = 110;

export const NATURE_STONE_BIT = 1 << 0;
export const SPIRIT_STONE_BIT = 1 << 1;

export const ITEM = {
    ghostspeakAmulet: 552,
    druidPouchEmpty: 2957,
    druidPouch: 2958,
    rottenFood: 2959,
    silverSickle: 2961,
    silverSickleBlessed: 2963,
    washingBowl: 2964,
    mirror: 2966,
    journal: 2967,
    bloomSpell: 2968,
    usedBloomSpell: 2969,
    mortMyreFungus: 2970,
    mortMyreStem: 2972,
    mortMyrePear: 2974,
    sickleMould: 2976,
} as const;

export const NPC = {
    drezel: [9636, 9804, 9805],
    filliman: 943,
    natureSpirit: 944,
    invisibleGhast: [945, 5622, 5624, 5626],
    visibleGhast: [946, 5623, 5625, 5627],
    ulizius: 947,
} as const;

export const LOC = {
    swampGates: [3506, 3507],
    rottingLog: 3508,
    fungiLog: 3509,
    rottingBranch: 3510,
    buddingBranch: 3511,
    smallBush: 3512,
    pearBush: 3513,
    grottoEntrance: 3516,
    grottoTree: 3517,
    undergroundGrotto: 3520,
    natureAltar: 3521,
    bridge: 3522,
    grottoExit: [3525, 3526],
    natureStone: 3527,
    faithStone: 3528,
    spiritStone: 3529,
} as const;

export const TILE = {
    filliman: { x: 3440, y: 3335, level: 0 },
    washingBowl: { x: 3440, y: 3334, level: 0 },
    grottoInside: { x: 3442, y: 9734, level: 0 },
    grottoOutside: { x: 3440, y: 3337, level: 0 },
} as const;

