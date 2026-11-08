import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    COINS_ITEM_ID,
    PRINCE_ALI_RESCUE_KEY,
    QUEST_REWARD_COINS,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_PRINCE_ALI_RESCUE,
} from "./constants";
import { registerPrinceAliRescueInteractions } from "./interactions";
import { buildPrinceAliRescueJournal } from "./journal";

export { PRINCE_ALI_RESCUE_KEY } from "./constants";

export const princeAliRescueQuest: QuestDefinition = {
    key: PRINCE_ALI_RESCUE_KEY,
    name: "Prince Ali Rescue",
    varpId: VARP_PRINCE_ALI_RESCUE,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 3,
        items: [{ itemId: COINS_ITEM_ID, quantity: QUEST_REWARD_COINS, label: "700 Coins" }],
        other: ["Free passage through the Al Kharid gate"],
    },
    rewardItemId: COINS_ITEM_ID,
    overviewStartText:
        "speaking to <col=800000>Chancellor Hassan<col=000080> in <col=800000>Al Kharid Palace<col=000080>.",
    buildJournal: (player, services) =>
        buildPrinceAliRescueJournal(princeAliRescueQuest, player, services),
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerPrinceAliRescueInteractions(princeAliRescueQuest, registry, services);
    },
};
