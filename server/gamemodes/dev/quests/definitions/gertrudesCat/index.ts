import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    GERTRUDES_CAT_QUEST_KEY,
    ITEM,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_GERTRUDES_CAT,
} from "./constants";
import { registerGertrudesCatInteractions } from "./interactions";
import { buildGertrudesCatJournal } from "./journal";

export { GERTRUDES_CAT_QUEST_KEY } from "./constants";

export const gertrudesCatQuest: QuestDefinition = {
    key: GERTRUDES_CAT_QUEST_KEY,
    name: "Gertrude's Cat",
    members: true,
    varpId: VARP_GERTRUDES_CAT,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Cooking, amount: 1525, label: "Cooking" }],
        items: [
            { itemId: ITEM.petKitten, quantity: 1, label: "A pet kitten" },
            { itemId: ITEM.cake, quantity: 1, label: "A Chocolate cake" },
            { itemId: ITEM.stew, quantity: 1, label: "A bowl of stew" },
        ],
        other: ["The ability to raise cats"],
    },
    rewardItemId: ITEM.petKitten,
    overviewStartText:
        "speaking to <col=800000>Gertrude<col=000080> west of <col=800000>Varrock<col=000080>.",
    buildJournal: buildGertrudesCatJournal,
    register(registry: IScriptRegistry, _services: ScriptServices): void {
        registerGertrudesCatInteractions(gertrudesCatQuest, registry);
    },
};
