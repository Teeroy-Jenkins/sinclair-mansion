import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    SHIELD_OF_ARRAV_QUEST_KEY,
    STAGE_BITS,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_SHIELD_OF_ARRAV,
} from "./constants";
import { registerShieldOfArravInteractions } from "./interactions";
import { buildShieldOfArravJournal } from "./journal";

export const shieldOfArravQuest: QuestDefinition = {
    key: SHIELD_OF_ARRAV_QUEST_KEY,
    name: "Shield of Arrav",
    members: false,
    varpId: VARP_SHIELD_OF_ARRAV,
    stageBits: STAGE_BITS,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        items: [{ itemId: ITEM.coins, quantity: 600, label: "600 Coins" }],
    },
    rewardItemId: ITEM.certificate,
    overviewStartText: "speaking to <col=800000>Reldo<col=000080> in Varrock Palace library.",
    buildJournal(player, services): string[] {
        return buildShieldOfArravJournal(player, services, shieldOfArravQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerShieldOfArravInteractions(shieldOfArravQuest, registry, services);
    },
};
