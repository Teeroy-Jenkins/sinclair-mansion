export const GERTRUDES_CAT_QUEST_KEY = "gertrudes_cat";
export const VARP_GERTRUDES_CAT = 180;
export const VARP_KITTEN_CRATE = 181;
export const STAGE_STARTED = 1;
export const STAGE_PAID_BOY = 2;
export const STAGE_GAVE_MILK = 3;
export const STAGE_GAVE_SARDINE = 4;
export const STAGE_RESCUED = 5;
export const STAGE_COMPLETE = 6;
export const ITEM = {
    rawSardine: 327,
    bucket: 1925,
    milk: 1927,
    cake: 1897,
    stew: 2003,
    seasonedSardine: 1552,
    fluffsKitten: 1554,
    petKitten: 1555,
    doogleLeaves: 1573,
    coins: 995,
} as const;

export const NPC = {
    cat: 3497,
    crate: 3499,
    gertrude: 3500,
    shilop: 3501,
    wilough: 3503,
} as const;

export const LOC = {
    fence: 2618,
    barrel: 2619,
    crate: 2620,
} as const;

export const KITTEN_CRATES = [
    [3298, 3514],
    [3303, 3506],
    [3305, 3500],
    [3307, 3507],
    [3310, 3499],
    [3315, 3515],
] as const;

export const REJECTED_FISH = [315, 317, 319, 321, 325, 327, 329, 331, 333, 335] as const;
