export const JUNGLE_POTION_QUEST_KEY = "jungle_potion";

export const VARP_JUNGLE_POTION = 175;
export const STAGE_NOT_STARTED = 0;
export const STAGE_GET_SNAKE_WEED = 1;
export const STAGE_FOUND_SNAKE_WEED = 2;
export const STAGE_GET_ARDRIGAL = 3;
export const STAGE_FOUND_ARDRIGAL = 4;
export const STAGE_GET_SITO_FOIL = 5;
export const STAGE_FOUND_SITO_FOIL = 6;
export const STAGE_GET_VOLENCIA_MOSS = 7;
export const STAGE_FOUND_VOLENCIA_MOSS = 8;
export const STAGE_GET_ROGUES_PURSE = 9;
export const STAGE_FOUND_ROGUES_PURSE = 10;
export const STAGE_FOUND_ALL_HERBS = 11;
export const STAGE_COMPLETE = 12;
export const STAGE_COMPLETE_AFTER_SPOKEN = 13;

export const VARP_DRUIDIC_RITUAL = 80;
export const DRUIDIC_RITUAL_COMPLETE = 4;

export const TRUFITUS_NPC_ID = 4625;

export const SNAKE_VINE_LOC_ID = 2575;
export const ARDRIGAL_PALM_LOC_ID = 2577;
export const SITO_SOIL_LOC_ID = 2579;
export const VOLENCIA_MOSS_ROCK_LOC_ID = 2581;
export const ROGUES_PURSE_WALL_LOC_ID = 2583;
export const POTHOLE_ENTRANCE_LOC_ID = 2584;
export const POTHOLE_EXIT_LOC_ID = 2585;

export const GRIMY_SNAKE_WEED_ITEM_ID = 1525;
export const SNAKE_WEED_ITEM_ID = 1526;
export const GRIMY_ARDRIGAL_ITEM_ID = 1527;
export const ARDRIGAL_ITEM_ID = 1528;
export const GRIMY_SITO_FOIL_ITEM_ID = 1529;
export const SITO_FOIL_ITEM_ID = 1530;
export const GRIMY_VOLENCIA_MOSS_ITEM_ID = 1531;
export const VOLENCIA_MOSS_ITEM_ID = 1532;
export const GRIMY_ROGUES_PURSE_ITEM_ID = 1533;
export const ROGUES_PURSE_ITEM_ID = 1534;
export const COINS_ITEM_ID = 995;
export const REWARD_ITEM_ID = 251;

export const POTHOLE_INTERIOR_X = 2830;
export const POTHOLE_INTERIOR_Y = 9520;
export const POTHOLE_EXTERIOR_X = 2823;
export const POTHOLE_EXTERIOR_Y = 3120;

export interface JunglePotionHerb {
    name: string;
    grimyItemId: number;
    cleanItemId: number;
    locId: number;
    requestedStage: number;
    foundStage: number;
    nextStage: number;
    searchTarget: string;
    clue: string[];
}

export const JUNGLE_POTION_HERBS: readonly JunglePotionHerb[] = [
    {
        name: "Snake weed",
        grimyItemId: GRIMY_SNAKE_WEED_ITEM_ID,
        cleanItemId: SNAKE_WEED_ITEM_ID,
        locId: SNAKE_VINE_LOC_ID,
        requestedStage: STAGE_GET_SNAKE_WEED,
        foundStage: STAGE_FOUND_SNAKE_WEED,
        nextStage: STAGE_GET_ARDRIGAL,
        searchTarget: "vine",
        clue: [
            "It grows near vines in an area to the south-west,",
            "where the ground turns soft and the water kisses your feet.",
        ],
    },
    {
        name: "Ardrigal",
        grimyItemId: GRIMY_ARDRIGAL_ITEM_ID,
        cleanItemId: ARDRIGAL_ITEM_ID,
        locId: ARDRIGAL_PALM_LOC_ID,
        requestedStage: STAGE_GET_ARDRIGAL,
        foundStage: STAGE_FOUND_ARDRIGAL,
        nextStage: STAGE_GET_SITO_FOIL,
        searchTarget: "palm",
        clue: [
            "It is related to the palm and grows in its brother's shady profusion.",
            "Search the small peninsula east of the village, where the cliffs meet the sand.",
        ],
    },
    {
        name: "Sito foil",
        grimyItemId: GRIMY_SITO_FOIL_ITEM_ID,
        cleanItemId: SITO_FOIL_ITEM_ID,
        locId: SITO_SOIL_LOC_ID,
        requestedStage: STAGE_GET_SITO_FOIL,
        foundStage: STAGE_FOUND_SITO_FOIL,
        nextStage: STAGE_GET_VOLENCIA_MOSS,
        searchTarget: "scorched earth",
        clue: ["Sito foil grows best where the ground has been blackened by living flame."],
    },
    {
        name: "Volencia moss",
        grimyItemId: GRIMY_VOLENCIA_MOSS_ITEM_ID,
        cleanItemId: VOLENCIA_MOSS_ITEM_ID,
        locId: VOLENCIA_MOSS_ROCK_LOC_ID,
        requestedStage: STAGE_GET_VOLENCIA_MOSS,
        foundStage: STAGE_FOUND_VOLENCIA_MOSS,
        nextStage: STAGE_GET_ROGUES_PURSE,
        searchTarget: "rock",
        clue: [
            "It clings to rocks with high metal content in frequently disturbed ground.",
            "Search carefully among the rocks south-east of the village.",
        ],
    },
    {
        name: "Rogue's purse",
        grimyItemId: GRIMY_ROGUES_PURSE_ITEM_ID,
        cleanItemId: ROGUES_PURSE_ITEM_ID,
        locId: ROGUES_PURSE_WALL_LOC_ID,
        requestedStage: STAGE_GET_ROGUES_PURSE,
        foundStage: STAGE_FOUND_ROGUES_PURSE,
        nextStage: STAGE_FOUND_ALL_HERBS,
        searchTarget: "wall",
        clue: [
            "It grows in the darkness of caverns to the north.",
            "A secret entrance is hidden among the northern cliffs. Take care, Bwana.",
        ],
    },
];
