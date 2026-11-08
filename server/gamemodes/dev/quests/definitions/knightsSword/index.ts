import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    KNIGHTS_SWORD_QUEST_KEY,
    STAGE_COMPLETE,
    STAGE_FIND_RELDO,
    VARP_KNIGHTS_SWORD,
} from "./constants";
import { registerKnightsSwordInteractions } from "./interactions";
import { buildKnightsSwordJournal } from "./journal";

export { KNIGHTS_SWORD_QUEST_KEY } from "./constants";

export const knightsSwordQuest: QuestDefinition = {
    key: KNIGHTS_SWORD_QUEST_KEY,
    name: "The Knight's Sword",
    varpId: VARP_KNIGHTS_SWORD,
    startedValue: STAGE_FIND_RELDO,
    completionValue: STAGE_COMPLETE,
    requirements: {
        skills: [{ skillId: SkillId.Mining, level: 10, label: "Mining" }],
    },
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Smithing, amount: 12725, label: "Smithing" }],
    },
    rewardItemId: ITEM.bluriteSword,
    overviewStartText:
        "speaking to the <col=800000>Squire<col=000080> in the courtyard of the <col=800000>White Knights' Castle<col=000080>.",
    buildJournal(player, services): string[] {
        return buildKnightsSwordJournal(player, services, knightsSwordQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerKnightsSwordInteractions(knightsSwordQuest, registry, services);
    },
};
