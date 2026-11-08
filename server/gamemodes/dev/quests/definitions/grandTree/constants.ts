export const GRAND_TREE_QUEST_KEY = "grand_tree";
export const VARP_GRAND_TREE = 150;
export const VARP_GRAND_TREE_PILLARS = 151;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 10;
export const STAGE_HAZELMERE = 20;
export const STAGE_RELAYED_MESSAGE = 30;
export const STAGE_SPOKEN_GLOUGH = 40;
export const STAGE_FOUND_PRISONER = 50;
export const STAGE_SPOKEN_PRISONER = 60;
export const STAGE_FOUND_JOURNAL = 70;
export const STAGE_RELEASED = 80;
export const STAGE_LUMBER_ORDER = 90;
export const STAGE_CHARLIE_CLUE = 100;
export const STAGE_INVASION_PLANS = 110;
export const STAGE_GIVEN_TWIGS = 120;
export const STAGE_TRAPDOOR = 130;
export const STAGE_DEMON_DEFEATED = 140;
export const STAGE_SEARCHING_DACONIA = 150;
export const STAGE_COMPLETE = 160;

export const ITEM = {
    barkSample: 783,
    translationBook: 784,
    gloughJournal: 785,
    hazelmereScroll: 786,
    lumberOrder: 787,
    gloughKey: 788,
    twigs: [789, 790, 791, 792],
    daconiaRock: 793,
    invasionPlans: 794,
} as const;

export const NPC = {
    hazelmere: 1422,
    narnode: 1423,
    glough: 1424,
    foreman: 1429,
    shipyardWorker: [1430, 5457, 5729],
    charlie: 1495,
    anita: 7180,
    blackDemon: 240,
} as const;

export const LOC = {
    gloughCupboards: [2434, 2435],
    gloughChests: [2436, 2437],
    pillars: [2440, 2441, 2442, 2443],
    trapdoor: [2444, 2445],
    trapdoorUnder: 2446,
    climbTree: 2447,
    downTree: 2448,
    daconiaRoots: [2449, 2450],
    rootDoor: 2451,
    prisonDoor: 3367,
} as const;

export const TILE = {
    gloughTunnel: { x: 2464, y: 9897, level: 0 },
    demon: { x: 2469, y: 9899, level: 0 },
    roots: { x: 2464, y: 9894, level: 0 },
    treeHouse: { x: 2482, y: 3464, level: 2 },
} as const;
