import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_WITCHS_HOUSE,
    WITCHS_HOUSE_QUEST_KEY,
} from "./constants";
import { registerWitchsHouseInteractions } from "./interactions";
import { buildWitchsHouseJournal } from "./journal";

export { WITCHS_HOUSE_QUEST_KEY } from "./constants";

export const witchsHouseQuest: QuestDefinition = {
    key: WITCHS_HOUSE_QUEST_KEY,
    name: "Witch's House",
    members: true,
    varpId: VARP_WITCHS_HOUSE,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 4,
        xp: [{ skillId: SkillId.Hitpoints, amount: 6325, label: "Hitpoints" }],
    },
    rewardItemId: ITEM.ball,
    overviewStartText:
        "speaking to the <col=800000>boy<col=000080> beside the long garden north of <col=800000>Taverley<col=000080>.",
    buildJournal(player, services): string[] {
        return buildWitchsHouseJournal(player, services, witchsHouseQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerWitchsHouseInteractions(witchsHouseQuest, registry, services);
    },
};
