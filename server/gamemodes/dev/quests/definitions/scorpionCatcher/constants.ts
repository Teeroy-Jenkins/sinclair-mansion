export const SCORPION_CATCHER_QUEST_KEY = "scorpion_catcher";
export const VARP_SCORPION_CATCHER = 76;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_FIRST_HINT = 2;
export const STAGE_SECOND_HINT = 3;
export const STAGE_COMPLETE = 4;

export const NPC = {
    firstScorpion: 5228,
    secondScorpion: 5229,
    thirdScorpion: 5230,
    seer: 5231,
    thormac: 5232,
    peksa: 2872,
} as const;

export const ITEM = {
    emptyCage: 456,
    first: 457,
    firstSecond: 458,
    firstThird: 459,
    second: 460,
    secondThird: 461,
    third: 462,
    fullCage: 463,
    coins: 995,
    airBattlestaff: 1397,
    waterBattlestaff: 1395,
    earthBattlestaff: 1399,
    fireBattlestaff: 1393,
    lavaBattlestaff: 3053,
    mysticAirStaff: 1405,
    mysticWaterStaff: 1403,
    mysticEarthStaff: 1407,
    mysticFireStaff: 1401,
    mysticLavaStaff: 3054,
} as const;

export const CAGE_ITEMS = [
    ITEM.emptyCage,
    ITEM.first,
    ITEM.firstSecond,
    ITEM.firstThird,
    ITEM.second,
    ITEM.secondThird,
    ITEM.third,
    ITEM.fullCage,
] as const;

export const LOC = { secretWall: 2117 } as const;
export const TILE = { secretWall: { x: 2875, y: 9799, level: 0 } } as const;
