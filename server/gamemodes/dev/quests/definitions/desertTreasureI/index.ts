import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { registerQuestDeathHandlers } from "../desertTreasureSeries/runtime";
import { ITEM, QUEST_KEYS, QUEST_STATE } from "./constants";
import { registerDesertTreasureIInteractions } from "./interactions";
import { buildDesertTreasureIJournal } from "./journal";

export const desertTreasureIQuest: QuestDefinition = {
    key: QUEST_KEYS.desertTreasure,
    name: "Desert Treasure I",
    members: true,
    varpId: QUEST_STATE[QUEST_KEYS.desertTreasure].varpId,
    startedValue: 1,
    completionValue: QUEST_STATE[QUEST_KEYS.desertTreasure].completionValue,
    rewards: {
        questPoints: 3,
        xp: [{ skillId: SkillId.Magic, amount: 20000, label: "Magic" }],
        other: [
            "Access to the Ancient Magicks spellbook",
            "The ability to purchase an Ancient staff",
            "Access to the Smoke Dungeon",
        ],
    },
    rewardItemId: ITEM.ancientStaff,
    overviewStartText:
        "speaking to the <col=800000>Asgarnia Smith<col=000080> at the Bedabin Camp.",
    buildJournal: buildDesertTreasureIJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerDesertTreasureIInteractions(desertTreasureIQuest, registry, services);
        registerQuestDeathHandlers(services);
    },
};

export { QUEST_KEYS } from "./constants";
