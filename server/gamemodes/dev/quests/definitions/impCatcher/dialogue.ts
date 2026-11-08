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
    REQUIRED_ITEMS,
    STAGE_COMPLETE,
    STAGE_STARTED,
    WIZARD_MIZGOG_NPC_ID,
} from "./constants";

const quietWizardSteps: DialogueStep[] = [
    { player: ["Most of your friends are pretty quiet aren't they?"] },
    {
        npc: [
            "Yes, they've mostly got their heads in the clouds,",
            "thinking about magic.",
        ],
    },
];

function politeQuestSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        { player: ["Give me a quest please."] },
        { npc: ["Well seeing as you asked nicely...", "I could do with some help."] },
        {
            npc: [
                "The wizard Grayzag next door decided he didn't",
                "like me. So he summoned hundreds of little imps.",
            ],
        },
        {
            npc: [
                "These imps stole all sorts of my things. Most of",
                "them I don't care about, just eggs and balls of",
                "string and things.",
            ],
        },
        {
            npc: [
                "But they stole my four magical beads: a red one,",
                "a yellow one, a black one, and a white one.",
            ],
        },
        {
            npc: [
                "The imps have spread out all over the kingdom.",
                "Could you get my beads back for me?",
            ],
        },
        {
            exec: ({ player, services }) => {
                setQuestStage(player, quest, services, STAGE_STARTED);
            },
        },
        { player: ["I'll try."] },
    ];
}

function questRequestSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        { player: ["Give me a quest!"] },
        { npc: ["Give me a quest what?"] },
        {
            options: [
                {
                    text: "Give me a quest please.",
                    echo: false,
                    next: politeQuestSteps(quest),
                },
                {
                    text: "Give me a quest or else!",
                    next: [
                        { npc: ["Or else what? You'll attack me?"] },
                        { npc: ["Hahaha!"] },
                    ],
                },
                {
                    text: "Just stop messing around and give me a quest!",
                    next: [{ npc: ["Ah, now you're assuming I have one to give."] }],
                },
            ],
        },
    ];
}

function notStartedSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        { npc: ["Hello there."] },
        {
            options: [
                { text: "Give me a quest!", echo: false, next: questRequestSteps(quest) },
                {
                    text: "Most of your friends are pretty quiet aren't they?",
                    echo: false,
                    next: quietWizardSteps,
                },
            ],
        },
    ];
}

function inProgressSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (hasQuestItems(player, services, REQUIRED_ITEMS)) {
        return [
            { npc: ["So how are you doing finding my beads?"] },
            { player: ["I've got all four beads.", "It was hard work, I can tell you."] },
            { npc: ["Give them here and I'll sort out a reward."] },
            { npc: ["Here's your reward then, an amulet of accuracy."] },
            {
                exec: ({ player: questPlayer, services: questServices }) => {
                    if (!takeQuestItems(questPlayer, questServices, REQUIRED_ITEMS)) return;
                    questServices.messaging.sendGameMessage(
                        questPlayer,
                        "You give four coloured beads to Wizard Mizgog.",
                    );
                    completeQuest(questPlayer, questServices, quest);
                },
            },
        ];
    }
    const foundAny = REQUIRED_ITEMS.some((requirement) =>
        services.inventory
            .getInventoryItems(player)
            .some((entry) => entry.itemId === requirement.itemId && entry.quantity > 0),
    );
    return [
        { npc: ["So how are you doing finding my beads?"] },
        {
            player: [foundAny ? "I have found some of your beads." : "I have not found any yet."],
        },
        {
            npc: foundAny
                ? [
                      "Come back when you have them all. The colours",
                      "I need are red, yellow, black, and white.",
                      "Go chase some imps!",
                  ]
                : [
                      "Well get on with it. I've lost a white bead, a",
                      "red bead, a black bead, and a yellow bead.",
                      "Go kill some imps!",
                  ],
        },
    ];
}

const completedSteps: DialogueStep[] = [
    { npc: ["Hello there."] },
    {
        options: [
            {
                text: "Got any more quests?",
                next: [{ npc: ["No, everything is good with the world today."] }],
            },
            {
                text: "Most of your friends are pretty quiet aren't they?",
                echo: false,
                next: quietWizardSteps,
            },
        ],
    },
];

export function createMizgogTalkHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return ({ player, services }) => {
        const context: DialogueContext = {
            player,
            services,
            npcId: WIZARD_MIZGOG_NPC_ID,
            npcName: "Wizard Mizgog",
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
