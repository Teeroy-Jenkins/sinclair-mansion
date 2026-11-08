import type { QuestItemRequirement } from "../../types";

export const NPC = {
    denulth: [4083],
    eohric: [4103],
    harold: [4101],
    saba: [4093],
    tenzing: [4094],
    dunstan: [4105],
} as const;

export const ITEM = {
    coins: 995,
    bread: 2309,
    trout: 333,
    ironBar: 2351,
    asgarnianAle: 1905,
    blurberrySpecial: 2064,
    steelClaws: 3097,
    combination: 3102,
    iou: 3103,
    secretWayMap: 3104,
    climbingBoots: 3105,
    spikedBoots: 3107,
    certificate: 3114,
} as const;

export const REQUIRED_SUPPLIES: QuestItemRequirement[] = [
    { itemId: ITEM.bread, quantity: 10, journalLabel: "10 loaves of bread" },
    { itemId: ITEM.trout, quantity: 10, journalLabel: "10 cooked trout" },
];
