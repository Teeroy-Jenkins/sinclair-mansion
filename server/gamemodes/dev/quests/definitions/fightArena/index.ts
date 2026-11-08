import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    FIGHT_ARENA_QUEST_KEY,
    ITEM,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_FIGHT_ARENA,
} from "./constants";
import { registerFightArenaInteractions } from "./interactions";
import { buildFightArenaJournal } from "./journal";

export const fightArenaQuest: QuestDefinition = {
    key: FIGHT_ARENA_QUEST_KEY,
    name: "Fight Arena",
    members: true,
    varpId: VARP_FIGHT_ARENA,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 2,
        xp: [
            { skillId: SkillId.Attack, amount: 12_175, label: "Attack" },
            { skillId: SkillId.Thieving, amount: 2_175, label: "Thieving" },
        ],
        items: [{ itemId: ITEM.coins, quantity: 1_000, label: "1,000 Coins" }],
    },
    rewardItemId: ITEM.coins,
    overviewStartText: "speaking to <col=800000>Lady Servil<col=000080> north of the Fight Arena.",
    buildJournal(player, services): string[] {
        return buildFightArenaJournal(player, services, fightArenaQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerFightArenaInteractions(fightArenaQuest, registry, services);
    },
};
