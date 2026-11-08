import type { IScriptRegistry, NpcInteractionEvent } from "../../../../src/game/scripts/types";
import {
    type DialogueStep,
    choose,
    giveItems,
    option,
    sayNpc,
    sayPlayer,
} from "../dialogue";
import { npcIdsByNames, registerTalkTo, startNpcConversation } from "../helpers";

const BOBS_FLYER = 956;

const RANDOM_REPLIES: DialogueStep[][] = [
    [sayNpc("I'm fine, how are you?"), sayPlayer("Very well thank you.")],
    [sayNpc("I think we need a new king. The one we've got isn't very good.")],
    [
        sayNpc("How can I help you?"),
        choose([
            option(
                "Do you wish to trade?",
                [
                    sayNpc(
                        "No, I have nothing I wish to get rid of. If you want to do some trading, there are plenty of shops and market stalls around though.",
                    ),
                ],
            ),
            option("I'm in search of a quest.", [
                sayNpc("I'm sorry I can't help you there."),
            ]),
            option("I'm in search of enemies to kill.", [
                sayNpc(
                    "I've heard there are many fearsome creatures that dwell under the ground...",
                ),
            ]),
        ]),
    ],
    [sayNpc("None of your business.")],
    [sayNpc("Not too bad thanks.")],
    [
        sayNpc(
            "Not too bad, but I'm a little worried about the increase of goblins these days.",
        ),
        sayPlayer("Don't worry, I'll kill them."),
    ],
    [
        sayNpc("Who are you?"),
        sayPlayer("I'm a bold adventurer."),
        sayNpc("Ah, a very noble profession."),
    ],
    [sayNpc("I'm very well thank you.")],
    [sayNpc("Hello there! Nice weather we've been having.")],
    [
        sayNpc("Hello, how's it going?"),
        sayPlayer("I'm in search of enemies to kill."),
        sayNpc(
            "I've heard there are many fearsome creatures that dwell under the ground...",
        ),
    ],
    [
        sayNpc("Hello, how's it going?"),
        sayPlayer("I'm in search of a quest."),
        sayNpc("I'm sorry I can't help you there."),
    ],
    [
        sayNpc("Hello, how's it going?"),
        sayPlayer("Do you wish to trade?"),
        sayNpc(
            "No, I have nothing I wish to get rid of. If you want to do some trading, there are plenty of shops and market stalls around though.",
        ),
    ],
    [sayNpc("Hello.")],
    [sayNpc("Do I know you? I'm in a hurry!")],
    [
        sayNpc(
            "I'm a little worried - I've heard there's lots of people going about, killing citizens at random.",
        ),
    ],
    [sayNpc("Get out of my way, I'm in a hurry!")],
    [sayNpc("I'm busy right now.")],
    [sayNpc("Are you asking for a fight?")],
    [sayNpc("Yo, wassup!")],
    [sayNpc("That is classified information.")],
    [sayNpc("No I don't have any spare change.")],
    [sayNpc("No, I don't want to buy anything!")],
];

function personDialogue(event: NpcInteractionEvent): void {
    const flyerChance = Math.floor(Math.random() * 128) === 0;
    const canTakeFlyer =
        flyerChance &&
        event.player.items.getFreeSlotCount() > 0 &&
        !event.player.items.hasItem(BOBS_FLYER);

    if (canTakeFlyer) {
        startNpcConversation(event, [
            sayPlayer("Hello, how's it going?"),
            sayNpc("Have this flyer..."),
            giveItems(BOBS_FLYER),
        ]);
        return;
    }

    const branch = RANDOM_REPLIES[Math.floor(Math.random() * RANDOM_REPLIES.length)]!;
    startNpcConversation(event, [sayPlayer("Hello, how's it going?"), ...branch]);
}

/**
 * OSRS "Man" / "Woman" ambient dialogue (OpenRune GenericPerson).
 * Bound by spawn name so it covers all matching type IDs.
 */
export function registerGenericPersonHandlers(registry: IScriptRegistry): void {
    const ids = npcIdsByNames("Man", "Woman");
    if (!ids.length) return;
    registerTalkTo(registry, ids, personDialogue);
}
