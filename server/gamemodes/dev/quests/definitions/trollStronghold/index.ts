import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import { ITEM } from "./constants";
import { registerTrollStrongholdInteractions } from "./interactions";
import { buildTrollStrongholdJournal } from "./journal";

export const trollStrongholdQuest: QuestDefinition = {
    key: QUEST_KEYS.trollStronghold,
    name: "Troll Stronghold",
    members: true,
    varpId: QUEST_STATE[QUEST_KEYS.trollStronghold].varpId,
    startedValue: 10,
    completionValue: QUEST_STATE[QUEST_KEYS.trollStronghold].completionValue,
    rewards: {
        questPoints: 1,
        items: [{ itemId: ITEM.lawTalisman, quantity: 1, label: "Law talisman" }],
        other: ["Access to the Troll Stronghold"],
    },
    rewardItemId: ITEM.lawTalisman,
    overviewStartText: "speaking to <col=800000>Denulth<col=000080> after Death Plateau.",
    buildJournal: buildTrollStrongholdJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerTrollStrongholdInteractions(trollStrongholdQuest, registry, services);
    },
};
