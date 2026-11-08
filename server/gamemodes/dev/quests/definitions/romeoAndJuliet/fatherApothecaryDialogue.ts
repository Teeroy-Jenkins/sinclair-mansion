import type { NpcInteractionEvent } from "../../../../../src/game/scripts/types";
import {
    countCarriedItem,
    getQuestStage,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
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
    APOTHECARY_NPC_ID,
    APOTHECARY_SPOT_POTION_ITEM_ID,
    CADAVA_BERRIES_ITEM_ID,
    CADAVA_POTION_ITEM_ID,
    COINS_ITEM_ID,
    FATHER_LAWRENCE_NPC_ID,
    LIMPWURT_ROOT_ITEM_ID,
    RED_SPIDERS_EGGS_ITEM_ID,
    STAGE_PASSED_MESSAGE,
    STAGE_SPOKEN_TO_APOTHECARY,
    STAGE_SPOKEN_TO_FATHER_LAWRENCE,
    STRENGTH_POTION_4_ITEM_ID,
} from "./constants";
import { giveItem, hasCarriedItem, takeItem } from "./items";

function fatherPrequestSteps(): DialogueStep[] {
    return [
        sayNpc("Hello adventurer, do you seek a quest?"),
        choose([
            option("I am always looking for a quest.", [
                sayNpc("Poor Romeo is wandering around the square. I think he may need help."),
                sayNpc("I was helping him and Juliet to meet, but it became impossible."),
            ]),
            option("No, I prefer just to kill things.", [
                sayNpc("That's a fine career in these lands. There is more that needs killing every day."),
            ]),
            option("Can you recommend a good bar?", [
                sayNpc("Drinking will be the death of you."),
                sayNpc("But the Blue Moon in the city is cheap enough."),
            ]),
        ]),
    ];
}

function fatherHelpSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("Romeo sent me. He says you can help."),
        sayNpc("Ah, Romeo. A fine lad, but a little confused."),
        sayPlayer("Juliet must be rescued from her father's control."),
        sayNpc("I know just the thing: a potion to make her appear dead."),
        sayNpc("Then Romeo can collect her from the crypt."),
        sayNpc("Go to the Apothecary and tell him I sent you. You will need a Cadava potion."),
        run(({ player, services }) =>
            setQuestStage(player, quest, services, STAGE_SPOKEN_TO_FATHER_LAWRENCE),
        ),
    ];
}

function fatherApothecaryProgressSteps(event: NpcInteractionEvent): DialogueStep[] {
    if (hasCarriedItem(event.player, event.services, CADAVA_POTION_ITEM_ID)) {
        return [
            sayNpc("Did you find the Apothecary?"),
            sayPlayer("I've got the Cadava potion."),
            sayNpc("Good work! Take it to Juliet; she is expecting you."),
            sayNpc("I'll talk to Romeo and make sure he knows what to do."),
        ];
    }
    if (hasCarriedItem(event.player, event.services, CADAVA_BERRIES_ITEM_ID)) {
        return [
            sayNpc("Did you find the Apothecary?"),
            sayPlayer("I am on my way back to him with the ingredients."),
            sayNpc("Good work. Get the potion to Juliet when you have it."),
        ];
    }
    return [
        sayNpc("Did you find the Apothecary?"),
        sayPlayer("Yes. I must find some Cadava berries."),
        sayNpc("Take care. They are poisonous to the touch."),
    ];
}

export function createFatherLawrenceTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const context: DialogueContext = {
            player,
            services,
            npcId: FATHER_LAWRENCE_NPC_ID,
            npcName: "Father Lawrence",
        };
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage === 0) steps = fatherPrequestSteps();
        else if (stage === STAGE_PASSED_MESSAGE) steps = fatherHelpSteps(quest);
        else if (stage === STAGE_SPOKEN_TO_FATHER_LAWRENCE) {
            steps = [
                sayNpc("Ah, have you found the Apothecary yet?"),
                sayNpc("Remember: Cadava potion, for Father Lawrence."),
            ];
        } else if (stage === STAGE_SPOKEN_TO_APOTHECARY) {
            steps = fatherApothecaryProgressSteps(event);
        } else {
            steps = [
                sayNpc("Oh, to be a father in the times of whiskey."),
                sayNpc("To err is human; to forgive, quite difficult."),
            ];
        }
        startConversation(context, steps);
    };
}

function strengthPotionSteps(event: NpcInteractionEvent): DialogueStep[] {
    const hasIngredients =
        countCarriedItem(event.player, event.services, LIMPWURT_ROOT_ITEM_ID) > 0 &&
        countCarriedItem(event.player, event.services, RED_SPIDERS_EGGS_ITEM_ID) > 0 &&
        countCarriedItem(event.player, event.services, COINS_ITEM_ID) >= 5;
    if (!hasIngredients) {
        return [
            sayPlayer("Can you make a strength potion?"),
            sayNpc("Yes, but the ingredients are a little hard to find."),
            sayNpc("You need red spiders' eggs, a limpwurt root and 5 coins."),
            sayPlayer("Ok, I'll look out for them."),
        ];
    }
    return [
        sayPlayer("Can you make a strength potion?"),
        sayPlayer("I have the root and spiders' eggs needed to make it."),
        sayNpc("Give me them and 5 gold and I'll make your potion."),
        choose([
            option("Yes, ok.", [
                run(({ player, services }) => {
                    const removed = takeQuestItems(player, services, [
                        { itemId: RED_SPIDERS_EGGS_ITEM_ID, quantity: 1, journalLabel: "" },
                        { itemId: LIMPWURT_ROOT_ITEM_ID, quantity: 1, journalLabel: "" },
                        { itemId: COINS_ITEM_ID, quantity: 5, journalLabel: "" },
                    ]);
                    if (!removed) return;
                    giveItem(player, services, STRENGTH_POTION_4_ITEM_ID);
                    services.messaging.sendGameMessage(
                        player,
                        "The Apothecary brews you a strength potion.",
                    );
                }),
                showItem(STRENGTH_POTION_4_ITEM_ID, "The Apothecary gives you a strength potion."),
            ]),
            option("No thanks."),
        ]),
    ];
}

function giveawaySteps(event: NpcInteractionEvent): DialogueStep[] {
    if (hasCarriedItem(event.player, event.services, APOTHECARY_SPOT_POTION_ITEM_ID)) {
        return [
            sayPlayer("Have you got any good potions to give away?"),
            sayNpc("Only that spot cream. Hope you enjoy it."),
        ];
    }
    if (Math.random() >= 0.5) {
        return [
            sayPlayer("Have you got any good potions to give away?"),
            sayNpc("Sorry, charity is not my strong point."),
        ];
    }
    if (!event.services.inventory.canStoreItem(event.player, APOTHECARY_SPOT_POTION_ITEM_ID)) {
        return [sayNpc("I would give you something, but you have no room for it.")];
    }
    return [
        sayPlayer("Have you got any good potions to give away?"),
        sayNpc("Ok then. Try this potion."),
        run(({ player, services }) => giveItem(player, services, APOTHECARY_SPOT_POTION_ITEM_ID)),
        showItem(APOTHECARY_SPOT_POTION_ITEM_ID, "The Apothecary gives you a potion."),
    ];
}

function apothecaryStandardSteps(event: NpcInteractionEvent): DialogueStep[] {
    return [
        sayNpc("I am the Apothecary. I have potions to brew. Do you need anything specific?"),
        choose([
            option("Can you make a strength potion?", strengthPotionSteps(event), { echo: false }),
            option("Do you know any potion to make hair fall out?", [
                sayNpc("I do indeed. I gave it to my mother. That's why I now live alone."),
            ]),
            option("Have you got any good potions to give away?", giveawaySteps(event), {
                echo: false,
            }),
        ]),
    ];
}

function lawrenceSentSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("Apothecary, Father Lawrence sent me."),
        sayPlayer("I need a Cadava potion to help Romeo and Juliet."),
        sayNpc("Cadava potion. It's pretty nasty, and hard to make."),
        sayNpc("Wing of rat, tail of frog; ear of snake and horn of dog."),
        sayNpc("I have all of that, but I need some Cadava berries."),
        sayNpc("Bring them here while I get the rest ready. Be careful; they are nasty."),
        run(({ player, services }) =>
            setQuestStage(player, quest, services, STAGE_SPOKEN_TO_APOTHECARY),
        ),
    ];
}

function makeCadavaSteps(event: NpcInteractionEvent): DialogueStep[] {
    if (hasCarriedItem(event.player, event.services, CADAVA_POTION_ITEM_ID)) {
        return apothecaryStandardSteps(event);
    }
    if (!hasCarriedItem(event.player, event.services, CADAVA_BERRIES_ITEM_ID)) {
        return [sayNpc("Keep searching for the berries. They are needed for the potion.")];
    }
    return [
        sayNpc("Well done. You have the berries."),
        run(({ player, services }) => {
            if (!takeItem(player, services, CADAVA_BERRIES_ITEM_ID)) return;
            giveItem(player, services, CADAVA_POTION_ITEM_ID);
            services.messaging.sendGameMessage(
                player,
                "The Apothecary shakes the berries in a vial of strange liquid.",
            );
        }),
        sayNpc("Here is what you need."),
        showItem(CADAVA_POTION_ITEM_ID, "The Apothecary gives you a Cadava potion."),
    ];
}

export function createApothecaryTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const context: DialogueContext = {
            player,
            services,
            npcId: APOTHECARY_NPC_ID,
            npcName: "Apothecary",
        };
        const stage = getQuestStage(player, quest);
        const steps =
            stage === STAGE_SPOKEN_TO_FATHER_LAWRENCE
                ? lawrenceSentSteps(quest)
                : stage === STAGE_SPOKEN_TO_APOTHECARY
                  ? makeCadavaSteps(event)
                  : apothecaryStandardSteps(event);
        startConversation(context, steps);
    };
}

