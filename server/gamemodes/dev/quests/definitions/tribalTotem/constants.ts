export const TRIBAL_TOTEM_QUEST_KEY = "tribal_totem";
export const VARP_TRIBAL_TOTEM = 200;
export const VARP_HANDELMORT_TRAPS = 201;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_CRATE_MARKED = 2;
export const STAGE_CRATE_DELIVERED = 3;
export const STAGE_TELEPORTED = 4;
export const STAGE_COMPLETE = 5;

export const ITEM = {
    guideBook: 1856,
    tribalTotem: 1857,
    addressLabel: 1858,
    swordfish: 373,
} as const;

export const NPC = {
    gpdtEmployee: 5313,
    wizardCromperty: [5314, 8480, 8481] as const,
    horacio: 5315,
    kangaiMau: 5316,
} as const;

export const LOC = {
    combinationDoor: 2705,
    mansionDoor: 2706,
    hornCrate: 2707,
    teleportCrate: 2708,
    closedChest: 2709,
    openChest: 2710,
    trapStairs: 2711,
} as const;

export const TILE = {
    mansionTeleport: { x: 2638, y: 3321, level: 0 },
    stairsTop: { x: 2631, y: 3321, level: 1 },
    trapFall: { x: 2640, y: 9719, level: 0 },
} as const;

export const TRAP_COMBINATION_SOLVED_BIT = 1 << 0;
export const STAIRS_DISABLED_BIT = 1 << 21;
