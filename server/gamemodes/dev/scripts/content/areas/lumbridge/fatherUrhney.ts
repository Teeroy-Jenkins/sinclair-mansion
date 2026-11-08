/**
 * Father Urhney default chatter (LostCity father_urhney.rs2 non-quest branches).
 * Restless Ghost amulet flow deferred with the quest.
 */
import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerTalkTo, startNpcConversation } from "../../../../npcs/helpers";

const FATHER_URHNEY_NPC_ID = 923;

export function registerFatherUrhneyHandlers(registry: IScriptRegistry): void {
    registerTalkTo(registry, [FATHER_URHNEY_NPC_ID], (event) => {
        startNpcConversation(event, [
            { npc: ["Go away! I'm meditating!"] },
            {
                options: [
                    {
                        text: "Well, that's friendly.",
                        next: [
                            { player: ["Well, that's friendly."] },
                            { npc: ["I SAID go AWAY."] },
                            { player: ["Okay, okay..."] },
                        ],
                    },
                    {
                        text: "I've come to repossess your house.",
                        next: [
                            { player: ["I've come to repossess your house."] },
                            { npc: ["Under what grounds???"] },
                            {
                                options: [
                                    {
                                        text: "Repeated failure on mortgage payments.",
                                        next: [
                                            {
                                                player: [
                                                    "Repeated failure on mortgage payments.",
                                                ],
                                            },
                                            { npc: ["What?"] },
                                            {
                                                npc: [
                                                    "But... I don't have a mortgage!",
                                                    "I built this house myself!",
                                                ],
                                            },
                                            {
                                                player: [
                                                    "Sorry. I must have got the wrong address.",
                                                    "All the houses look the same around here.",
                                                ],
                                            },
                                        ],
                                    },
                                    {
                                        text: "I don't know, I just wanted this house.",
                                        next: [
                                            {
                                                player: [
                                                    "I don't know. I just wanted this house...",
                                                ],
                                            },
                                            {
                                                npc: [
                                                    "Oh... go away and stop wasting my time!",
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ]);
    });
}
