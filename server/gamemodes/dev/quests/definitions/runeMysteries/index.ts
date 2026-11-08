import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    AIR_TALISMAN_ITEM_ID,
    RUNE_MYSTERIES_KEY,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_RUNE_MYSTERIES,
} from "./constants";
import { registerRuneMysteriesInteractions } from "./interactions";
import { buildRuneMysteriesJournal } from "./journal";

export { RUNE_MYSTERIES_KEY } from "./constants";

export const runeMysteriesQuest: QuestDefinition = {
    key: RUNE_MYSTERIES_KEY,
    name: "Rune Mysteries",
    varpId: VARP_RUNE_MYSTERIES,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        other: ["Access to the Rune Essence Mine", "The ability to train Runecraft"],
    },
    rewardItemId: AIR_TALISMAN_ITEM_ID,
    overviewStartText:
        "speaking to <col=800000>Duke Horacio<col=000080> upstairs in <col=800000>Lumbridge Castle<col=000080>.",
    buildJournal: buildRuneMysteriesJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerRuneMysteriesInteractions(runeMysteriesQuest, registry, services);
    },
};

