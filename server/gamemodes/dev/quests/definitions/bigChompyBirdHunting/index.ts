import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    BIG_CHOMPY_BIRD_HUNTING_QUEST_KEY,
    ITEM,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_CHOMPY_BIRD,
} from "./constants";
import { registerBigChompyBirdHuntingInteractions } from "./interactions";
import { buildBigChompyBirdHuntingJournal } from "./journal";

export const bigChompyBirdHuntingQuest: QuestDefinition = {
    key: BIG_CHOMPY_BIRD_HUNTING_QUEST_KEY,
    name: "Big Chompy Bird Hunting",
    members: true,
    varpId: VARP_CHOMPY_BIRD,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: {
        skills: [
            { skillId: SkillId.Fletching, level: 5, label: "Fletching" },
            { skillId: SkillId.Ranged, level: 30, label: "Ranged" },
            { skillId: SkillId.Cooking, level: 30, label: "Cooking" },
        ],
    },
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Fletching, amount: 262, label: "Fletching" },
            { skillId: SkillId.Cooking, amount: 1_470, label: "Cooking" },
            { skillId: SkillId.Ranged, amount: 735, label: "Ranged" },
        ],
        other: ["Ability to hunt chompy birds", "Chompy bird hats from Rantz"],
    },
    rewardItemId: ITEM.ogreBow,
    overviewStartText: "speaking to <col=800000>Rantz<col=000080> in the eastern Feldip Hills.",
    buildJournal: buildBigChompyBirdHuntingJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerBigChompyBirdHuntingInteractions(bigChompyBirdHuntingQuest, registry, services);
    },
};
