import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    COINS_ITEM_ID,
    DORICS_QUEST_KEY,
    STAGE_COMPLETE,
    STAGE_STARTED,
    STEEL_PICKAXE_ITEM_ID,
    VARP_DORICS_QUEST,
} from "./constants";
import { registerDoricInteractions } from "./interactions";
import { buildDoricJournal } from "./journal";

export { DORICS_QUEST_KEY } from "./constants";

export const doricsQuest: QuestDefinition = {
    key: DORICS_QUEST_KEY,
    name: "Doric's Quest",
    varpId: VARP_DORICS_QUEST,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Mining, amount: 1300, label: "Mining" }],
        items: [{ itemId: COINS_ITEM_ID, quantity: 180, label: "180 Coins" }],
        other: ["Use of Doric's anvils"],
    },
    rewardItemId: STEEL_PICKAXE_ITEM_ID,
    overviewStartText:
        "talking to <col=800000>Doric<col=000080> at his home north of <col=800000>Falador<col=000080>.",
    buildJournal: buildDoricJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerDoricInteractions(doricsQuest, registry, services);
    },
};
