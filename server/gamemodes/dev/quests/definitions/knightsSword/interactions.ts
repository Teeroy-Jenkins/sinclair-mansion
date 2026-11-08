import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
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
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_ASK_SQUIRE_FOR_PORTRAIT,
    STAGE_COMPLETE,
    STAGE_FIND_IMCANDO_DWARF,
    STAGE_FIND_MATERIALS,
    STAGE_FIND_PORTRAIT,
    STAGE_FIND_RELDO,
    STAGE_GAVE_THURGO_PIE,
    STAGE_NOT_STARTED,
} from "./constants";

function context(event: NpcInteractionEvent, npcId: number, npcName: string) {
    return { player: event.player, services: event.services, npcId, npcName };
}

function createSquireTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const ctx = context(event, NPC.squire, "Squire");
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(ctx, [
                sayNpc("Hello. I am the squire to Sir Vyvin."),
                choose([
                    option("And how is life as a squire?", [
                        sayNpc([
                            "Sir Vyvin is a good man to work for, but I'm in trouble.",
                            "I've gone and lost his sword!",
                        ]),
                        sayPlayer("I can make a new sword if you like."),
                        sayNpc([
                            "This is a family heirloom made by the Imcando dwarves.",
                            "Reldo, the Varrock palace librarian, may know if any remain.",
                        ]),
                        sayNpc("Could you track down an Imcando dwarf for me?"),
                        choose([
                            option("OK, I'll give it a go.", [
                                run(({ player, services }) =>
                                    setQuestStage(player, quest, services, STAGE_FIND_RELDO),
                                ),
                                sayNpc("Thank you! The best place to start is with Reldo."),
                            ]),
                            option("No, I've got mining work to do.", [
                                sayNpc("Oh no... I'm in such trouble."),
                            ]),
                        ]),
                    ]),
                    option("Wouldn't you prefer to be a squire for me?", [
                        sayNpc("No, sorry. I'm loyal to Sir Vyvin."),
                    ]),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_ASK_SQUIRE_FOR_PORTRAIT) {
            startConversation(ctx, [
                sayPlayer("Thurgo needs a picture of the sword."),
                sayNpc([
                    "Sir Vyvin keeps a portrait of his father in a cupboard in his room.",
                    "The sword is shown in that portrait.",
                ]),
                sayNpc("Please don't let him catch you. He mustn't know what happened!"),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_FIND_PORTRAIT),
                ),
            ]);
            return;
        }
        if (stage === STAGE_FIND_MATERIALS) {
            const swordSlot = event.services.inventory.findInventorySlotWithItem(
                event.player,
                ITEM.bluriteSword,
            );
            if (swordSlot !== undefined) {
                startConversation(ctx, [
                    sayPlayer("I have retrieved your sword for you."),
                    sayNpc("Thank you! I was seriously worried I would have to own up to Sir Vyvin!"),
                    showItem(ITEM.bluriteSword, "You give the sword to the squire."),
                    run(({ player, services }) => {
                        if (!services.inventory.consumeItem(player, swordSlot)) return;
                        services.inventory.snapshotInventory(player);
                        completeQuest(player, services, quest);
                    }),
                ]);
                return;
            }
            if (
                event.services.equipment.getEquippedItem(event.player, EquipmentSlot.WEAPON) ===
                ITEM.bluriteSword
            ) {
                startConversation(ctx, [sayNpc("Could you unequip the sword and hand it to me?")]);
                return;
            }
            startConversation(ctx, [
                sayPlayer("Thurgo will make the sword once I find the materials."),
                sayNpc("Please hurry!"),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(ctx, [sayNpc("Hello friend. Thanks again for saving me from trouble!")]);
            return;
        }
        startConversation(ctx, [
            sayPlayer("I'm still working on finding an Imcando dwarf."),
            sayNpc("Please try to find one quickly. I'm scared Sir Vyvin will find out."),
        ]);
    };
}

function createReldoTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const ctx = context(event, NPC.reldo, "Reldo");
        if (getQuestStage(event.player, quest) !== STAGE_FIND_RELDO) {
            startConversation(ctx, [sayNpc("Hello stranger. I am the palace librarian."), sayNpc("I have knowledge, but nothing to trade.")]);
            return;
        }
        startConversation(ctx, [
            sayPlayer("What do you know about the Imcando dwarves?"),
            sayNpc([
                "They were once the world's most skilled smiths.",
                "Most were wiped out during the barbarian invasions.",
            ]),
            sayNpc([
                "A few descendants live near the cliffs on Asgarnia's southern peninsula.",
                "They keep to themselves, but they love redberry pie.",
            ]),
            run(({ player, services }) =>
                setQuestStage(player, quest, services, STAGE_FIND_IMCANDO_DWARF),
            ),
        ]);
    };
}

function createThurgoTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const ctx = context(event, NPC.thurgo, "Thurgo");
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_FIND_IMCANDO_DWARF) {
            startConversation(ctx, [sayNpc("Hello there."), sayNpc("Lovely weather by the sea, isn't it?")]);
            return;
        }
        if (stage === STAGE_FIND_IMCANDO_DWARF) {
            const pieSlot = event.services.inventory.findInventorySlotWithItem(
                event.player,
                ITEM.redberryPie,
            );
            if (pieSlot === undefined) {
                startConversation(ctx, [
                    sayPlayer("Are you an Imcando dwarf?"),
                    sayNpc("Maybe. Who wants to know?"),
                    sayPlayer("Can you make me a special sword?"),
                    sayNpc("No. I don't do that anymore. I'm getting old."),
                ]);
                return;
            }
            startConversation(ctx, [
                sayPlayer("Would you like a redberry pie?"),
                sayNpc("I'd never say no to a redberry pie! They're great stuff!"),
                showItem(ITEM.redberryPie, "You hand over the pie. Thurgo eats it and pats his stomach."),
                run(({ player, services }) => {
                    if (!services.inventory.consumeItem(player, pieSlot)) return;
                    services.inventory.snapshotInventory(player);
                    setQuestStage(player, quest, services, STAGE_GAVE_THURGO_PIE);
                }),
                sayNpc("By Guthix! That was good pie! Anyone who makes pie like that is alright!"),
            ]);
            return;
        }
        if (stage === STAGE_GAVE_THURGO_PIE) {
            startConversation(ctx, [
                sayPlayer("Can you make me a special sword?"),
                sayNpc("After that pie, I suppose I should give it a go. What sort of sword?"),
                sayPlayer("A unique family sword for one of Falador's knights."),
                sayNpc("I'll need a picture showing exactly how the sword looked."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_ASK_SQUIRE_FOR_PORTRAIT),
                ),
            ]);
            return;
        }
        if (stage === STAGE_ASK_SQUIRE_FOR_PORTRAIT) {
            startConversation(ctx, [sayNpc("Ask the squire if he knows where to find a picture of the sword.")]);
            return;
        }
        if (stage === STAGE_FIND_PORTRAIT) {
            const portraitSlot = event.services.inventory.findInventorySlotWithItem(
                event.player,
                ITEM.portrait,
            );
            if (portraitSlot === undefined) {
                startConversation(ctx, [sayNpc("Have you got a picture of the sword yet?"), sayPlayer("Sorry, not yet.")]);
                return;
            }
            startConversation(ctx, [
                sayPlayer("I found a picture of the sword."),
                showItem(ITEM.portrait, "You give the portrait to Thurgo. He studies it carefully."),
                sayNpc([
                    "I'll need two iron bars and one blurite ore.",
                    "Blurite can be mined in the icy cave beneath this cliff.",
                ]),
                run(({ player, services }) => {
                    if (!services.inventory.consumeItem(player, portraitSlot)) return;
                    services.inventory.snapshotInventory(player);
                    setQuestStage(player, quest, services, STAGE_FIND_MATERIALS);
                }),
            ]);
            return;
        }
        if (stage === STAGE_FIND_MATERIALS) {
            if (event.services.inventory.playerHasItem(event.player, ITEM.bluriteSword)) {
                startConversation(ctx, [sayPlayer("Thanks for making the sword."), sayNpc("No worries. Bring more pie sometime!")]);
                return;
            }
            const requirements = [
                { itemId: ITEM.bluriteOre, quantity: 1, journalLabel: "Blurite ore" },
                { itemId: ITEM.ironBar, quantity: 2, journalLabel: "2 Iron bars" },
            ];
            if (!takeQuestItems(event.player, event.services, requirements)) {
                startConversation(ctx, [
                    sayNpc("I still need one blurite ore and two iron bars."),
                    sayPlayer("I'll keep looking."),
                ]);
                return;
            }
            const added = event.services.inventory.addItemToInventory(event.player, ITEM.bluriteSword, 1);
            event.services.inventory.snapshotInventory(event.player);
            startConversation(ctx, [
                showItem(ITEM.bluriteSword, added.added === 1 ? "Thurgo smiths the materials into a fine replica sword." : "Thurgo could not hand you the sword."),
                sayPlayer("Thank you very much!"),
                sayNpc("Remember to call in with more pie sometime!"),
            ]);
            return;
        }
        startConversation(ctx, [sayPlayer("Thanks for all your help."), sayNpc("No worries, mate.")]);
    };
}

export function registerKnightsSwordInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const handlers = [
        [NPC.squire, createSquireTalkHandler(quest)],
        [NPC.reldo, createReldoTalkHandler(quest)],
        [NPC.thurgo, createThurgoTalkHandler(quest)],
    ] as const;
    for (const [npcId, handler] of handlers) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler });
        registry.registerNpcScript({ npcId, option: undefined, handler });
    }

    registry.registerLocScript({
        locId: LOC.vyvinCupboardClosed,
        action: "open",
        handler: (event) => {
            event.services.location.replaceTemporaryLoc(
                { worldViewId: event.player.worldViewId, ownerPlayerId: event.player.id },
                LOC.vyvinCupboardClosed,
                LOC.vyvinCupboardOpen,
                event.tile,
                event.level,
                { oldRotation: 1, newRotation: 1, lifetimeTicks: 300 },
            );
            event.services.messaging.sendGameMessage(event.player, "You open the cupboard.");
        },
    });

    const searchCupboard = (event: LocInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_FIND_PORTRAIT) {
            event.services.messaging.sendGameMessage(event.player, "There is just a load of junk in here.");
            return;
        }
        if (event.services.inventory.findOwnedItemLocation(event.player, ITEM.portrait)) {
            event.services.messaging.sendGameMessage(event.player, "You have already taken the portrait.");
            return;
        }
        const added = event.services.inventory.addItemToInventory(event.player, ITEM.portrait, 1);
        if (added.added !== 1) {
            event.services.messaging.sendGameMessage(event.player, "You need a free inventory space.");
            return;
        }
        event.services.inventory.snapshotInventory(event.player);
        event.services.messaging.sendGameMessage(event.player, "You find a small portrait showing Sir Vyvin's sword.");
    };
    registry.registerLocScript({ locId: LOC.vyvinCupboardOpen, action: "search", handler: searchCupboard });
    registry.registerLocScript({ locId: LOC.vyvinCupboardClosed, action: "search", handler: searchCupboard });
}
