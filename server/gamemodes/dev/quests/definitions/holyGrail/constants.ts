export const HOLY_GRAIL_QUEST_KEY = "holy_grail";
export const VARP_HOLY_GRAIL = 5;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 2;
export const STAGE_SPOKEN_MERLIN = 3;
export const STAGE_SPOKEN_CRONE = 4;
export const STAGE_FAILED_TITAN = 7;
export const STAGE_FINDING_PERCIVAL = 8;
export const STAGE_GIVEN_WHISTLE = 9;
export const STAGE_COMPLETE = 10;

export const ITEM = {
    napkin: 15,
    magicWhistle: 16,
    grailBell: 17,
    magicFeather: 18,
    holyGrail: 19,
    excalibur: 35,
} as const;

export const NPC = {
    kingArthur: 3531,
    merlin: 3529,
    sirPercival: 4057,
    highPriest: 4062,
    galahad: 4064,
    fisherman: 4065,
    fisherKing: 4066,
    blackKnightTitan: 4067,
} as const;

export const LOC = {
    whistleRoomDoor: 22,
    percivalSacks: 23,
    merlinWorkshopDoor: 24,
} as const;

export const TILE = {
    merlinWorkshop: { x: 2767, y: 3500, level: 1 },
    whistleTable: { x: 3107, y: 3359, level: 2 },
    realmDying: { x: 2806, y: 4715, level: 0 },
    realmRestored: { x: 2678, y: 4715, level: 0 },
    karamjaTower: { x: 2741, y: 3235, level: 0 },
    fisherCastle: { x: 2761, y: 4688, level: 1 },
} as const;

export const VARP_MERLINS_CRYSTAL = 14;
export const MERLINS_CRYSTAL_COMPLETE = 7;
