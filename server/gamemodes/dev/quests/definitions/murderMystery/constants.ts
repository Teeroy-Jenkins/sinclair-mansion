export const MURDER_MYSTERY_QUEST_KEY = "murder_mystery";

export const VARP_MURDER_MYSTERY = 192;
export const VARP_POISON_PROOF = 193;
export const VARP_MURDER_EVIDENCE = 194;
export const VARP_MURDERER = 195;

export const STAGE_NOT_STARTED = 0;
export const STAGE_STARTED = 1;
export const STAGE_COMPLETE = 2;

export const POISON_NOT_STARTED = 0;
export const POISON_SALESMAN_QUESTIONED = 1;
export const POISON_MURDERER_QUESTIONED = 2;
export const POISON_LOCATION_CHECKED = 3;

export const EVIDENCE_THREAD = 1 << 1;
export const EVIDENCE_FINGERPRINTS = 1 << 2;

export const ITEM = {
    silverNecklace: 1796,
    dustedNecklace: 1797,
    silverCup: 1798,
    dustedCup: 1799,
    silverBottle: 1800,
    dustedBottle: 1801,
    silverBook: 1802,
    dustedBook: 1803,
    silverNeedle: 1804,
    dustedNeedle: 1805,
    silverPot: 1806,
    dustedSilverPot: 1807,
    redThread: 1808,
    greenThread: 1809,
    blueThread: 1810,
    flypaper: 1811,
    pungentPot: 1812,
    dagger: 1813,
    dustedDagger: 1814,
    killersPrint: 1815,
    annaPrint: 1816,
    bobPrint: 1817,
    carolPrint: 1818,
    davidPrint: 1819,
    elizabethPrint: 1820,
    frankPrint: 1821,
    unknownPrint: 1822,
    emptyPot: 1931,
    potOfFlour: 1933,
    coins: 995,
} as const;

export const LOC = {
    compost: [2650, 26120] as const,
    beehive: [2651, 26121] as const,
    drain: [2652] as const,
    spidersNest: [2653, 26109] as const,
    fountain: [2654] as const,
    crest: [2655] as const,
    suspectBarrels: [2656, 2657, 2658, 2659, 2660, 2661] as const,
    flourBarrel: [2662, 26122] as const,
    flypaperSacks: 2663,
    dogGates: [2664, 2665] as const,
    smashedWindow: [2666, 26110, 26111, 26112, 26123] as const,
} as const;

export const NPC = {
    guard: [6194, 4218] as const,
    gossip: 4219,
    poisonSalesman: 4227,
    anna: 6195,
    bob: 6196,
    carol: 6197,
    david: 6198,
    elizabeth: 6199,
    frank: 6200,
    donovan: 4212,
    pierre: 4213,
    hobbes: 4214,
    louisa: 4215,
    mary: 4216,
    stanford: 4217,
} as const;

export type MurdererDefinition = {
    id: number;
    name: string;
    npcId: number;
    barrelId: number;
    originalItem: number;
    dustedItem: number;
    printItem: number;
    threadItem: number;
    poisonLocIds: readonly number[];
    poisonTarget: string;
    alibi: string;
};

export const MURDERERS: readonly MurdererDefinition[] = [
    { id: 1, name: "Anna", npcId: NPC.anna, barrelId: 2656, originalItem: ITEM.silverNecklace, dustedItem: ITEM.dustedNecklace, printItem: ITEM.annaPrint, threadItem: ITEM.greenThread, poisonLocIds: LOC.compost, poisonTarget: "compost heap", alibi: "I was alone in the library." },
    { id: 2, name: "Bob", npcId: NPC.bob, barrelId: 2657, originalItem: ITEM.silverCup, dustedItem: ITEM.dustedCup, printItem: ITEM.bobPrint, threadItem: ITEM.redThread, poisonLocIds: LOC.beehive, poisonTarget: "beehive", alibi: "I was walking alone in the garden." },
    { id: 3, name: "Carol", npcId: NPC.carol, barrelId: 2658, originalItem: ITEM.silverBottle, dustedItem: ITEM.dustedBottle, printItem: ITEM.carolPrint, threadItem: ITEM.redThread, poisonLocIds: LOC.drain, poisonTarget: "drain", alibi: "I was alone in my room." },
    { id: 4, name: "David", npcId: NPC.david, barrelId: 2659, originalItem: ITEM.silverBook, dustedItem: ITEM.dustedBook, printItem: ITEM.davidPrint, threadItem: ITEM.greenThread, poisonLocIds: LOC.spidersNest, poisonTarget: "spiders' nest", alibi: "Where I was is none of your business." },
    { id: 5, name: "Elizabeth", npcId: NPC.elizabeth, barrelId: 2660, originalItem: ITEM.silverNeedle, dustedItem: ITEM.dustedNeedle, printItem: ITEM.elizabethPrint, threadItem: ITEM.blueThread, poisonLocIds: LOC.fountain, poisonTarget: "fountain", alibi: "I was out. I do not have to justify myself to you." },
    { id: 6, name: "Frank", npcId: NPC.frank, barrelId: 2661, originalItem: ITEM.silverPot, dustedItem: ITEM.dustedSilverPot, printItem: ITEM.frankPrint, threadItem: ITEM.blueThread, poisonLocIds: LOC.crest, poisonTarget: "family crest", alibi: "I was somewhere around here, probably." },
] as const;

export const CRIME_SCENE_TILE = { x: 2748, y: 3578, level: 0 } as const;
