import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { DRAGON_SLAYER_I_QUEST_KEY, ITEM, STAGE_COMPLETE, STAGE_GUILDMASTER, VARP_DRAGON_SLAYER } from "./constants";
import { registerDragonSlayerIInteractions } from "./interactions";
import { buildDragonSlayerIJournal } from "./journal";

export const dragonSlayerIQuest: QuestDefinition = {
    key: DRAGON_SLAYER_I_QUEST_KEY,
    name: "Dragon Slayer I",
    members: false,
    varpId: VARP_DRAGON_SLAYER,
    startedValue: STAGE_GUILDMASTER,
    completionValue: STAGE_COMPLETE,
    requirements: { questPoints: 32 },
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Strength, amount: 18_650, label: "Strength" },
            { skillId: SkillId.Defence, amount: 18_650, label: "Defence" },
        ],
        other: ["The right to wear rune platebodies and green dragonhide bodies", "Access to Crandor"],
    },
    rewardItemId: ITEM.antiDragonShield,
    overviewStartText: "speaking to the <col=800000>Guildmaster<col=000080> in the Champions' Guild.",
    buildJournal: buildDragonSlayerIJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerDragonSlayerIInteractions(dragonSlayerIQuest, registry, services);
    },
};
