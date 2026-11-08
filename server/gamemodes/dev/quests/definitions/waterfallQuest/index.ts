import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import { ITEM } from "./constants";
import { registerWaterfallQuestInteractions } from "./interactions";
import { buildWaterfallQuestJournal } from "./journal";

export const waterfallQuest: QuestDefinition = {
    key: QUEST_KEYS.waterfall,
    name: "Waterfall Quest",
    members: true,
    varpId: QUEST_STATE[QUEST_KEYS.waterfall].varpId,
    startedValue: 1,
    completionValue: QUEST_STATE[QUEST_KEYS.waterfall].completionValue,
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Attack, amount: 13750, label: "Attack" },
            { skillId: SkillId.Strength, amount: 13750, label: "Strength" },
        ],
        items: [
            { itemId: ITEM.diamond, quantity: 2, label: "2 Diamonds" },
            { itemId: ITEM.goldBar, quantity: 2, label: "2 Gold bars" },
            { itemId: ITEM.mithrilSeeds, quantity: 40, label: "40 Mithril seeds" },
        ],
        other: ["Access to the Waterfall Dungeon"],
    },
    rewardItemId: ITEM.glarialsUrnFull,
    overviewStartText: "speaking to <col=800000>Almera<col=000080> beside Baxtorian Falls.",
    buildJournal: buildWaterfallQuestJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerWaterfallQuestInteractions(waterfallQuest, registry, services);
    },
};
