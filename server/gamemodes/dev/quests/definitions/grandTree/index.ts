import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { GRAND_TREE_QUEST_KEY, ITEM, STAGE_COMPLETE, STAGE_STARTED, VARP_GRAND_TREE } from "./constants";
import { registerGrandTreeInteractions } from "./interactions";
import { buildGrandTreeJournal } from "./journal";

export const grandTreeQuest: QuestDefinition = {
    key: GRAND_TREE_QUEST_KEY,
    name: "The Grand Tree",
    members: true,
    varpId: VARP_GRAND_TREE,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: { skills: [{ skillId: SkillId.Agility, level: 25, label: "Agility" }] },
    rewards: {
        questPoints: 5,
        xp: [
            { skillId: SkillId.Attack, amount: 18_400, label: "Attack" },
            { skillId: SkillId.Agility, amount: 7_900, label: "Agility" },
            { skillId: SkillId.Magic, amount: 2_150, label: "Magic" },
        ],
        other: ["Access to the Grand Tree mine", "Gnome gliders", "Spirit Tree travel from the stronghold"],
    },
    rewardItemId: ITEM.daconiaRock,
    overviewStartText: "speaking to <col=800000>King Narnode Shareen<col=000080> in the Grand Tree.",
    buildJournal: buildGrandTreeJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void { registerGrandTreeInteractions(grandTreeQuest, registry, services); },
};
