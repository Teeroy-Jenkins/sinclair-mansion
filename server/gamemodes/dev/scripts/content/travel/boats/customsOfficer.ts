/**
 * Musa Point customs officer → Port Sarim (LostCity customs_officer.rs2, simplified).
 */
import type { IScriptRegistry, NpcInteractionEvent } from "../../../../../../src/game/scripts/types";
import {
    choose,
    option,
    registerNpcOptions,
    registerTalkTo,
    run,
    sayNpc,
    sayPlayer,
    startNpcConversation,
} from "../../../../npcs/helpers";
import { CUSTOMS_OFFICER_IDS, FARE_COINS, KARAMJAN_RUM, PORT_SARIM_DOCK } from "./constants";
import { sailTo, tryPayFare } from "./fare";

function confiscateRum(event: NpcInteractionEvent): boolean {
    if (!event.player.items.hasItem(KARAMJAN_RUM, 1)) return false;
    // Remove up to a full inventory worth of rum stacks.
    for (let i = 0; i < 28; i++) {
        if (!event.player.items.hasItem(KARAMJAN_RUM, 1)) break;
        event.player.items.removeItem(KARAMJAN_RUM, 1);
    }
    event.services.inventory.snapshotInventory(event.player);
    event.services.messaging.sendGameMessage(
        event.player,
        "The customs officer confiscates your rum.",
    );
    return true;
}

function afterSearch(event: NpcInteractionEvent): void {
    startNpcConversation(event, [
        sayNpc([
            "Well you've got some odd stuff, but it's all legal.",
            `Now you need to pay a boarding charge of ${FARE_COINS} coins.`,
        ]),
        choose([
            option("Ok.", [
                run((ctx) => {
                    if (tryPayFare(ctx.player, ctx.services) === "poor") {
                        setImmediate(() => {
                            startNpcConversation(event, [
                                sayPlayer("Oh dear, I don't actually seem to have enough money."),
                            ]);
                        });
                        return;
                    }
                    sailTo(
                        ctx.player,
                        ctx.services,
                        PORT_SARIM_DOCK,
                        `You pay ${FARE_COINS} coins and board the ship.`,
                    );
                }),
            ]),
            option("Oh, I'll not bother then.", [sayPlayer("Oh, I'll not bother then.")]),
        ]),
    ]);
}

function offerCustoms(event: NpcInteractionEvent): void {
    startNpcConversation(event, [
        sayNpc("Can I help you?"),
        choose([
            option("Can I journey on this ship?", [
                sayPlayer("Can I journey on this ship?"),
                sayNpc("You need to be searched before you can board."),
                choose([
                    option("Search away, I have nothing to hide.", [
                        sayPlayer("Search away, I have nothing to hide."),
                        run(() => {
                            if (confiscateRum(event)) {
                                setImmediate(() => {
                                    startNpcConversation(event, [
                                        sayNpc("Aha, trying to smuggle rum are we?"),
                                        sayPlayer("Umm... it's for personal use?"),
                                    ]);
                                });
                                return;
                            }
                            setImmediate(() => afterSearch(event));
                        }),
                    ]),
                    option("You're not putting your hands on my things!", [
                        sayPlayer("You're not putting your hands on my things!"),
                        sayNpc("You're not getting on this ship then."),
                    ]),
                    option("Why?", [
                        sayPlayer("Why?"),
                        sayNpc(
                            "Because Asgarnia has banned the import of intoxicating spirits.",
                        ),
                    ]),
                ]),
            ]),
            option("Does Karamja have unusual customs then?", [
                sayPlayer("Does Karamja have any unusual customs then?"),
                sayNpc("I'm not that sort of customs officer."),
            ]),
        ]),
    ]);
}

export function registerCustomsOfficer(registry: IScriptRegistry): void {
    const ids = [...CUSTOMS_OFFICER_IDS];
    registerTalkTo(registry, ids, offerCustoms);
    registerNpcOptions(registry, ids, ["pay-fare", "pay fare", "travel"], offerCustoms);
}
