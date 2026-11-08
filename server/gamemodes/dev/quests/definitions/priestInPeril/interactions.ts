import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import {
    countCarriedItem,
    getQuestStage,
    isQuestComplete,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    finishQuest,
    gameMessage,
    giveItem,
    hasItem,
    registerTalk,
    requirement,
    talk,
} from "../desertTreasureSeries/helpers";
import { ITEM, NPC } from "./constants";

export function registerPriestInPerilInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerTalk(registry, NPC.kingRoald, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 0) {
            talk(event, "King Roald", [
                sayNpc(
                    "I have had no word from Drezel at the temple on the River Salve. Find out what happened.",
                ),
                choose([
                    option("I'll check on Drezel.", [
                        run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 10)),
                    ]),
                    option("Not today, Your Majesty."),
                ]),
            ]);
            return;
        }
        if (stage === 20) {
            talk(event, "King Roald", [
                sayPlayer("I killed the creature guarding the temple."),
                sayNpc(
                    "That was no threat—it guarded Misthalin from Morytania! Return at once and rescue Drezel.",
                ),
                run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 30)),
            ]);
            return;
        }
        talk(event, "King Roald", [
            sayNpc(
                isQuestComplete(event.player, quest)
                    ? "The River Salve barrier is secure once more."
                    : "Drezel needs your help at the temple.",
            ),
        ]);
    });

    registerTalk(registry, NPC.drezel, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 40) {
            talk(event, "Drezel", [
                sayNpc(
                    "The golden key opens my cell. Bless this water so we can seal the vampire's coffin.",
                ),
                run((ctx) => {
                    if (
                        !takeQuestItems(ctx.player, ctx.services, [
                            requirement(ITEM.goldenKey, 1, "Golden key"),
                        ])
                    ) {
                        gameMessage(
                            ctx.player,
                            ctx.services,
                            "You need the golden key carried by the monks.",
                        );
                        return;
                    }
                    if (!giveItem(ctx.player, ctx.services, ITEM.blessedWater, 1, "blessed water"))
                        return;
                    setQuestStage(ctx.player, quest, ctx.services, 50);
                }),
            ]);
            return;
        }
        if (stage === 50) {
            const runeCount = countCarriedItem(event.player, services, ITEM.runeEssence);
            const pureCount = countCarriedItem(event.player, services, ITEM.pureEssence);
            if (runeCount + pureCount < 50) {
                gameMessage(
                    event.player,
                    services,
                    `Drezel needs 50 rune or pure essence; you have ${runeCount + pureCount}.`,
                );
                return;
            }
            talk(event, "Drezel", [
                sayNpc("Fifty essence will restore the power of the River Salve barrier."),
                run((ctx) => {
                    let remaining = 50;
                    for (const itemId of [ITEM.runeEssence, ITEM.pureEssence]) {
                        while (remaining > 0 && hasItem(ctx.player, ctx.services, itemId)) {
                            const slot = ctx.services.inventory.findInventorySlotWithItem(
                                ctx.player,
                                itemId,
                            );
                            if (
                                slot === undefined ||
                                !ctx.services.inventory.consumeItem(ctx.player, slot)
                            )
                                break;
                            remaining--;
                        }
                    }
                    ctx.services.inventory.snapshotInventory(ctx.player);
                    if (remaining > 0) return;
                    finishQuest(ctx.player, ctx.services, quest);
                }),
            ]);
            return;
        }
        talk(event, "Drezel", [
            sayNpc(
                isQuestComplete(event.player, quest)
                    ? "Thanks to you, the holy barrier holds."
                    : "The Zamorakian monks have imprisoned me beneath the temple.",
            ),
        ]);
    });
}
