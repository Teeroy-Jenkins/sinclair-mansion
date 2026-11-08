import type { PlayerState } from "../../../../../src/game/player";
import type { NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    countCarriedItem,
    getQuestStage,
    hasQuestItems,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import {
    type DialogueContext,
    type DialogueStep,
    choose,
    option,
    sayNpc,
    sayPlayer,
    startConversation,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BRONZE_PICKAXE_ITEM_ID,
    DORIC_NPC_ID,
    REQUIRED_ITEMS,
    STAGE_COMPLETE,
    STAGE_STARTED,
} from "./constants";

function giveStarterPickaxe(ctx: DialogueContext): void {
    const result = ctx.services.inventory.addItemToInventory(
        ctx.player,
        BRONZE_PICKAXE_ITEM_ID,
        1,
    );
    if (result.added === 1) {
        ctx.services.inventory.snapshotInventory(ctx.player);
        ctx.services.messaging.sendGameMessage(ctx.player, "Doric gives you a bronze pickaxe.");
    } else {
        ctx.services.messaging.sendGameMessage(
            ctx.player,
            "Doric cannot give you the pickaxe because your inventory is full.",
        );
    }
}

function finishQuestStep(quest: QuestDefinition): DialogueStep {
    return {
        exec: (ctx) => {
            if (!takeQuestItems(ctx.player, ctx.services, REQUIRED_ITEMS)) {
                ctx.services.messaging.sendGameMessage(
                    ctx.player,
                    "You don't have all the materials Doric needs.",
                );
                return;
            }
            ctx.services.messaging.sendGameMessage(
                ctx.player,
                "You hand the clay, copper, and iron to Doric.",
            );
            completeQuest(ctx.player, ctx.services, quest);
        },
    };
}

function hasExactMaterials(player: PlayerState, services: ScriptServices): boolean {
    return REQUIRED_ITEMS.every(
        (requirement) =>
            countCarriedItem(player, services, requirement.itemId) === requirement.quantity,
    );
}

function buildReadyAtStartSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const exactQuantityLine = hasExactMaterials(player, services)
        ? [sayPlayer("In fact, in the exact quantities too!")]
        : [];
    return [
        sayPlayer("You know, it's funny you should require those exact things!"),
        sayNpc("What do you mean?"),
        sayPlayer([
            "I can usually fit 28 things in my backpack and in a world",
            "full of quite literally limitless possibilities, a complete",
            "coincidence has occurred!",
        ]),
        sayNpc("I don't quite understand what you're saying?"),
        sayPlayer([
            "Well, out of pure coincidence, despite definitely not knowing",
            "what you were about to request, I just so happened to have",
            "carried those exact items!",
        ]),
        ...exactQuantityLine,
        sayNpc([
            "Oh my, that is a coincidence! Pass them here, please.",
            "I can spare you some coins for your trouble, and please",
            "use my anvils any time you want.",
        ]),
        finishQuestStep(quest),
    ];
}

function buildAcceptSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const ready = hasQuestItems(player, services, REQUIRED_ITEMS);
    const continuation: DialogueStep[] = ready
        ? buildReadyAtStartSteps(quest, player, services)
        : [
              choose([
                  option("Where can I find those?", [
                      sayNpc([
                          "You'll be able to find all those ores in the rocks just inside",
                          "the Dwarven Mine. Head east from here and you'll find the",
                          "entrance in the side of Ice Mountain.",
                      ]),
                  ]),
                  option("Certainly, I'll be right back!"),
              ]),
          ];
    return [
        sayNpc([
            "Clay is what I use more than anything, to make casts.",
            "Could you get me 6 clay, 4 copper ore, and 2 iron ore, please?",
            "I could pay a little, and let you use my anvils.",
            "Take this pickaxe with you just in case you need it.",
        ]),
        {
            exec: (ctx) => {
                setQuestStage(ctx.player, quest, ctx.services, STAGE_STARTED);
                giveStarterPickaxe(ctx);
            },
        },
        ...continuation,
    ];
}

function buildStartChoice(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep {
    return choose(
        [
            option(
                "Yes, I will get you the materials.",
                buildAcceptSteps(quest, player, services),
            ),
            option("No, hitting rocks is for the boring people, sorry.", [
                sayNpc("That is your choice. Nice to meet you anyway."),
            ]),
        ],
        "Start Doric's Quest?",
    );
}

function buildAnvilRequestSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    return [
        sayNpc([
            "My anvils get enough work with my own use. I make pickaxes,",
            "and it takes a lot of hard work. If you could get me some more",
            "materials, then I could let you use them.",
        ]),
        buildStartChoice(quest, player, services),
    ];
}

function buildWhetstoneRequestSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    return [
        sayNpc([
            "The whetstone is for more advanced smithing, but I could let",
            "you use it as well as my anvils if you could get me some more",
            "materials.",
        ]),
        buildStartChoice(quest, player, services),
    ];
}

function buildNotStartedSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    return [
        sayNpc("Hello traveller, what brings you to my humble smithy?"),
        choose([
            option(
                "I wanted to use your anvils.",
                buildAnvilRequestSteps(quest, player, services),
            ),
            option(
                "I want to use your whetstone.",
                buildWhetstoneRequestSteps(quest, player, services),
            ),
            option("Mind your own business, shortstuff!", [
                sayNpc([
                    "How nice to meet someone with such pleasant manners.",
                    "Do come again when you need to shout at someone",
                    "smaller than you!",
                ]),
            ]),
            option("I was just checking out the landscape.", [
                sayNpc([
                    "Hope you like it. I do enjoy the solitude of my little home.",
                    "If you get time, please say hi to my friends in the Dwarven Mine.",
                ]),
                choose([
                    option("Dwarven Mine?", [
                        sayNpc([
                            "Yep, the entrance is in the side of Ice Mountain just to the",
                            "east of here. They're a friendly bunch. Stop in at Nurmof's",
                            "store and buy one of my pickaxes!",
                        ]),
                    ]),
                    option("Will do!"),
                ]),
            ]),
            option("What do you make here?", [
                sayNpc("I make pickaxes. I am the best maker of pickaxes in the whole of Gielinor."),
                sayPlayer("Do you have any to sell?"),
                sayNpc("Sorry, but I've got a running order with Nurmof."),
                choose([
                    option("Who's Nurmof?", [
                        sayNpc([
                            "Nurmof has a store over in the Dwarven Mine. You can find",
                            "the entrance on the side of Ice Mountain to the east of here.",
                        ]),
                    ]),
                    option("Ah, fair enough."),
                ]),
            ]),
        ]),
    ];
}

function buildInProgressSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (!hasQuestItems(player, services, REQUIRED_ITEMS)) {
        return [
            sayNpc("Have you got my materials yet, traveller?"),
            sayPlayer("Sorry, I don't have them all yet."),
            sayNpc("Not to worry, stick at it. Remember, I need 6 clay, 4 copper ore and 2 iron ore."),
        ];
    }
    return [
        sayNpc("Have you got my materials yet, traveller?"),
        sayPlayer("I have everything you need!"),
        sayNpc([
            "Many thanks. Pass them here, please. I can spare you some coins",
            "for your trouble, and please use my anvils any time you want.",
        ]),
        finishQuestStep(quest),
    ];
}

const completedSteps: DialogueStep[] = [
    sayNpc("Hello traveller, how is your metalworking coming along?"),
    sayPlayer("Not too bad, Doric."),
    sayNpc("Good, the love of metal is a thing close to my heart."),
];

function context(player: PlayerState, services: ScriptServices): DialogueContext {
    return { player, services, npcId: DORIC_NPC_ID, npcName: "Doric" };
}

export function startDoricAnvilConversation(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
    whetstone = false,
): void {
    const stage = getQuestStage(player, quest);
    if (stage >= STAGE_STARTED) {
        startConversation(context(player, services), buildInProgressSteps(quest, player, services));
        return;
    }
    const intro = whetstone
        ? sayNpc([
              "The whetstone is for more advanced smithing, but I could let",
              "you use it as well as my anvils if you could get me some more",
              "materials.",
          ])
        : sayNpc([
              "Hey, who said you could use that? My anvils get enough work",
              "with my own use. I make pickaxes, and it takes a lot of hard work.",
          ]);
    const request = whetstone
        ? [buildStartChoice(quest, player, services)]
        : [
              choose([
                  option("Sorry, would it be OK if I used your anvils?", [
                      sayNpc("If you could get me some more materials then I could let you use them."),
                      buildStartChoice(quest, player, services),
                  ]),
                  option("I didn't want to use your anvils anyway.", [sayNpc("That is your choice.")]),
              ]),
          ];
    startConversation(context(player, services), [intro, ...request]);
}

export function createDoricTalkHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const stage = getQuestStage(player, quest);
        if (stage >= STAGE_COMPLETE) {
            startConversation(context(player, services), completedSteps);
        } else if (stage >= STAGE_STARTED) {
            startConversation(context(player, services), buildInProgressSteps(quest, player, services));
        } else {
            startConversation(context(player, services), buildNotStartedSteps(quest, player, services));
        }
    };
}
