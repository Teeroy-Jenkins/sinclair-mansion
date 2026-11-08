import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    PIRATES_TREASURE_QUEST_KEY,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_PIRATES_TREASURE,
} from "./constants";
import { registerPiratesTreasureInteractions } from "./interactions";
import { buildPiratesTreasureJournal } from "./journal";

export { PIRATES_TREASURE_QUEST_KEY } from "./constants";

export const piratesTreasureQuest: QuestDefinition = {
    key: PIRATES_TREASURE_QUEST_KEY,
    name: "Pirate's Treasure",
    varpId: VARP_PIRATES_TREASURE,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 2,
        items: [
            { itemId: ITEM.coins, quantity: 450, label: "450 Coins" },
            { itemId: ITEM.ring, quantity: 1, label: "A Gold ring" },
            { itemId: ITEM.emerald, quantity: 1, label: "An Emerald" },
        ],
    },
    rewardItemId: ITEM.emerald,
    overviewStartText:
        "speaking to <col=800000>Redbeard Frank<col=000080> at <col=800000>Port Sarim<col=000080>.",
    buildJournal: buildPiratesTreasureJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerPiratesTreasureInteractions(piratesTreasureQuest, registry, services);
    },
};
