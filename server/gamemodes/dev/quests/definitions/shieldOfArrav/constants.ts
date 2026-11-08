export const SHIELD_OF_ARRAV_QUEST_KEY = "shield_of_arrav";
export const VARP_SHIELD_OF_ARRAV = 145;
export const STAGE_BITS = { start: 0, end: 2 } as const;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_READ_BOOK = 2;
export const STAGE_GANG_TASK = 3;
export const STAGE_JOINED_GANG = 4;
export const STAGE_RECOVERED_SHIELD = 5;
export const STAGE_CERTIFICATE = 6;
export const STAGE_COMPLETE = 7;

export const AUX = {
    gangChosen: 1 << 3,
    phoenixGang: 1 << 4,
    phoenixLocationKnown: 1 << 5,
} as const;

export const ITEM = {
    book: 757,
    weaponStoreKey: 759,
    intelReport: 761,
    phoenixShieldHalf: 763,
    blackArmShieldHalf: 765,
    phoenixCrossbow: 767,
    certificate: 769,
    coins: 995,
    phoenixCertificateHalf: 11173,
    blackArmCertificateHalf: 11174,
} as const;

export const NPC = {
    charlie: 5209,
    katrine: 5210,
    weaponsmaster: 5211,
    straven: 5212,
    jonnyTheBeard: 5213,
    curator: 5214,
    kingRoald: 5215,
    baraek: 2881,
    reldo: 6203,
} as const;

export const LOC = {
    phoenixHideoutDoor: 2397,
    weaponStoreDoor: 2398,
    blackArmDoor: 2399,
    blackArmCupboard: 2400,
    bookcase: 2402,
    phoenixChest: 2403,
} as const;

export const TILE = {
    weaponStoreDoor: { x: 3251, y: 3386, level: 0 },
    blackArmDoor: { x: 3185, y: 3388, level: 0 },
    phoenixHideoutDoor: { x: 3247, y: 9779, level: 0 },
} as const;
