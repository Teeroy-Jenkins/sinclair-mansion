import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    BLACK_KNIGHTS_FORTRESS_QUEST_KEY,
    COINS_ITEM_ID,
    REQUIRED_QUEST_POINTS,
    STAGE_COMPLETE,
    STAGE_INVESTIGATE,
    VARP_BLACK_KNIGHTS_FORTRESS,
} from "./constants";
import { registerBlackKnightsFortressInteractions } from "./interactions";
import { buildBlackKnightsFortressJournal } from "./journal";

export { BLACK_KNIGHTS_FORTRESS_QUEST_KEY } from "./constants";

export const blackKnightsFortressQuest: QuestDefinition = {
    key: BLACK_KNIGHTS_FORTRESS_QUEST_KEY,
    name: "Black Knights' Fortress",
    varpId: VARP_BLACK_KNIGHTS_FORTRESS,
    startedValue: STAGE_INVESTIGATE,
    completionValue: STAGE_COMPLETE,
    requirements: { questPoints: REQUIRED_QUEST_POINTS },
    rewards: {
        questPoints: 3,
        items: [{ itemId: COINS_ITEM_ID, quantity: 2500, label: "2,500 Coins" }],
    },
    rewardItemId: COINS_ITEM_ID,
    overviewStartText:
        "speaking to <col=800000>Sir Amik Varze<col=000080> in <col=800000>Falador Castle<col=000080>.",
    buildJournal: buildBlackKnightsFortressJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerBlackKnightsFortressInteractions(blackKnightsFortressQuest, registry, services);
    },
};
