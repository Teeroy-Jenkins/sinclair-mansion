import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import { ITEM } from "./constants";
import { registerPriestInPerilInteractions } from "./interactions";
import { buildPriestInPerilJournal } from "./journal";

export const priestInPerilQuest: QuestDefinition = {
    key: QUEST_KEYS.priestInPeril,
    name: "Priest in Peril",
    members: true,
    varpId: QUEST_STATE[QUEST_KEYS.priestInPeril].varpId,
    startedValue: 10,
    completionValue: QUEST_STATE[QUEST_KEYS.priestInPeril].completionValue,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Prayer, amount: 1406, label: "Prayer" }],
        items: [{ itemId: ITEM.wolfbane, quantity: 1, label: "Wolfbane dagger" }],
        other: ["Access to Morytania"],
    },
    rewardItemId: ITEM.wolfbane,
    overviewStartText: "speaking to <col=800000>King Roald<col=000080> in Varrock Palace.",
    buildJournal: buildPriestInPerilJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerPriestInPerilInteractions(priestInPerilQuest, registry, services);
    },
};
