export const VARP_OBSERVATORY_QUEST = 112;

export const STAGE = {
    notStarted: 0,
    planks: 1,
    bronze: 2,
    glass: 3,
    mould: 4,
    lens: 5,
    telescope: 6,
    complete: 7,
    claimedWine: 8,
} as const;

export const NPC = {
    professor: [6403, 6404, 488, 490],
    assistant: [5365, 487],
    goblinGuard: 489,
} as const;

export const ITEM = {
    plank: 960,
    bronzeBar: 2349,
    moltenGlass: 1775,
    goblinKitchenKey: 601,
    lensMould: 602,
    observatoryLens: 603,
    jugOfWine: 1993,
    uncutSapphire: 1623,
} as const;

export const LOC = {
    closedDungeonChest: 2191,
    openDungeonChest: 2194,
    telescope: 2210,
} as const;
