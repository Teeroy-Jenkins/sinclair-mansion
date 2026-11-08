import type { IScriptRegistry, ItemOnItemEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem, getQuestStage, isQuestComplete } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    BLUE_DYE_ITEM_ID,
    BLUE_GOBLIN_MAIL_ITEM_ID,
    GENERAL_BENTNOZE_NPC_ID,
    GENERAL_WARTFACE_NPC_ID,
    GOBLIN_MAIL_CRATE_LOC_IDS,
    GOBLIN_MAIL_ITEM_ID,
    GRUBFOOT_NPC_ID,
    ORANGE_DYE_ITEM_ID,
    ORANGE_GOBLIN_MAIL_ITEM_ID,
    STAGE_STARTED,
} from "./constants";
import { createGeneralTalkHandler, createGrubfootTalkHandler } from "./dialogue";

function decrementSlot(event: ItemOnItemEvent, slot: number): void {
    const entry = event.services.inventory
        .getInventoryItems(event.player)
        .find((candidate) => candidate.slot === slot);
    if (!entry || entry.quantity <= 0) return;
    const quantity = entry.quantity - 1;
    event.services.inventory.setInventorySlot(
        event.player,
        slot,
        quantity > 0 ? entry.itemId : -1,
        quantity,
    );
}

function dyeGoblinMail(event: ItemOnItemEvent, dyeItemId: number, resultItemId: number): void {
    const dye = event.source.itemId === dyeItemId ? event.source : event.target;
    const mail = event.source.itemId === GOBLIN_MAIL_ITEM_ID ? event.source : event.target;
    if (dye.itemId !== dyeItemId || mail.itemId !== GOBLIN_MAIL_ITEM_ID) return;
    decrementSlot(event, dye.slot);
    event.services.inventory.setInventorySlot(event.player, mail.slot, resultItemId, 1);
    event.services.inventory.snapshotInventory(event.player);
    event.services.messaging.sendGameMessage(event.player, "You dye the goblin mail.");
}

export function registerGoblinDiplomacyInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const generalTalk = createGeneralTalkHandler(quest);
    for (const npcId of [GENERAL_BENTNOZE_NPC_ID, GENERAL_WARTFACE_NPC_ID]) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: generalTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: generalTalk });
        for (const mailId of [
            ORANGE_GOBLIN_MAIL_ITEM_ID,
            BLUE_GOBLIN_MAIL_ITEM_ID,
            GOBLIN_MAIL_ITEM_ID,
        ]) {
            registry.registerItemOnNpc(mailId, npcId, generalTalk);
        }
    }

    const grubfootTalk = createGrubfootTalkHandler(quest);
    for (const npcId of [GRUBFOOT_NPC_ID, 672, 673]) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: grubfootTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: grubfootTalk });
    }

    for (const locId of GOBLIN_MAIL_CRATE_LOC_IDS) {
        registry.registerLocScript({
            locId,
            action: "search",
            handler: (event) => {
                const stage = getQuestStage(event.player, quest);
                if (stage < STAGE_STARTED || isQuestComplete(event.player, quest)) {
                    event.services.messaging.sendGameMessage(event.player, "The crate contains nothing useful.");
                    return;
                }
                const mailCount =
                    countCarriedItem(event.player, event.services, GOBLIN_MAIL_ITEM_ID) +
                    countCarriedItem(event.player, event.services, ORANGE_GOBLIN_MAIL_ITEM_ID) +
                    countCarriedItem(event.player, event.services, BLUE_GOBLIN_MAIL_ITEM_ID);
                if (mailCount >= 3) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "You already have enough goblin mail for the colour tests.",
                    );
                    return;
                }
                const result = event.services.inventory.addItemToInventory(
                    event.player,
                    GOBLIN_MAIL_ITEM_ID,
                    1,
                );
                if (result.added !== 1) {
                    event.services.messaging.sendGameMessage(event.player, "You need a free inventory slot.");
                    return;
                }
                event.services.inventory.snapshotInventory(event.player);
                event.services.messaging.sendGameMessage(event.player, "You find a goblin mail in the crate.");
            },
        });
    }

    registry.registerItemOnItem(ORANGE_DYE_ITEM_ID, GOBLIN_MAIL_ITEM_ID, (event) =>
        dyeGoblinMail(event, ORANGE_DYE_ITEM_ID, ORANGE_GOBLIN_MAIL_ITEM_ID),
    );
    registry.registerItemOnItem(BLUE_DYE_ITEM_ID, GOBLIN_MAIL_ITEM_ID, (event) =>
        dyeGoblinMail(event, BLUE_DYE_ITEM_ID, BLUE_GOBLIN_MAIL_ITEM_ID),
    );
}
