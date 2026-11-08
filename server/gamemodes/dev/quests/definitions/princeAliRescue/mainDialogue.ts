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
    type DialogueStep,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BLONDE_WIG_ITEM_ID,
    BRONZE_BAR_ITEM_ID,
    BRONZE_KEY_ITEM_ID,
    COINS_ITEM_ID,
    HASSAN_NPC_ID,
    JUG_OF_WATER_ITEM_ID,
    KEY_PRINT_ITEM_ID,
    KEY_REPLACEMENT_COST,
    LEELA_NPC_ID,
    OSMAN_NPC_IDS,
    PINK_SKIRT_ITEM_ID,
    PRINCE_ALI_VISIBLE_NPC_ID,
    ROPE_ITEM_ID,
    SKIN_PASTE_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_GUARD_DRUNK,
    STAGE_KELI_TIED,
    STAGE_KEY_CLAIMED,
    STAGE_KEY_MADE,
    STAGE_PREPARATION_COMPLETE,
    STAGE_PRINCE_SAVED,
    STAGE_SPOKEN_TO_OSMAN,
    STAGE_STARTED,
} from "./constants";
import { carriesItem, giveItem, hasDisguise, ownsItem, takeItem } from "./items";

export function createHassanTalkHandler(quest: QuestDefinition) {
    return ({ player, services }: NpcInteractionEvent): void => {
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage === 0) {
            steps = [
                sayNpc("Greetings. I am Chancellor Hassan, servant of the Emir of Al Kharid."),
                choose([
                    option("Can I help you? You must need some help here in the desert.", [
                        sayNpc(
                            "I need someone's services. If you are interested, see our spymaster Osman. Return to me when payment is due.",
                        ),
                        run(({ player: questPlayer, services: questServices }) => {
                            setQuestStage(questPlayer, quest, questServices, STAGE_STARTED);
                        }),
                    ]),
                    option("It's too hot here. How can you stand it?", [
                        sayNpc("We are wealthy and have water. It cures many thirsts."),
                        run(({ player: questPlayer, services: questServices }) => {
                            giveItem(questPlayer, questServices, JUG_OF_WATER_ITEM_ID);
                        }),
                        showItem(JUG_OF_WATER_ITEM_ID, "The Chancellor hands you some water."),
                    ]),
                    option("Do you mind if I kill your warriors?", [
                        sayNpc(
                            "You are welcome. They are inexpensive and keep visitors from bothering the elite guard.",
                        ),
                    ]),
                ]),
            ];
        } else if (stage === STAGE_STARTED) {
            steps = [sayNpc("Have you found Osman? You cannot proceed without reporting to him.")];
        } else if (stage < STAGE_PRINCE_SAVED) {
            steps = stage === STAGE_SPOKEN_TO_OSMAN
                ? [sayNpc("Osman has hired you. I will pay only when the Prince is rescued.")]
                : [sayNpc("I see you are getting on well with the rescue. Keep at it.")];
        } else if (stage === STAGE_PRINCE_SAVED) {
            steps = [
                sayNpc(
                    "You have the Emir's eternal gratitude for rescuing his son. I am authorised to pay you 700 coins.",
                ),
                run(({ player: questPlayer, services: questServices }) => {
                    completeQuest(questPlayer, questServices, quest);
                }),
            ];
        } else {
            steps = [
                sayNpc(
                    "You are a friend of Al Kharid. If we have more work, we will ask you. Good employees are not easy to find.",
                ),
            ];
        }
        startConversation({ player, services, npcId: HASSAN_NPC_ID, npcName: "Chancellor Hassan" }, steps);
    };
}

function osmanFirstSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc(
            "The Prince is guarded by stupid guards and one clever woman. Tie Lady Keli with a coil of rope and disguise the Prince as her.",
        ),
        sayNpc(
            "Find a pink skirt like hers, a blonde wig, and something to lighten the Prince's skin.",
        ),
        sayNpc(
            "My daughter and top spy, Leela, found the prison near Draynor Village. Find her there.",
        ),
        choose([
            option("Explain the first thing again.", osmanFirstSteps(quest), { echo: false }),
            option("What is the second thing you need?", osmanSecondSteps(quest), {
                echo: false,
            }),
            option("Okay, I had better find those things.", finishOsmanBriefingSteps(quest), {
                echo: false,
            }),
        ]),
    ];
}

function osmanSecondSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc(
            "We need a copy of the prison key. Press Lady Keli's key into soft clay; she is boastful enough to show it to you.",
        ),
        sayNpc("Bring the key print to me with a bronze bar."),
        choose([
            option("What is the first thing I must do?", osmanFirstSteps(quest), { echo: false }),
            option("Explain the second thing again.", osmanSecondSteps(quest), { echo: false }),
            option("Okay, I had better find those things.", finishOsmanBriefingSteps(quest), {
                echo: false,
            }),
        ]),
    ];
}

function finishOsmanBriefingSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("Okay, I had better go find some things."),
        sayNpc("Good luck. Do not forget Leela; this cannot be done without her."),
        run(({ player, services }) => {
            setQuestStage(player, quest, services, STAGE_SPOKEN_TO_OSMAN);
        }),
    ];
}

function osmanReminderSteps(event: NpcInteractionEvent): DialogueStep[] {
    const { player, services } = event;
    return [
        sayPlayer("Can you tell me what I still need?"),
        sayNpc(
            carriesItem(player, services, BRONZE_KEY_ITEM_ID)
                ? "You have the duplicate key, good."
                : "You need a key print in soft clay and a bronze bar, then collect the key from Leela.",
        ),
        sayNpc(
            carriesItem(player, services, BLONDE_WIG_ITEM_ID)
                ? "The blonde wig is ready."
                : "You still need a blonde wig. Leela may know who can make one.",
        ),
        sayNpc(
            carriesItem(player, services, PINK_SKIRT_ITEM_ID)
                ? "You have the pink skirt."
                : "You need a skirt like Lady Keli's.",
        ),
        sayNpc(
            carriesItem(player, services, SKIN_PASTE_ITEM_ID)
                ? "You have the skin paste."
                : "You need something to make the Prince's skin appear lighter.",
        ),
        sayNpc(
            carriesItem(player, services, ROPE_ITEM_ID)
                ? "You have rope for Lady Keli."
                : "You need rope to tie Lady Keli up.",
        ),
        sayNpc("When everything is ready, return to Leela."),
    ];
}

export function createOsmanTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const { player, services } = event;
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage === 0) {
            steps = [
                sayNpc("Hello, I am Osman. How may I assist you?"),
                choose([
                    option("You don't seem very tough. Who are you?", [
                        sayNpc("I am in the Emir's employ. That is all you need to know."),
                    ]),
                    option("I hear rumours about a prince.", [
                        sayNpc("The Prince is... away. If you can be trusted, speak to Hassan."),
                    ]),
                    option("I am just being nosy.", [
                        sayNpc("That bothers me not. Al Kharid's secrets protect themselves."),
                    ]),
                ]),
            ];
        } else if (stage === STAGE_STARTED) {
            steps = [
                sayPlayer("The Chancellor trusts me. I have come for instructions."),
                sayNpc("Lady Keli holds our Prince captive. There are two things to arrange."),
                choose([
                    option("What is the first thing?", osmanFirstSteps(quest), { echo: false }),
                    option("What is the second thing?", osmanSecondSteps(quest), { echo: false }),
                ]),
            ];
        } else if (stage >= STAGE_PRINCE_SAVED && stage < STAGE_COMPLETE) {
            steps = [sayNpc("The Prince is safe. Collect your payment from Chancellor Hassan.")];
        } else if (stage >= STAGE_COMPLETE) {
            steps = [sayNpc("Well done. I will remember you when I have more dangerous work.")];
        } else if (
            stage === STAGE_SPOKEN_TO_OSMAN &&
            carriesItem(player, services, KEY_PRINT_ITEM_ID) &&
            carriesItem(player, services, BRONZE_BAR_ITEM_ID)
        ) {
            steps = [
                sayNpc("Well done; we can make the key now."),
                run(({ player: questPlayer, services: questServices }) => {
                    takeItem(questPlayer, questServices, KEY_PRINT_ITEM_ID);
                    takeItem(questPlayer, questServices, BRONZE_BAR_ITEM_ID);
                    setQuestStage(questPlayer, quest, questServices, STAGE_KEY_MADE);
                }),
                showItem(KEY_PRINT_ITEM_ID, "Osman takes the key print and bronze bar."),
                sayNpc("Pick the finished key up from Leela."),
            ];
        } else if (
            stage === STAGE_KEY_CLAIMED &&
            !ownsItem(player, services, BRONZE_KEY_ITEM_ID)
        ) {
            const canPay = carriesItem(player, services, COINS_ITEM_ID, KEY_REPLACEMENT_COST);
            steps = [
                sayPlayer("I'm afraid I lost the key."),
                sayNpc("Foolish adventurer! A new key will cost 15 coins."),
                ...(canPay
                    ? [
                          sayPlayer("Here, I have 15 coins."),
                          run(({ player: questPlayer, services: questServices }) => {
                              takeItem(
                                  questPlayer,
                                  questServices,
                                  COINS_ITEM_ID,
                                  KEY_REPLACEMENT_COST,
                              );
                              setQuestStage(questPlayer, quest, questServices, STAGE_KEY_MADE);
                          }),
                          sayNpc("I will have another made. Collect it from Leela."),
                      ]
                    : [sayPlayer("I haven't got 15 coins."), sayNpc("Come back when you do.")]),
            ];
        } else if (stage === STAGE_KEY_MADE) {
            steps = [sayNpc("Your key is ready. Collect it from Leela near Draynor Village.")];
        } else if (stage >= STAGE_PREPARATION_COMPLETE) {
            steps = [sayNpc("Leela keeps me informed. You are well on the way with the rescue.")];
        } else {
            steps = osmanReminderSteps(event);
        }
        startConversation({ player, services, npcId: OSMAN_NPC_IDS[1], npcName: "Osman" }, steps);
    };
}

function leelaPlanningSteps(event: NpcInteractionEvent): DialogueStep[] {
    const { player, services } = event;
    return [
        sayPlayer("I am here to help free the Prince."),
        sayNpc("Your employment is known to me. Do you know everything we need?"),
        choose([
            option("What disguise do you suggest?", [
                sayNpc(
                    "Only Lady Keli can move freely. We need a blonde wig, a pink skirt, and skin paste to fool the guards at a distance.",
                ),
                sayNpc(
                    carriesItem(player, services, ROPE_ITEM_ID)
                        ? "You have rope for Keli. That is the dangerous part."
                        : "You also need rope. A rope maker lives in Draynor.",
                ),
            ]),
            option("How do I get the key made?", [
                sayNpc(
                    "Press Keli's chained key into soft clay. Take the print and a bronze bar to my father, Osman.",
                ),
            ]),
            option("What can I do with the guards?", [
                sayNpc(
                    "The disguise fools most guards. The door guard is the problem; we can plan for him when the escape kit is ready.",
                ),
            ]),
            option("I will get the rest of the equipment.", [sayNpc("I shall await your return.")]),
        ]),
    ];
}

function replacementKeySteps(quest: QuestDefinition, event: NpcInteractionEvent): DialogueStep[] {
    const canPay = carriesItem(event.player, event.services, COINS_ITEM_ID, KEY_REPLACEMENT_COST);
    return [
        sayPlayer("I'm afraid I lost the key you gave me."),
        sayNpc("Foolish adventurer! A replacement costs 15 coins."),
        ...(canPay
            ? [
                  sayPlayer("Here are 15 coins."),
                  run(({ player, services }) => {
                      takeItem(player, services, COINS_ITEM_ID, KEY_REPLACEMENT_COST);
                      giveItem(player, services, BRONZE_KEY_ITEM_ID);
                      if (getQuestStage(player, quest) < STAGE_KEY_CLAIMED) {
                          setQuestStage(player, quest, services, STAGE_KEY_CLAIMED);
                      }
                  }),
                  showItem(BRONZE_KEY_ITEM_ID, "Leela gives you another bronze key."),
              ]
            : [sayPlayer("I haven't got 15 coins."), sayNpc("Then return when you do.")]),
    ];
}

export function createLeelaTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const { player, services } = event;
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage < STAGE_SPOKEN_TO_OSMAN) {
            steps = [sayPlayer("What are you waiting here for?"), sayNpc("That is no concern of yours.")];
        } else if (stage >= STAGE_PRINCE_SAVED) {
            steps = [sayNpc("Al Kharid will forever owe you for your help. You have proved reliable.")];
        } else if (stage === STAGE_KEY_MADE) {
            steps = [
                sayNpc("My father sent this key for you. Be careful not to lose it."),
                run(({ player: questPlayer, services: questServices }) => {
                    if (giveItem(questPlayer, questServices, BRONZE_KEY_ITEM_ID)) {
                        setQuestStage(questPlayer, quest, questServices, STAGE_KEY_CLAIMED);
                    }
                }),
                showItem(BRONZE_KEY_ITEM_ID, "Leela gives you the prison key."),
            ];
        } else if (
            stage >= STAGE_KEY_CLAIMED &&
            !ownsItem(player, services, BRONZE_KEY_ITEM_ID)
        ) {
            steps = replacementKeySteps(quest, event);
        } else if (stage === STAGE_GUARD_DRUNK) {
            steps = [sayNpc("The guard is harmless. Use your rope on Keli, then free the Prince.")];
        } else if (stage === STAGE_KELI_TIED) {
            steps = [sayNpc("Get in and rescue the Prince. Keli will not stay tied up for long.")];
        } else if (
            stage >= STAGE_SPOKEN_TO_OSMAN &&
            stage < STAGE_PREPARATION_COMPLETE &&
            carriesItem(player, services, BRONZE_KEY_ITEM_ID) &&
            hasDisguise(player, services)
        ) {
            steps = [
                sayNpc("Good, you have the basic equipment. Now deal with the door guard."),
                sayNpc("He is talkative. Find a weakness in him."),
                run(({ player: questPlayer, services: questServices }) => {
                    setQuestStage(
                        questPlayer,
                        quest,
                        questServices,
                        STAGE_PREPARATION_COMPLETE,
                    );
                }),
            ];
        } else if (stage === STAGE_PREPARATION_COMPLETE) {
            steps = [
                sayNpc("What is your plan to stop the guard interfering?"),
                choose([
                    option("I haven't spoken to him yet.", [
                        sayNpc("Speaking to him may reveal a weakness."),
                    ]),
                    option("I was going to attack him.", [
                        sayNpc("Do not. Keli's whole gang would attack you."),
                    ]),
                    option("I hoped to get him drunk.", [
                        sayNpc("That might work. It will take at least three beers, all at once."),
                    ]),
                    option("Maybe I could bribe him.", [
                        sayNpc("Keli killed the last guard we bribed. It would take a lot of gold."),
                    ]),
                ]),
            ];
        } else {
            steps = leelaPlanningSteps(event);
        }
        startConversation({ player, services, npcId: LEELA_NPC_ID, npcName: "Leela" }, steps);
    };
}

export function createPrinceAliTalkHandler(
    quest: QuestDefinition,
    onEscaped?: (event: NpcInteractionEvent) => void,
) {
    return (event: NpcInteractionEvent): void => {
        const { player, services } = event;
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage !== STAGE_KELI_TIED) {
            steps = [
                sayNpc(
                    stage >= STAGE_PRINCE_SAVED
                        ? "I owe you my life for that escape. Go in peace, friend of Al Kharid."
                        : "Please, help me escape from Lady Keli!",
                ),
            ];
        } else if (
            carriesItem(player, services, BRONZE_KEY_ITEM_ID) &&
            hasDisguise(player, services)
        ) {
            steps = [
                sayPlayer("Prince, I have come to rescue you."),
                sayNpc("That is very kind. How do I get out?"),
                sayPlayer("With a disguise. Lady Keli is tied up, but not for long."),
                sayPlayer("Take this disguise and key."),
                run(({ player: questPlayer, services: questServices }) => {
                    takeItem(questPlayer, questServices, BRONZE_KEY_ITEM_ID);
                    takeItem(questPlayer, questServices, BLONDE_WIG_ITEM_ID);
                    takeItem(questPlayer, questServices, PINK_SKIRT_ITEM_ID);
                    takeItem(questPlayer, questServices, SKIN_PASTE_ITEM_ID);
                    setQuestStage(questPlayer, quest, questServices, STAGE_PRINCE_SAVED);
                    onEscaped?.(event);
                }),
                showItem(BLONDE_WIG_ITEM_ID, "You hand the disguise and key to Prince Ali."),
                sayNpc("Thank you, my friend. My father will pay you well."),
                sayPlayer("Go to Leela; she is close by."),
                showItem(
                    BRONZE_KEY_ITEM_ID,
                    [
                        "The Prince escapes!",
                        "You are now a friend of Al Kharid and may use its toll gate for free.",
                    ],
                ),
            ];
        } else {
            steps = [
                sayPlayer("Prince, I have come to rescue you."),
                sayNpc("You still need the prison key and every part of the disguise."),
            ];
        }
        startConversation(
            { player, services, npcId: PRINCE_ALI_VISIBLE_NPC_ID, npcName: "Prince Ali" },
            steps,
        );
    };
}
