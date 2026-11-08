/**
 * Lumbridge Cook soft stub + post-quest style chatter (LostCity cook.rs2).
 * Cook's Assistant quest stages deferred — greeting always offers the casual options.
 */
import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerTalkTo, startNpcConversation } from "../../../../npcs/helpers";

/** Lumbridge Castle kitchen cook (rsmod npc.sym `cook`). */
const LUMBRIDGE_COOK_NPC_ID = 4626;

export function registerLumbridgeCookHandlers(registry: IScriptRegistry): void {
    registerTalkTo(registry, [LUMBRIDGE_COOK_NPC_ID], (event) => {
        startNpcConversation(event, [
            { npc: ["How is the adventuring going, my friend?"] },
            {
                options: [
                    {
                        text: "I am getting strong and mighty.",
                        next: [
                            { player: ["I am getting strong and mighty."] },
                            { npc: ["Glad to hear it."] },
                        ],
                    },
                    {
                        text: "I keep on dying.",
                        next: [
                            { player: ["I keep on dying."] },
                            {
                                npc: ["Ah well, at least you keep coming back to life!"],
                            },
                        ],
                    },
                    {
                        text: "Nice hat!",
                        next: [
                            { player: ["Nice hat!"] },
                            {
                                npc: [
                                    "Err thank you. It's a pretty ordinary cooks hat really.",
                                ],
                            },
                        ],
                    },
                    {
                        text: "Can I use your range?",
                        next: [
                            { player: ["Can I use your range?"] },
                            {
                                npc: [
                                    "Go ahead - it's a very good range.",
                                    "It's easier to use than most other ranges.",
                                ],
                            },
                        ],
                    },
                ],
            },
        ]);
    });
}
