import type { QuestItemRequirement } from "../../types";

export const IMP_CATCHER_QUEST_KEY = "imp_catcher";
export const WIZARD_MIZGOG_NPC_ID = 5005;

export const VARP_IMP_CATCHER = 160;
export const STAGE_STARTED = 1;
export const STAGE_COMPLETE = 2;

export const RED_BEAD_ITEM_ID = 1470;
export const YELLOW_BEAD_ITEM_ID = 1472;
export const BLACK_BEAD_ITEM_ID = 1474;
export const WHITE_BEAD_ITEM_ID = 1476;
export const AMULET_OF_ACCURACY_ITEM_ID = 1478;

export const REQUIRED_ITEMS: QuestItemRequirement[] = [
    { itemId: BLACK_BEAD_ITEM_ID, quantity: 1, journalLabel: "1 Black bead" },
    { itemId: RED_BEAD_ITEM_ID, quantity: 1, journalLabel: "1 Red bead" },
    { itemId: WHITE_BEAD_ITEM_ID, quantity: 1, journalLabel: "1 White bead" },
    { itemId: YELLOW_BEAD_ITEM_ID, quantity: 1, journalLabel: "1 Yellow bead" },
];
