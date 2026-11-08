export const FIGHT_ARENA_QUEST_KEY = "fight_arena";
export const VARP_FIGHT_ARENA = 17;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_OBTAINED_ARMOUR = 2;
export const STAGE_SPOKEN_GUARD = 3;
export const STAGE_GUARD_DRUNK = 5;
export const STAGE_OGRE_FIGHT = 6;
export const STAGE_DEFEATED_OGRE = 8;
export const STAGE_SCORPION_FIGHT = 9;
export const STAGE_DEFEATED_SCORPION = 10;
export const STAGE_DEFEATED_BOUNCER = 11;
export const STAGE_FREED_SERVILS = 12;
export const STAGE_COMPLETE = 14;

export const ITEM = {
    khazardHelmet: 74,
    khazardArmour: 75,
    cellKeys: 76,
    khaliBrew: 77,
    coins: 995,
} as const;

export const NPC = {
    guards: [1208, 1209, 1210, 1211] as const,
    drunkGuard: 1209,
    generalKhazard: 1213,
    barman: 1214,
    ladyServil: 1219,
    jeremyServil: [1220, 1221] as const,
    justinServil: 1222,
    bouncer: 1224,
    khazardOgre: 1225,
    khazardScorpion: 1226,
} as const;

export const LOC = {
    armourChest: 75,
    armourChestOpen: 76,
    prisonGate: [77, 78] as const,
    jeremyGate: [79, 80] as const,
    arenaDoor: [81, 82] as const,
} as const;
