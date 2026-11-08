import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { HEROES_QUEST_KEY, ITEM, STAGE_COMPLETE, STAGE_STARTED, VARP_HEROES_QUEST } from "./constants";
import { registerHeroesQuestInteractions } from "./interactions";
import { buildHeroesQuestJournal } from "./journal";

export const heroesQuest: QuestDefinition = {
    key: HEROES_QUEST_KEY,
    name: "Heroes' Quest",
    members: true,
    varpId: VARP_HEROES_QUEST,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: {
        questPoints: 55,
        skills: [
            { skillId: SkillId.Cooking, level: 53, label: "Cooking" },
            { skillId: SkillId.Fishing, level: 53, label: "Fishing" },
            { skillId: SkillId.Mining, level: 50, label: "Mining" },
            { skillId: SkillId.Herblore, level: 25, label: "Herblore" },
        ],
        quests: [
            { varpId: 147, minValue: 6, label: "Lost City" },
            { varpId: 176, minValue: 10, label: "Dragon Slayer I" },
            { varpId: 14, minValue: 7, label: "Merlin's Crystal" },
            { varpId: 145, minValue: 7, label: "Shield of Arrav" },
        ],
    },
    rewards: {
        questPoints: 1,
        xp: [
            { skillId: SkillId.Attack, amount: 3_075, label: "Attack" }, { skillId: SkillId.Defence, amount: 3_075, label: "Defence" },
            { skillId: SkillId.Strength, amount: 3_075, label: "Strength" }, { skillId: SkillId.Hitpoints, amount: 3_075, label: "Hitpoints" },
            { skillId: SkillId.Ranged, amount: 2_075, label: "Ranged" }, { skillId: SkillId.Fishing, amount: 2_725, label: "Fishing" },
            { skillId: SkillId.Cooking, amount: 2_825, label: "Cooking" }, { skillId: SkillId.Woodcutting, amount: 1_575, label: "Woodcutting" },
            { skillId: SkillId.Firemaking, amount: 1_575, label: "Firemaking" }, { skillId: SkillId.Smithing, amount: 2_275, label: "Smithing" },
            { skillId: SkillId.Mining, amount: 2_575, label: "Mining" }, { skillId: SkillId.Herblore, amount: 1_325, label: "Herblore" },
        ],
        other: ["Access to the Heroes' Guild", "Access to the Fountain of Heroes"],
    },
    rewardItemId: ITEM.thievesArmband,
    overviewStartText: "speaking to <col=800000>Achietties<col=000080> outside the Heroes' Guild.",
    buildJournal: buildHeroesQuestJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void { registerHeroesQuestInteractions(heroesQuest, registry, services); },
};
