export const LOST_CITY_QUEST_KEY = "lost_city";
export const VARP_LOST_CITY = 147;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_SPOKEN_SHAMUS = 2;
export const STAGE_SPIRIT_DEFEATED = 3;
export const STAGE_TREE_CHOPPED = 4;
export const STAGE_STAFF_MADE = 5;
export const STAGE_COMPLETE = 6;

export const ITEM = {
    dramenBranch: 771,
    dramenStaff: 772,
    knife: 946,
} as const;

export const AXES = [
    1351, // Bronze
    1349, // Iron
    1353, // Steel
    1361, // Black
    1355, // Mithril
    1357, // Adamant
    1359, // Rune
    6739, // Dragon
    13241, // Infernal
    20011, // 3rd age
    23673, // Crystal
    28217, // Blessed
] as const;

export const NPC = {
    archer: 1157,
    warrior: 1158,
    monk: 1159,
    wizard: 1160,
    shamus: 1162,
    treeSpirit: 1163,
} as const;

export const LOC = {
    dramenTree: 1292,
    zanarisDoor: 2406,
    leprechaunTree: 2409,
} as const;

export const TILE = {
    shamus: { x: 3139, y: 3211, level: 0 },
    treeSpirit: { x: 2860, y: 9737, level: 0 },
    zanaris: { x: 2452, y: 4473, level: 0 },
} as const;
