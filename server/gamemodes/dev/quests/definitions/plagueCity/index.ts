import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    PLAGUE_CITY_QUEST_KEY,
    STAGE_COMPLETE,
    STAGE_FIND_DWELLBERRIES,
    VARP_PLAGUE_CITY,
} from "./constants";
import { registerPlagueCityInteractions } from "./interactions";
import { buildPlagueCityJournal } from "./journal";

export { PLAGUE_CITY_QUEST_KEY } from "./constants";

export const plagueCityQuest: QuestDefinition = {
    key: PLAGUE_CITY_QUEST_KEY,
    name: "Plague City",
    varpId: VARP_PLAGUE_CITY,
    startedValue: STAGE_FIND_DWELLBERRIES,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Mining, amount: 2425, label: "Mining" }],
        items: [{ itemId: ITEM.ardougneTeleportScroll, quantity: 1, label: "Magic scroll" }],
        other: ["Access to the Ardougne Teleport spell after reading the scroll"],
    },
    rewardItemId: ITEM.gasMask,
    overviewStartText:
        "speaking to <col=800000>Edmond<col=000080> behind his house in <col=800000>East Ardougne<col=000080>.",
    buildJournal(player, services): string[] {
        return buildPlagueCityJournal(player, services, plagueCityQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerPlagueCityInteractions(plagueCityQuest, registry, services);
    },
};

