/**
 * Wyson the gardener — woad leaf sales (LostCity wyson_the_gardener.rs2).
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

const WYSON_NPC_ID = 5422;
const COINS = 995;
const WOAD_LEAF = 1793;

function refusePrice(playerLine: string) {
    return [
        sayPlayer(playerLine),
        sayNpc([
            "No no, that's far too little. Woad leaves are hard to get. I used to have plenty but someone kept stealing them off me!",
        ]),
    ];
}

function buyLeaves(event: NpcInteractionEvent, price: number, quantity: number) {
    const leafWord = quantity === 1 ? "a woad leaf" : "some woad leaves";
    const acceptNpc =
        price >= 20
            ? ["Okay, that's more than fair.", "Here, have two, you're a generous person."]
            : ["Mmmm... okay, sounds fair."];

    return [
        sayPlayer(`How about ${price} coins?`),
        sayNpc(acceptNpc),
        run((ctx) => {
            if (!ctx.player.items.hasItem(COINS, price)) {
                setImmediate(() => {
                    startNpcConversation(event, [
                        sayPlayer([
                            "I don't have enough coins to buy the leaves. I'll come back later.",
                        ]),
                    ]);
                });
                return;
            }
            ctx.player.items.removeItem(COINS, price, { assureFullRemoval: true });
            ctx.player.items.addItem(WOAD_LEAF, quantity);
            ctx.services.inventory.snapshotInventory(ctx.player);
            ctx.services.messaging.sendGameMessage(ctx.player, `You give Wyson ${price} coins.`);
            ctx.services.messaging.sendGameMessage(
                ctx.player,
                `Wyson the gardener gives you ${leafWord}.`,
            );
        }),
    ];
}

export function registerWysonHandlers(registry: IScriptRegistry): void {
    registerTalkTo(registry, [WYSON_NPC_ID], (event) => {
        startNpcConversation(event, [
            sayNpc([
                "I'm the gardener around here.",
                "Do you have any gardening that needs doing?",
            ]),
            choose([
                option(
                    "I'm looking for woad leaves.",
                    [
                        sayPlayer("I'm looking for woad leaves."),
                        sayNpc("How much are you willing to pay?"),
                        choose([
                            option("How about 5 coins?", refusePrice("How about 5 coins?"), {
                                echo: false,
                            }),
                            option("How about 10 coins?", refusePrice("How about 10 coins?"), {
                                echo: false,
                            }),
                            option("How about 15 coins?", buyLeaves(event, 15, 1), { echo: false }),
                            option("How about 20 coins?", buyLeaves(event, 20, 2), { echo: false }),
                        ]),
                    ],
                    { echo: false },
                ),
                option("Not right now, thanks."),
            ]),
        ]);
    });
}
