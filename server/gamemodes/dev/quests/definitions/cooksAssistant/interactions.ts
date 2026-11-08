import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { ANY_ITEM_ID } from "../../../../../src/game/scripts/types";
import { isQuestComplete } from "../../QuestService";
import { type DialogueContext, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import { COOKING_RANGE_LOC_ID, COOK_NPC_ID } from "./constants";
import { createCookTalkHandler } from "./dialogue";

export function registerCooksAssistantInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const talk = createCookTalkHandler(quest);
    registry.registerNpcScript({ npcId: COOK_NPC_ID, option: "talk-to", handler: talk });
    registry.registerNpcScript({ npcId: COOK_NPC_ID, option: undefined, handler: talk });

    const genericCook = registry.findLocInteraction(COOKING_RANGE_LOC_ID, "cook");
    if (!genericCook) {
        services.system.logger.warn?.(
            "[quest:cooks-assistant] Generic cooking handler is unavailable",
        );
        return;
    }

    const stopPlayer = (player: Parameters<typeof isQuestComplete>[0]) => {
        const context: DialogueContext = {
            player,
            services,
            npcId: COOK_NPC_ID,
            npcName: "Cook",
        };
        startConversation(context, [
            {
                npc: [
                    "Hey! Who said you could use that?",
                    "Help me with my cake first, then you can use it.",
                ],
            },
        ]);
    };

    registry.registerLocScript({
        locId: COOKING_RANGE_LOC_ID,
        action: "cook",
        handler: (event) => {
            if (!isQuestComplete(event.player, quest)) {
                stopPlayer(event.player);
                return;
            }
            return genericCook(event);
        },
    });

    registry.registerItemOnLoc(ANY_ITEM_ID, COOKING_RANGE_LOC_ID, (event) => {
        if (!isQuestComplete(event.player, quest)) {
            stopPlayer(event.player);
            return;
        }
        return genericCook({
            player: event.player,
            services: event.services,
            tick: event.tick,
            locId: event.target.locId,
            tile: event.target.tile,
            level: event.target.level,
            action: "cook",
        });
    });
}
