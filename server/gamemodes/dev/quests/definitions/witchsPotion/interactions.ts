import type { PlayerState } from "../../../../../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage } from "../../QuestService";
import { sayPlayer, startConversation, type DialogueContext } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import { createHettyTalkHandler } from "./dialogue";
import {
    HETTYS_CAULDRON_LOC_ID,
    HETTY_NPC_ID,
    RATS_TAIL_ITEM_ID,
    RAT_NPC_IDS,
    STAGE_COMPLETE,
    STAGE_INGREDIENTS_GIVEN,
    STAGE_STARTED,
} from "./constants";

const knownPlayers = new Map<number, PlayerState>();
const registeredEventBuses = new WeakSet<object>();

function registerRatTailDrops(quest: QuestDefinition, services: ScriptServices): void {
    const eventBus = services.system.eventBus;
    if (!eventBus || registeredEventBuses.has(eventBus)) return;
    registeredEventBuses.add(eventBus);
    eventBus.on("player:login", ({ player }) => knownPlayers.set(player.id, player));
    eventBus.on("player:logout", ({ playerId }) => knownPlayers.delete(playerId));
    eventBus.on("npc:death", ({ npcTypeId, killerPlayerId, tile }) => {
        if (killerPlayerId === undefined || !RAT_NPC_IDS.some((ratId) => ratId === npcTypeId)) return;
        const player = knownPlayers.get(killerPlayerId);
        if (!player) return;
        const stage = getQuestStage(player, quest);
        if (stage < STAGE_STARTED || stage >= STAGE_COMPLETE) return;
        if (services.inventory.findOwnedItemLocation(player, RATS_TAIL_ITEM_ID)) return;
        services.groundItems.spawn(RATS_TAIL_ITEM_ID, 1, tile, {
            ownerId: killerPlayerId,
            privateTicks: 100,
            durationTicks: 200,
            isMonsterDrop: true,
        });
    });
}

export function registerWitchsPotionInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const talk = createHettyTalkHandler(quest);
    registry.registerNpcScript({ npcId: HETTY_NPC_ID, option: "talk-to", handler: talk });
    registry.registerNpcScript({ npcId: HETTY_NPC_ID, option: undefined, handler: talk });

    registry.registerLocScript({
        locId: HETTYS_CAULDRON_LOC_ID,
        action: "drink-from",
        handler: ({ player, services: eventServices }) => {
            const stage = getQuestStage(player, quest);
            if (stage === STAGE_INGREDIENTS_GIVEN) {
                eventServices.messaging.sendGameMessage(
                    player,
                    "You drink from the cauldron. It tastes horrible! You feel yourself imbued with power.",
                );
                completeQuest(player, eventServices, quest);
                return;
            }
            const context: DialogueContext = {
                player,
                services: eventServices,
                npcId: HETTY_NPC_ID,
                npcName: "Hetty",
            };
            startConversation(context, [
                sayPlayer("As nice as that looks, I think I'll give it a miss for now."),
            ]);
        },
    });

    registerRatTailDrops(quest, services);
}
