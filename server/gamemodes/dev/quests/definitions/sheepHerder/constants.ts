export const SHEEP_HERDER_QUEST_KEY = "sheep_herder";
export const VARP_SHEEP_HERDER = 60;
export const VARP_SHEEP_DISPOSAL = 61;

export const STAGE_NOT_STARTED = 0;
export const STAGE_NEEDS_PROTECTIVE_CLOTHING = 1;
export const STAGE_DISPOSING_SHEEP = 2;
export const STAGE_COMPLETE = 3;

export const ITEM = {
    cattleprod: 278,
    sheepFeed: 279,
    redBones: 280,
    greenBones: 281,
    blueBones: 282,
    yellowBones: 283,
    plagueJacket: 284,
    plagueTrousers: 285,
    coins: 995,
} as const;

export const NPC = {
    doctorOrbon: 3984,
    farmerBrumty: 3985,
    redSheep: 3986,
    greenSheep: 3987,
    blueSheep: 3988,
    yellowSheep: 3989,
    councillorHalgrive: [8765, 8802, 4578] as const,
} as const;

export const LOC = {
    incinerator: 165,
    enclosureGates: [166, 167] as const,
} as const;

export const SHEEP = [
    {
        npcId: NPC.redSheep,
        name: "Red Sheep",
        bonesItemId: ITEM.redBones,
        startBit: 1,
        start: { x: 2605, y: 3343, level: 0 },
        pen: { x: 2596, y: 3362, level: 0 },
    },
    {
        npcId: NPC.greenSheep,
        name: "Green Sheep",
        bonesItemId: ITEM.greenBones,
        startBit: 4,
        start: { x: 2616, y: 3348, level: 0 },
        pen: { x: 2597, y: 3363, level: 0 },
    },
    {
        npcId: NPC.blueSheep,
        name: "Blue Sheep",
        bonesItemId: ITEM.blueBones,
        startBit: 7,
        start: { x: 2612, y: 3371, level: 0 },
        pen: { x: 2597, y: 3360, level: 0 },
    },
    {
        npcId: NPC.yellowSheep,
        name: "Yellow Sheep",
        bonesItemId: ITEM.yellowBones,
        startBit: 10,
        start: { x: 2583, y: 3374, level: 0 },
        pen: { x: 2596, y: 3359, level: 0 },
    },
] as const;

export const SHEEP_FARM_ZONE = {
    id: "sheep_herder_farm",
    minX: 2576,
    maxX: 2624,
    minY: 3336,
    maxY: 3380,
    levels: [0],
} as const;
