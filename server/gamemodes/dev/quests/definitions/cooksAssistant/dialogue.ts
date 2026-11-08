import type { PlayerState } from "../../../../../src/game/player";
import type { NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    getQuestStage,
    hasQuestItems,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import { type DialogueContext, type DialogueStep, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BUCKET_OF_MILK_ITEM_ID,
    COOK_NPC_ID,
    EGG_ITEM_ID,
    POT_OF_FLOUR_ITEM_ID,
    REQUIRED_ITEMS,
    STAGE_COMPLETE,
    STAGE_STARTED,
} from "./constants";

function acceptQuestSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        { player: ["Yes, I'll help you."] },
        {
            exec: ({ player, services }) => {
                setQuestStage(player, quest, services, STAGE_STARTED);
            },
        },
        {
            npc: [
                "Oh thank you, thank you. I need milk, an egg and",
                "flour. I'd be very grateful if you can get them",
                "for me.",
            ],
        },
    ];
}

function whatsWrongSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        { player: ["What's wrong?"] },
        {
            npc: [
                "Ooh dear, I'm in a terrible mess! It's the Duke's",
                "birthday today, and I'm meant to be making him a",
                "big cake for this evening.",
            ],
        },
        {
            npc: [
                "Unfortunately, I've forgotten to buy some of the",
                "ingredients. I'll never get them in time now. I",
                "don't suppose you could help me?",
            ],
        },
        {
            options: [
                { text: "Yes, I'll help you.", echo: false, next: acceptQuestSteps(quest) },
                {
                    text: "No, I don't feel like it. Maybe later.",
                    next: [{ npc: ["OK, suit yourself!"] }],
                },
            ],
        },
    ];
}

function notStartedSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        { npc: ["What am I to do?"] },
        {
            options: [
                { text: "What's wrong?", echo: false, next: whatsWrongSteps(quest) },
                {
                    text: "Well, you could give me all your money!",
                    next: [{ npc: ["Haha, very funny!"] }],
                },
                {
                    text: "You don't look very happy.",
                    next: [
                        { npc: ["No, I'm not."] },
                        {
                            options: [
                                {
                                    text: "What's wrong?",
                                    echo: false,
                                    next: whatsWrongSteps(quest),
                                },
                                {
                                    text: "I'd take the rest of the day off if I were you.",
                                    next: [
                                        {
                                            npc: [
                                                "No, that's the worst thing I could do - I'd",
                                                "get in terrible trouble.",
                                            ],
                                        },
                                        ...whatsWrongSteps(quest),
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {
                    text: "Nice hat!",
                    next: [
                        {
                            npc: [
                                "Err thank you. It's a pretty ordinary cook's hat",
                                "really.",
                            ],
                        },
                    ],
                },
            ],
        },
    ];
}

function hasItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.getInventoryItems(player).some(
        (entry) => entry.itemId === itemId && entry.quantity > 0,
    );
}

function inProgressSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (hasQuestItems(player, services, REQUIRED_ITEMS)) {
        return [
            { npc: ["How are you getting on with finding the ingredients?"] },
            { player: ["I now have everything you need for your cake!", "Milk, flour, and an egg!"] },
            { npc: ["I am saved, thank you!"] },
            {
                exec: ({ player: questPlayer, services: questServices }) => {
                    if (!takeQuestItems(questPlayer, questServices, REQUIRED_ITEMS)) return;
                    questServices.messaging.sendGameMessage(
                        questPlayer,
                        "You give some milk, an egg and some flour to the cook.",
                    );
                    completeQuest(questPlayer, questServices, quest);
                },
            },
        ];
    }

    const found = [
        hasItem(player, services, BUCKET_OF_MILK_ITEM_ID) ? "I have some milk." : undefined,
        hasItem(player, services, POT_OF_FLOUR_ITEM_ID) ? "I have some flour." : undefined,
        hasItem(player, services, EGG_ITEM_ID) ? "I have an egg." : undefined,
    ].filter((line): line is string => line !== undefined);
    const missing = [
        !hasItem(player, services, BUCKET_OF_MILK_ITEM_ID) ? "Some milk." : undefined,
        !hasItem(player, services, POT_OF_FLOUR_ITEM_ID) ? "Some flour." : undefined,
        !hasItem(player, services, EGG_ITEM_ID) ? "An egg." : undefined,
    ].filter((line): line is string => line !== undefined);

    if (found.length === 0) {
        return [
            { npc: ["How are you getting on with finding the ingredients?"] },
            { player: ["I'm afraid I don't have any yet!"] },
            {
                npc: [
                    "Oh dear, oh dear! I need flour, eggs and milk.",
                    "Without them I am doomed!",
                ],
            },
        ];
    }

    return [
        { npc: ["How are you getting on with finding the ingredients?"] },
        { player: ["I have found some of the things you asked for.", ...found] },
        { npc: ["Great, but can you get the other ingredients as well?", ...missing] },
        { player: ["OK, I'll try and find that for you."] },
    ];
}

const completedSteps: DialogueStep[] = [
    { npc: ["How is the adventuring going, my friend?"] },
    {
        options: [
            {
                text: "I am getting strong and mighty.",
                next: [{ npc: ["Glad to hear it."] }],
            },
            {
                text: "I keep on dying.",
                next: [{ npc: ["Ah well, at least you keep coming back to life!"] }],
            },
            {
                text: "Nice hat!",
                next: [
                    { npc: ["Err thank you. It's a pretty ordinary cook's hat really."] },
                ],
            },
            {
                text: "Can I use your range?",
                next: [
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
];

export function createCookTalkHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return ({ player, services }) => {
        const context: DialogueContext = {
            player,
            services,
            npcId: COOK_NPC_ID,
            npcName: "Cook",
        };
        const stage = getQuestStage(player, quest);
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, completedSteps);
        } else if (stage >= STAGE_STARTED) {
            startConversation(context, inProgressSteps(quest, player, services));
        } else {
            startConversation(context, notStartedSteps(quest));
        }
    };
}
