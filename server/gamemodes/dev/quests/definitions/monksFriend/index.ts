import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    LAW_RUNE_ITEM_ID,
    MONKS_FRIEND_QUEST_KEY,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_MONKS_FRIEND,
} from "./constants";
import { registerMonksFriendInteractions } from "./interactions";
import { buildMonksFriendJournal } from "./journal";

export { MONKS_FRIEND_QUEST_KEY } from "./constants";

export const monksFriendQuest: QuestDefinition = {
    key: MONKS_FRIEND_QUEST_KEY,
    name: "Monk's Friend",
    members: true,
    varpId: VARP_MONKS_FRIEND,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Woodcutting, amount: 2_000, label: "Woodcutting" }],
        items: [{ itemId: LAW_RUNE_ITEM_ID, quantity: 8, label: "8 Law runes" }],
    },
    rewardItemId: LAW_RUNE_ITEM_ID,
    overviewStartText:
        "speaking to <col=800000>Brother Omad<col=000080> at the monastery south of <col=800000>Ardougne<col=000080>.",
    buildJournal: buildMonksFriendJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerMonksFriendInteractions(monksFriendQuest, registry, services);
    },
};
