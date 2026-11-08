import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    STAGE_COMPLETE,
    STAGE_STARTED,
    TRIBAL_TOTEM_QUEST_KEY,
    VARP_TRIBAL_TOTEM,
} from "./constants";
import { registerTribalTotemInteractions } from "./interactions";
import { buildTribalTotemJournal } from "./journal";

export { TRIBAL_TOTEM_QUEST_KEY } from "./constants";

export const tribalTotemQuest: QuestDefinition = {
    key: TRIBAL_TOTEM_QUEST_KEY,
    name: "Tribal Totem",
    members: true,
    varpId: VARP_TRIBAL_TOTEM,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: {
        skills: [{ skillId: SkillId.Thieving, level: 21, label: "Thieving" }],
    },
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Thieving, amount: 1775, label: "Thieving" }],
        items: [{ itemId: ITEM.swordfish, quantity: 5, label: "5 Swordfish" }],
    },
    rewardItemId: ITEM.tribalTotem,
    overviewStartText:
        "speaking to <col=800000>Kangai Mau<col=000080> in the Shrimp & Parrot in Brimhaven.",
    buildJournal(player, services): string[] {
        return buildTribalTotemJournal(player, services, tribalTotemQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerTribalTotemInteractions(tribalTotemQuest, registry, services);
    },
};
