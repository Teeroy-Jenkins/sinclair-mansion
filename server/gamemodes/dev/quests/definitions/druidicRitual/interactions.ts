import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    CAULDRON_OF_THUNDER_LOC_ID,
    KAQEMEEX_NPC_ID,
    MEAT_TRANSFORMATIONS,
    SANFEW_NPC_ID,
    STAGE_GATHERING_MEATS,
} from "./constants";
import { createKaqemeexTalkHandler, createSanfewTalkHandler } from "./dialogue";

export function registerDruidicRitualInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const kaqemeexTalk = createKaqemeexTalkHandler(quest);
    const sanfewTalk = createSanfewTalkHandler(quest);
    registry.registerNpcScript({ npcId: KAQEMEEX_NPC_ID, option: "talk-to", handler: kaqemeexTalk });
    registry.registerNpcScript({ npcId: KAQEMEEX_NPC_ID, option: undefined, handler: kaqemeexTalk });
    registry.registerNpcScript({ npcId: SANFEW_NPC_ID, option: "talk-to", handler: sanfewTalk });
    registry.registerNpcScript({ npcId: SANFEW_NPC_ID, option: undefined, handler: sanfewTalk });

    for (const [rawItemId, enchantedItemId] of MEAT_TRANSFORMATIONS) {
        registry.registerItemOnLoc(rawItemId, CAULDRON_OF_THUNDER_LOC_ID, (event) => {
            if (getQuestStage(event.player, quest) !== STAGE_GATHERING_MEATS) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "You have no reason to dip that in the cauldron.",
                );
                return;
            }
            event.services.inventory.setInventorySlot(
                event.player,
                event.source.slot,
                enchantedItemId,
                1,
            );
            event.services.inventory.snapshotInventory(event.player);
            event.services.messaging.sendGameMessage(
                event.player,
                "You dip the raw meat into the Cauldron of Thunder.",
            );
        });
        registry.registerItemOnNpc(enchantedItemId, SANFEW_NPC_ID, sanfewTalk);
    }
}
