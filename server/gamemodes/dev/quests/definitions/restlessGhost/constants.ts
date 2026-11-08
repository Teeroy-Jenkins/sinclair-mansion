export const RESTLESS_GHOST_KEY = "the_restless_ghost";

export const VARP_RESTLESS_GHOST = 107;
export const STAGE_STARTED = 1;
export const STAGE_SPOKEN_URHNEY = 2;
export const STAGE_SPOKEN_GHOST = 3;
export const STAGE_OBTAINED_SKULL = 4;
export const STAGE_COMPLETE = 5;

export const NPC = {
    fatherAereck: 2812,
    fatherUrhney: 923,
    restlessGhost: 922,
    skeleton: 924,
} as const;

export const ITEM = {
    ghostspeakAmulet: 552,
    ghostSkull: 553,
} as const;

export const LOC = {
    closedCoffin: 2145,
    openCoffin: 15052,
    completedCoffin: 15053,
    skullAltar: 2146,
} as const;

export const TILE = {
    coffin: { x: 3249, y: 3192, level: 0 },
    ghost: { x: 3248, y: 3193, level: 0 },
    skullSkeleton: { x: 3119, y: 9567, level: 0 },
} as const;
