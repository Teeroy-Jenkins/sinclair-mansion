import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    CLOCK_TOWER_QUEST_KEY,
    ITEM,
    STAGE_COMPLETE,
    STAGE_PLACE_COGS,
    VARP_CLOCK_TOWER,
} from "./constants";
import { registerClockTowerInteractions } from "./interactions";
import { buildClockTowerJournal } from "./journal";

export { CLOCK_TOWER_QUEST_KEY } from "./constants";

export const clockTowerQuest: QuestDefinition = {
    key: CLOCK_TOWER_QUEST_KEY,
    name: "Clock Tower",
    varpId: VARP_CLOCK_TOWER,
    stageBits: { start: 0, end: 3 },
    startedValue: STAGE_PLACE_COGS,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        items: [{ itemId: ITEM.coins, quantity: 500, label: "500 Coins" }],
    },
    rewardItemId: ITEM.coins,
    overviewStartText:
        "speaking to <col=800000>Brother Kojo<col=000080> at the <col=800000>Clock Tower<col=000080> south of <col=800000>Ardougne<col=000080>.",
    buildJournal(player, services): string[] {
        return buildClockTowerJournal(player, services, clockTowerQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerClockTowerInteractions(clockTowerQuest, registry, services);
    },
};
