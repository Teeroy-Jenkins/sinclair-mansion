import type { PlayerState } from "../../../../../src/game/player";
import type {
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
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
    AIR_TALISMAN_ITEM_ID,
    AUBURY_NPC_IDS,
    DUKE_HORACIO_NPC_ID,
    RESEARCH_NOTES_ITEM_ID,
    RESEARCH_PACKAGE_ITEM_ID,
    RUNE_ESSENCE_MINE_TILE,
    SEDRIDOR_NPC_IDS,
    STAGE_COMPLETE,
    STAGE_GIVEN_PACKAGE,
    STAGE_GIVEN_TALISMAN,
    STAGE_RECEIVED_NOTES,
    STAGE_RECEIVED_PACKAGE,
    STAGE_STARTED,
} from "./constants";

function hasOwnedItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function hasCarriedItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return countCarriedItem(player, services, itemId) > 0;
}

function giveItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    if (!services.inventory.canStoreItem(player, itemId)) return false;
    const result = services.inventory.addItemToInventory(player, itemId, 1);
    if (result.added !== 1) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function takeItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return takeQuestItems(player, services, [{ itemId, quantity: 1, journalLabel: "" }]);
}

function moneySteps(): DialogueStep[] {
    return [
        sayPlayer("Where can I find money?"),
        sayNpc(
            "I've heard that the blacksmiths are prosperous amongst the peasantry. Maybe you could try your hand at that?",
        ),
    ];
}

function startQuestSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const accept = services.inventory.canStoreItem(player, AIR_TALISMAN_ITEM_ID)
        ? [
              sayPlayer("Sure, no problem."),
              run(({ player: questPlayer, services: questServices }) => {
                  if (!giveItem(questPlayer, questServices, AIR_TALISMAN_ITEM_ID)) return;
                  setQuestStage(questPlayer, quest, questServices, STAGE_STARTED);
              }),
              sayNpc(
                  "Thank you very much, stranger. I am sure the head wizard will reward you for such an interesting find.",
              ),
              showItem(AIR_TALISMAN_ITEM_ID, "The Duke hands you an air talisman."),
          ]
        : [
              sayPlayer("Sure, no problem."),
              sayNpc("You will need a free inventory space before I can give you the talisman."),
          ];

    return [
        sayPlayer("Have you any quests for me?"),
        sayNpc("Well, it's not really a quest but I recently discovered this strange talisman."),
        sayNpc(
            "It seems to be mystical and I have never seen anything like it before. Would you take it to the head wizard at the Wizards' Tower for me?",
        ),
        sayNpc(
            "It's just south-west of here and should not take you very long at all. I would be awfully grateful.",
        ),
        choose([
            option("Sure, no problem.", accept, { echo: false }),
            option("Not right now.", [
                sayNpc(
                    "As you wish, stranger, although I have this strange feeling that it is important. Unfortunately, I cannot leave my castle unattended.",
                ),
            ]),
        ]),
    ];
}

function dukeQuestSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const stage = getQuestStage(player, quest);
    if (stage >= STAGE_COMPLETE) {
        return [sayPlayer("Have you any quests for me?"), sayNpc("No, all is well for me.")];
    }
    if (stage === 0) return startQuestSteps(quest, player, services);
    if (!hasOwnedItem(player, services, AIR_TALISMAN_ITEM_ID) && stage === STAGE_STARTED) {
        const replacement = services.inventory.canStoreItem(player, AIR_TALISMAN_ITEM_ID)
            ? [
                  sayNpc(
                      "One of my servants found this outside. Please take it to the head wizard at the Wizards' Tower, and don't lose it this time.",
                  ),
                  run(({ player: questPlayer, services: questServices }) => {
                      giveItem(questPlayer, questServices, AIR_TALISMAN_ITEM_ID);
                  }),
                  showItem(AIR_TALISMAN_ITEM_ID, "The Duke hands you another air talisman."),
              ]
            : [sayNpc("Make some room and I will replace the talisman for you.")];
        return [
            sayNpc("Did you speak to the head wizard for me yet, adventurer?"),
            sayPlayer("No, I lost that talisman that you gave me."),
            ...replacement,
        ];
    }
    return [
        sayNpc(
            "The only task remotely approaching a quest is the delivery of that talisman to the head wizard of the Wizards' Tower, south-west of here.",
        ),
        sayNpc("I suggest you deliver it as soon as possible. I have the oddest feeling that it is important..."),
    ];
}

export function createDukeHoracioTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return ({ player, services }) => {
        const context: DialogueContext = {
            player,
            services,
            npcId: DUKE_HORACIO_NPC_ID,
            npcName: "Duke Horacio",
        };
        startConversation(context, [
            sayNpc("Greetings. Welcome to my castle."),
            choose([
                option("Have you any quests for me?", dukeQuestSteps(quest, player, services), {
                    echo: false,
                }),
                option("Where can I find money?", moneySteps(), { echo: false }),
            ]),
        ]);
    };
}

function towerHistorySteps(): DialogueStep[] {
    return [
        sayNpc(
            "That is indeed a good question. Here in the cellar of the Wizards' Tower you find the remains of the old Wizards' Tower, destroyed by fire many years past by the treachery of the Zamorakians.",
        ),
        sayNpc(
            "Many mysteries were lost, which we try to find once more. By building this Tower on the remains of the old, we sought to show the world our dedication to learning the mysteries of Magic.",
        ),
        sayNpc(
            "I am here searching through these fragments for knowledge from the artefacts of our past.",
        ),
        sayPlayer("And have you found anything useful?"),
        sayNpc(
            "Aaaah... that would be telling, adventurer. Anything I have found I cannot speak freely of, for fear the treachery of the past might be repeated.",
        ),
        choose([
            option("Ok, well I'll leave you to it."),
            option("What do you mean treachery?", [
                sayNpc(
                    "Many years ago, this Wizards' Tower was a focus of great learning, as we mages studied together to learn the secrets behind the Rune Stones that allow us to use Magic.",
                ),
                sayNpc(
                    "Who makes them? Where do they come from? How many types are there? What spells can they produce? These questions and more are still unknown to us, but were once known to our ancestors.",
                ),
                sayNpc(
                    "Legends tell us the mages who lived here could fashion Rune Stones almost at will, and as many as they desired.",
                ),
                sayPlayer("But they cannot anymore?"),
                sayNpc(
                    "No, unfortunately not. The wizards who followed Zamorak, the god of chaos, burned this Tower to the ground, and all who were inside.",
                ),
                sayNpc(
                    "To this day we do not fully know why they did this terrible act, but all our research and all our greatest magical minds were destroyed in one fell swoop.",
                ),
                sayNpc(
                    "This is why I search through the few remains left from the glorious old Tower. I hope someday to find something that will tell us once more of the mysteries of the runes we use daily.",
                ),
                sayNpc(
                    "Their supply dwindles with each use. Someday I hope we may create our own runes again, and the Wizards' Tower will once more be a place of glory!",
                ),
                sayPlayer("Ok, well I'll leave you to it."),
            ]),
        ]),
    ];
}

function nothingSteps(): DialogueStep[] {
    return [
        sayPlayer("Nothing thanks, I'm just looking around."),
        sayNpc(
            "Well, take care adventurer. You stand on the ruins of the destroyed Wizards' Tower. Strange and powerful magicks lurk here.",
        ),
    ];
}

function incredibleSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const canTakePackage =
        services.inventory.canStoreItem(player, RESEARCH_PACKAGE_ITEM_ID) ||
        hasCarriedItem(player, services, AIR_TALISMAN_ITEM_ID);
    const accept = canTakePackage
        ? [
              sayPlayer("Yes, certainly."),
              sayNpc(
                  "Take this package and head north through Draynor Village. At the Barbarian Village, head east until you reach Varrock.",
              ),
              sayNpc(
                  "Take it to Aubury, owner of the rune shop. He will give you a special item; bring it back to me.",
              ),
              run(({ player: questPlayer, services: questServices }) => {
                  if (!giveItem(questPlayer, questServices, RESEARCH_PACKAGE_ITEM_ID)) return;
                  setQuestStage(questPlayer, quest, questServices, STAGE_RECEIVED_PACKAGE);
              }),
              showItem(RESEARCH_PACKAGE_ITEM_ID, "The head wizard gives you a research package."),
              sayNpc("Best of luck with your quest."),
          ]
        : [sayNpc("Make some room in your inventory and speak to me again for the package.")];

    return [
        sayNpc("Wow! This is... incredible!"),
        sayNpc(
            "Th-this talisman you brought me... it is the last piece of the puzzle, I think! Finally! The legacy of our ancestors will return to us once more!",
        ),
        sayNpc(
            "I need time to study this. Can you please do me a task while I study the talisman you have brought me?",
        ),
        sayNpc(
            "In the mighty town of Varrock, north-east of here, there is a certain shop that sells magical runes. I have placed all of my research relating to Rune Stones in a package.",
        ),
        sayNpc(
            "Take it to the shopkeeper so that he may share my research and offer his insights. Bring back what he gives you.",
        ),
        sayNpc(
            "If my suspicions are correct, I will let you into the knowledge of one of the greatest secrets this world has ever known!",
        ),
        sayNpc(
            "It is a secret so powerful that it destroyed the original Wizards' Tower centuries ago. My research, combined with this mysterious talisman... the answer is so close!",
        ),
        sayNpc(
            `Do this thing for me, ${player.name ?? "adventurer"}. Be rewarded in a way you can never imagine.`,
        ),
        choose([
            option("Yes, certainly.", accept, { echo: false }),
            option("No, I'm busy.", [
                sayNpc(
                    "As you wish. I will continue to study the talisman. Return when you have some spare time to help me.",
                ),
            ]),
        ]),
    ];
}

function handTalismanSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (!hasCarriedItem(player, services, AIR_TALISMAN_ITEM_ID)) {
        return [
            sayPlayer("Ok, here you are... except I don't have it with me."),
            sayNpc("You are a very odd person. Come back again when you have found it."),
        ];
    }
    return [
        sayPlayer("Ok, here you are."),
        run(({ player: questPlayer, services: questServices }) => {
            if (!takeItem(questPlayer, questServices, AIR_TALISMAN_ITEM_ID)) return;
            setQuestStage(questPlayer, quest, questServices, STAGE_GIVEN_TALISMAN);
        }),
        showItem(AIR_TALISMAN_ITEM_ID, "You hand the talisman to the wizard."),
        ...incredibleSteps(quest, player, services),
    ];
}

function runeMysteriesIntroductionSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    return [
        choose([
            option("Nothing thanks, I'm just looking around.", nothingSteps(), { echo: false }),
            option("What are you doing down here?", towerHistorySteps(), { echo: false }),
            option("I'm looking for the head wizard.", [
                sayPlayer("I'm looking for the head wizard."),
                sayNpc("Oh you are, are you? And just why would you be doing that?"),
                sayPlayer(
                    "The Duke of Lumbridge sent me. I have a weird talisman he found, and he said the head wizard would be interested in it.",
                ),
                sayNpc("Did he now? Well that IS interesting. Hand it over and let me see it."),
                choose([
                    option("Ok, here you are.", handTalismanSteps(quest, player, services), {
                        echo: false,
                    }),
                    option("No, I'll only give it to the head wizard.", [
                        sayNpc(
                            "I admire your caution. I will use my mental powers to prove myself. Your name is...",
                        ),
                        sayNpc(`${player.name ?? "Adventurer"}!`),
                        sayPlayer("You're right!"),
                        sayNpc("Well I am head wizard! You don't get my position without a few tricks."),
                        ...handTalismanSteps(quest, player, services),
                    ]),
                ]),
            ], { echo: false }),
        ]),
    ];
}

function receivedPackageSteps(
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (!hasOwnedItem(player, services, RESEARCH_PACKAGE_ITEM_ID)) {
        const recover = services.inventory.canStoreItem(player, RESEARCH_PACKAGE_ITEM_ID)
            ? [
                  sayNpc(
                      "Luckily, as head wizard I can teleport it back here. I have retrieved it; please try not to lose it again.",
                  ),
                  run(({ player: questPlayer, services: questServices }) => {
                      giveItem(questPlayer, questServices, RESEARCH_PACKAGE_ITEM_ID);
                  }),
                  showItem(RESEARCH_PACKAGE_ITEM_ID, "Sedridor returns the research package."),
              ]
            : [sayNpc("Make some inventory space and I will recover it for you.")];
        return [
            sayPlayer("...I lost the package you gave me."),
            sayNpc("You WHAT? That was very careless!"),
            ...recover,
        ];
    }
    return [
        sayNpc("How goes your quest? Have you delivered the research package to Aubury yet?"),
        sayPlayer("Not yet..."),
        sayNpc(
            "Please do so as soon as possible. Aubury owns the rune shop in Varrock, and it is vital that he receives it.",
        ),
    ];
}

function notesSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (!hasOwnedItem(player, services, RESEARCH_NOTES_ITEM_ID)) {
        return [
            sayNpc("Have you delivered the package to Aubury?"),
            sayPlayer("Yes, but I lost the notes he gave me."),
            sayNpc("Speak to Aubury again. With luck he made copies of his research."),
        ];
    }
    if (!hasCarriedItem(player, services, RESEARCH_NOTES_ITEM_ID)) {
        return [
            sayNpc("May I have Aubury's notes?"),
            sayPlayer("Sure, I'll go and get them from the bank."),
        ];
    }
    return [
        sayNpc("Have you delivered the research package to Aubury?"),
        sayPlayer("Yes. He gave me some research notes to pass on to you."),
        sayNpc("May I have his notes then?"),
        sayPlayer("Sure. I have them here."),
        sayNpc(
            "Before you hand them over, as you have been nothing but truthful with me and I admire that in an adventurer, I will let you into the secret of our research.",
        ),
        sayNpc(
            "Many centuries ago, the wizards at this Tower learnt the secret of creating Rune Stones, which allowed us to cast Magic very easily.",
        ),
        sayNpc(
            "When this Tower was burnt down, the secret of creating runes was lost to us for all time... except it wasn't.",
        ),
        sayNpc(
            "Some months ago, while searching these ruins for information from old days, I came upon an almost-destroyed scroll.",
        ),
        sayNpc(
            "It detailed a magical rock deep in the icefields of the north, closed off from access by anything other than magical means.",
        ),
        sayNpc(
            "This rock was called Rune Essence. By breaking a chunk from it, a Rune Stone could be fashioned at certain elemental altars scattered across the land.",
        ),
        sayNpc(
            "It was interesting history, but not much use to modern wizards without access to the Rune Essence or those elemental altars.",
        ),
        sayNpc(
            "This is where you and Aubury enter the story. A few weeks ago Aubury found, in a standard delivery of runes, a parchment describing a teleport spell he had never seen.",
        ),
        sayNpc(
            "To his shock, when cast it took him to a strange rock he had never encountered before, yet which felt strangely familiar.",
        ),
        sayNpc(
            "He had discovered a portal to the mythical Rune Essence. If we could find the old elemental altars, we would be able to create runes as our ancestors did!",
        ),
        sayPlayer("I'm still not sure how I fit into this story."),
        sayNpc(
            "You haven't guessed? This talisman you brought me is the key to the elemental altar of air! When you hold it, it will direct you towards the entrance.",
        ),
        sayNpc(
            "By bringing pieces of Rune Essence to the Air Temple, you will be able to fashion your own Air Runes!",
        ),
        sayNpc(
            "By finding other talismans like this one, you may eventually craft every rune available in this world, just as our ancestors did.",
        ),
        sayNpc(
            "Because of the risks of this power falling into the wrong hands, I will keep the Rune Essence teleport a closely guarded secret.",
        ),
        sayNpc(
            "I will share it only with those Magic users around the world whom I trust enough to keep it.",
        ),
        sayNpc(
            "If an evil power discovers the talismans, we will be able to prevent its access to Rune Essence and avert tragedy.",
        ),
        sayNpc(
            "I do not know where all the temples are, nor where their talismans have been scattered, but I now return your Air Talisman.",
        ),
        sayNpc(
            "Find the Air Temple and charge Rune Essence into Air Runes. Whenever you wish to visit the mine, speak to me or Aubury.",
        ),
        sayPlayer("So only you and Aubury know the teleport spell to the Rune Essence?"),
        sayNpc(
            "No. There are others whom I will tell of your authorisation. When you speak to them, they will know you and grant you access.",
        ),
        sayNpc(
            "Use the Air Talisman to locate the Air Temple, and any further talismans to locate the other missing elemental temples. Now... my research notes please?",
        ),
        run(({ player: questPlayer, services: questServices }) => {
            if (!takeItem(questPlayer, questServices, RESEARCH_NOTES_ITEM_ID)) return;
            if (!giveItem(questPlayer, questServices, AIR_TALISMAN_ITEM_ID)) return;
            questServices.messaging.sendGameMessage(
                questPlayer,
                "You hand over the notes and Sedridor returns your air talisman.",
            );
            completeQuest(questPlayer, questServices, quest);
        }),
    ];
}

export function teleportToRuneEssence(player: PlayerState, services: ScriptServices): void {
    services.messaging.sendGameMessage(player, "Senventior disthine molenko!");
    services.movement.teleportPlayer(
        player,
        RUNE_ESSENCE_MINE_TILE.x,
        RUNE_ESSENCE_MINE_TILE.y,
        RUNE_ESSENCE_MINE_TILE.level,
        true,
    );
}

export function createSedridorTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return ({ player, services, npc }) => {
        const context: DialogueContext = {
            player,
            services,
            npcId: npc.typeId ?? SEDRIDOR_NPC_IDS[0],
            npcName: "Archmage Sedridor",
        };
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage === 0) {
            steps = [
                sayNpc("Welcome, adventurer, to the world-renowned Wizards' Tower. How may I help you?"),
                choose([
                    option("Nothing thanks, I'm just looking around.", nothingSteps(), {
                        echo: false,
                    }),
                    option("What are you doing down here?", towerHistorySteps(), { echo: false }),
                ]),
            ];
        } else if (stage === STAGE_STARTED) {
            steps = [
                sayNpc("Welcome, adventurer, to the world-renowned Wizards' Tower. How may I help you?"),
                ...runeMysteriesIntroductionSteps(quest, player, services),
            ];
        } else if (stage === STAGE_GIVEN_TALISMAN) {
            steps = incredibleSteps(quest, player, services);
        } else if (stage === STAGE_RECEIVED_PACKAGE) {
            steps = receivedPackageSteps(player, services);
        } else if (stage === STAGE_GIVEN_PACKAGE) {
            steps = [
                sayNpc("Have you delivered the research package to Aubury yet?"),
                sayPlayer("Yes, I have."),
                sayNpc("And did he give you anything in return?"),
                sayPlayer("No. He told me to return after he'd looked at it."),
                sayNpc("Then I think you should speak to him again."),
            ];
        } else if (stage === STAGE_RECEIVED_NOTES) {
            steps = notesSteps(quest, player, services);
        } else {
            steps = [
                sayNpc("Welcome, adventurer. How may I help you?"),
                choose([
                    option("Nothing thanks, I'm just looking around.", nothingSteps(), {
                        echo: false,
                    }),
                    option("Can you teleport me to the Rune Essence?", [
                        run(({ player: questPlayer, services: questServices }) => {
                            teleportToRuneEssence(questPlayer, questServices);
                        }),
                    ]),
                ]),
            ];
        }
        startConversation(context, steps);
    };
}

function auburyStandardSteps(canTeleport: boolean): DialogueStep[] {
    const options = [
        option("Yes please!", [
            run(({ player, services }) => services.shopping?.openShop?.(player, { npcTypeId: 2886 })),
        ]),
        option("Oh, it's a rune shop. No thank you, then.", [
            sayNpc("Well, if you find someone who wants runes, please send them my way."),
        ]),
    ];
    if (canTeleport) {
        options.push(
            option("Can you teleport me to the Rune Essence?", [
                sayNpc(
                    "Of course. If you make any runes from the essence you mine, I will happily buy them from you.",
                ),
                run(({ player, services }) => teleportToRuneEssence(player, services)),
            ]),
        );
    }
    return [sayNpc("Do you want to buy some runes?"), choose(options)];
}

function auburyPackageSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (!hasCarriedItem(player, services, RESEARCH_PACKAGE_ITEM_ID)) {
        return [
            sayPlayer("I was sent with a package for you... but I don't have it with me."),
            sayNpc("Come back when you do."),
        ];
    }
    return [
        sayPlayer("I have been sent with a package from the head wizard at the Wizards' Tower."),
        sayNpc("Really? Please let me have it; it must be extremely important."),
        run(({ player: questPlayer, services: questServices }) => {
            if (!takeItem(questPlayer, questServices, RESEARCH_PACKAGE_ITEM_ID)) return;
            setQuestStage(questPlayer, quest, questServices, STAGE_GIVEN_PACKAGE);
        }),
        showItem(RESEARCH_PACKAGE_ITEM_ID, "You hand Aubury the research package."),
        sayNpc("This is incredible. Give me a few moments to look it over, then talk to me again."),
    ];
}

function auburyNotesSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (!services.inventory.canStoreItem(player, RESEARCH_NOTES_ITEM_ID)) {
        return [sayNpc("I have notes for Sedridor, but you will need a free inventory space.")];
    }
    return [
        sayNpc(
            "My gratitude to you for bringing me these research notes. I notice that you brought the head wizard a special talisman that was the key to finally unlocking the puzzle.",
        ),
        sayNpc(
            "Combined with the information I had already collated regarding Rune Essence, I think we have finally unlocked the power to... no. I am getting ahead of myself.",
        ),
        sayNpc(
            "Please take this summary of my research back to Sedridor. I trust his judgement on whether to let you in on our little secret.",
        ),
        run(({ player: questPlayer, services: questServices }) => {
            if (!giveItem(questPlayer, questServices, RESEARCH_NOTES_ITEM_ID)) return;
            setQuestStage(questPlayer, quest, questServices, STAGE_RECEIVED_NOTES);
        }),
        showItem(RESEARCH_NOTES_ITEM_ID, "Aubury gives you his research notes."),
    ];
}

function auburyReceivedNotesSteps(
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (!hasOwnedItem(player, services, RESEARCH_NOTES_ITEM_ID)) {
        if (!services.inventory.canStoreItem(player, RESEARCH_NOTES_ITEM_ID)) {
            return [sayNpc("Make some room and I will give you another copy of my notes.")];
        }
        return [
            sayNpc("I suggest you take my notes back to Sedridor."),
            sayPlayer("I can't. I lost them."),
            sayNpc("Luckily I have duplicates. It is a good thing they are written in code."),
            run(({ player: questPlayer, services: questServices }) => {
                giveItem(questPlayer, questServices, RESEARCH_NOTES_ITEM_ID);
            }),
            showItem(RESEARCH_NOTES_ITEM_ID, "Aubury gives you another copy of his notes."),
        ];
    }
    return [
        sayNpc("I suggest you take those research notes back to Sedridor at the Wizards' Tower."),
        sayPlayer("Ok, I will do that."),
        ...auburyStandardSteps(false),
    ];
}

export function createAuburyTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return ({ player, services, npc }) => {
        const context: DialogueContext = {
            player,
            services,
            npcId: npc.typeId ?? AUBURY_NPC_IDS[0],
            npcName: "Aubury",
        };
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage === STAGE_GIVEN_PACKAGE) {
            steps = auburyNotesSteps(quest, player, services);
        } else if (stage === STAGE_RECEIVED_NOTES) {
            steps = auburyReceivedNotesSteps(player, services);
        } else if (
            stage === STAGE_RECEIVED_PACKAGE &&
            hasCarriedItem(player, services, RESEARCH_PACKAGE_ITEM_ID)
        ) {
            steps = [
                sayNpc("Do you want to buy some runes?"),
                choose([
                    option("Yes please!", [
                        run(({ player: questPlayer, services: questServices }) =>
                            questServices.shopping?.openShop?.(questPlayer, { npcTypeId: npc.typeId }),
                        ),
                    ]),
                    option("Oh, it's a rune shop. No thank you, then.", [
                        sayNpc("Well, if you find someone who wants runes, please send them my way."),
                    ]),
                    option(
                        "I have been sent here with a package for you.",
                        auburyPackageSteps(quest, player, services),
                        { echo: false },
                    ),
                ]),
            ];
        } else {
            steps = auburyStandardSteps(stage >= STAGE_COMPLETE);
        }
        startConversation(context, steps);
    };
}

export function startSedridorNotesDialogue(
    quest: QuestDefinition,
    context: DialogueContext,
): void {
    startConversation(context, notesSteps(quest, context.player, context.services));
}

export function startAuburyPackageDialogue(
    quest: QuestDefinition,
    context: DialogueContext,
): void {
    startConversation(context, auburyPackageSteps(quest, context.player, context.services));
}
