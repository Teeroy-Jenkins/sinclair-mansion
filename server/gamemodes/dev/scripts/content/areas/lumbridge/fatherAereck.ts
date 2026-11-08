/**
 * Father Aereck default chatter (LostCity father_aereck_default).
 * Restless Ghost quest stages deferred — quest option is a soft stub for now.
 */
import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import type { DialogueStep } from "../../../../npcs/helpers";
import { registerTalkTo, startNpcConversation } from "../../../../npcs/helpers";

const FATHER_AERECK_NPC_ID = 2812;

function saradominBranch(): DialogueStep[] {
    return [
        { player: ["Who's Saradomin?"] },
        { npc: ["Surely you have heard of the god, Saradomin?"] },
        {
            npc: [
                "He who creates the forces of goodness and purity in this world? I cannot believe your ignorance!",
                "This is the God with more followers than any other!.. At least in this part of the world.",
                "He who created this world along with his brothers Guthix and Zamorak?",
            ],
        },
        {
            options: [
                {
                    text: "Oh, THAT Saradomin...",
                    next: [
                        { player: ["Oh, THAT Saradomin..."] },
                        { npc: ["There... is only one Saradomin..."] },
                    ],
                },
                {
                    text: "Oh, sorry. I'm not from this world.",
                    next: [
                        { player: ["Oh, sorry. I'm not from this world."] },
                        {
                            npc: [
                                "...",
                                "That's... strange.",
                                "I thought things not from this world were all slime and tenticles.",
                            ],
                        },
                        {
                            options: [
                                {
                                    text: "You don't understand. This is a computer game!",
                                    next: [
                                        {
                                            player: [
                                                "You don't understand. This is a computer game!",
                                            ],
                                        },
                                        { npc: ["I... beg your pardon?"] },
                                        { player: ["Never mind."] },
                                    ],
                                },
                                {
                                    text: "I am - do you like my disguise?",
                                    next: [
                                        { player: ["I am - do you like my disguise?"] },
                                        {
                                            npc: [
                                                "Aargh! Begone foul creature from another dimension!",
                                            ],
                                        },
                                        { player: ["Ok, ok, I was only joking..."] },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ];
}

export function registerFatherAereckHandlers(registry: IScriptRegistry): void {
    registerTalkTo(registry, [FATHER_AERECK_NPC_ID], (event) => {
        startNpcConversation(event, [
            { npc: ["Welcome to the church of holy Saradomin."] },
            {
                options: [
                    {
                        text: "Who's Saradomin?",
                        next: saradominBranch(),
                    },
                    {
                        text: "Nice place you've got here.",
                        next: [
                            { player: ["Nice place you've got here."] },
                            {
                                npc: [
                                    "It is, isn't it?",
                                    "It was built over 230 years ago.",
                                ],
                            },
                        ],
                    },
                    {
                        text: "I'm looking for a quest!",
                        next: [
                            { player: ["I'm looking for a quest."] },
                            {
                                npc: [
                                    // Restless Ghost stages not ported yet — soft stub.
                                    "That's lucky, I need someone to do a quest for me.",
                                    "There is a ghost in the church graveyard — come back once that quest is available here.",
                                ],
                            },
                        ],
                    },
                ],
            },
        ]);
    });
}
