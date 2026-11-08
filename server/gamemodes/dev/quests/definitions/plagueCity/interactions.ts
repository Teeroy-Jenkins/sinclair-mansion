import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    ItemOnNpcEvent,
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
    STAGE_CLERK_PERMISSION,
    STAGE_COMPLETE,
    STAGE_FIND_DWELLBERRIES,
    STAGE_FREED_ELENA,
    STAGE_GAS_MASK,
    STAGE_HAVE_WARRANT,
    STAGE_NEED_CLEARANCE,
    STAGE_NEED_HANGOVER_CURE,
    STAGE_NOT_STARTED,
    STAGE_PIPE_OPEN,
    STAGE_READ_SCROLL,
    STAGE_RETURNED_BOOK,
    STAGE_ROPE_TIED,
    STAGE_SHOWN_PICTURE,
    STAGE_SOFTEN_MUD,
    STAGE_SPOKE_TO_MILLI,
    STAGE_SPOKE_TO_REHNISONS,
    STAGE_TUNNEL_OPEN,
    STAGE_WATER_4,
    TILE,
} from "./constants";

function npcContext(event: NpcInteractionEvent, npcId: number, npcName: string) {
    return { player: event.player, services: event.services, npcId, npcName };
}

function hasItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.playerHasItem(player, itemId);
}

function giveItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function removeAllQuestItems(player: PlayerState, services: ScriptServices): void {
    const questItems = new Set<number>([
        ITEM.picture,
        ITEM.smallKey,
        ITEM.warrant,
        ITEM.scruffyNote,
        ITEM.book,
    ]);
    let changed = false;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (!questItems.has(entry.itemId) || entry.quantity <= 0) continue;
        services.inventory.setInventorySlot(player, entry.slot, -1, 0);
        changed = true;
    }
    if (changed) services.inventory.snapshotInventory(player);
}

function createEdmondHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = npcContext(event, NPC.edmond, "Edmond");
        if (stage === STAGE_NOT_STARTED) {
            startConversation(ctx, [
                sayPlayer("Hello. You look worried. What's wrong?"),
                sayNpc([
                    "My daughter Elena crossed into West Ardougne to help the plague victims.",
                    "She should have returned weeks ago.",
                ]),
                choose([
                    option("Can I help find her?", [
                        sayNpc([
                            "Really? Thank you. First you will need protection from the plague.",
                            "My wife Alrena can make a gas mask with dwellberries.",
                        ]),
                        run(({ player, services }) =>
                            setQuestStage(player, quest, services, STAGE_FIND_DWELLBERRIES),
                        ),
                    ]),
                    option("Good luck finding her.", [sayNpc("Thank you. I fear the worst.")]),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_FIND_DWELLBERRIES) {
            startConversation(ctx, [sayNpc("Take some dwellberries to Alrena. McGrubor's Wood has them.")]);
            return;
        }
        if (stage === STAGE_GAS_MASK) {
            startConversation(ctx, [
                sayPlayer("I have the gas mask."),
                sayNpc([
                    "Good. We can dig beneath the wall into the sewers.",
                    "Pour four buckets of water on the mud patch to soften it, then dig with a spade.",
                ]),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_SOFTEN_MUD),
                ),
            ]);
            return;
        }
        if (stage >= STAGE_SOFTEN_MUD && stage <= STAGE_WATER_4) {
            startConversation(ctx, [sayNpc("Soften the mud with four buckets of water, then use your spade.")]);
            return;
        }
        if (stage === STAGE_TUNNEL_OPEN) {
            startConversation(ctx, [sayNpc("Tie a rope to the sewer pipe's grill, then I can help pull it away.")]);
            return;
        }
        if (stage === STAGE_ROPE_TIED) {
            startConversation(ctx, [
                sayPlayer("I've tied the rope to the grill."),
                sayNpc("Together we should be able to pull it free."),
                sayNpc("That's done it. Wear your gas mask before climbing into West Ardougne."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_PIPE_OPEN),
                ),
            ]);
            return;
        }
        if (stage === STAGE_FREED_ELENA) {
            startConversation(ctx, [
                sayNpc([
                    "Elena made it home safely. Thank you!",
                    "Take this magic scroll as your reward.",
                ]),
                run(({ player, services }) => {
                    removeAllQuestItems(player, services);
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            if (
                stage === STAGE_COMPLETE &&
                !event.services.inventory.findOwnedItemLocation(
                    event.player,
                    ITEM.ardougneTeleportScroll,
                )
            ) {
                startConversation(ctx, [
                    sayPlayer("Do you have another copy of that magic scroll?"),
                    run(({ player, services }) => {
                        if (giveItem(player, services, ITEM.ardougneTeleportScroll)) {
                            services.messaging.sendGameMessage(player, "Edmond gives you another scroll.");
                        }
                    }),
                ]);
                return;
            }
            startConversation(ctx, [sayNpc("Thank you again for rescuing Elena.")]);
            return;
        }
        startConversation(ctx, [sayNpc("Please keep searching. I hope Elena is safe.")]);
    };
}

function createAlrenaHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = npcContext(event, NPC.alrena, "Alrena");
        if (stage !== STAGE_FIND_DWELLBERRIES) {
            startConversation(ctx, [
                sayNpc(stage >= STAGE_FREED_ELENA ? "Thank you for rescuing my daughter!" : "Please help Edmond find Elena."),
            ]);
            return;
        }
        if (!hasItem(event.player, event.services, ITEM.dwellberries)) {
            startConversation(ctx, [sayNpc("I need some dwellberries to finish your gas mask.")]);
            return;
        }
        startConversation(ctx, [
            showItem(ITEM.dwellberries, "You give Alrena the dwellberries."),
            sayNpc("I crush the berries into a paste and rub it into the mask."),
            run(({ player, services }) => {
                if (
                    !takeQuestItems(player, services, [
                        { itemId: ITEM.dwellberries, quantity: 1, journalLabel: "Dwellberries" },
                    ])
                ) {
                    return;
                }
                if (!giveItem(player, services, ITEM.gasMask)) return;
                setQuestStage(player, quest, services, STAGE_GAS_MASK);
            }),
            showItem(ITEM.gasMask, "Alrena gives you a gas mask."),
            sayNpc("Wear this whenever you enter West Ardougne. I'll keep a spare in the cupboard."),
        ]);
    };
}

function createJethickHandler(quest: QuestDefinition, npcId: number) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = npcContext(event, npcId, "Jethick");
        if (stage !== STAGE_PIPE_OPEN && stage !== STAGE_SHOWN_PICTURE) {
            startConversation(ctx, [sayNpc("We don't get many newcomers around here.")]);
            return;
        }
        if (!hasItem(event.player, event.services, ITEM.picture)) {
            startConversation(ctx, [
                sayPlayer("I'm looking for a woman named Elena."),
                sayNpc("That name sounds familiar, but I would need to see a picture."),
            ]);
            return;
        }
        startConversation(ctx, [
            showItem(ITEM.picture, "You show Jethick the picture of Elena."),
            sayNpc([
                "Yes, she stayed with the Rehnison family in the timber house to the north.",
                "Please return this book I borrowed from them.",
            ]),
            run(({ player, services }) => {
                if (!hasItem(player, services, ITEM.book) && !giveItem(player, services, ITEM.book)) return;
                setQuestStage(player, quest, services, STAGE_SHOWN_PICTURE);
            }),
        ]);
    };
}

function createRehnisonHandler(quest: QuestDefinition, npcId: number, name: string) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = npcContext(event, npcId, name);
        if (stage === STAGE_RETURNED_BOOK || stage === STAGE_SPOKE_TO_REHNISONS) {
            startConversation(ctx, [
                sayPlayer("I hear Elena was staying here."),
                sayNpc([
                    "She was, but men kidnapped her before she could return home.",
                    "Our daughter Milli saw it happen. She is upstairs.",
                ]),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_SPOKE_TO_REHNISONS),
                ),
            ]);
            return;
        }
        startConversation(ctx, [sayNpc("Times are difficult here in West Ardougne.")]);
    };
}

function createMilliHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const ctx = npcContext(event, NPC.milliRehnison, "Milli Rehnison");
        if (getQuestStage(event.player, quest) !== STAGE_SPOKE_TO_REHNISONS) {
            startConversation(ctx, [sayNpc("Hello.")]);
            return;
        }
        startConversation(ctx, [
            sayPlayer("Your parents said you saw what happened to Elena."),
            sayNpc([
                "Some men put a sack over her head and dragged her away.",
                "They took her into the windowless plague house in the south-east corner.",
            ]),
            run(({ player, services }) =>
                setQuestStage(player, quest, services, STAGE_SPOKE_TO_MILLI),
            ),
        ]);
    };
}

function createClerkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = npcContext(event, NPC.clerk, "Clerk");
        if (stage !== STAGE_NEED_CLEARANCE && stage !== STAGE_CLERK_PERMISSION) {
            startConversation(ctx, [sayNpc("Welcome to the Civic Office of West Ardougne.")]);
            return;
        }
        startConversation(ctx, [
            sayPlayer("I urgently need to speak to Bravek about a kidnapping."),
            sayNpc("Very well. He will see you, but keep it short."),
            run(({ player, services }) =>
                setQuestStage(player, quest, services, STAGE_CLERK_PERMISSION),
            ),
        ]);
    };
}

function giveWarrant(event: NpcInteractionEvent, quest: QuestDefinition): void {
    const ctx = npcContext(event, NPC.bravek, "Bravek");
    if (!hasItem(event.player, event.services, ITEM.hangoverCure)) {
        startConversation(ctx, [sayNpc("My head still hurts. I need that hangover cure.")]);
        return;
    }
    startConversation(ctx, [
        showItem(ITEM.hangoverCure, "You give Bravek the foul-looking hangover cure."),
        sayNpc("That's much better! You need permission to enter a plague house?"),
        sayPlayer("The Mourners will not listen, and Elena has been kidnapped."),
        run(({ player, services }) => {
            if (
                !takeQuestItems(player, services, [
                    { itemId: ITEM.hangoverCure, quantity: 1, journalLabel: "Hangover cure" },
                ])
            ) {
                return;
            }
            if (!hasItem(player, services, ITEM.warrant) && !giveItem(player, services, ITEM.warrant)) return;
            setQuestStage(player, quest, services, STAGE_HAVE_WARRANT);
        }),
        showItem(ITEM.warrant, "Bravek gives you a warrant to enter the plague house."),
    ]);
}

function createBravekHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = npcContext(event, NPC.bravek, "Bravek");
        if (stage === STAGE_CLERK_PERMISSION) {
            startConversation(ctx, [
                sayNpc("My head hurts too much to think. I drank far too much last night."),
                sayPlayer("Do you know what was in your herbalist's hangover cure?"),
                sayNpc("She left the recipe on this scruffy note."),
                run(({ player, services }) => {
                    if (!hasItem(player, services, ITEM.scruffyNote) && !giveItem(player, services, ITEM.scruffyNote)) return;
                    setQuestStage(player, quest, services, STAGE_NEED_HANGOVER_CURE);
                }),
                showItem(ITEM.scruffyNote, "Bravek hands you a scruffy note."),
            ]);
            return;
        }
        if (stage === STAGE_NEED_HANGOVER_CURE) {
            giveWarrant(event, quest);
            return;
        }
        startConversation(ctx, [sayNpc(stage >= STAGE_HAVE_WARRANT ? "Thanks again for the cure." : "Go away, I'm busy!")]);
    };
}

function createElenaHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = npcContext(event, NPC.elena, "Elena");
        if (stage !== STAGE_HAVE_WARRANT) {
            startConversation(ctx, [sayNpc(stage >= STAGE_FREED_ELENA ? "Thank you for rescuing me." : "Please get me out of here!")]);
            return;
        }
        startConversation(ctx, [
            sayPlayer("You're free to go. Your kidnappers are gone."),
            sayNpc("Thank you! Tell my father I am safe, and that I will return home."),
            run(({ player, services }) =>
                setQuestStage(player, quest, services, STAGE_FREED_ELENA),
            ),
        ]);
    };
}

function mixItemPair(
    event: ItemOnItemEvent,
    first: number,
    second: number,
    product: number,
    message: string,
): void {
    if (!hasItem(event.player, event.services, first) || !hasItem(event.player, event.services, second)) return;
    if (
        !takeQuestItems(event.player, event.services, [
            { itemId: first, quantity: 1, journalLabel: "" },
            { itemId: second, quantity: 1, journalLabel: "" },
        ])
    ) {
        return;
    }
    if (!giveItem(event.player, event.services, product)) return;
    event.services.messaging.sendGameMessage(event.player, message);
}

export function registerPlagueCityInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const npcHandlers: Array<[number, (event: NpcInteractionEvent) => void]> = [
        [NPC.edmond, createEdmondHandler(quest)],
        [NPC.alrena, createAlrenaHandler(quest)],
        [NPC.clerk, createClerkHandler(quest)],
        [NPC.bravek, createBravekHandler(quest)],
        [NPC.elena, createElenaHandler(quest)],
        [NPC.tedRehnison, createRehnisonHandler(quest, NPC.tedRehnison, "Ted Rehnison")],
        [NPC.marthaRehnison, createRehnisonHandler(quest, NPC.marthaRehnison, "Martha Rehnison")],
        [NPC.milliRehnison, createMilliHandler(quest)],
    ];
    for (const jethickId of NPC.jethick) {
        npcHandlers.push([jethickId, createJethickHandler(quest, jethickId)]);
    }
    for (const [npcId, handler] of npcHandlers) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler });
        registry.registerNpcScript({ npcId, option: undefined, handler });
    }

    const bravekItem = (event: ItemOnNpcEvent): void => {
        giveWarrant(
            { player: event.player, services: event.services, npc: event.target } as NpcInteractionEvent,
            quest,
        );
    };
    registry.registerItemOnNpc(ITEM.hangoverCure, NPC.bravek, bravekItem);

    registry.registerItemOnItem(ITEM.chocolateDust, ITEM.bucketOfMilk, (event) =>
        mixItemPair(
            event,
            ITEM.chocolateDust,
            ITEM.bucketOfMilk,
            ITEM.chocolateyMilk,
            "You mix the chocolate dust into the bucket of milk.",
        ),
    );
    registry.registerItemOnItem(ITEM.snapeGrass, ITEM.chocolateyMilk, (event) =>
        mixItemPair(
            event,
            ITEM.snapeGrass,
            ITEM.chocolateyMilk,
            ITEM.hangoverCure,
            "You mix the snape grass into the bucket and make a hangover cure.",
        ),
    );

    registry.registerItemAction(ITEM.scruffyNote, ({ player, services }) => {
        services.messaging.sendGameMessage(
            player,
            "Get a bucket of milk, add chocolate dust, then add snape grass.",
        );
    }, "read");
    registry.registerItemAction(ITEM.ardougneTeleportScroll, ({ player, services, source }) => {
        if (getQuestStage(player, quest) !== STAGE_COMPLETE) {
            services.messaging.sendGameMessage(player, "The scroll bursts into flame.");
            services.inventory.consumeItem(player, source.slot);
            services.inventory.snapshotInventory(player);
            return;
        }
        if (!services.inventory.consumeItem(player, source.slot)) return;
        services.inventory.snapshotInventory(player);
        setQuestStage(player, quest, services, STAGE_READ_SCROLL);
        services.messaging.sendGameMessage(player, "You memorise the scroll and can now cast Ardougne Teleport.");
    }, "read");

    registry.registerLocScript({
        locId: LOC.alrenaCupboardClosed,
        action: "open",
        handler: (event) => {
            event.services.location.replaceTemporaryLoc(
                { worldViewId: event.player.worldViewId, ownerPlayerId: event.player.id },
                LOC.alrenaCupboardClosed,
                LOC.alrenaCupboardOpen,
                event.tile,
                event.level,
                { lifetimeTicks: 200 },
            );
            event.services.messaging.sendGameMessage(event.player, "You open the cupboard.");
        },
    });
    registry.registerLocScript({
        locId: LOC.alrenaCupboardOpen,
        action: "search",
        handler: (event) => {
            if (getQuestStage(event.player, quest) < STAGE_GAS_MASK) {
                event.services.messaging.sendGameMessage(event.player, "The cupboard is empty.");
                return;
            }
            if (event.services.inventory.findOwnedItemLocation(event.player, ITEM.gasMask)) {
                event.services.messaging.sendGameMessage(event.player, "You already have a gas mask.");
                return;
            }
            if (giveItem(event.player, event.services, ITEM.gasMask)) {
                event.services.messaging.sendGameMessage(event.player, "You find Alrena's spare gas mask.");
            }
        },
    });

    registry.registerItemOnLoc(ITEM.bucketOfWater, LOC.mudPatch, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_SOFTEN_MUD || stage >= STAGE_WATER_4) {
            event.services.messaging.sendGameMessage(
                event.player,
                stage >= STAGE_WATER_4 ? "The soil is already soft enough." : "You have no reason to do that yet.",
            );
            return;
        }
        if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
        const result = event.services.inventory.addItemToInventory(event.player, ITEM.emptyBucket, 1);
        event.services.inventory.snapshotInventory(event.player);
        if (result.added !== 1) return;
        setQuestStage(event.player, quest, event.services, stage + 1);
        event.services.messaging.sendGameMessage(
            event.player,
            stage + 1 === STAGE_WATER_4
                ? "You pour water onto the soil. It is now soft enough to dig."
                : "You pour water onto the soil. It softens slightly.",
        );
    });
    registry.registerItemOnLoc(ITEM.spade, LOC.mudPatch, (event) => {
        if (getQuestStage(event.player, quest) !== STAGE_WATER_4) {
            event.services.messaging.sendGameMessage(event.player, "The ground is too hard to dig.");
            return;
        }
        setQuestStage(event.player, quest, event.services, STAGE_TUNNEL_OPEN);
        event.services.movement.teleportPlayer(
            event.player,
            TILE.sewerMudPile.x,
            TILE.sewerMudPile.y,
            TILE.sewerMudPile.level,
            true,
        );
        event.services.npc.spawnNpc({
            id: NPC.edmond,
            name: "Edmond",
            x: TILE.sewerMudPile.x + 1,
            y: TILE.sewerMudPile.y,
            level: TILE.sewerMudPile.level,
            worldViewId: event.player.worldViewId,
            ownerPlayerId: event.player.id,
            lifetimeTicks: 3000,
        });
        event.services.messaging.sendGameMessage(event.player, "The soft soil collapses and you fall into the sewer.");
    });

    registry.registerItemOnLoc(ITEM.rope, LOC.sewerPipe, (event) => {
        if (getQuestStage(event.player, quest) !== STAGE_TUNNEL_OPEN) {
            event.services.messaging.sendGameMessage(event.player, "Nothing interesting happens.");
            return;
        }
        if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
        event.services.inventory.snapshotInventory(event.player);
        setQuestStage(event.player, quest, event.services, STAGE_ROPE_TIED);
        event.services.messaging.sendGameMessage(event.player, "You tie the rope securely to the sewer grill.");
    });
    const enterWestArdougne = (event: {
        player: PlayerState;
        services: ScriptServices;
    }): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_PIPE_OPEN) {
            event.services.messaging.sendGameMessage(event.player, "The grill is too secure to pull off alone.");
            return;
        }
        if (event.services.equipment.getEquippedItem(event.player, EquipmentSlot.HEAD) !== ITEM.gasMask) {
            event.services.messaging.sendGameMessage(event.player, "You must wear your gas mask first.");
            return;
        }
        event.services.movement.teleportPlayer(
            event.player,
            TILE.westArdougneManhole.x,
            TILE.westArdougneManhole.y,
            TILE.westArdougneManhole.level,
            true,
        );
        event.services.messaging.sendGameMessage(event.player, "You squeeze through the pipe into West Ardougne.");
    };
    for (const action of ["open", "search", "climb-through"] as const) {
        registry.registerLocScript({ locId: LOC.sewerPipe, action, handler: enterWestArdougne });
    }

    registry.registerLocScript({
        locId: LOC.mudPile,
        action: "climb",
        handler: (event) => event.services.movement.teleportPlayer(
            event.player,
            TILE.garden.x,
            TILE.garden.y,
            TILE.garden.level,
            true,
        ),
    });
    registry.registerLocScript({
        locId: LOC.westArdougneManholeClosed,
        action: "open",
        handler: (event) => {
            event.services.location.replaceTemporaryLoc(
                { worldViewId: event.player.worldViewId, ownerPlayerId: event.player.id },
                LOC.westArdougneManholeClosed,
                LOC.westArdougneManholeOpen,
                event.tile,
                event.level,
                { lifetimeTicks: 200 },
            );
            event.services.messaging.sendGameMessage(event.player, "You open the manhole.");
        },
    });
    registry.registerLocScript({
        locId: LOC.westArdougneManholeOpen,
        action: "climb-down",
        handler: (event) => event.services.movement.teleportPlayer(
            event.player,
            TILE.sewerPipe.x,
            TILE.sewerPipe.y + 1,
            TILE.sewerPipe.level,
            true,
        ),
    });

    registry.registerLocScript({
        locId: LOC.rehnisonDoor,
        action: "open",
        handler: (event) => {
            if (getQuestStage(event.player, quest) < STAGE_SHOWN_PICTURE) {
                event.services.messaging.sendGameMessage(event.player, "The occupants refuse to let you in.");
                return;
            }
            if (getQuestStage(event.player, quest) === STAGE_SHOWN_PICTURE) {
                if (
                    !takeQuestItems(event.player, event.services, [
                        { itemId: ITEM.book, quantity: 1, journalLabel: "Jethick's book" },
                    ])
                ) {
                    event.services.messaging.sendGameMessage(event.player, "You need Jethick's book to enter.");
                    return;
                }
                setQuestStage(event.player, quest, event.services, STAGE_RETURNED_BOOK);
            }
            event.services.movement.teleportPlayer(event.player, event.tile.x, event.tile.y - 1, event.level);
        },
    });
    registry.registerLocScript({
        locId: LOC.rehnisonStairsUp,
        action: "walk-up",
        handler: (event) => event.services.movement.teleportPlayer(
            event.player,
            TILE.rehnisonFirst.x,
            TILE.rehnisonFirst.y,
            TILE.rehnisonFirst.level,
        ),
    });
    registry.registerLocScript({
        locId: LOC.rehnisonStairsDown,
        action: "walk-down",
        handler: (event) => event.services.movement.teleportPlayer(
            event.player,
            TILE.rehnisonGround.x,
            TILE.rehnisonGround.y,
            TILE.rehnisonGround.level,
        ),
    });

    registry.registerLocScript({
        locId: LOC.plagueHouseDoorClosed,
        action: "open",
        handler: (event) => {
            const stage = getQuestStage(event.player, quest);
            if (stage === STAGE_SPOKE_TO_MILLI) {
                setQuestStage(event.player, quest, event.services, STAGE_NEED_CLEARANCE);
                event.services.messaging.sendGameMessage(event.player, "A Mourner says you need Bravek's clearance to enter.");
                return;
            }
            if (stage < STAGE_HAVE_WARRANT) {
                event.services.messaging.sendGameMessage(event.player, "The door won't open. A black cross marks the house.");
                return;
            }
            if (!hasItem(event.player, event.services, ITEM.warrant) && stage < STAGE_FREED_ELENA) {
                event.services.messaging.sendGameMessage(event.player, "You need Bravek's warrant.");
                return;
            }
            event.services.movement.teleportPlayer(event.player, event.tile.x, event.tile.y + 1, event.level);
            event.services.messaging.sendGameMessage(event.player, "You wait until the Mourner turns away and sneak inside.");
        },
    });
    registry.registerLocScript({
        locId: LOC.bravekDoor,
        action: "open",
        handler: (event) => {
            if (getQuestStage(event.player, quest) < STAGE_CLERK_PERMISSION) {
                event.services.messaging.sendGameMessage(event.player, "Bravek does not want to be disturbed.");
                return;
            }
            event.services.movement.teleportPlayer(event.player, event.tile.x, event.tile.y - 1, event.level);
        },
    });
    registry.registerLocScript({
        locId: LOC.keyBarrel,
        action: "search",
        handler: (event) => {
            if (getQuestStage(event.player, quest) < STAGE_HAVE_WARRANT) {
                event.services.messaging.sendGameMessage(event.player, "The barrel is empty.");
                return;
            }
            if (event.services.inventory.findOwnedItemLocation(event.player, ITEM.smallKey)) {
                event.services.messaging.sendGameMessage(event.player, "The barrel is empty.");
                return;
            }
            if (giveItem(event.player, event.services, ITEM.smallKey)) {
                event.services.messaging.sendGameMessage(event.player, "You find a small key in the barrel.");
            }
        },
    });
    registry.registerLocScript({
        locId: LOC.plagueHouseStairsDown,
        action: "walk-down",
        handler: (event) => event.services.movement.teleportPlayer(
            event.player,
            TILE.plagueHouseBasement.x,
            TILE.plagueHouseBasement.y,
            TILE.plagueHouseBasement.level,
            true,
        ),
    });
    registry.registerLocScript({
        locId: LOC.plagueHouseStairsUp,
        action: "walk-up",
        handler: (event) => event.services.movement.teleportPlayer(
            event.player,
            TILE.plagueHouseGround.x,
            TILE.plagueHouseGround.y,
            TILE.plagueHouseGround.level,
            true,
        ),
    });
    const unlockCell = (event: { player: PlayerState; services: ScriptServices }): void => {
        if (!hasItem(event.player, event.services, ITEM.smallKey)) {
            event.services.messaging.sendGameMessage(event.player, "The door is locked.");
            return;
        }
        event.services.movement.teleportPlayer(
            event.player,
            TILE.elenaCell.x,
            TILE.elenaCell.y,
            TILE.elenaCell.level,
        );
        event.services.messaging.sendGameMessage(event.player, "You unlock the cell door.");
    };
    registry.registerLocScript({ locId: LOC.elenaCellDoor, action: "open", handler: unlockCell });
    registry.registerItemOnLoc(ITEM.smallKey, LOC.elenaCellDoor, unlockCell);
}
