import type {
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    getQuestStage,
    hasQuestItems,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import {
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
    startConversation,
    type DialogueContext,
    type DialogueStep,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    HETTY_NPC_ID,
    REQUIRED_ITEMS,
    STAGE_COMPLETE,
    STAGE_INGREDIENTS_GIVEN,
    STAGE_STARTED,
} from "./constants";

function beginPotionSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("Ok, I'm going to make a potion to help bring out your darker self."),
        sayNpc("You will need certain ingredients."),
        sayPlayer("What do I need?"),
        run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED)),
        sayNpc("You need an eye of newt, a rat's tail, an onion... Oh, and a piece of burnt meat."),
        sayPlayer("Great, I'll go and get them."),
    ];
}

function questOfferSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("I am in search of a quest."),
        sayNpc("Hmmm... Maybe I can think of something for you."),
        sayNpc("Would you like to become more proficient in the dark arts?"),
        choose([
            option("Yes, help me become one with my darker side.", beginPotionSteps(quest)),
            option("No, I have my principles and honour.", [
                sayNpc("Suit yourself, but you're missing out."),
            ]),
            option("What, you mean improve my magic?", [
                sayNpc("Yes, improve your magic... Do you have no sense of drama?"),
                choose([
                    option("Yes, I'd like to improve my magic.", beginPotionSteps(quest)),
                    option("No, I'm not interested.", [
                        sayNpc("Many aren't to start off with."),
                        sayNpc("But I think you'll be drawn back to this place."),
                    ]),
                    option("Show me the mysteries of the dark arts...", beginPotionSteps(quest)),
                ]),
            ]),
        ]),
    ];
}

function notStartedSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("What could you want with an old woman like me?"),
        choose([
            option("I am in search of a quest.", questOfferSteps(quest), { echo: false }),
            option("I've heard that you are a witch.", [
                sayNpc("Yes, it does seem to be getting fairly common knowledge."),
                sayNpc("I fear I may get a visit from the witch hunters of Falador before long."),
            ]),
        ]),
    ];
}

function inProgressSteps(
    quest: QuestDefinition,
    services: ScriptServices,
    event: NpcInteractionEvent,
): DialogueStep[] {
    if (!hasQuestItems(event.player, services, REQUIRED_ITEMS)) {
        return [
            sayNpc("So, have you found the things for the potion?"),
            sayPlayer("No, not yet."),
            sayNpc(
                "I can't make it without them! You need an eye of newt, a rat's tail, an onion, and a piece of burnt meat. Off you go, dear!",
            ),
        ];
    }
    return [
        sayNpc("So, have you found the things for the potion?"),
        sayPlayer("Yes, I have everything!"),
        sayNpc("Excellent, can I have them then?"),
        run(({ player, services: questServices }) => {
            if (!takeQuestItems(player, questServices, REQUIRED_ITEMS)) return;
            questServices.messaging.sendGameMessage(
                player,
                "You pass the ingredients to Hetty. She puts them into her cauldron and begins to chant.",
            );
            setQuestStage(player, quest, questServices, STAGE_INGREDIENTS_GIVEN);
        }),
        sayPlayer("Well, is it ready?"),
        sayNpc("Ok, now drink from the cauldron."),
    ];
}

const completedSteps: DialogueStep[] = [
    sayNpc("How's your magic coming along?"),
    sayPlayer("I'm practising and slowly getting better."),
    sayNpc("Good, good."),
];

export function createHettyTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const context: DialogueContext = {
            player,
            services,
            npcId: HETTY_NPC_ID,
            npcName: "Hetty",
        };
        const stage = getQuestStage(player, quest);
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, completedSteps);
        } else if (stage >= STAGE_INGREDIENTS_GIVEN) {
            startConversation(context, [sayNpc("Well, are you going to drink the potion or not?")]);
        } else if (stage >= STAGE_STARTED) {
            startConversation(context, inProgressSteps(quest, services, event));
        } else {
            startConversation(context, notStartedSteps(quest));
        }
    };
}

