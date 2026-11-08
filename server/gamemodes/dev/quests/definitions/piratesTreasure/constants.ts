export const PIRATES_TREASURE_QUEST_KEY = "pirates_treasure";
export const VARP_PIRATES_TREASURE = 71;
export const VARP_PIRATES_EMPLOYMENT = 72;
export const VARP_PIRATES_BANANAS = 73;
export const VARP_PIRATES_RUM = 74;
export const STAGE_STARTED = 1;
export const STAGE_KEY = 2;
export const STAGE_NOTE = 3;
export const STAGE_COMPLETE = 4;
export const ITEM = {
    rum: 431,
    key: 432,
    message: 433,
    banana: 1963,
    apron: 1005,
    spade: 952,
    coins: 995,
    ring: 1635,
    emerald: 1605,
} as const;
export const NPC = { wydin: 2890, frank: 3643, luthas: 3647 } as const;
// Current-cache ids: Karamja packing crate, Wydin stock-room crate, Blue Moon chest.
export const LOC = {
    plantationCrate: [2072],
    storeCrate: [2071],
    stockRoomDoor: 2069,
    chest: [2079],
} as const;
export const TREASURE_TILE = { x: 2999, y: 3383, level: 0 } as const;
