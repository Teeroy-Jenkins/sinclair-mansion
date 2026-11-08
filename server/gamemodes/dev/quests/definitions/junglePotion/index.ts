import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    DRUIDIC_RITUAL_COMPLETE,
    JUNGLE_POTION_QUEST_KEY,
    REWARD_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_GET_SNAKE_WEED,
    VARP_DRUIDIC_RITUAL,
    VARP_JUNGLE_POTION,
} from "./constants";
import { registerJunglePotionInteractions } from "./interactions";
import { buildJunglePotionJournal } from "./journal";

export { JUNGLE_POTION_QUEST_KEY } from "./constants";

export const junglePotionQuest: QuestDefinition = {
    key: JUNGLE_POTION_QUEST_KEY,
    name: "Jungle Potion",
    members: true,
    varpId: VARP_JUNGLE_POTION,
    startedValue: STAGE_GET_SNAKE_WEED,
    completionValue: STAGE_COMPLETE,
    requirements: {
        quests: [
            {
                varpId: VARP_DRUIDIC_RITUAL,
                minValue: DRUIDIC_RITUAL_COMPLETE,
                label: "Druidic Ritual",
            },
        ],
    },
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Herblore, amount: 775, label: "Herblore" }],
    },
    rewardItemId: REWARD_ITEM_ID,
    overviewStartText:
        "speaking to <col=800000>Trufitus Shakaya<col=000080> in <col=800000>Tai Bwo Wannai<col=000080>.",
    buildJournal: buildJunglePotionJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerJunglePotionInteractions(junglePotionQuest, registry, services);
    },
};
