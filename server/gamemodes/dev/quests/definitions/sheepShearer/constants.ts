import type { QuestItemRequirement } from "../../types";

export const SHEEP_SHEARER_KEY = "sheep_shearer";

export const FRED_THE_FARMER_NPC_ID = 732;

export const VARP_SHEEP_SHEARER = 179;
export const STAGE_STARTED = 1;
export const STAGE_COMPLETE = 21;

export const BALL_OF_WOOL_ITEM_ID = 1759;
export const WOOL_ITEM_ID = 1737;
export const SHEARS_ITEM_ID = 1735;
export const COINS_ITEM_ID = 995;
export const STRANGE_SHEEP_NPC_ID = 731;
export const TOTAL_BALLS_OF_WOOL = 20;

export const REQUIRED_ITEMS: QuestItemRequirement[] = [
    { itemId: BALL_OF_WOOL_ITEM_ID, quantity: TOTAL_BALLS_OF_WOOL, journalLabel: "20 Balls of wool" },
];

export function getDeliveredWool(stage: number): number {
    if (stage <= STAGE_STARTED) return 0;
    if (stage >= STAGE_COMPLETE) return TOTAL_BALLS_OF_WOOL;
    return stage - STAGE_STARTED;
}

export function getRemainingWool(stage: number): number {
    return TOTAL_BALLS_OF_WOOL - getDeliveredWool(stage);
}
