import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    SEA_SLUG_QUEST_KEY,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_SEA_SLUG,
} from "./constants";
import { registerSeaSlugInteractions } from "./interactions";
import { buildSeaSlugJournal } from "./journal";

export { SEA_SLUG_QUEST_KEY } from "./constants";

export const seaSlugQuest: QuestDefinition = {
    key: SEA_SLUG_QUEST_KEY,
    name: "Sea Slug",
    members: true,
    varpId: VARP_SEA_SLUG,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    requirements: {
        skills: [{ skillId: SkillId.Firemaking, level: 30, label: "Firemaking" }],
    },
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Fishing, amount: 7175, label: "Fishing" }],
        items: [{ itemId: ITEM.oysterPearls, quantity: 1, label: "Oyster pearls" }],
    },
    rewardItemId: ITEM.seaSlug,
    overviewStartText:
        "speaking to <col=800000>Caroline<col=000080> on the coast east of <col=800000>Ardougne<col=000080>.",
    buildJournal(player, services): string[] {
        return buildSeaSlugJournal(player, services, seaSlugQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerSeaSlugInteractions(seaSlugQuest, registry, services);
    },
};
