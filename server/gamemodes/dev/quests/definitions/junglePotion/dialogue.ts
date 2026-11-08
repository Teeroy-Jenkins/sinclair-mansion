import type {
    ItemOnNpcEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    countCarriedItem,
    getQuestStage,
    getUnmetQuestRequirements,
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
    type DialogueStep,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    COINS_ITEM_ID,
    JUNGLE_POTION_HERBS,
    STAGE_COMPLETE,
    STAGE_COMPLETE_AFTER_SPOKEN,
    STAGE_FOUND_ALL_HERBS,
    STAGE_GET_SNAKE_WEED,
    STAGE_NOT_STARTED,
    TRUFITUS_NPC_ID,
    type JunglePotionHerb,
} from "./constants";

function context(event: NpcInteractionEvent | ItemOnNpcEvent) {
    return {
        player: event.player,
        services: event.services,
        npcId: TRUFITUS_NPC_ID,
        npcName: "Trufitus",
    };
}

function hasItem(
    event: NpcInteractionEvent | ItemOnNpcEvent,
    itemId: number,
): boolean {
    return countCarriedItem(event.player, event.services, itemId) > 0;
}

function currentHerb(stage: number): JunglePotionHerb | undefined {
    return JUNGLE_POTION_HERBS.find(
        (herb) => stage === herb.requestedStage || stage === herb.foundStage,
    );
}

function nextHerbLines(herb: JunglePotionHerb): DialogueStep[] {
    const next = JUNGLE_POTION_HERBS.find((candidate) => candidate.requestedStage === herb.nextStage);
    if (!next) {
        return [
            sayNpc([
                "Most excellent, Bwana! You have returned all the herbs,",
                "and I can finish the preparations for the potion.",
            ]),
            sayNpc([
                "Many blessings on you. I must now prepare and commune",
                "with the gods. Let me first show you some Herblore techniques.",
            ]),
        ];
    }
    return [
        sayNpc(`Great, you have the ${herb.name}! Many thanks.`),
        sayNpc([`The next herb is called ${next.name}.`, ...next.clue]),
    ];
}

function acceptHerbSteps(quest: QuestDefinition, herb: JunglePotionHerb): DialogueStep[] {
    return [
        showItem(herb.cleanItemId, `You give the ${herb.name} to Trufitus.`),
        run(({ player, services }) => {
            if (
                !takeQuestItems(player, services, [
                    { itemId: herb.cleanItemId, quantity: 1, journalLabel: herb.name },
                ])
            ) {
                return;
            }
            setQuestStage(player, quest, services, herb.nextStage);
        }),
        ...nextHerbLines(herb),
        ...(herb.nextStage === STAGE_FOUND_ALL_HERBS
            ? [run(({ player, services }) => completeQuest(player, services, quest))]
            : []),
    ];
}

function herbProgressDialogue(
    event: NpcInteractionEvent | ItemOnNpcEvent,
    quest: QuestDefinition,
    herb: JunglePotionHerb,
): DialogueStep[] {
    const stage = getQuestStage(event.player, quest);
    const clean = hasItem(event, herb.cleanItemId);
    const grimy = hasItem(event, herb.grimyItemId);
    return [
        sayNpc(`Hello, Bwana. Have you been able to get the ${herb.name}?`),
        choose([
            option("Of course!", [
                ...(stage === herb.foundStage && clean
                    ? acceptHerbSteps(quest, herb)
                    : grimy
                      ? [
                            sayNpc([
                                "That herb is so dirty that I cannot tell whether it is fresh.",
                                "Please clean it first.",
                            ]),
                        ]
                      : clean
                        ? [
                              sayNpc([
                                  `That is not fresh ${herb.name}. Did you pick it yourself?`,
                                  `Go and collect some fresh ${herb.name} for me.`,
                              ]),
                          ]
                        : [
                              sayNpc([
                                  "Please do not try to deceive me, Bwana.",
                                  `I really need that ${herb.name} if I am to make this potion.`,
                              ]),
                          ]),
            ]),
            option("Not yet, sorry. What's the clue again?", [sayNpc(herb.clue)]),
        ]),
    ];
}

function startQuestSteps(quest: QuestDefinition, unmet: readonly string[]): DialogueStep[] {
    return [
        sayNpc([
            "I need to make a special brew that helps me commune with the gods.",
            "For it I need five special herbs found only in the deep jungle.",
        ]),
        sayNpc([
            "Bring each herb to me in turn and I will tell you where to find the next.",
            "In return, I will give you training in Herblore.",
        ]),
        choose([
            option(
                "It sounds like just the challenge for me.",
                unmet.length > 0
                    ? [
                          sayNpc([
                              `You must first complete ${unmet.join(" and ")}.`,
                              "Return when you are ready to begin your Herblore training.",
                          ]),
                      ]
                    : [
                          run(({ player, services }) =>
                              setQuestStage(player, quest, services, STAGE_GET_SNAKE_WEED),
                          ),
                          sayNpc([
                              "Excellent, Bwana! The first herb is called Snake weed.",
                              ...JUNGLE_POTION_HERBS[0].clue,
                          ]),
                      ],
            ),
            option("It sounds difficult. I don't know if I am ready.", [
                sayNpc([
                    "Very well, Bwana. Perhaps you will return invigorated",
                    "and ready to take up the challenge another day.",
                ]),
            ]),
        ]),
    ];
}

function preQuestDialogue(quest: QuestDefinition, unmet: readonly string[]): DialogueStep[] {
    return [
        sayNpc([
            "Greetings, Bwana! I am Trufitus Shakaya of Tai Bwo Wannai.",
            "Welcome to our humble village.",
        ]),
        choose([
            option("What does Bwana mean?", [
                sayNpc([
                    "It means friend, and friends come in peace.",
                    "I assume that you come in peace?",
                ]),
                choose([
                    option("Yes, of course I do.", [
                        sayNpc("That is good news, as I may have a proposition for you."),
                        ...startQuestSteps(quest, unmet),
                    ]),
                    option("What does a warrior like me know about peace?", [
                        sayNpc([
                            "When you grow weary of violence and seek a more enlightened path,",
                            "please pay me another visit.",
                        ]),
                    ]),
                ]),
            ]),
            option("Tai Bwo Wannai? What does that mean?", [
                sayNpc("It means 'small clearing in the jungle', and is now our village's name."),
                choose([
                    option("It's a nice village. Where is everyone?", [
                        sayNpc([
                            "My people are afraid to stay here and have returned to the jungle.",
                            "I need to commune with the gods to learn what fate awaits us.",
                        ]),
                        ...startQuestSteps(quest, unmet),
                    ]),
                    option("I am sorry, but I am very busy.", [
                        sayNpc("Very well. May your journeys bring you much joy."),
                    ]),
                ]),
            ]),
            option("It's a nice village. Where is everyone?", [
                sayNpc([
                    "My people are afraid to stay here and have returned to the jungle.",
                    "You may be able to help me divine what the future holds.",
                ]),
                ...startQuestSteps(quest, unmet),
            ]),
        ]),
    ];
}

function postQuestDialogue(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc([
            "My greatest respects, Bwana. I have communed with my gods,",
            "and the future looks good for my people.",
        ]),
        sayNpc([
            "With their blessing we will be safe here.",
            "You should deliver the good news to Bwana Timfraku, our chief.",
        ]),
        run(({ player, services }) => {
            if (getQuestStage(player, quest) === STAGE_COMPLETE) {
                setQuestStage(player, quest, services, STAGE_COMPLETE_AFTER_SPOKEN);
            }
        }),
    ];
}

export function createTrufitusTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const steps =
            stage === STAGE_NOT_STARTED
                ? preQuestDialogue(
                      quest,
                      getUnmetQuestRequirements(event.player, event.services, quest),
                  )
                : stage >= STAGE_COMPLETE
                  ? postQuestDialogue(quest)
                  : stage === STAGE_FOUND_ALL_HERBS
                    ? [
                          sayNpc([
                              "All five herbs are ready. Let me show you some Herblore techniques",
                              "before I finish the potion and commune with the gods.",
                          ]),
                          run(({ player, services }) => completeQuest(player, services, quest)),
                      ]
                    : herbProgressDialogue(event, quest, currentHerb(stage)!);
        startConversation(context(event), steps);
    };
}

function sellHerbAfterQuest(event: ItemOnNpcEvent, herb: JunglePotionHerb): void {
    if (
        !takeQuestItems(event.player, event.services, [
            { itemId: herb.cleanItemId, quantity: 1, journalLabel: herb.name },
        ])
    ) {
        return;
    }
    const coins = Math.floor(Math.random() * 4) + 1;
    event.services.inventory.addItemToInventory(event.player, COINS_ITEM_ID, coins);
    event.services.inventory.snapshotInventory(event.player);
    event.services.messaging.sendGameMessage(
        event.player,
        `Trufitus gives you ${coins} coin${coins === 1 ? "" : "s"} for the ${herb.name.toLowerCase()}.`,
    );
}

export function createTrufitusItemHandler(
    quest: QuestDefinition,
): (event: ItemOnNpcEvent) => void {
    return (event) => {
        const herb = JUNGLE_POTION_HERBS.find(
            (candidate) =>
                candidate.cleanItemId === event.source.itemId ||
                candidate.grimyItemId === event.source.itemId,
        );
        if (!herb) return;
        const stage = getQuestStage(event.player, quest);
        if (stage >= STAGE_COMPLETE) {
            if (event.source.itemId === herb.grimyItemId) {
                startConversation(context(event), [
                    sayNpc("That herb is too dirty for me to identify. Please clean it first."),
                ]);
                return;
            }
            sellHerbAfterQuest(event, herb);
            return;
        }
        if (event.source.itemId === herb.grimyItemId) {
            startConversation(context(event), [
                sayNpc([
                    "That herb is so dirty that I cannot tell whether it is fresh.",
                    "Please clean it first.",
                ]),
            ]);
            return;
        }
        if (stage === herb.foundStage) {
            startConversation(context(event), acceptHerbSteps(quest, herb));
            return;
        }
        if (stage === herb.requestedStage) {
            startConversation(context(event), [
                sayNpc([
                    `That is not fresh ${herb.name}. Did you pick it yourself?`,
                    `Go and collect some fresh ${herb.name} for me.`,
                ]),
            ]);
            return;
        }
        startConversation(context(event), [
            sayNpc("Many thanks, Bwana, but I do not need that herb at the moment."),
        ]);
    };
}
