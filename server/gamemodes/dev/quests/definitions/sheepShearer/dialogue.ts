import type { PlayerState } from "../../../../../src/game/player";
import type { NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage } from "../../QuestService";
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
    BALL_OF_WOOL_ITEM_ID,
    FRED_THE_FARMER_NPC_ID,
    SHEARS_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_STARTED,
    WOOL_ITEM_ID,
    getRemainingWool,
} from "./constants";

const playersWhoSawTheThing = new WeakSet<PlayerState>();

export function markSheepShearerThingSeen(player: PlayerState): void {
    playersWhoSawTheThing.add(player);
}

function removeWool(player: PlayerState, services: ScriptServices, quantity: number): number {
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== BALL_OF_WOOL_ITEM_ID || entry.quantity <= 0) continue;
        const amount = Math.min(entry.quantity, remaining);
        const next = entry.quantity - amount;
        services.inventory.setInventorySlot(player, entry.slot, next > 0 ? entry.itemId : -1, next);
        remaining -= amount;
        if (remaining === 0) break;
    }
    const removed = quantity - remaining;
    if (removed > 0) services.inventory.snapshotInventory(player);
    return removed;
}

function restoreWool(player: PlayerState, services: ScriptServices, quantity: number): void {
    if (quantity <= 0) return;
    const restored = services.inventory.addItemToInventory(
        player,
        BALL_OF_WOOL_ITEM_ID,
        quantity,
    ).added;
    services.inventory.snapshotInventory(player);
    if (restored !== quantity) {
        services.system.logger.error?.(
            `[sheep-shearer] Failed to restore wool player=${player.id} expected=${quantity} restored=${restored}`,
        );
    }
}

function tutorialSteps(player: PlayerState, services: ScriptServices): DialogueStep[] {
    const shearing = services.inventory.playerHasItem(player, SHEARS_ITEM_ID)
        ? [
              sayNpc([
                  "Well, you're half way there already! You have a set of shears",
                  "in your inventory. Just use those on a Sheep to shear it.",
              ]),
              sayPlayer("That's all I have to do?"),
              sayNpc("Well once you've collected some wool you'll need to spin it into balls."),
          ]
        : [
              sayNpc("Well, first things first, you need a pair of shears. I've got some here you can use."),
              sayNpc("You just need to go and use them on the sheep out in my field."),
              sayPlayer("Sounds easy!"),
              sayNpc("That's what they all say!"),
              sayNpc("Some of the sheep don't like it too much... Persistence is the key."),
              sayNpc("Once you've collected some wool you can spin it into balls."),
          ];
    return [
        ...shearing,
        sayNpc("Do you know how to spin wool?"),
        choose([
            option("Yes, I know how to spin wool.", [sayNpc("Great!")]),
            option("I don't know how to spin wool, sorry.", [
                sayNpc("Don't worry, it's quite simple!"),
                sayNpc("The nearest Spinning Wheel can be found on the first floor of Lumbridge Castle."),
                sayNpc("To get to Lumbridge Castle just follow the road east."),
                sayPlayer("Thank you!"),
            ]),
        ]),
    ];
}

function finishWithWool(
    quest: QuestDefinition,
    quantity: number,
): DialogueStep {
    return {
        exec: (ctx) => {
            const removed = removeWool(ctx.player, ctx.services, quantity);
            if (removed !== quantity) {
                restoreWool(ctx.player, ctx.services, removed);
                ctx.services.messaging.sendGameMessage(ctx.player, "You do not have enough balls of wool.");
                return;
            }
            ctx.services.messaging.sendGameMessage(
                ctx.player,
                quantity === 1
                    ? "You give Fred a ball of wool."
                    : `You give Fred ${quantity} balls of wool.`,
            );
            try {
                if (!completeQuest(ctx.player, ctx.services, quest)) {
                    restoreWool(ctx.player, ctx.services, quantity);
                    ctx.services.dialog.closeDialog(ctx.player);
                }
            } catch (error) {
                if (getQuestStage(ctx.player, quest) < STAGE_COMPLETE) {
                    restoreWool(ctx.player, ctx.services, quantity);
                }
                ctx.services.dialog.closeDialog(ctx.player);
                throw error;
            }
        },
    };
}

function buildStartSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const carried = countCarriedItem(player, services, BALL_OF_WOOL_ITEM_ID);
    const offer: DialogueStep[] = [
        sayNpc("You're after a quest, you say? Actually, I could do with a bit of help."),
        sayNpc([
            "My sheep are getting mighty woolly. I'd be much obliged if you",
            "could shear them. And while you're at it, spin the wool for me too.",
        ]),
        sayNpc([
            "Yes, that's it. Bring me 20 balls of wool. And I'm sure I could",
            "sort out some sort of payment. Of course, there's the small matter of The Thing.",
        ]),
    ];
    if (carried >= 20) {
        return [
            ...offer,
            sayPlayer("In fact Fred, funnily enough, I actually have 20 balls of wool already on me."),
            sayNpc("Have you been shearing my sheep without permission!?"),
            sayPlayer("No! Well, maybe... They just looked a little woolly! Surely you like a shave once in a while, too?"),
            sayNpc("It's rude to shave another person without permission - don't be coming at me with them shears!"),
            sayPlayer("I'm sorry, I'll ask permission next time."),
            sayNpc("I guess no real 'arm was done. Hand the balls over and we can put this whole thing behind us."),
            finishWithWool(quest, 20),
        ];
    }
    return [
        ...offer,
        sayPlayer("What do you mean, The Thing?"),
        sayNpc("Well now, no one has ever seen The Thing. That's why we call it The Thing, 'cos we don't know what it is."),
        sayNpc([
            "Some say it's a black hearted shapeshifter, hungering for the souls",
            "of hard working decent folk like me. Others say it's just a sheep.",
        ]),
        sayNpc("Well I don't have all day to stand around and gossip. Are you going to shear my sheep or what!"),
        choose([
            option("Yes.", [
                {
                    exec: (ctx) => setQuestStage(ctx.player, quest, ctx.services, STAGE_STARTED),
                },
                sayPlayer("Yes, okay. I can do that."),
                sayNpc("Good! Now one more thing, do you actually know how to shear a sheep?"),
                sayPlayer("Err. No, I don't know actually."),
                ...tutorialSteps(player, services),
            ]),
            option("No.", [sayPlayer("No, I'll give it a miss."), sayNpc("Suit yourself.")], { echo: false }),
        ]),
    ];
}

function buildThingReportSteps(): DialogueStep[] {
    return [
        sayPlayer("Fred! Fred! I've seen The Thing!"),
        sayNpc("You ... you actually saw it?"),
        sayNpc("Run for the hills! Grab as many chickens as you can! We have to ..."),
        sayPlayer("Fred!"),
        sayNpc("... flee! Oh, woe is me! The shapeshifter is coming! We're all ..."),
        sayPlayer("FRED!"),
        sayNpc("... doomed. What!"),
        sayPlayer("It's not a shapeshifter or any other kind of monster!"),
        sayNpc("Well then what is it?"),
        sayPlayer("Well ... it's just two Penguins; Penguins disguised as a sheep."),
        sayNpc("..."),
        sayNpc("Have you been out in the sun too long?"),
    ];
}

function buildNoWoolSteps(
    player: PlayerState,
    services: ScriptServices,
    remaining: number,
): DialogueStep[] {
    if (countCarriedItem(player, services, WOOL_ITEM_ID) > 0) {
        return [
            sayPlayer("I've got some wool. I've not managed to make it into a ball though."),
            sayNpc([
                "Well go find a spinning wheel then. You can find one on the first floor",
                "of Lumbridge Castle, just walk east on the road outside my house.",
            ]),
        ];
    }
    return [
        sayPlayer("How many more do I need to give you?"),
        sayNpc(`You need to collect ${remaining} more ${remaining === 1 ? "ball" : "balls"} of wool.`),
        sayPlayer("I haven't got any at the moment."),
        sayNpc("Ah well at least you haven't been eaten. You know what you're doing, right?"),
        choose([
            option("How do I shear sheep, again?", tutorialSteps(player, services)),
            option("Remind me how to spin wool.", [
                sayNpc("The nearest Spinning Wheel can be found on the first floor of Lumbridge Castle."),
                sayNpc("To get to Lumbridge Castle just follow the road east."),
                sayPlayer("Thank you!"),
            ]),
            option("Yeah, I think so.", [sayNpc("You can get to it, then!")]),
        ]),
    ];
}

function buildProgressSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    const stage = getQuestStage(player, quest);
    const remaining = getRemainingWool(stage);
    const carried = countCarriedItem(player, services, BALL_OF_WOOL_ITEM_ID);
    const prefix = [
        sayPlayer("I need to talk to you about shearing these sheep!"),
        sayNpc("Oh. How are you doing getting those balls of wool?"),
    ];
    if (carried <= 0) return [...prefix, ...buildNoWoolSteps(player, services, remaining)];

    const handIn = Math.min(carried, remaining);
    if (handIn === remaining) {
        return [
            ...prefix,
            sayPlayer("I have some."),
            sayNpc("Give 'em here then."),
            sayPlayer("That's the last of them."),
            sayNpc("I guess I'd better pay you then."),
            finishWithWool(quest, handIn),
        ];
    }
    return [
        ...prefix,
        sayPlayer("I have some."),
        sayNpc("Give 'em here then."),
        {
            exec: (ctx) => {
                const removed = removeWool(ctx.player, ctx.services, handIn);
                if (removed <= 0) return;
                setQuestStage(ctx.player, quest, ctx.services, stage + removed);
                ctx.services.messaging.sendGameMessage(
                    ctx.player,
                    removed === 1
                        ? "You give Fred a ball of wool."
                        : `You give Fred ${removed} balls of wool.`,
                );
            },
        },
        sayPlayer("That's all I've got so far."),
        sayNpc(`I need ${remaining - handIn} more before I can pay you.`),
        sayPlayer("Ok, I'll work on it."),
    ];
}

function buildNotStartedSteps(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): DialogueStep[] {
    return [
        sayNpc("What are you doing on my land? You're not the one who keeps leaving all my gates open and letting out all my sheep, are you?"),
        choose([
            option("I'm looking for a quest.", buildStartSteps(quest, player, services)),
            option("I'm looking for something to kill.", [
                sayNpc("What, on my land? Leave my livestock alone you scoundrel!"),
            ]),
            option("I'm lost.", [
                sayNpc("How can you be lost? Just follow the road east and south. You'll end up in Lumbridge fairly quickly."),
            ]),
        ]),
    ];
}

const completedSteps: DialogueStep[] = [
    sayNpc("What are you doing on my land?"),
    choose([
        option("I'm looking for something to kill.", [
            sayNpc("What, on my land? Leave my livestock alone you scoundrel!"),
        ]),
        option("I'm lost.", [
            sayNpc("How can you be lost? Just follow the road east and south. You'll end up in Lumbridge fairly quickly."),
        ]),
    ]),
];

export function createSheepShearerTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const { player, services } = event;
        const ctx: DialogueContext = {
            player,
            services,
            npcId: FRED_THE_FARMER_NPC_ID,
            npcName: "Fred the Farmer",
        };
        const stage = getQuestStage(player, quest);
        if (stage >= STAGE_COMPLETE) {
            startConversation(ctx, completedSteps);
        } else if (stage >= STAGE_STARTED) {
            const progress = buildProgressSteps(quest, player, services);
            const steps = playersWhoSawTheThing.has(player)
                ? [
                      sayNpc("What are you doing on my land?"),
                      choose([
                          option("I need to talk to you about shearing these sheep!", progress, { echo: false }),
                          option("Fred! Fred! I've seen The Thing!", buildThingReportSteps(), { echo: false }),
                      ]),
                  ]
                : [sayNpc("What are you doing on my land?"), ...progress];
            startConversation(ctx, steps);
        } else {
            startConversation(ctx, buildNotStartedSteps(quest, player, services));
        }
    };
}
