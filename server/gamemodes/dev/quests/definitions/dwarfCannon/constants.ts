export const DWARF_CANNON_QUEST_KEY = "dwarf_cannon";

/** Current cache quest state (mcannon). */
export const VARP_DWARF_CANNON = 0;
/** Bits 0..2 are cannon repairs; bits 5..10 are the six railings. */
export const VARP_DWARF_CANNON_MULTI = 1;

export const STAGE_NOT_STARTED = 0;
export const STAGE_REPAIR_RAILINGS = 1;
export const STAGE_CHECK_WATCHTOWER = 2;
export const STAGE_FIND_CAVE = 3;
export const STAGE_FIND_LOLLK = 4;
export const STAGE_RETURN_TO_LAWGOF = 5;
export const STAGE_REPAIR_CANNON = 6;
export const STAGE_INSPECTED_CANNON = 7;
export const STAGE_CANNON_REPAIRED = 8;
export const STAGE_SPEAK_TO_NULODION = 9;
export const STAGE_RETURN_NOTES = 10;
export const STAGE_COMPLETE = 11;

export const RAIL_MASK = 0x3f << 5;
export const CANNON_REPAIR_MASK = 0x7;

export const ITEM = {
    dwarfRemains: 0,
    toolkit: 1,
    cannonball: 2,
    nulodionsNotes: 3,
    ammoMould: 4,
    instructionManual: 5,
    cannonBase: 6,
    cannonStand: 8,
    cannonBarrels: 10,
    cannonFurnace: 12,
    railing: 14,
    hammer: 2347,
    coins: 995,
} as const;

export const NPC = {
    nulodion: 1400,
    lollk: 5190,
    lawgof: 5191,
    guards: [5185, 5186, 5187, 5188, 5189],
} as const;

export const LOC = {
    lollkCrate: 1,
    caveEntrance: 2,
    nulodionDoorClosed: 3,
    nulodionDoorOpen: 4,
    brokenCannon: 5,
    towerLadderUp: [10, 16683, 16679],
    towerLadderDown: [11, 16680],
    mudPile: 13,
    legacyRailings: [15, 16, 17, 18, 19, 20],
    currentRailing: 15601,
    dwarfRemains: [0, 15596],
    currentCannonParts: [11870, 11873],
} as const;

/** The six damaged fence sections around the Black Guard camp. */
export const CURRENT_RAILING_TILES = [
    { x: 2555, y: 3472 },
    { x: 2555, y: 3477 },
    { x: 2558, y: 3463 },
    { x: 2559, y: 3457 },
    { x: 2565, y: 3456 },
    { x: 2570, y: 3456 },
] as const;

export const TILE = {
    towerGround: { x: 2570, y: 3441, level: 0 },
    towerTop: { x: 2570, y: 3443, level: 1 },
    remains: { x: 2567, y: 3444, level: 2 },
    caveOutside: { x: 2622, y: 3391, level: 0 },
    caveInside: { x: 2620, y: 9797, level: 0 },
    lollkCrate: { x: 2571, y: 9850, level: 0 },
    lollkSpawn: { x: 2572, y: 9850, level: 0 },
    cannonWest: { x: 2577, y: 3460, level: 0 },
    cannonEast: { x: 2562, y: 3460, level: 0 },
} as const;

