import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { isQuestComplete } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    DORIC_ANVIL_AREA,
    DORIC_ANVIL_LOC_ID,
    DORIC_NPC_ID,
    DORIC_WHETSTONE_LOC_ID,
} from "./constants";
import { createDoricTalkHandler, startDoricAnvilConversation } from "./dialogue";

function registerDoricAnvilGate(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const genericSmith = registry.findLocInteraction(DORIC_ANVIL_LOC_ID, "smith");
    if (!genericSmith) {
        services.system.logger.warn?.(
            "[quest:dorics-quest] No generic smith handler found; anvil gate not installed",
        );
    }
    registry.registerLocScript({
        locId: DORIC_ANVIL_LOC_ID,
        action: "smith",
        handler: (event) => {
            const { tile, level } = event;
            const inDoricHouse =
                level === DORIC_ANVIL_AREA.level &&
                tile.x >= DORIC_ANVIL_AREA.minX &&
                tile.x <= DORIC_ANVIL_AREA.maxX &&
                tile.y >= DORIC_ANVIL_AREA.minY &&
                tile.y <= DORIC_ANVIL_AREA.maxY;
            if (inDoricHouse && !isQuestComplete(event.player, quest)) {
                startDoricAnvilConversation(quest, event.player, services);
                return;
            }
            if (genericSmith) return genericSmith(event);
            services.messaging.sendGameMessage(event.player, "You use Doric's anvil.");
        },
    });
}

function registerDoricWhetstoneGate(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const genericUse = registry.findLocInteraction(DORIC_WHETSTONE_LOC_ID, "use");
    registry.registerLocScript({
        locId: DORIC_WHETSTONE_LOC_ID,
        action: "use",
        handler: (event) => {
            if (!isQuestComplete(event.player, quest)) {
                startDoricAnvilConversation(quest, event.player, services, true);
                return;
            }
            if (genericUse) return genericUse(event);
            services.messaging.sendGameMessage(event.player, "You use Doric's whetstone.");
        },
    });
}

export function registerDoricInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const handleDoricTalk = createDoricTalkHandler(quest);
    registry.registerNpcScript({
        npcId: DORIC_NPC_ID,
        option: "talk-to",
        handler: handleDoricTalk,
    });
    registry.registerNpcScript({
        npcId: DORIC_NPC_ID,
        option: undefined,
        handler: handleDoricTalk,
    });
    registerDoricAnvilGate(quest, registry, services);
    registerDoricWhetstoneGate(quest, registry, services);
}
