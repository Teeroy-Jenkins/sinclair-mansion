import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import type { PlayerState } from "../../../../../src/game/player";
import type { NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem, getQuestStage, setQuestStage } from "../../QuestService";
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
    ITEM,
    NPC,
    STAGE_COMPLETE,
    STAGE_OBTAINED_SKULL,
    STAGE_SPOKEN_GHOST,
    STAGE_SPOKEN_URHNEY,
    STAGE_STARTED,
} from "./constants";

function npcContext(
    player: PlayerState,
    services: ScriptServices,
    npcId: number,
    npcName: string,
): DialogueContext {
    return { player, services, npcId, npcName };
}

function saradominSteps(): DialogueStep[] {
    return [
        sayNpc("Surely you have heard of the god, Saradomin?"),
        sayNpc("He who creates the forces of goodness and purity in this world? I cannot believe your ignorance!"),
        sayNpc("This is the god with more followers than any other! ...At least in this part of the world."),
        sayNpc("He who created this world along with his brothers Guthix and Zamorak?"),
        choose([
            option("Oh, THAT Saradomin...", [
                sayNpc("There... is only one Saradomin..."),
                sayPlayer("Yeah... I, uh, thought you said something else."),
            ]),
            option("Oh, sorry. I'm not from this world.", [
                sayNpc("..."),
                sayNpc("That's... strange."),
                sayNpc("I thought things not from this world were all slime and tentacles."),
                choose([
                    option("You don't understand. This is a computer game!", [
                        sayNpc("I... beg your pardon?"),
                        sayPlayer("Never mind."),
                    ]),
                    option("I am - do you like my disguise?", [
                        sayNpc("Aargh! Begone foul creature from another dimension!"),
                        sayPlayer("Ok, ok, I was only joking..."),
                    ]),
                ]),
            ]),
        ]),
    ];
}

function buildAereckStartSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("That's lucky, I need someone to do a quest for me."),
        choose(
            [
                option("Yes.", [
                    sayPlayer("Okay, let me help then."),
                    {
                        exec: (ctx) => setQuestStage(ctx.player, quest, ctx.services, STAGE_STARTED),
                    },
                    sayNpc("Thank you. The problem is, there is a ghost in the church graveyard. I would like you to get rid of it."),
                    sayNpc("If you need any help, my friend Father Urhney is an expert on ghosts."),
                    sayNpc([
                        "I believe he is currently living as a hermit in Lumbridge swamp.",
                        "He has a little shack in the far west of the swamps.",
                    ]),
                    sayNpc("Exit the graveyard through the south gate to reach the swamp. I'm sure if you told him that I sent you he'd be willing to help."),
                    sayNpc("My name is Father Aereck by the way. Pleased to meet you."),
                    sayPlayer("Likewise."),
                    sayNpc("Take care travelling through the swamps, I have heard they can be quite dangerous."),
                    sayPlayer("I will, thanks."),
                ], { echo: false }),
                option("No.", [
                    sayPlayer("Sorry, I don't have time right now."),
                    sayNpc("Oh well. If you do have some spare time on your hands, come back and talk to me."),
                ], { echo: false }),
            ],
            "Start The Restless Ghost?",
        ),
    ];
}

function buildAereckDefaultSteps(quest: QuestDefinition, complete: boolean): DialogueStep[] {
    return [
        sayNpc("Welcome to the church of holy Saradomin."),
        choose([
            option("Who's Saradomin?", saradominSteps()),
            option("Nice place you've got here.", [
                sayNpc(["It is, isn't it?", "It was built over 230 years ago."]),
            ]),
            option(
                "I'm looking for a quest!",
                complete
                    ? [sayNpc("Sorry, I only had the one quest.")]
                    : buildAereckStartSteps(quest),
            ),
        ]),
    ];
}

function buildAereckProgressSteps(
    stage: number,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const prefix = [sayNpc("Have you got rid of the ghost yet?")];
    if (stage === STAGE_STARTED) {
        return [
            ...prefix,
            sayPlayer("I can't find Father Urhney at the moment."),
            sayNpc("To reach the swamp, go around the back of the castle and through the woods to the west."),
            sayNpc("Father Urhney's shack is in the western part of Lumbridge Swamp."),
        ];
    }
    if (stage === STAGE_SPOKEN_URHNEY) {
        return [
            ...prefix,
            sayPlayer("I talked to Father Urhney. He gave me this funny amulet to talk to the ghost with."),
            sayNpc("I always wondered what that amulet was... I hope it's useful. Tell me when you get rid of the ghost!"),
        ];
    }
    if (stage === STAGE_SPOKEN_GHOST) {
        return [
            ...prefix,
            sayPlayer("The ghost's corpse has lost its skull. If I can find the skull the ghost will go."),
            sayNpc("That WOULD explain it."),
            sayNpc("Hmmmmm. Well, I haven't seen any skulls."),
            sayPlayer("I think a warlock has stolen it."),
            sayNpc("I hate warlocks."),
            sayNpc("Ah well, good luck!"),
        ];
    }
    if (stage === STAGE_OBTAINED_SKULL) {
        return countCarriedItem(player, services, ITEM.ghostSkull) > 0
            ? [
                  ...prefix,
                  sayPlayer("I've finally found the ghost's skull!"),
                  sayNpc("Great! Put it in the ghost's coffin and see what happens!"),
              ]
            : [
                  ...prefix,
                  sayPlayer("I found the ghost's skull but then lost it."),
                  sayNpc("Don't worry, I'm sure you'll find it again."),
              ];
    }
    return prefix;
}

export function createFatherAereckTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const steps =
            stage === 0 || stage >= STAGE_COMPLETE
                ? buildAereckDefaultSteps(quest, stage >= STAGE_COMPLETE)
                : buildAereckProgressSteps(stage, event.player, event.services);
        startConversation(
            npcContext(event.player, event.services, NPC.fatherAereck, "Father Aereck"),
            steps,
        );
    };
}

function repossessSteps(): DialogueStep[] {
    return [
        sayNpc("Under what grounds???"),
        choose([
            option("Repeated failure on mortgage payments.", [
                sayNpc("What?"),
                sayNpc(["But... I don't have a mortgage!", "I built this house myself!"]),
                sayPlayer(["Sorry. I must have got the wrong address.", "All the houses look the same around here."]),
            ]),
            option("I don't know, I just wanted this house.", [
                sayNpc("Oh... go away and stop wasting my time!"),
            ]),
        ]),
    ];
}

function giveGhostspeakAmulet(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (
        services.inventory.findOwnedItemLocation(player, ITEM.ghostspeakAmulet) === undefined &&
        !services.inventory.canStoreItem(player, ITEM.ghostspeakAmulet)
    ) {
        return [sayNpc("You need some free inventory space before I can give you the amulet.")];
    }
    return [
        {
            exec: (ctx) => {
                if (ctx.services.inventory.findOwnedItemLocation(ctx.player, ITEM.ghostspeakAmulet) === undefined) {
                    const result = ctx.services.inventory.addItemToInventory(ctx.player, ITEM.ghostspeakAmulet, 1);
                    if (result.added !== 1) return;
                    ctx.services.inventory.snapshotInventory(ctx.player);
                }
                setQuestStage(ctx.player, quest, ctx.services, STAGE_SPOKEN_URHNEY);
                ctx.services.messaging.sendGameMessage(ctx.player, "Father Urhney hands you an amulet.");
            },
        },
        sayNpc("It is an Amulet of Ghostspeak."),
        sayNpc("When you wear it you can speak to ghosts. Many ghosts are doomed because they left an important task uncompleted."),
        sayNpc("Maybe if you learn what that task is, you can get rid of the ghost. I'm not making any guarantees, mind you."),
        sayPlayer("Thank you. I'll give it a try!"),
    ];
}

function urhneyQuestSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const explain: DialogueStep[] = [
        sayPlayer("He's got a ghost haunting his graveyard."),
        sayNpc("Oh, the silly fool."),
        sayNpc("I leave town for just five months, and ALREADY he can't manage."),
        sayNpc("(sigh)"),
        sayNpc("I can't go back and exorcise it. I vowed not to leave until I had done two full years of prayer and meditation."),
        sayNpc("Tell you what I can do though; take this amulet."),
        ...giveGhostspeakAmulet(quest, player, services),
    ];
    return [
        sayNpc(["I suppose I'd better talk to you then.", "What problems has he got himself into this time?"]),
        choose([
            option("He's got a ghost haunting his graveyard.", explain, { echo: false }),
            option("You mean he gets himself into lots of problems?", [
                sayNpc("Yeah. When we were trainee priests he kept on getting stuck up bell ropes."),
                sayNpc("Anyway, I don't have time for chitchat. What's his problem THIS time?"),
                ...explain,
            ]),
        ]),
    ];
}

function lostAmuletSteps(
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    if (!services.inventory.canStoreItem(player, ITEM.ghostspeakAmulet)) {
        return [sayNpc("Make some room in your inventory and I will give you my spare.")];
    }
    return [
        sayNpc("How careless can you get? Those things aren't easy to come by! It's a good job I've got a spare."),
        {
            exec: (ctx) => {
                const result = ctx.services.inventory.addItemToInventory(ctx.player, ITEM.ghostspeakAmulet, 1);
                if (result.added === 1) {
                    ctx.services.inventory.snapshotInventory(ctx.player);
                    ctx.services.messaging.sendGameMessage(ctx.player, "Father Urhney hands you an amulet.");
                }
            },
        },
        sayNpc("Be more careful this time."),
        sayPlayer("Okay, I'll try to be."),
    ];
}

export function createFatherUrhneyTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const stage = getQuestStage(player, quest);
        const options = [
            option("Well, that's friendly.", [
                sayNpc("I SAID go AWAY."),
                sayPlayer("Okay, okay..."),
            ]),
        ];
        if (stage === STAGE_STARTED) {
            options.push(
                option("Father Aereck sent me to talk to you.", urhneyQuestSteps(quest, player, services)),
            );
        } else if (
            stage >= STAGE_SPOKEN_URHNEY &&
            stage < STAGE_COMPLETE &&
            services.inventory.findOwnedItemLocation(player, ITEM.ghostspeakAmulet) === undefined
        ) {
            options.push(option("I've lost the amulet.", lostAmuletSteps(player, services)));
        }
        options.push(option("I've come to repossess your house.", repossessSteps()));
        startConversation(npcContext(player, services, NPC.fatherUrhney, "Father Urhney"), [
            sayNpc("Go away! I'm meditating!"),
            choose(options),
        ]);
    };
}

function skullExplanationSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("I've been told a certain task may need to be completed so you can rest in peace."),
        sayNpc("A warlock stole my skull. If you look inside my coffin there, you'll find my corpse without a head on it."),
        sayPlayer("Do you know where this warlock might be now?"),
        sayNpc("I think it was one of the warlocks who lives in the big tower by the sea south-west from here."),
        sayPlayer("Ok. I will try and get the skull back for you, then you can rest in peace."),
        sayNpc("Ooh, thank you. That would be such a great relief!"),
        {
            exec: (ctx) => setQuestStage(ctx.player, quest, ctx.services, STAGE_SPOKEN_GHOST),
        },
        sayNpc("It is so dull being a ghost..."),
    ];
}

function scaryGhostSteps(): DialogueStep[] {
    return [
        sayNpc("Great."),
        sayNpc("The first person I can speak to in ages..."),
        sayNpc("..and they're an idiot."),
    ];
}

function firstGhostConversation(quest: QuestDefinition): DialogueStep[] {
    const help = [
        sayPlayer("Yes, ok. Do you know WHY you're a ghost?"),
        sayNpc("Nope. I just know I can't do much of anything like this!"),
        ...skullExplanationSteps(quest),
    ];
    return [
        sayPlayer("Hello ghost, how are you?"),
        sayNpc("Not very good actually."),
        sayPlayer("What's the problem then?"),
        sayNpc("Did you just understand what I said???"),
        choose([
            option("Yep, now tell me what the problem is.", [
                sayNpc("WOW! This is INCREDIBLE! I didn't expect anyone to ever understand me again!"),
                sayPlayer("Ok, Ok, I can understand you!"),
                sayPlayer("But have you any idea WHY you're doomed to be a ghost?"),
                sayNpc("Well, to be honest... I'm not sure."),
                ...skullExplanationSteps(quest),
            ]),
            option("No, you sound like you're speaking nonsense to me.", [
                sayNpc("Oh that's a pity. You got my hopes up there."),
                sayPlayer("Yeah, it is a pity. Sorry about that."),
                sayNpc("Hang on a second... you CAN understand me!"),
                choose([
                    option("No I can't.", [
                        sayNpc("Great."),
                        sayNpc("The first person I can speak to in ages..."),
                        sayNpc("..and they're a moron."),
                    ]),
                    option("Yep, clever aren't I?", [
                        sayNpc("I'm impressed. I don't suppose you can stop me being a ghost?"),
                        choose([
                            option("Yes, ok. Do you know WHY you're a ghost?", help, { echo: false }),
                            option("No, you're scary!", scaryGhostSteps()),
                        ]),
                    ]),
                ]),
            ]),
            option("Wow, this amulet works!", [
                sayNpc("Oh! It's your amulet that's doing it! I did wonder. I don't suppose you can help me? I don't like being a ghost."),
                choose([
                    option("Yes, ok. Do you know why you're a ghost?", help, { echo: false }),
                    option("No, you're scary!", scaryGhostSteps()),
                ]),
            ]),
        ]),
    ];
}

function noAmuletGhostSteps(): DialogueStep[] {
    const dontUnderstand = [
        sayNpc("Woo woo?"),
        sayPlayer("Nope, still don't understand you."),
        sayNpc("WOOOOOOOOO!"),
        sayPlayer("Never mind."),
    ];
    return [
        sayPlayer("Hello ghost, how are you?"),
        sayNpc("Wooo wooo wooooo!"),
        choose([
            option("Sorry, I don't speak ghost.", dontUnderstand),
            option("Ooh, THAT'S interesting.", [
                sayNpc("Woo wooo. Woooooooooooooooooo!"),
                sayPlayer("Hmm... I'm not so sure about that."),
                sayNpc("Wooo woo?"),
                sayPlayer("Well, if you INSIST."),
                sayNpc("Wooooooooo!"),
                sayPlayer("Ah well, better be off now..."),
                sayNpc("Woo."),
                sayPlayer("Bye."),
            ]),
            option("Any hints where I can find some treasure?", [
                sayNpc("Wooooooo woo! Wooooo woo wooooo woowoowoo woo Woo wooo. Wooooo woo woo? Woooooooooooooooooo!"),
                choose([
                    option("Sorry, I don't speak ghost.", dontUnderstand),
                    option("Thank you. You've been very helpful.", [sayNpc("Wooooooo.")]),
                ]),
            ]),
        ]),
    ];
}

export function createRestlessGhostTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage === 0) {
            steps = [
                sayNpc("Wooooo! Ooooooh!"),
                sayPlayer("I can't understand a word you are saying. Maybe Father Aereck will be able to help."),
            ];
        } else if (stage >= STAGE_COMPLETE) {
            steps = [sayNpc("The ghost doesn't appear interested in talking.")];
        } else if (services.equipment.getEquippedItem(player, EquipmentSlot.AMULET) !== ITEM.ghostspeakAmulet) {
            steps = noAmuletGhostSteps();
        } else if (stage === STAGE_SPOKEN_URHNEY) {
            steps = firstGhostConversation(quest);
        } else if (stage === STAGE_SPOKEN_GHOST) {
            steps = [
                sayPlayer("Hello ghost, how are you?"),
                sayNpc("How are you doing finding my skull?"),
                sayPlayer("Sorry, I can't find it at the moment."),
                sayNpc("Ah well. Keep on looking."),
                sayNpc("I'm pretty sure it's somewhere in the tower south-west from here. There's a lot of levels to the tower, though."),
            ];
        } else {
            steps = [
                sayPlayer("Hello ghost, how are you?"),
                sayNpc("How are you doing finding my skull?"),
                sayPlayer("I have found it!"),
                sayNpc("Hurrah! Put it in my coffin there, then I'll be free!"),
            ];
        }
        startConversation(npcContext(player, services, NPC.restlessGhost, "Restless ghost"), steps);
    };
}
