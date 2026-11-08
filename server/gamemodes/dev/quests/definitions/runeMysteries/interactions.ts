import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { DialogueContext } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    createAuburyTalkHandler,
    createDukeHoracioTalkHandler,
    createSedridorTalkHandler,
    startAuburyPackageDialogue,
    startSedridorNotesDialogue,
    teleportToRuneEssence,
} from "./dialogue";
import {
    AUBURY_NPC_IDS,
    DUKE_HORACIO_NPC_ID,
    RESEARCH_NOTES_ITEM_ID,
    RESEARCH_PACKAGE_ITEM_ID,
    SEDRIDOR_NPC_IDS,
    STAGE_COMPLETE,
    STAGE_RECEIVED_NOTES,
    STAGE_RECEIVED_PACKAGE,
} from "./constants";

export function registerRuneMysteriesInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const dukeTalk = createDukeHoracioTalkHandler(quest);
    registry.registerNpcScript({
        npcId: DUKE_HORACIO_NPC_ID,
        option: "talk-to",
        handler: dukeTalk,
    });
    registry.registerNpcScript({ npcId: DUKE_HORACIO_NPC_ID, option: undefined, handler: dukeTalk });

    const sedridorTalk = createSedridorTalkHandler(quest);
    for (const npcId of SEDRIDOR_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: sedridorTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: sedridorTalk });
        registry.registerNpcScript({
            npcId,
            option: "teleport",
            handler: ({ player, services }) => {
                if (getQuestStage(player, quest) < STAGE_COMPLETE) {
                    services.messaging.sendGameMessage(
                        player,
                        "You need to complete Rune Mysteries before using this teleport.",
                    );
                    return;
                }
                teleportToRuneEssence(player, services);
            },
        });
        registry.registerItemOnNpc(RESEARCH_NOTES_ITEM_ID, npcId, ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_RECEIVED_NOTES) {
                services.messaging.sendGameMessage(player, "Nothing interesting happens.");
                return;
            }
            const context: DialogueContext = {
                player,
                services,
                npcId,
                npcName: "Archmage Sedridor",
            };
            startSedridorNotesDialogue(quest, context);
        });
    }

    const auburyTalk = createAuburyTalkHandler(quest);
    for (const npcId of AUBURY_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: auburyTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: auburyTalk });
        registry.registerNpcScript({
            npcId,
            option: "teleport",
            handler: ({ player, services }) => {
                if (getQuestStage(player, quest) < STAGE_COMPLETE) {
                    services.messaging.sendGameMessage(
                        player,
                        "You need to complete Rune Mysteries before using this teleport.",
                    );
                    return;
                }
                teleportToRuneEssence(player, services);
            },
        });
        registry.registerItemOnNpc(RESEARCH_PACKAGE_ITEM_ID, npcId, ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_RECEIVED_PACKAGE) {
                services.messaging.sendGameMessage(player, "Nothing interesting happens.");
                return;
            }
            const context: DialogueContext = {
                player,
                services,
                npcId,
                npcName: "Aubury",
            };
            startAuburyPackageDialogue(quest, context);
        });
    }
}

