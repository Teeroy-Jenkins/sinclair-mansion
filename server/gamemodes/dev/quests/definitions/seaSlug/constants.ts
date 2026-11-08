export const SEA_SLUG_QUEST_KEY = "sea_slug";
export const VARP_SEA_SLUG = 159;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_NEEDS_SWAMP_PASTE = 2;
export const STAGE_BOAT_REPAIRED = 3;
export const STAGE_SPOKEN_TO_KENNITH = 4;
export const STAGE_SAILED_TO_KENT = 5;
export const STAGE_SPOKEN_TO_KENT = 6;
export const STAGE_LIT_TORCH = 7;
export const STAGE_KENNITH_NEEDS_ESCAPE = 8;
export const STAGE_PANEL_OPENED = 9;
export const STAGE_NEEDS_CRANE = 10;
export const STAGE_SAVED_KENNITH = 11;
export const STAGE_COMPLETE = 12;

export const NPC = {
    seaSlug: 5061,
    kennithBase: 5065,
    kennith: 5063,
    bailey: 5066,
    caroline: 5067,
    shoreHolgartBase: 5071,
    shoreHolgart: [7324, 7789],
    platformHolgart: 5070,
    islandHolgart: 5069,
    kent: 5074,
} as const;

export const ITEM = {
    oysterPearls: 413,
    litTorch: 594,
    unlitTorch: 596,
    seaSlug: 1466,
    dampSticks: 1467,
    drySticks: 1468,
    brokenGlass: 1469,
    emptyPot: 1931,
    potOfFlour: 1933,
    swampTar: 1939,
    rawSwampPaste: 1940,
    swampPaste: 1941,
} as const;

export const LOC = {
    fires: [26185],
    laddersUp: [2517, 18324],
    laddersDown: [18325],
    panelsClosed: [2518, 18381],
    panelOpen: 18380,
    kennithCrates: [2519],
    cranes: [2520, 18326, 18327],
} as const;

export const TILE = {
    shore: { x: 2722, y: 3305, level: 0 },
    platform: { x: 2782, y: 3273, level: 0 },
    platformHolgart: { x: 2783, y: 3273, level: 0 },
    island: { x: 2800, y: 3320, level: 0 },
} as const;

export const PLATFORM_ZONE = {
    id: "sea_slug_fishing_platform",
    minX: 2758,
    maxX: 2798,
    minY: 3268,
    maxY: 3295,
    levels: [0, 1],
} as const;
