export const VARP_BARCRAWL = 77;

export const BARCRAWL_NOT_STARTED = 0;
export const BARCRAWL_STARTED = 1;
export const BARCRAWL_COMPLETE = 2;

export const BARCRAWL_CARD = 455;
export const COINS = 995;

export const BAR = {
    blueMoon: { bit: 3, npcIds: [1312], name: "Blue Moon Inn", drink: "Uncle Humphrey's Gutrot", cost: 50 },
    blurberry: { bit: 4, npcIds: [6531], name: "Blurberry's Bar", drink: "Fire Toad Blast", cost: 10 },
    deadMansChest: { bit: 5, npcIds: [1314], name: "Dead Man's Chest", drink: "Supergrog", cost: 15 },
    dragonInn: { bit: 6, npcIds: [1320], name: "Dragon Inn", drink: "Fire Brandy", cost: 12 },
    flyingHorse: { bit: 7, npcIds: [1319], name: "Flying Horse Inn", drink: "Heart Stopper", cost: 8 },
    forestersArms: { bit: 8, npcIds: [1318], name: "Forester's Arms", drink: "Liverbane Ale", cost: 18 },
    jollyBoar: { bit: 9, npcIds: [1310], name: "Jolly Boar Inn", drink: "Olde Suspiciouse", cost: 10 },
    karamjaSpirits: { bit: 10, npcIds: [3205], name: "Karamja Spirits", drink: "Ape Bite Liqueur", cost: 7 },
    risingSun: { bit: 11, npcIds: [1315, 1316, 1317], name: "Rising Sun", drink: "Hand of Death", cost: 70 },
    rustyAnchor: { bit: 12, npcIds: [1313], name: "Rusty Anchor", drink: "Black Skull Ale", cost: 8 },
} as const;

export const BARS = Object.values(BAR);
export const ALL_BARS_MASK = BARS.reduce((mask, bar) => mask | (1 << bar.bit), 0);

export const OUTPOST_GUARD_NPCS = [5227, 7285, 7724] as const;
export const OUTPOST_GATES = [2115, 2116] as const;
