/**
 * Baraek — Varrock fur trader (LostCity baraek.rs2, sell path; quest/buy deferred).
 */
import type { IScriptRegistry, NpcInteractionEvent } from "../../../../../../src/game/scripts/types";
import {
    choose,
    option,
    registerTalkTo,
    run,
    sayNpc,
    sayPlayer,
    startNpcConversation,
} from "../../../../npcs/helpers";

const BARAEK_NPC_ID = 2881;
const COINS = 995;
const FUR = 948;
const PRICE = 20;
const CHEAP_PRICE = 18;

function giveFur(event: NpcInteractionEvent, price: number): void {
    event.player.items.removeItem(COINS, price, { assureFullRemoval: true });
    event.player.items.addItem(FUR, 1);
    event.services.inventory.snapshotInventory(event.player);
    event.services.messaging.sendGameMessage(event.player, "Baraek sells you a fur.");
}

function tryBuyAt(event: NpcInteractionEvent, price: number, onPoor: () => void): void {
    if (!event.player.items.hasItem(COINS, price)) {
        onPoor();
        return;
    }
    giveFur(event, price);
}

function sellFurBranch(event: NpcInteractionEvent) {
    return [
        sayPlayer("Can you sell me some furs?"),
        sayNpc("Yeah, sure. They're 20 gold coins each."),
        choose([
            option("Yeah, Okay, here you go.", [
                sayPlayer("Yeah, OK, here you go."),
                run(() => {
                    tryBuyAt(event, PRICE, () => {
                        setImmediate(() => {
                            startNpcConversation(event, [
                                sayPlayer("Oh dear, I don't have enough money!"),
                                sayNpc("Well, my best price is 18 coins."),
                                choose([
                                    option("OK, here you go.", [
                                        sayPlayer("OK, here you go."),
                                        run(() => {
                                            tryBuyAt(event, CHEAP_PRICE, () => {
                                                setImmediate(() => {
                                                    startNpcConversation(event, [
                                                        sayPlayer(
                                                            "Oh dear, I don't have that either.",
                                                        ),
                                                        sayNpc([
                                                            "Well, I can't go any cheaper than that mate. I have a family to feed.",
                                                        ]),
                                                    ]);
                                                });
                                            });
                                        }),
                                    ], { echo: false }),
                                    option("No thanks, I'll leave it.", [
                                        sayPlayer("No thanks, I'll leave it."),
                                        sayNpc("It's your loss mate."),
                                    ], { echo: false }),
                                ]),
                            ]);
                        });
                    });
                }),
            ], { echo: false }),
            option("20 gold coins? That's an outrage!", [
                sayPlayer("20 gold coins? That's an outrage!"),
                sayNpc([
                    "Well, I can't go any cheaper than that mate. I have a family to feed.",
                ]),
            ], { echo: false }),
        ]),
    ];
}

export function registerBaraekHandlers(registry: IScriptRegistry): void {
    registerTalkTo(registry, [BARAEK_NPC_ID], (event) => {
        startNpcConversation(event, [
            choose([
                option("Can you sell me some furs?", sellFurBranch(event), { echo: false }),
                option("Hello. I am in search of a quest.", [
                    sayPlayer("Hello! I am in search of a quest."),
                    sayNpc("Sorry kiddo, I'm a fur trader not a damsel in distress."),
                ], { echo: false }),
            ]),
        ]);
    });
}
