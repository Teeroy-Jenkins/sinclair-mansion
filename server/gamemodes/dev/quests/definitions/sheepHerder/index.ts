import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    SHEEP_HERDER_QUEST_KEY,
    STAGE_COMPLETE,
    STAGE_NEEDS_PROTECTIVE_CLOTHING,
    VARP_SHEEP_HERDER,
} from "./constants";
import { registerSheepHerderInteractions } from "./interactions";
import { buildSheepHerderJournal } from "./journal";

export { SHEEP_HERDER_QUEST_KEY } from "./constants";

export const sheepHerderQuest: QuestDefinition = {
    key: SHEEP_HERDER_QUEST_KEY,
    name: "Sheep Herder",
    members: true,
    varpId: VARP_SHEEP_HERDER,
    startedValue: STAGE_NEEDS_PROTECTIVE_CLOTHING,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 4,
        items: [{ itemId: ITEM.coins, quantity: 3100, label: "3,100 Coins" }],
    },
    rewardItemId: ITEM.coins,
    overviewStartText:
        "speaking to <col=800000>Councillor Halgrive<col=000080> outside the East Ardougne church.",
    buildJournal(player, services): string[] {
        return buildSheepHerderJournal(player, services, sheepHerderQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerSheepHerderInteractions(sheepHerderQuest, registry, services);
    },
};
