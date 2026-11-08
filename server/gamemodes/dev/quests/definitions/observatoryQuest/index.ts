import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { ITEM, STAGE, VARP_OBSERVATORY_QUEST } from "./constants";
import { registerObservatoryQuestInteractions } from "./interactions";
import { buildObservatoryQuestJournal } from "./journal";

export const observatoryQuest: QuestDefinition = {
    key: "observatory_quest",
    name: "Observatory Quest",
    members: true,
    varpId: VARP_OBSERVATORY_QUEST,
    startedValue: STAGE.planks,
    completionValue: STAGE.complete,
    requirements: { skills: [{ skillId: SkillId.Crafting, level: 10, label: "Crafting" }] },
    rewards: {
        questPoints: 2,
        xp: [{ skillId: SkillId.Crafting, amount: 2_250, label: "Crafting" }],
        items: [{ itemId: ITEM.uncutSapphire, quantity: 1, label: "An uncut sapphire" }],
        other: ["A random reward based on the observed constellation"],
    },
    rewardItemId: ITEM.uncutSapphire,
    overviewStartText: "speaking to the <col=800000>Observatory professor<col=000080> south-west of Ardougne.",
    buildJournal(player, services): string[] {
        return buildObservatoryQuestJournal(player, services, observatoryQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerObservatoryQuestInteractions(observatoryQuest, registry, services);
    },
};
