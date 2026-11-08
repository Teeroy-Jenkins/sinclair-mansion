import type {
    ItemOnNpcEvent,
    NpcInteractionEvent,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    getQuestStage,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BROTHER_CEDRIC_NPC_ID,
    BROTHER_OMAD_NPC_ID,
    CHILDS_BLANKET_ITEM_ID,
    JUG_OF_WATER_ITEM_ID,
    LOGS_ITEM_ID,
    PARTY_BALLOON_LOC_IDS,
    PARTY_BALLOON_TILES,
    STAGE_COMPLETE,
    STAGE_FINDING_WATER,
    STAGE_FIXED_CART,
    STAGE_FIXING_CART,
    STAGE_GIVEN_WATER,
    STAGE_LOOKING_FOR_CEDRIC,
    STAGE_RETURNED_BLANKET,
    STAGE_STARTED,
} from "./constants";

type MonkNpcEvent = NpcInteractionEvent | ItemOnNpcEvent;

function hasItem(event: MonkNpcEvent, itemId: number): boolean {
    return event.services.inventory
        .getInventoryItems(event.player)
        .some((entry) => entry.itemId === itemId && entry.quantity > 0);
}

function context(event: MonkNpcEvent, npcId: number, npcName: string) {
    return { player: event.player, services: event.services, npcId, npcName };
}

function cartHelpSteps(quest: QuestDefinition) {
    return [
        sayNpc([
            "I was bringing food for Brother Omad's party, but my cart",
            "has broken. Could you help me repair it?",
        ]),
        choose([
            option("Yes, I'll help repair it.", [
                sayNpc("Thank you. One set of ordinary logs should do it."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_FIXING_CART),
                ),
            ]),
            option("No, sorry.", [sayNpc("Oh dear. Ask me again if you change your mind.")]),
        ]),
    ];
}

export function createOmadTalkHandler(quest: QuestDefinition): (event: MonkNpcEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const omad = context(event, BROTHER_OMAD_NPC_ID, "Brother Omad");
        if (stage >= STAGE_COMPLETE) {
            startConversation(omad, [
                sayNpc("Hic! That was a wonderful party. I may have danced a little too much."),
            ]);
            return;
        }
        if (stage >= STAGE_FIXED_CART) {
            startConversation(omad, [
                sayNpc("Brother Cedric is back, and the wine and food have arrived!"),
                sayPlayer("His cart is fixed. Is it finally time for the party?"),
                sayNpc("It certainly is. Everybody dance!"),
                run(({ player, services }) => {
                    services.animation.playPlayerSeq(player, 866);
                    if ("npc" in event) {
                        services.npc.queueNpcSeq(event.npc, 866);
                        services.npc.queueNpcForcedChat(event.npc, "Party!");
                    }
                    for (let i = 0; i < PARTY_BALLOON_TILES.length; i++) {
                        services.location.spawnLocForPlayer(
                            player,
                            PARTY_BALLOON_LOC_IDS[i],
                            PARTY_BALLOON_TILES[i],
                            0,
                            10,
                            i & 3,
                        );
                    }
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        if (stage >= STAGE_GIVEN_WATER) {
            startConversation(omad, [
                sayNpc("Have you found Brother Cedric? We cannot begin without the food and wine."),
                sayPlayer("I found him. I'm helping him with his cart."),
                sayNpc("Splendid. Please hurry back when it is repaired."),
            ]);
            return;
        }
        if (stage >= STAGE_LOOKING_FOR_CEDRIC) {
            startConversation(omad, [
                sayNpc("Brother Cedric should be somewhere on the road south of Ardougne."),
                sayPlayer("I'll keep looking for him."),
            ]);
            return;
        }
        if (stage >= STAGE_RETURNED_BLANKET) {
            startConversation(omad, [
                sayNpc("At last, peace and quiet. Now I can prepare for our party."),
                choose([
                    option("What party?", [
                        sayNpc([
                            "Brother Cedric is bringing wine and food, but he is very late.",
                            "Would you look for him?",
                        ]),
                        choose([
                            option("Where should I look?", [
                                sayNpc("Try the road south of Ardougne. He cannot be far away."),
                                run(({ player, services }) =>
                                    setQuestStage(
                                        player,
                                        quest,
                                        services,
                                        STAGE_LOOKING_FOR_CEDRIC,
                                    ),
                                ),
                            ]),
                            option("Can I come to the party?", [
                                sayNpc("Help us find Cedric and you will be our honoured guest."),
                            ]),
                            option("I don't have time.", [sayNpc("Very well. Perhaps later.")]),
                        ]),
                    ]),
                    option("Enjoy it.", [sayNpc("Thank you. If only Brother Cedric would arrive.")]),
                ]),
            ]);
            return;
        }
        if (stage >= STAGE_STARTED) {
            if (hasItem(event, CHILDS_BLANKET_ITEM_ID)) {
                startConversation(omad, [
                    sayPlayer("I found the child's blanket in the thieves' cave."),
                    sayNpc("Wonderful! The poor child can finally sleep."),
                    run(({ player, services }) => {
                        if (
                            !takeQuestItems(player, services, [
                                { itemId: CHILDS_BLANKET_ITEM_ID, quantity: 1, journalLabel: "" },
                            ])
                        ) {
                            return;
                        }
                        services.messaging.sendGameMessage(player, "You give Brother Omad the blanket.");
                        setQuestStage(player, quest, services, STAGE_RETURNED_BLANKET);
                    }),
                ]);
            } else {
                startConversation(omad, [
                    sayNpc("Please find the child's blanket. None of us have slept!"),
                    sayPlayer("Remind me where the thieves went."),
                    sayNpc([
                        "Their secret cave is beneath a ring of stones south-west",
                        "of the Clock Tower. Step inside the ring and look carefully.",
                    ]),
                ]);
            }
            return;
        }
        startConversation(omad, [
            sayNpc("Please, keep your voice down. I have not slept in a week."),
            choose([
                option("Why can't you sleep?", [
                    sayNpc([
                        "A child in our care will not stop crying. Thieves broke in",
                        "and stole his favourite blanket.",
                    ]),
                    choose([
                        option("I'll recover the blanket.", [
                            sayNpc([
                                "Thank you. The thieves hide in a cave beneath a ring",
                                "of stones south-west of the Clock Tower.",
                            ]),
                            run(({ player, services }) =>
                                setQuestStage(player, quest, services, STAGE_STARTED),
                            ),
                        ]),
                        option("I'm sorry, but I can't help.", [sayNpc("Then the crying continues...")]),
                    ]),
                ]),
                option("You look busy. I'll leave you alone.", [sayNpc("Thank you.")]),
            ]),
        ]);
    };
}

export function createCedricTalkHandler(quest: QuestDefinition): (event: MonkNpcEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const cedric = context(event, BROTHER_CEDRIC_NPC_ID, "Brother Cedric");
        if (stage >= STAGE_COMPLETE) {
            startConversation(cedric, [sayNpc("Thanks again. The cart is as good as new!")]);
            return;
        }
        if (stage >= STAGE_FIXED_CART) {
            startConversation(cedric, [
                sayNpc("The cart is fixed. Go and tell Brother Omad the party can begin!"),
            ]);
            return;
        }
        if (stage >= STAGE_FIXING_CART) {
            if (hasItem(event, LOGS_ITEM_ID)) {
                startConversation(cedric, [
                    sayPlayer("I have the logs for your cart."),
                    sayNpc("Perfect. These will make a strong new axle."),
                    run(({ player, services }) => {
                        if (
                            !takeQuestItems(player, services, [
                                { itemId: LOGS_ITEM_ID, quantity: 1, journalLabel: "" },
                            ])
                        ) {
                            return;
                        }
                        services.messaging.sendGameMessage(player, "You help Cedric repair the cart.");
                        setQuestStage(player, quest, services, STAGE_FIXED_CART);
                    }),
                    sayNpc("That did it! Tell Omad I am on my way."),
                ]);
            } else {
                startConversation(cedric, [
                    sayNpc("I still need one set of ordinary logs to repair the cart."),
                ]);
            }
            return;
        }
        if (stage >= STAGE_GIVEN_WATER) {
            startConversation(cedric, cartHelpSteps(quest));
            return;
        }
        if (stage >= STAGE_FINDING_WATER) {
            if (hasItem(event, JUG_OF_WATER_ITEM_ID)) {
                startConversation(cedric, [
                    sayPlayer("Here, drink this water."),
                    sayNpc("Water? I suppose it might clear my head."),
                    run(({ player, services }) => {
                        if (
                            !takeQuestItems(player, services, [
                                { itemId: JUG_OF_WATER_ITEM_ID, quantity: 1, journalLabel: "" },
                            ])
                        ) {
                            return;
                        }
                        setQuestStage(player, quest, services, STAGE_GIVEN_WATER);
                    }),
                    sayNpc("Much better. Now, there is one more problem..."),
                    ...cartHelpSteps(quest),
                ]);
            } else {
                startConversation(cedric, [sayNpc("Please bring me a jug of water. My head is spinning.")]);
            }
            return;
        }
        if (stage >= STAGE_LOOKING_FOR_CEDRIC) {
            startConversation(cedric, [
                sayNpc("Hic! Lovely day for a little drink, isn't it?"),
                sayPlayer("Brother Omad is waiting for you and the party supplies."),
                sayNpc("Oh dear... I may have sampled rather too much wine."),
                sayPlayer("Can I help?"),
                sayNpc("Bring me a jug of water so I can sober up."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_FINDING_WATER),
                ),
            ]);
            return;
        }
        startConversation(cedric, [
            sayNpc("Hello there. I am rather busy with this cart at the moment."),
        ]);
    };
}
