import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    HAZEEL_CULT_QUEST_KEY,
    ITEM,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_HAZEEL_CULT,
} from "./constants";
import { registerHazeelCultInteractions } from "./interactions";
import { buildHazeelCultJournal } from "./journal";

export const hazeelCultQuest: QuestDefinition = {
    key: HAZEEL_CULT_QUEST_KEY,
    name: "Hazeel Cult",
    members: true,
    varpId: VARP_HAZEEL_CULT,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Thieving, amount: 1_500, label: "Thieving" }],
        items: [{ itemId: ITEM.coins, quantity: 2_000, label: "Coins" }],
        other: ["A permanent choice between the Carnillean family and the Cult of Hazeel"],
    },
    rewardItemId: ITEM.coins,
    overviewStartText: "speaking to <col=800000>Ceril Carnillean<col=000080> in the Carnillean Mansion.",
    buildJournal(player, services): string[] {
        return buildHazeelCultJournal(player, services, hazeelCultQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerHazeelCultInteractions(hazeelCultQuest, registry, services);
    },
};
