export const QUEST_KEYS = {
    deathPlateau: "death-plateau",
    digSite: "the-dig-site",
    templeOfIkov: "temple-of-ikov",
    touristTrap: "the-tourist-trap",
    trollStronghold: "troll-stronghold",
    priestInPeril: "priest-in-peril",
    waterfall: "waterfall-quest",
    desertTreasure: "desert-treasure-i",
} as const;

export type DesertTreasureQuestKey = (typeof QUEST_KEYS)[keyof typeof QUEST_KEYS];

/** Official OSRS quest-progress varps and completion values. */
export const QUEST_STATE = {
    [QUEST_KEYS.deathPlateau]: { varpId: 314, completionValue: 80 },
    [QUEST_KEYS.digSite]: { varpId: 131, completionValue: 9 },
    [QUEST_KEYS.templeOfIkov]: { varpId: 26, completionValue: 80 },
    [QUEST_KEYS.touristTrap]: { varpId: 197, completionValue: 30 },
    [QUEST_KEYS.trollStronghold]: { varpId: 317, completionValue: 50 },
    [QUEST_KEYS.priestInPeril]: { varpId: 302, completionValue: 60 },
    [QUEST_KEYS.waterfall]: { varpId: 65, completionValue: 10 },
    [QUEST_KEYS.desertTreasure]: { varpId: 440, completionValue: 15 },
} as const;

export const DT_DIRECT_PREREQUISITES: DesertTreasureQuestKey[] = [
    QUEST_KEYS.digSite,
    QUEST_KEYS.templeOfIkov,
    QUEST_KEYS.touristTrap,
    QUEST_KEYS.trollStronghold,
    QUEST_KEYS.priestInPeril,
    QUEST_KEYS.waterfall,
];
