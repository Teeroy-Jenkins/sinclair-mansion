import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VAMPYRE_SLAYER_QUEST_KEY,
    VARP_VAMPYRE_SLAYER,
} from "./constants";
import { registerVampyreSlayerInteractions } from "./interactions";
import { buildVampyreSlayerJournal } from "./journal";

export { VAMPYRE_SLAYER_QUEST_KEY } from "./constants";

export const vampyreSlayerQuest: QuestDefinition = {
    key: VAMPYRE_SLAYER_QUEST_KEY,
    name: "Vampyre Slayer",
    varpId: VARP_VAMPYRE_SLAYER,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 3,
        xp: [{ skillId: SkillId.Attack, amount: 4825, label: "Attack" }],
    },
    rewardItemId: ITEM.stake,
    overviewStartText:
        "speaking to <col=800000>Morgan<col=000080> in <col=800000>Draynor Village<col=000080>.",
    buildJournal: buildVampyreSlayerJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerVampyreSlayerInteractions(vampyreSlayerQuest, registry, services);
    },
};
