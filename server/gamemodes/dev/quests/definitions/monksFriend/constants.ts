export const MONKS_FRIEND_QUEST_KEY = "monks_friend";

export const BROTHER_OMAD_NPC_ID = 4244;
export const BROTHER_CEDRIC_NPC_ID = 4245;

export const VARP_MONKS_FRIEND = 30;
export const STAGE_STARTED = 10;
export const STAGE_RETURNED_BLANKET = 20;
export const STAGE_LOOKING_FOR_CEDRIC = 30;
export const STAGE_FINDING_WATER = 40;
export const STAGE_GIVEN_WATER = 50;
export const STAGE_FIXING_CART = 60;
export const STAGE_FIXED_CART = 70;
export const STAGE_COMPLETE = 80;

export const CHILDS_BLANKET_ITEM_ID = 90;
export const JUG_OF_WATER_ITEM_ID = 1937;
export const LOGS_ITEM_ID = 1511;
export const LAW_RUNE_ITEM_ID = 563;

export const HIDDEN_LADDER_LOC_ID = 18987;
export const CAVE_LADDER_LOC_ID = 17385;
export const HIDDEN_LADDER_TILE = { x: 2561, y: 3222 } as const;
export const CAVE_LADDER_TILE = { x: 2561, y: 9622 } as const;
export const LADDER_REGION_ID = (40 << 8) | 50;

export const PARTY_BALLOON_LOC_IDS = [115, 116, 117, 118, 119, 120] as const;
export const PARTY_BALLOON_TILES = [
    { x: 2603, y: 3208 },
    { x: 2606, y: 3210 },
    { x: 2609, y: 3209 },
    { x: 2605, y: 3214 },
    { x: 2607, y: 3216 },
    { x: 2604, y: 3218 },
] as const;
