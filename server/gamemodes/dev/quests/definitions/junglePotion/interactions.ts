import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    JUNGLE_POTION_HERBS,
    POTHOLE_ENTRANCE_LOC_ID,
    POTHOLE_EXIT_LOC_ID,
    POTHOLE_EXTERIOR_X,
    POTHOLE_EXTERIOR_Y,
    POTHOLE_INTERIOR_X,
    POTHOLE_INTERIOR_Y,
    STAGE_GET_SNAKE_WEED,
    TRUFITUS_NPC_ID,
} from "./constants";
import { createTrufitusItemHandler, createTrufitusTalkHandler } from "./dialogue";

export function registerJunglePotionInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const talk = createTrufitusTalkHandler(quest);
    registry.registerNpcScript({ npcId: TRUFITUS_NPC_ID, option: "talk-to", handler: talk });
    registry.registerNpcScript({ npcId: TRUFITUS_NPC_ID, option: undefined, handler: talk });

    const itemOnTrufitus = createTrufitusItemHandler(quest);
    for (const herb of JUNGLE_POTION_HERBS) {
        registry.registerItemOnNpc(herb.grimyItemId, TRUFITUS_NPC_ID, itemOnTrufitus);
        registry.registerItemOnNpc(herb.cleanItemId, TRUFITUS_NPC_ID, itemOnTrufitus);

        registry.registerItemAction(
            herb.grimyItemId,
            ({ player, source, services }) => {
                if (getQuestStage(player, quest) < STAGE_GET_SNAKE_WEED) {
                    services.messaging.sendGameMessage(
                        player,
                        "You cannot clean this herb until you have started Jungle Potion.",
                    );
                    return;
                }
                if (services.skills.getSkill(player, SkillId.Herblore).baseLevel < 3) {
                    services.messaging.sendGameMessage(
                        player,
                        "You need a Herblore level of 3 to clean this herb.",
                    );
                    return;
                }
                services.inventory.setInventorySlot(player, source.slot, herb.cleanItemId, 1);
                services.skills.addSkillXp(player, SkillId.Herblore, 2.5);
                services.inventory.snapshotInventoryImmediate(player);
                services.messaging.sendGameMessage(player, `You clean the ${herb.name.toLowerCase()}.`);
            },
            "clean",
        );

        registry.registerLocScript({
            locId: herb.locId,
            action: "search",
            handler: ({ player, services }) => {
                const stage = getQuestStage(player, quest);
                if (stage < herb.requestedStage) {
                    services.messaging.sendGameMessage(
                        player,
                        herb === JUNGLE_POTION_HERBS[0]
                            ? "Unfortunately, you find nothing of interest."
                            : "You find nothing of significance.",
                    );
                    return;
                }
                const result = services.inventory.addItemToInventory(player, herb.grimyItemId, 1);
                if (result.added !== 1) {
                    services.messaging.sendGameMessage(
                        player,
                        "You find a herb, but you have no room to store it.",
                    );
                    return;
                }
                if (stage === herb.requestedStage) {
                    setQuestStage(player, quest, services, herb.foundStage);
                }
                services.inventory.snapshotInventory(player);
                startConversation(
                    { player, services, npcId: TRUFITUS_NPC_ID, npcName: "Trufitus" },
                    [showItem(herb.grimyItemId, `You search the ${herb.searchTarget} and find a herb.`)],
                );
            },
        });
    }

    registry.registerLocScript({
        locId: POTHOLE_ENTRANCE_LOC_ID,
        action: "search",
        handler: ({ player, services }) => {
            startConversation(
                { player, services, npcId: TRUFITUS_NPC_ID, npcName: "Trufitus" },
                [
                    sayPlayer("I find an entrance into some caves among the rocks."),
                    choose([
                        option("Yes, I'll enter the cave.", [
                            run(({ player: questPlayer, services: questServices }) =>
                                questServices.movement.teleportPlayer(
                                    questPlayer,
                                    POTHOLE_INTERIOR_X,
                                    POTHOLE_INTERIOR_Y,
                                    0,
                                ),
                            ),
                        ]),
                        option("No thanks, I'll give it a miss."),
                    ], "Would you like to enter the caves?"),
                ],
            );
        },
    });

    registry.registerLocScript({
        locId: POTHOLE_EXIT_LOC_ID,
        action: "climb",
        handler: ({ player, services }) => {
            services.messaging.sendGameMessage(player, "You climb the rocks back out of the cave.");
            services.movement.teleportPlayer(player, POTHOLE_EXTERIOR_X, POTHOLE_EXTERIOR_Y, 0);
        },
    });
}
