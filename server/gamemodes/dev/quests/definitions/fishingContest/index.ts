import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    FISHING_CONTEST_QUEST_KEY,
    ITEM,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_FISHING_CONTEST,
} from "./constants";
import { registerFishingContestInteractions } from "./interactions";
import { buildFishingContestJournal } from "./journal";

export { FISHING_CONTEST_QUEST_KEY } from "./constants";

export const fishingContestQuest: QuestDefinition = {
    key: FISHING_CONTEST_QUEST_KEY,
    name: "Fishing Contest",
    members: true,
    varpId: VARP_FISHING_CONTEST,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: {
        skills: [{ skillId: SkillId.Fishing, level: 10, label: "Fishing" }],
    },
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Fishing, amount: 2437.5, label: "Fishing" }],
        other: ["Access to the White Wolf Mountain tunnel"],
    },
    rewardItemId: ITEM.trophy,
    overviewStartText:
        "speaking to <col=800000>Austri or Vestri<col=000080> at <col=800000>White Wolf Mountain<col=000080>.",
    buildJournal: buildFishingContestJournal,
    register(registry: IScriptRegistry, _services: ScriptServices): void {
        registerFishingContestInteractions(fishingContestQuest, registry);
    },
};
