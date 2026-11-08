import type { NpcInteractionEvent } from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage } from "../../QuestService";
import {
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
    showItem,
    startConversation,
    type DialogueContext,
    type DialogueStep,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    CADAVA_POTION_ITEM_ID,
    JULIETS_MESSAGE_ITEM_ID,
    JULIET_NPC_IDS,
    ROMEO_NPC_ID,
    STAGE_COMPLETE,
    STAGE_JULIET_IN_CRYPT,
    STAGE_PASSED_MESSAGE,
    STAGE_SPOKEN_TO_APOTHECARY,
    STAGE_SPOKEN_TO_FATHER_LAWRENCE,
    STAGE_SPOKEN_TO_JULIET,
    STAGE_SPOKEN_TO_ROMEO,
} from "./constants";
import { giveItem, hasCarriedItem, hasOwnedItem, takeItem } from "./items";

function agreeToFindJulietSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("Yes, I will tell her how you feel."),
        sayNpc("You are the saviour of my heart, thank you."),
        sayPlayer("Err, yes. Ok. That's... nice."),
        run(({ player, services }) =>
            setQuestStage(player, quest, services, STAGE_SPOKEN_TO_ROMEO),
        ),
    ];
}

function romeoStartSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("Juliet, Juliet, Juliet! Wherefore art thou?"),
        sayNpc("Kind friend, have you seen Juliet? She's disappeared and I can't find her anywhere."),
        choose([
            option("Yes, I have seen her.", [
                sayPlayer("I think it was her... blonde? A bit stressed?"),
                sayNpc("Yes, that sounds like her. Please tell her I long to be with her."),
                choose([
                    option("Yes, I will tell her.", agreeToFindJulietSteps(quest), {
                        echo: false,
                    }),
                    option("Sorry, I am too busy. Maybe later?", [
                        sayNpc("Well, if you do find her, I would be most grateful."),
                    ]),
                ]),
            ]),
            option("No, but that's girls for you.", [
                sayNpc("Not my dear Juliet, she is different."),
                sayNpc("Could you find her for me? Please tell her I long to be with her."),
                choose([
                    option(
                        "Yes, I will tell her how you feel.",
                        agreeToFindJulietSteps(quest),
                        { echo: false },
                    ),
                    option("I can't, it sounds like work to me.", [
                        sayNpc("I guess you are not the romantic type. Goodbye!"),
                    ]),
                ]),
            ]),
            option("Can I help find her for you?", [
                sayNpc("Oh, would you? That would be wonderful! Please tell her I long to be with her."),
                ...agreeToFindJulietSteps(quest),
            ]),
        ]),
    ];
}

function romeoMessageSteps(
    quest: QuestDefinition,
    event: NpcInteractionEvent,
): DialogueStep[] {
    if (!hasCarriedItem(event.player, event.services, JULIETS_MESSAGE_ITEM_ID)) {
        return [
            sayPlayer("Juliet gave me a message, but I don't have it with me."),
            sayNpc("Please bring it to me. I must know what she wrote!"),
        ];
    }
    return [
        sayPlayer("Romeo, I have a message from Juliet."),
        run(({ player, services }) => {
            if (!takeItem(player, services, JULIETS_MESSAGE_ITEM_ID)) return;
            setQuestStage(player, quest, services, STAGE_PASSED_MESSAGE);
            services.messaging.sendGameMessage(player, "You pass Juliet's message to Romeo.");
        }),
        sayNpc("Tragic news. Her father is opposing our marriage."),
        sayNpc("If her father sees me, he will kill me. I dare not go near his lands."),
        sayNpc("She says Father Lawrence can help us. Please find him and tell him of our plight."),
    ];
}

function romeoFatherSteps(): DialogueStep[] {
    return [
        sayNpc("Did you find the Father? What did he suggest?"),
        choose([
            option("He sent me to the Apothecary.", [
                sayNpc("I know him. He lives near the town square, behind the sloped building."),
                sayNpc("Good luck."),
            ]),
            option("He seems keen for you to marry Juliet.", [
                sayNpc("I think he wants some peace. He was our messenger before you helped us."),
            ]),
        ]),
    ];
}

function romeoPotionSteps(event: NpcInteractionEvent): DialogueStep[] {
    if (hasCarriedItem(event.player, event.services, CADAVA_POTION_ITEM_ID)) {
        return [
            sayNpc("Ah, you have the potion."),
            sayNpc("I was told what to do by the good Father. Better get it to Juliet."),
        ];
    }
    return [
        sayNpc("I hope the potion is nearly ready. It is the last step of the great plan."),
        sayNpc("I hope I will be with my dear one soon."),
    ];
}

function romeoFinishSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("Romeo, it's all set. Juliet has the potion."),
        sayNpc("Ah, right. What potion would that be then?"),
        sayPlayer("The one to get her to the crypt."),
        sayNpc("Ah, right. So she is dead then. Aww, that's a shame."),
        sayNpc("Thanks for your help anyway."),
        run(({ player, services }) => {
            completeQuest(player, services, quest);
        }),
    ];
}

export function createRomeoTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const context: DialogueContext = {
            player,
            services,
            npcId: ROMEO_NPC_ID,
            npcName: "Romeo",
        };
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage === 0) steps = romeoStartSteps(quest);
        else if (stage === STAGE_SPOKEN_TO_ROMEO) steps = [sayNpc("Please find my Juliet. I am so, so sad.")];
        else if (stage === STAGE_SPOKEN_TO_JULIET) steps = romeoMessageSteps(quest, event);
        else if (stage === STAGE_PASSED_MESSAGE) {
            steps = [
                sayNpc("Please, friend, how goes our quest?"),
                sayNpc("Father Lawrence must be told. Only he can help."),
            ];
        } else if (stage === STAGE_SPOKEN_TO_FATHER_LAWRENCE) steps = romeoFatherSteps();
        else if (stage === STAGE_SPOKEN_TO_APOTHECARY) steps = romeoPotionSteps(event);
        else if (stage === STAGE_JULIET_IN_CRYPT) steps = romeoFinishSteps(quest);
        else {
            steps = [
                sayNpc("I heard Juliet had died. Terrible business."),
                sayNpc("Her cousin and I are getting on well, though. Thanks for your help!"),
            ];
        }
        startConversation(context, steps);
    };
}

function giveJulietMessageSteps(
    quest: QuestDefinition,
    event: NpcInteractionEvent,
): DialogueStep[] {
    if (!event.services.inventory.canStoreItem(event.player, JULIETS_MESSAGE_ITEM_ID)) {
        return [
            sayPlayer("Certainly, I will deliver your message straight away."),
            sayNpc("You will need a free inventory space before I can give it to you."),
        ];
    }
    return [
        sayPlayer("Certainly, I will deliver your message straight away."),
        sayNpc("It may be our only hope."),
        run(({ player, services }) => {
            if (!giveItem(player, services, JULIETS_MESSAGE_ITEM_ID)) {
                services.messaging.sendGameMessage(player, "You need a free inventory space.");
                return;
            }
            setQuestStage(player, quest, services, STAGE_SPOKEN_TO_JULIET);
        }),
        showItem(JULIETS_MESSAGE_ITEM_ID, "Juliet gives you a message."),
    ];
}

function julietStartSteps(quest: QuestDefinition, event: NpcInteractionEvent): DialogueStep[] {
    return [
        sayNpc("Romeo, Romeo, wherefore art thou Romeo?"),
        sayNpc("Bold adventurer, have you seen Romeo? Skinny, wishy-washy, head full of poetry."),
        choose([
            option("Yes, I have met him.", [
                sayPlayer("I saw him somewhere. He seemed a bit depressed."),
                sayNpc("Could you please deliver a message to him?"),
                choose([
                    option(
                        "Certainly, I will do so straight away!",
                        giveJulietMessageSteps(quest, event),
                        { echo: false },
                    ),
                    option("No, he was a little too weird for me.", [
                        sayNpc("Oh dear, that will be the ruin of our love. You unromantic soul."),
                    ]),
                ]),
            ]),
            option("No, I think I would have remembered if I had.", [
                sayNpc("Could you please deliver a message to him?"),
                choose([
                    option(
                        "Certainly, I will do so straight away!",
                        giveJulietMessageSteps(quest, event),
                        { echo: false },
                    ),
                    option("No, I have better things to do.", [
                        sayNpc("I will not keep you from them. Goodbye."),
                    ]),
                ]),
            ]),
            option("I guess I could find him.", [
                sayNpc("That is most kind of you! Could you please deliver a message to him?"),
                ...giveJulietMessageSteps(quest, event),
            ]),
            option("I think you could do better.", [
                sayNpc("He has his good points. He doesn't spend all day on the internet, at least."),
            ]),
        ]),
    ];
}

function julietFromRomeoSteps(
    quest: QuestDefinition,
    event: NpcInteractionEvent,
): DialogueStep[] {
    return [
        sayPlayer("Juliet, I come from Romeo. He begs I tell you he still cares."),
        sayNpc("Please, take this message to him."),
        ...giveJulietMessageSteps(quest, event),
    ];
}

function julietMessageRecoverySteps(
    quest: QuestDefinition,
    event: NpcInteractionEvent,
): DialogueStep[] {
    if (hasOwnedItem(event.player, event.services, JULIETS_MESSAGE_ITEM_ID)) {
        return [sayNpc("Please deliver the message to Romeo with all speed!")];
    }
    if (!event.services.inventory.canStoreItem(event.player, JULIETS_MESSAGE_ITEM_ID)) {
        return [sayNpc("Make some room and I will write you another copy of the message.")];
    }
    return [
        sayNpc("How could you lose this most important message?"),
        sayNpc("Take this copy to him, and please don't lose it."),
        run(({ player, services }) => giveItem(player, services, JULIETS_MESSAGE_ITEM_ID)),
        showItem(JULIETS_MESSAGE_ITEM_ID, "Juliet gives you another message."),
    ];
}

function julietPotionSteps(
    quest: QuestDefinition,
    event: NpcInteractionEvent,
): DialogueStep[] {
    if (!hasCarriedItem(event.player, event.services, CADAVA_POTION_ITEM_ID)) {
        return [
            sayPlayer("I have to get a potion made for you. I haven't done that bit yet."),
            sayNpc("Fair luck to you. The end is close."),
        ];
    }
    return [
        sayPlayer("I have a Cadava potion from Father Lawrence."),
        sayPlayer("It should make you seem dead and get you away from this place."),
        run(({ player, services }) => {
            if (!takeItem(player, services, CADAVA_POTION_ITEM_ID)) return;
            setQuestStage(player, quest, services, STAGE_JULIET_IN_CRYPT);
            services.messaging.sendGameMessage(player, "You pass the potion to Juliet.");
        }),
        sayNpc("Wonderful. I just hope Romeo can remember to get me from the crypt."),
        sayNpc("Please go to Romeo and make sure he understands. He can be a bit dense sometimes."),
    ];
}

export function createJulietTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services, npc } = event;
        const context: DialogueContext = {
            player,
            services,
            npcId: npc.typeId ?? JULIET_NPC_IDS[0],
            npcName: "Juliet",
        };
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage === 0) steps = julietStartSteps(quest, event);
        else if (stage === STAGE_SPOKEN_TO_ROMEO) steps = julietFromRomeoSteps(quest, event);
        else if (stage === STAGE_SPOKEN_TO_JULIET) steps = julietMessageRecoverySteps(quest, event);
        else if (stage === STAGE_PASSED_MESSAGE) {
            steps = [
                sayPlayer("I passed on your message. Now I go to Father Lawrence for help."),
                sayNpc("Yes, he knows many things. I hope you find him soon!"),
            ];
        } else if (stage === STAGE_SPOKEN_TO_FATHER_LAWRENCE) {
            steps = [
                sayPlayer("I found the Father. Now I seek the Apothecary."),
                sayNpc("I do not know where he lives, but please make haste. My father is close."),
            ];
        } else if (stage === STAGE_SPOKEN_TO_APOTHECARY) steps = julietPotionSteps(quest, event);
        else if (stage === STAGE_JULIET_IN_CRYPT) {
            steps = [
                sayNpc("Have you seen Romeo? He will reward you for your help."),
                sayNpc("He is the wealth in this story. I am just the glamour."),
            ];
        } else {
            steps = [
                sayNpc("I sat in that cold crypt for ages waiting for Romeo."),
                sayNpc("That useless fool never showed up, and all I got was indigestion."),
                sayNpc("I am done with men like him. Now go away before I call my father!"),
            ];
        }
        startConversation(context, steps);
    };
}
