import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOST_CITY_QUEST_KEY,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_LOST_CITY,
} from "./constants";
import { registerLostCityInteractions } from "./interactions";
import { buildLostCityJournal } from "./journal";

export { LOST_CITY_QUEST_KEY } from "./constants";

export const lostCityQuest: QuestDefinition = {
    key: LOST_CITY_QUEST_KEY,
    name: "Lost City",
    members: true,
    varpId: VARP_LOST_CITY,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: {
        skills: [
            { skillId: SkillId.Crafting, level: 31, label: "Crafting" },
            { skillId: SkillId.Woodcutting, level: 36, label: "Woodcutting" },
        ],
    },
    rewards: {
        questPoints: 3,
        other: ["Access to Zanaris", "Ability to wield a Dramen staff"],
    },
    rewardItemId: ITEM.dramenStaff,
    overviewStartText: "speaking to the <col=800000>adventurers<col=000080> in Lumbridge Swamp.",
    buildJournal(player, services): string[] {
        return buildLostCityJournal(player, services, lostCityQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerLostCityInteractions(lostCityQuest, registry, services);
    },
};
