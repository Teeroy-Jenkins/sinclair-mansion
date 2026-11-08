import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    HOLY_GRAIL_QUEST_KEY,
    ITEM,
    MERLINS_CRYSTAL_COMPLETE,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_HOLY_GRAIL,
    VARP_MERLINS_CRYSTAL,
} from "./constants";
import { registerHolyGrailInteractions } from "./interactions";
import { buildHolyGrailJournal } from "./journal";

export const holyGrailQuest: QuestDefinition = {
    key: HOLY_GRAIL_QUEST_KEY,
    name: "Holy Grail",
    members: true,
    varpId: VARP_HOLY_GRAIL,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: {
        skills: [{ skillId: SkillId.Attack, level: 20, label: "Attack" }],
        quests: [{ varpId: VARP_MERLINS_CRYSTAL, minValue: MERLINS_CRYSTAL_COMPLETE, label: "Merlin's Crystal" }],
    },
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Prayer, amount: 11_000, label: "Prayer" },
            { skillId: SkillId.Defence, amount: 15_300, label: "Defence" },
        ],
        other: ["Access to the Fisher Realm"],
    },
    rewardItemId: ITEM.holyGrail,
    overviewStartText: "speaking to <col=800000>King Arthur<col=000080> in Camelot.",
    buildJournal(player, services): string[] {
        return buildHolyGrailJournal(player, services, holyGrailQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerHolyGrailInteractions(holyGrailQuest, registry, services);
    },
};
