import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { BIOHAZARD_QUEST_KEY, STAGE_COMPLETE, STAGE_STARTED, VARP_BIOHAZARD } from "./constants";
import { registerBiohazardInteractions } from "./interactions";
import { buildBiohazardJournal } from "./journal";

export const biohazardQuest: QuestDefinition = {
    key: BIOHAZARD_QUEST_KEY,
    name: "Biohazard",
    members: true,
    varpId: VARP_BIOHAZARD,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: {
        quests: [{ varpId: 165, minValue: 29, label: "Plague City" }],
    },
    rewards: {
        questPoints: 3,
        xp: [{ skillId: SkillId.Thieving, amount: 1_250, label: "Thieving" }],
        other: ["Access to the Combat Training Camp", "Free passage through West Ardougne's gate"],
    },
    overviewStartText: "speaking to <col=800000>Elena<col=000080> in East Ardougne after Plague City.",
    buildJournal: buildBiohazardJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerBiohazardInteractions(biohazardQuest, registry, services);
    },
};

