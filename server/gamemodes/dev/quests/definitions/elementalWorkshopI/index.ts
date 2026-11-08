import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { BIT, ELEMENTAL_WORKSHOP_I_QUEST_KEY, ITEM, VARP_ELEMENTAL_WORKSHOP } from "./constants";
import { registerElementalWorkshopIInteractions } from "./interactions";
import { buildElementalWorkshopIJournal } from "./journal";

export const elementalWorkshopIQuest: QuestDefinition = {
    key: ELEMENTAL_WORKSHOP_I_QUEST_KEY,
    name: "Elemental Workshop I",
    members: true,
    varpId: VARP_ELEMENTAL_WORKSHOP,
    startedValue: BIT.readBook,
    completionValue: BIT.complete,
    requirements: {
        skills: [
            { skillId: SkillId.Mining, level: 20, label: "Mining" },
            { skillId: SkillId.Smithing, level: 20, label: "Smithing" },
            { skillId: SkillId.Crafting, level: 20, label: "Crafting" },
        ],
    },
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Crafting, amount: 5_000, label: "Crafting" },
            { skillId: SkillId.Smithing, amount: 5_000, label: "Smithing" },
        ],
        other: ["The ability to make elemental shields"],
    },
    rewardItemId: ITEM.elementalShield,
    overviewStartText: "reading a <col=800000>battered book<col=000080> found in Seers' Village.",
    buildJournal(player, services): string[] {
        return buildElementalWorkshopIJournal(player, services, elementalWorkshopIQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerElementalWorkshopIInteractions(elementalWorkshopIQuest, registry, services);
    },
};
