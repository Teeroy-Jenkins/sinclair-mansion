import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    GOBLIN_DIPLOMACY_QUEST_KEY,
    GOLD_BAR_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_GOBLIN_DIPLOMACY,
} from "./constants";
import { registerGoblinDiplomacyInteractions } from "./interactions";
import { buildGoblinDiplomacyJournal } from "./journal";

export { GOBLIN_DIPLOMACY_QUEST_KEY } from "./constants";

export const goblinDiplomacyQuest: QuestDefinition = {
    key: GOBLIN_DIPLOMACY_QUEST_KEY,
    name: "Goblin Diplomacy",
    varpId: VARP_GOBLIN_DIPLOMACY,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 5,
        xp: [{ skillId: SkillId.Crafting, amount: 200, label: "Crafting" }],
        items: [{ itemId: GOLD_BAR_ITEM_ID, quantity: 1, label: "A Gold bar" }],
    },
    rewardItemId: GOLD_BAR_ITEM_ID,
    overviewStartText:
        "speaking to one of the <col=800000>Goblin Generals<col=000080> in <col=800000>Goblin Village<col=000080>.",
    buildJournal: buildGoblinDiplomacyJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerGoblinDiplomacyInteractions(goblinDiplomacyQuest, registry, services);
    },
};
