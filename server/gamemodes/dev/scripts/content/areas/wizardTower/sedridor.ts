/**
 * Sedridor / head wizard default chatter (LostCity sedridor.rs2 not_started).
 * Rune Mysteries stages + essence teleport deferred.
 */
import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import type { DialogueStep } from "../../../../npcs/helpers";
import { registerTalkTo, startNpcConversation } from "../../../../npcs/helpers";

const SEDRIDOR_NPC_IDS = [5034, 11432, 11433];

function lookingAroundBranch(): DialogueStep[] {
    return [
        { player: ["Nothing thanks, I'm just looking around."] },
        {
            npc: [
                "Well, take care adventurer. You stand on the ruins of the destroyed Wizards' Tower. Strange and powerful magicks lurk here.",
            ],
        },
    ];
}

function whatAreYouDoingBranch(): DialogueStep[] {
    return [
        { player: ["What are you doing down here?"] },
        {
            npc: [
                "That is indeed a good question. Here in the cellar of the Wizards' Tower you find the remains of the old Wizards' Tower, destroyed by fire many years past by the treachery of the Zamorakians.",
                "Many mysteries were lost, which we try to find once more. By building this Tower on the remains of the old, we sought to show the world of our dedication to learning the mysteries of Magic.",
                "I am here searching through these fragments for knowledge from the artefacts from our past.",
            ],
        },
        { player: ["And have you found anything useful?"] },
        {
            npc: [
                "Aaaah... that would be telling adventurer. Anything I have found I cannot speak freely of, for fear the treachery of the past might be repeated.",
            ],
        },
        {
            options: [
                {
                    text: "Ok, well I'll leave you to it.",
                    next: [{ player: ["Ok, well I'll leave you to it."] }],
                },
                {
                    text: "What do you mean treachery?",
                    next: [
                        {
                            npc: [
                                "Well, it is a long story from the past... Many years ago, this Wizards' Tower was a focus of great learning, as we mages studied together to try and learn the secrets behind the Rune Stones.",
                                "Legends tell us that in the past the mages who lived here could fashion Rune Stones almost at will.",
                                "No, unfortunately not anymore. Many years past, the Wizards who follow Zamorak burned this Tower to the ground, and all who were inside.",
                                "This is why I spend my time searching through these few remains. Someday I hope we may once more create our own runes!",
                            ],
                        },
                        { player: ["Ok, well I'll leave you to it."] },
                    ],
                },
            ],
        },
    ];
}

function headWizardStubBranch(): DialogueStep[] {
    return [
        { player: ["I'm looking for the head wizard."] },
        {
            npc: [
                "Oh you are, are you? And just why would you be doing that?",
                // Soft stub until Rune Mysteries is ported.
                "If the Duke of Lumbridge has sent you with a talisman, return once Rune Mysteries is available here — I am the head wizard you seek.",
            ],
        },
    ];
}

export function registerSedridorHandlers(registry: IScriptRegistry): void {
    registerTalkTo(registry, SEDRIDOR_NPC_IDS, (event) => {
        startNpcConversation(event, [
            {
                npc: [
                    "Welcome adventurer, to the world renowned Wizards' Tower. How may I help you?",
                ],
            },
            {
                options: [
                    {
                        text: "Nothing thanks, I'm just looking around.",
                        next: lookingAroundBranch(),
                    },
                    {
                        text: "What are you doing down here?",
                        next: whatAreYouDoingBranch(),
                    },
                    {
                        text: "I'm looking for the head wizard.",
                        next: headWizardStubBranch(),
                    },
                ],
            },
        ]);
    });
}
