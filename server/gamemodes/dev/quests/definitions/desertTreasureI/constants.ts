import type { QuestItemRequirement } from "../../types";

export {
    DT_DIRECT_PREREQUISITES,
    QUEST_KEYS,
    QUEST_STATE,
    type DesertTreasureQuestKey,
} from "../desertTreasureSeries/constants";

/** DESERTTREASUREVARBIT: four diamond and smoke-torch progression. */
export const VARP_DESERT_TREASURE_DIAMONDS = 441;

export const NPC = {
    asgarniaSmith: [12162, 12291],
    bartender: [687],
    eblis: [1966, 1967],
    rasolo: [679],
    malak: [686],
    ruantun: [3461],
    highPriest: [4062],
    trollChild: [1968],
    azzanadra: [1973],
} as const;

export const BOSS_NPC = {
    damisFirst: 682,
    damisSecond: 683,
    dessous: 3459,
    kamil: 3458,
    fareed: 3456,
} as const;

export const ITEM = {
    coins: 995,
    etchings: 4654,
    translation: 4655,
    warmKey: 4656,
    ringOfVisibility: 4657,
    silverPot: 4658,
    blessedPot: 4667,
    garlicPowder: 4668,
    garlic: 1550,
    pestleAndMortar: 233,
    bloodDiamond: 4670,
    iceDiamond: 4671,
    smokeDiamond: 4672,
    shadowDiamond: 4673,
    gildedCross: 4674,
    ancientStaff: 4675,
    banditsBrew: 4627,
    cake: 1891,
    spikedBoots: 3107,
    magicLogs: 1513,
    steelBar: 2353,
    moltenGlass: 1775,
    ashes: 592,
    charcoal: 973,
    bloodRune: 565,
    bones: 526,
    silverBar: 2355,
    spice: 2007,
    tinderbox: 590,
    lockpick: 1523,
    facemask: 4164,
} as const;

export const LOC = {
    smokeTorches: [6405, 6407, 6409, 6411],
    smokeChest: 6420,
    banditChest: 6448,
    fareedGate: 6452,
    diamondObelisks: {
        blood: 6482,
        ice: 6485,
        smoke: 6488,
        shadow: 6491,
    },
} as const;

export const EBLIS_SUPPLIES: QuestItemRequirement[] = [
    { itemId: ITEM.ashes, quantity: 1, journalLabel: "Ashes" },
    { itemId: ITEM.bloodRune, quantity: 1, journalLabel: "A blood rune" },
    { itemId: ITEM.bones, quantity: 1, journalLabel: "Bones" },
    { itemId: ITEM.charcoal, quantity: 1, journalLabel: "Charcoal" },
    { itemId: ITEM.moltenGlass, quantity: 6, journalLabel: "6 molten glass" },
    { itemId: ITEM.magicLogs, quantity: 12, journalLabel: "12 magic logs" },
    { itemId: ITEM.steelBar, quantity: 6, journalLabel: "6 steel bars" },
];
