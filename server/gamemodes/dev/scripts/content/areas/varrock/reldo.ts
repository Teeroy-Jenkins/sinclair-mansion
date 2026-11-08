/**
 * Reldo — palace librarian default chatter (LostCity reldo.rs2, non-quest).
 * Shield of Arrav / Knight's Sword branches deferred.
 */
import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import {
    choose,
    option,
    registerTalkTo,
    sayNpc,
    sayPlayer,
    startNpcConversation,
} from "../../../../npcs/helpers";

const RELDO_NPC_ID = 6203;

export function registerReldoHandlers(registry: IScriptRegistry): void {
    registerTalkTo(registry, [RELDO_NPC_ID], (event) => {
        startNpcConversation(event, [
            sayNpc("Hello stranger."),
            choose([
                option("Do you have anything to trade?", [
                    sayPlayer("Do you have anything to trade?"),
                    sayNpc("Only knowledge."),
                    sayPlayer("How much do you want for that then?"),
                    sayNpc("No, sorry, that was just my little joke. I'm not the trading type."),
                    sayPlayer("Ah well."),
                ], { echo: false }),
                option("What do you do?", [
                    sayPlayer("What do you do?"),
                    sayNpc("I am the palace librarian."),
                    sayPlayer("Ah. That's why you're in the library then."),
                    sayNpc("Yes."),
                    sayNpc([
                        "Although I would probably be in here even if I didn't work here. I like reading. Someday I hope to catalogue all of the information stored in these books so all may read it.",
                    ]),
                ], { echo: false }),
            ]),
        ]);
    });
}
