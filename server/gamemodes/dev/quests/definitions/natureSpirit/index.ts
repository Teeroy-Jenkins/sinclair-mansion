import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { ITEM, NATURE_SPIRIT_QUEST_KEY, STAGE_COMPLETE, STAGE_STARTED, VARP_NATURE_SPIRIT } from "./constants";
import { registerNatureSpiritInteractions } from "./interactions";
import { buildNatureSpiritJournal } from "./journal";

export const natureSpiritQuest: QuestDefinition = {
    key: NATURE_SPIRIT_QUEST_KEY,
    name: "Nature Spirit",
    members: true,
    varpId: VARP_NATURE_SPIRIT,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: { quests: [{ varpId: 302, minValue: 60, label: "Priest in Peril" }] },
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Crafting, amount: 3_000, label: "Crafting" },
            { skillId: SkillId.Hitpoints, amount: 2_000, label: "Hitpoints" },
            { skillId: SkillId.Defence, amount: 2_000, label: "Defence" },
        ],
        other: ["An altar of nature", "Ability to fight Ghasts", "Access to Mort Myre swamp produce"],
    },
    rewardItemId: ITEM.silverSickleBlessed,
    overviewStartText: "speaking to <col=800000>Drezel<col=000080> beneath the Paterdomus temple.",
    buildJournal: buildNatureSpiritJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerNatureSpiritInteractions(natureSpiritQuest, registry, services);
    },
};

