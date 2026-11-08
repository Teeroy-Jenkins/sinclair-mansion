export const TREE_GNOME_VILLAGE_QUEST_KEY = "tree_gnome_village";
export const VARP_TREE_GNOME_VILLAGE = 111;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_SPOKEN_MONTAI = 2;
export const STAGE_GIVEN_LOGS = 3;
export const STAGE_FINDING_TRACKERS = 4;
export const STAGE_BALLISTA_FIRED = 5;
export const STAGE_RETRIEVED_ORB = 6;
export const STAGE_RETURNED_FIRST_ORB = 7;
export const STAGE_DEFEATED_WARLORD = 8;
export const STAGE_COMPLETE = 9;

export const ITEM = {
    firstOrb: 587,
    remainingOrbs: 588,
    gnomeAmulet: 589,
    logs: 1511,
} as const;

export const NPC = {
    kingBolren: 4963,
    commanderMontai: 4964,
    khazardWarlord: 4971,
    khazardCommander: 4972,
    trackers: [4975, 4976, 4977] as const,
    elkoyOutside: 6265,
    elkoyInside: 6266,
} as const;

export const LOC = {
    ballista: 2181,
    openChest: 2182,
    closedChest: 2183,
    strongholdDoor: 2184,
    crumbledWall: 2185,
} as const;

export const TILE = {
    mazeEntrance: { x: 2504, y: 3192, level: 0 },
    village: { x: 2515, y: 3159, level: 0 },
} as const;
