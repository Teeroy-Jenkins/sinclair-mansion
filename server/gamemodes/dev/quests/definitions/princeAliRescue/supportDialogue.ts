import type { NpcInteractionEvent } from "../../../../../src/game/scripts/types";
import { getQuestStage, setQuestStage } from "../../QuestService";
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
    AGGIE_NPC_IDS,
    ASHES_ITEM_ID,
    BALL_OF_WOOL_ITEM_ID,
    BEER_ITEM_ID,
    BLONDE_WIG_ITEM_ID,
    BLUE_DYE_ITEM_ID,
    BUCKET_OF_WATER_ITEM_ID,
    COINS_ITEM_ID,
    GREY_WIG_ITEM_ID,
    JOE_VISIBLE_NPC_ID,
    KEY_PRINT_ITEM_ID,
    LADY_KELI_VISIBLE_NPC_ID,
    NED_NPC_ID,
    ONION_ITEM_ID,
    PINK_SKIRT_ITEM_ID,
    POT_OF_FLOUR_ITEM_ID,
    REDBERRIES_ITEM_ID,
    RED_DYE_ITEM_ID,
    ROPE_COST,
    ROPE_ITEM_ID,
    SKIN_PASTE_ITEM_ID,
    SOFT_CLAY_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_GUARD_DRUNK,
    STAGE_KELI_TIED,
    STAGE_PREPARATION_COMPLETE,
    STAGE_PRINCE_SAVED,
    STAGE_SPOKEN_TO_OSMAN,
    WOAD_LEAF_ITEM_ID,
    YELLOW_DYE_ITEM_ID,
    JUG_OF_WATER_ITEM_ID,
} from "./constants";
import { carriesItem, giveItem, takeItem } from "./items";

function ropeSteps(event: NpcInteractionEvent): DialogueStep[] {
    const hasCoins = carriesItem(event.player, event.services, COINS_ITEM_ID, ROPE_COST);
    const hasWool = carriesItem(event.player, event.services, BALL_OF_WOOL_ITEM_ID, 4);
    return [
        sayPlayer("Yes, I would like some rope."),
        sayNpc("I can sell rope for 15 coins, or make it from four balls of wool."),
        choose([
            option("Please sell me some rope.", hasCoins
                ? [
                      run(({ player, services }) => {
                          takeItem(player, services, COINS_ITEM_ID, ROPE_COST);
                          giveItem(player, services, ROPE_ITEM_ID);
                      }),
                      showItem(ROPE_ITEM_ID, "You pay Ned 15 coins and receive a coil of rope."),
                  ]
                : [sayPlayer("I don't have enough coins."), sayNpc("Come back when you do.")]),
            option("That's more than I want to pay.", [
                sayNpc("That's the price. An old sailor needs money for a drop of rum."),
            ]),
            option("Could you make rope from my wool?", hasWool
                ? [
                      run(({ player, services }) => {
                          takeItem(player, services, BALL_OF_WOOL_ITEM_ID, 4);
                          giveItem(player, services, ROPE_ITEM_ID);
                      }),
                      showItem(ROPE_ITEM_ID, "Ned strands four balls of wool into strong rope."),
                  ]
                : [sayNpc("Bring me four balls of wool and I'll make it.")]),
        ]),
    ];
}

function wigSteps(event: NpcInteractionEvent): DialogueStep[] {
    if (!carriesItem(event.player, event.services, BALL_OF_WOOL_ITEM_ID, 3)) {
        return [
            sayPlayer("How about some sort of wig?"),
            sayNpc("Give me three balls of wool and I might be able to make one."),
        ];
    }
    return [
        sayPlayer("How about some sort of wig?"),
        sayNpc("I can make one from three balls of wool."),
        choose([
            option("Please make me a wig.", [
                run(({ player, services }) => {
                    takeItem(player, services, BALL_OF_WOOL_ITEM_ID, 3);
                    giveItem(player, services, GREY_WIG_ITEM_ID);
                }),
                showItem(GREY_WIG_ITEM_ID, "Ned works quickly and gives you a grey woollen wig."),
            ]),
            option("I'll come back when I need one.", []),
        ]),
    ];
}

function otherWoolSteps(event: NpcInteractionEvent): DialogueStep[] {
    return [
        sayPlayer("Could you make other things from wool?"),
        sayNpc("I am sure I can. What are you thinking of?"),
        choose([
            option("Could you knit me a sweater?", [
                sayNpc("Do I look like a sewing circle? I've fought monsters that turn hair blue!"),
            ]),
            option("How about some sort of wig?", wigSteps(event), { echo: false }),
            option("Could you repair the arrow holes in my shirt?", [
                sayNpc("Ned attacks your shirt with a needle. There you go, good as new."),
            ]),
        ]),
    ];
}

export function createNedTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const questActive = stage >= STAGE_SPOKEN_TO_OSMAN && stage < STAGE_PRINCE_SAVED;
        const steps: DialogueStep[] = [
            sayNpc(
                "Why hello there. My friends call me Ned. I was a man of the sea. Could I make or sell you some rope?",
            ),
            choose([
                ...(questActive
                    ? [
                          option("Could you make other things from wool?", otherWoolSteps(event), {
                              echo: false,
                          }),
                      ]
                    : []),
                option("Yes, I would like some rope.", ropeSteps(event), { echo: false }),
                option("No thanks, Ned.", [
                    sayNpc("Old Neddy is always here if you need the business."),
                ]),
            ]),
        ];
        startConversation(
            { player: event.player, services: event.services, npcId: NED_NPC_ID, npcName: "Ned" },
            steps,
        );
    };
}

function makeDyeSteps(
    itemId: number,
    ingredientId: number,
    ingredientCount: number,
    colour: string,
    event: NpcInteractionEvent,
): DialogueStep[] {
    const ready =
        carriesItem(event.player, event.services, ingredientId, ingredientCount) &&
        carriesItem(event.player, event.services, COINS_ITEM_ID, 5);
    return ready
        ? [
              sayPlayer(`Please make me some ${colour} dye.`),
              run(({ player, services }) => {
                  takeItem(player, services, ingredientId, ingredientCount);
                  takeItem(player, services, COINS_ITEM_ID, 5);
                  giveItem(player, services, itemId);
              }),
              showItem(itemId, `Aggie takes the ingredients and gives you ${colour} dye.`),
          ]
        : [sayNpc(`You need ${ingredientCount} ingredients and 5 coins for ${colour} dye.`)];
}

function dyeMenuSteps(event: NpcInteractionEvent): DialogueStep[] {
    return [
        choose([
            option("What do you need for red dye?", [
                sayNpc("Three lots of redberries and five coins."),
                ...makeDyeSteps(RED_DYE_ITEM_ID, REDBERRIES_ITEM_ID, 3, "red", event),
            ]),
            option("What do you need for yellow dye?", [
                sayNpc("Two onions and five coins."),
                ...makeDyeSteps(YELLOW_DYE_ITEM_ID, ONION_ITEM_ID, 2, "yellow", event),
            ]),
            option("What do you need for blue dye?", [
                sayNpc("Two woad leaves and five coins."),
                ...makeDyeSteps(BLUE_DYE_ITEM_ID, WOAD_LEAF_ITEM_ID, 2, "blue", event),
            ]),
            option("No thanks, I am happy with my colour.", [
                sayNpc("When you need dyes, come to me."),
            ]),
        ]),
    ];
}

function skinPasteSteps(event: NpcInteractionEvent): DialogueStep[] {
    const { player, services } = event;
    const waterItem = carriesItem(player, services, BUCKET_OF_WATER_ITEM_ID)
        ? BUCKET_OF_WATER_ITEM_ID
        : carriesItem(player, services, JUG_OF_WATER_ITEM_ID)
          ? JUG_OF_WATER_ITEM_ID
          : undefined;
    const ready =
        waterItem !== undefined &&
        carriesItem(player, services, ASHES_ITEM_ID) &&
        carriesItem(player, services, POT_OF_FLOUR_ITEM_ID) &&
        carriesItem(player, services, REDBERRIES_ITEM_ID);
    if (!ready) {
        return [
            sayPlayer("Could you think of a way to make skin paste?"),
            sayNpc("It is one of my popular potions."),
            sayNpc("Bring ashes, flour, water, and redberries and I will make it."),
        ];
    }
    return [
        sayPlayer("Could you make me skin paste?"),
        sayNpc("You already have the ingredients. Shall I mix it now?"),
        choose([
            option("Yes please.", [
                run(({ player: questPlayer, services: questServices }) => {
                    takeItem(questPlayer, questServices, waterItem);
                    takeItem(questPlayer, questServices, ASHES_ITEM_ID);
                    takeItem(questPlayer, questServices, POT_OF_FLOUR_ITEM_ID);
                    takeItem(questPlayer, questServices, REDBERRIES_ITEM_ID);
                    giveItem(questPlayer, questServices, SKIN_PASTE_ITEM_ID);
                }),
                sayNpc("Tourniquet, Fenderbaum, Tottenham, Marshmallow, MarbleArch!"),
                showItem(SKIN_PASTE_ITEM_ID, "Aggie hands you a bottle of skin paste."),
            ]),
            option("No thank you.", [sayNpc("That is always your choice, dearie.")]),
        ]),
    ];
}

export function createAggieTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const questActive = stage >= STAGE_SPOKEN_TO_OSMAN && stage < STAGE_PRINCE_SAVED;
        const steps: DialogueStep[] = [
            sayNpc("What can I help you with?"),
            choose([
                ...(questActive
                    ? [
                          option("Could you make skin paste?", skinPasteSteps(event), {
                              echo: false,
                          }),
                      ]
                    : []),
                option("What could you make for me?", [
                    sayNpc("I make red, yellow, and blue dyes. Would you like some?"),
                    ...dyeMenuSteps(event),
                ]),
                option("Do you turn people into frogs?", [
                    sayNpc("Not for years. A talking chicken is probably the professor's doing."),
                ]),
                option("You mad old witch, you can't help me.", [
                    sayNpc("Be careful insulting a witch. You never know what shape you may wake in."),
                ]),
                option("Can you make dyes for me?", dyeMenuSteps(event)),
            ]),
        ];
        startConversation(
            { player: event.player, services: event.services, npcId: AGGIE_NPC_IDS[1], npcName: "Aggie" },
            steps,
        );
    };
}

function keliPlanSteps(quest: QuestDefinition, event: NpcInteractionEvent): DialogueStep[] {
    return [
        sayPlayer("What is your latest plan?"),
        sayNpc("I have a valuable prisoner in my cells and expect a high reward very soon."),
        choose([
            option("You must have been very skilful.", [
                sayNpc("I did most of the work. We grabbed the Pr... prisoner without his guards noticing."),
            ]),
            option("Are you sure they will pay?", [
                sayNpc("They will pay, or we will cut his hair off and send it to them."),
            ]),
            option("Can you be sure they won't get him out?", keliKeySteps(quest, event)),
            option("I should not disturb someone as tough as you.", [sayNpc("Goodbye.")]),
        ]),
    ];
}

function keliKeySteps(quest: QuestDefinition, event: NpcInteractionEvent): DialogueStep[] {
    return [
        sayNpc(
            "The only key is on a Runite chain around my neck. The locksmith died when he finished it.",
        ),
        choose([
            option("Could I see the key for a moment?", [
                sayNpc("Since you ask so respectfully, you may see it. You cannot steal the chain."),
                showItem(KEY_PRINT_ITEM_ID, "Keli shows you a small key on a strong chain."),
                ...(getQuestStage(event.player, quest) === STAGE_SPOKEN_TO_OSMAN &&
                carriesItem(event.player, event.services, SOFT_CLAY_ITEM_ID)
                    ? [
                          choose([
                              option("Could I touch the key for a moment?", [
                                  sayNpc("Only for a moment."),
                                  run(({ player, services }) => {
                                      takeItem(player, services, SOFT_CLAY_ITEM_ID);
                                      giveItem(player, services, KEY_PRINT_ITEM_ID);
                                  }),
                                  showItem(
                                      KEY_PRINT_ITEM_ID,
                                      "You secretly press the key into soft clay and take an imprint.",
                                  ),
                                  sayNpc("Run along now. I am very busy."),
                              ]),
                              option("I should not disturb you.", [sayNpc("Goodbye.")]),
                          ]),
                      ]
                    : [sayNpc("There, run along now. I am very busy.")]),
            ]),
            option("That is a good way to keep secrets.", [
                sayNpc("Dead men tell no tales."),
            ]),
            option("I should not disturb you.", [sayNpc("Goodbye.")]),
        ]),
    ];
}

export function createLadyKeliTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const steps: DialogueStep[] = stage >= STAGE_KELI_TIED
            ? [
                  sayNpc("You tricked me and tied me up! Guards, kill this stranger!"),
                  sayPlayer("Perhaps I should leave before the guards listen."),
              ]
            : [
                  sayPlayer("Are you the famous Lady Keli, leader of the toughest mercenary gang?"),
                  sayNpc("I am Keli. You have heard of me, then?"),
                  choose([
                      option("You are famous throughout RuneScape!", [
                          sayNpc("That is kind. Reputations are not easily earned."),
                          choose([
                              option("What is your latest plan?", keliPlanSteps(quest, event), {
                                  echo: false,
                              }),
                              option("You must have trained a lot.", [
                                  sayNpc("I used a sword as a small girl and stabbed three people before six."),
                              ]),
                              option("I think Katrine is tougher.", [
                                  sayNpc("Those Black Arm cowards dare not leave the city. Get out!"),
                              ]),
                              option("I should not disturb you.", [sayNpc("Goodbye.")]),
                          ]),
                      ]),
                      option("I think Katrine is tougher.", [
                          sayNpc("Out here I am the toughest. Leave before I call my guards."),
                      ]),
                      option("I heard rumours that you kill people.", [
                          sayNpc("People spread all sorts of ridiculous rumours."),
                          ...keliPlanSteps(quest, event),
                      ]),
                      option("No, I have never heard of you.", [
                          sayNpc("You must be new. Everyone knows Lady Keli!"),
                          choose([
                              option("Still doesn't ring a bell.", [
                                  sayNpc("Show respect or I will wring your neck."),
                              ]),
                              option("Of course I've heard of you.", keliPlanSteps(quest, event)),
                              option("You must have trained a lot.", [
                                  sayNpc("I have used a sword since I was a small girl."),
                              ]),
                          ]),
                      ]),
                  ]),
              ];
        startConversation(
            {
                player: event.player,
                services: event.services,
                npcId: LADY_KELI_VISIBLE_NPC_ID,
                npcName: "Lady Keli",
            },
            steps,
        );
    };
}

export function joeBeerSteps(quest: QuestDefinition, event: NpcInteractionEvent): DialogueStep[] {
    const total = event.services.inventory
        .getInventoryItems(event.player)
        .filter((entry) => entry.itemId === BEER_ITEM_ID)
        .reduce((sum, entry) => sum + entry.quantity, 0);
    if (total <= 0) return [sayPlayer("It seems I don't have any beer.")];
    return [
        sayPlayer("I have some beer here, fancy one?"),
        sayNpc("That would be lovely, just one to wet my throat."),
        run(({ player, services }) => {
            takeItem(player, services, BEER_ITEM_ID);
        }),
        showItem(BEER_ITEM_ID, "You hand Joe a beer. He drinks it in seconds."),
        ...(total >= 3
            ? [
                  sayPlayer("Would you care for another, my friend? Keep these two for later."),
                  run(({ player, services }) => {
                      takeItem(player, services, BEER_ITEM_ID, 2);
                      setQuestStage(player, quest, services, STAGE_GUARD_DRUNK);
                  }),
                  sayNpc("Franksh, that wash just what I needed. No more beersh..."),
                  showItem(BEER_ITEM_ID, "Joe is drunk and is no longer a problem."),
              ]
            : [sayNpc("One drink won't get me drunk. You would need a few at once.")]),
    ];
}

export function createJoeTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        let steps: DialogueStep[];
        if (stage === STAGE_PREPARATION_COMPLETE) {
            steps = [
                choose([
                    option("I have some beer, fancy one?", joeBeerSteps(quest, event), {
                        echo: false,
                    }),
                    option("Tell me about a guard's life.", [
                        sayNpc("The hours are good, but most drag. I should have studied at knight school."),
                    ]),
                    option("What did you want to be as a boy?", [
                        sayNpc("I sat by the lake and shot fish with a bow. Better than goblin hunting."),
                    ]),
                    option("I had better leave.", [
                        sayNpc("Thanks. Talking on duty can get your mouth stitched up."),
                    ]),
                ]),
            ];
        } else if (stage === STAGE_GUARD_DRUNK || stage === STAGE_KELI_TIED) {
            steps = [
                sayNpc("Halt! Who goesh there?"),
                sayPlayer("I am just rescuing the Prince. Is that okay?"),
                sayNpc("Thatsh a funny joke. Lucky I am shober. Go in peash."),
            ];
        } else if (stage >= STAGE_PRINCE_SAVED) {
            steps = [
                sayNpc("The Prince escaped and I am in trouble. They are not sure I was drunk."),
                sayPlayer("I won't say anything. Your secret is safe."),
            ];
        } else {
            steps = [
                sayNpc("Hi, I'm Joe, door guard for Lady Keli."),
                sayPlayer("Who are you guarding?"),
                sayNpc("Can't say. It's secret. I am not supposed to talk on duty."),
            ];
        }
        startConversation(
            {
                player: event.player,
                services: event.services,
                npcId: JOE_VISIBLE_NPC_ID,
                npcName: "Joe",
            },
            steps,
        );
    };
}
