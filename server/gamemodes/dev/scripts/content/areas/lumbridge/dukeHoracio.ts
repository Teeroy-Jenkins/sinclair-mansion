/**
 * Duke Horacio default chatter (LostCity duke_horacio.rs2).
 * Rune Mysteries / Dragon Slayer shield deferred — quest options soft-stubbed.
 */
import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import type { DialogueStep } from "../../../../npcs/helpers";
import { registerTalkTo, startNpcConversation } from "../../../../npcs/helpers";

const DUKE_HORACIO_NPC_ID = 815;

function moneyBranch(): DialogueStep[] {
    return [
        { player: ["Where can I find money?"] },
        {
            npc: [
                "I've heard that the blacksmiths are prosperous amongst the peasantry. Maybe you could try your hand at that?",
            ],
        },
    ];
}

function questStubBranch(): DialogueStep[] {
    return [
        { player: ["Have you any quests for me?"] },
        {
            npc: [
                "Well, it's not really a quest but I recently discovered this strange talisman.",
                "It seems to be mystical — once Rune Mysteries is available here, I'll ask you to take it to the Wizards' Tower.",
            ],
        },
    ];
}

export function registerDukeHoracioHandlers(registry: IScriptRegistry): void {
    registerTalkTo(registry, [DUKE_HORACIO_NPC_ID], (event) => {
        startNpcConversation(event, [
            { npc: ["Greetings. Welcome to my castle."] },
            {
                options: [
                    {
                        text: "Have you any quests for me?",
                        next: questStubBranch(),
                    },
                    {
                        text: "Where can I find money?",
                        next: moneyBranch(),
                    },
                ],
            },
        ]);
    });
}
