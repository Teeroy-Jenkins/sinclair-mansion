export const WITCHS_HOUSE_QUEST_KEY = "witchs_house";

export const VARP_WITCHS_HOUSE = 226;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_FOUND_MAGNET = 2;
export const STAGE_UNLOCKED_BACK_DOOR = 3;
export const STAGE_READ_DIARY = 5;
export const STAGE_DEFEATED_EXPERIMENT = 6;
export const STAGE_COMPLETE = 7;

export const NPC = {
    boy: 3994,
    nora: 3995,
    experimentForms: [3996, 3997, 3998, 3999],
    mouse: 4000,
} as const;

export const ITEM = {
    ball: 2407,
    diary: 2408,
    doorKey: 2409,
    magnet: 2410,
    shedKey: 2411,
    cheese: 1985,
    leatherGloves: 1059,
} as const;

export const LOC = {
    frontDoor: 2861,
    backDoor: 2862,
    shedDoor: 2863,
    fountain: 2864,
    electricGates: [2865, 2866],
    pottedPlant: 2867,
    cupboardClosed: 2868,
    cupboardOpen: 2869,
    mouseHoles: [2870, 15518, 15519],
    ladderUp: 24717,
    ladderDown: 24718,
} as const;

export const TILE = {
    mouse: { x: 2903, y: 3466, level: 0 },
    experiment: { x: 2935, y: 3462, level: 0 },
    outsideGarden: { x: 2929, y: 3456, level: 0 },
    basement: { x: 2907, y: 9876, level: 0 },
    groundFloor: { x: 2907, y: 3476, level: 0 },
} as const;

export const GARDEN_ZONE = {
    id: "witchs_house_garden",
    minX: 2901,
    maxX: 2939,
    minY: 3457,
    maxY: 3466,
    levels: [0],
} as const;
