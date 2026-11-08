import type { PlayerState } from "../../../../../src/game/player";
import {
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcInteractionEvent,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    AUX,
    ITEM,
    LOC,
    NPC,
    RITUAL_WORDS,
    STAGE_COMPLETE,
    STAGE_EXCALIBUR_BOUND,
    STAGE_MERLIN_FREED,
    STAGE_NOT_STARTED,
    STAGE_SPOKEN_GAWAIN,
    STAGE_SPOKEN_LANCELOT,
    STAGE_SPOKEN_MORGAN,
    STAGE_STARTED,
    TILE,
    VARP_MERLINS_CRYSTAL,
} from "./constants";

const beggarByPlayer = new Map<number, number>();

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function rawState(player: PlayerState): number {
    return player.varps.getVarpValue(VARP_MERLINS_CRYSTAL);
}

function hasAux(player: PlayerState, bit: number): boolean {
    return (rawState(player) & bit) !== 0;
}

function updateAux(player: PlayerState, services: ScriptServices, bit: number, enabled: boolean): void {
    const current = rawState(player);
    const next = enabled ? current | bit : current & ~bit;
    player.varps.setVarpValue(VARP_MERLINS_CRYSTAL, next);
    services.variables.sendVarp(player, VARP_MERLINS_CRYSTAL, next);
}

function clearAux(player: PlayerState, services: ScriptServices): void {
    const stageOnly = rawState(player) & 0x7;
    player.varps.setVarpValue(VARP_MERLINS_CRYSTAL, stageOnly);
    services.variables.sendVarp(player, VARP_MERLINS_CRYSTAL, stageOnly);
}

function hasOwned(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function giveItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    if (!services.inventory.hasInventorySlot(player)) {
        services.messaging.sendGameMessage(player, "You need a free inventory space.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function removeQuantity(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity: number,
): boolean {
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const taken = Math.min(remaining, entry.quantity);
        const left = entry.quantity - taken;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= taken;
        if (remaining === 0) break;
    }
    if (remaining !== 0) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function createArthurHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_MERLIN_FREED) {
            startConversation(context(event, "King Arthur"), [
                sayPlayer("I have freed Merlin from his crystal!"),
                sayNpc("A good job, well done. I dub thee a Knight of the Round Table."),
                run(({ player, services }) => completeQuest(player, services, quest)),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context(event, "King Arthur"), [
                sayNpc("Welcome back, Knight of the Round Table."),
            ]);
            return;
        }
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context(event, "King Arthur"), [
                sayNpc("Welcome to my court. I am King Arthur."),
                choose([
                    option("I want to become a Knight of the Round Table!", [
                        sayNpc([
                            "Then you must prove yourself by rescuing Merlin.",
                            "He is trapped in a giant crystal upstairs in his tower.",
                        ]),
                        run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED)),
                        sayNpc("Talk to my knights if you need any help."),
                    ]),
                    option("So what are you doing in Gielinor?", [
                        sayNpc("We are passing the time here until our homeland needs us again."),
                    ]),
                ]),
            ]);
            return;
        }
        startConversation(context(event, "King Arthur"), [
            sayNpc("Complete your quest to rescue Merlin. My knights may be able to help."),
        ]);
    };
}

function createGawainHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) === STAGE_STARTED) {
            startConversation(context(event, "Sir Gawain"), [
                sayPlayer("Do you know how Merlin became trapped?"),
                sayNpc([
                    "This must be the work of the evil Morgan Le Faye.",
                    "She lives in a stronghold south of here, guarded by renegade knights.",
                ]),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_GAWAIN)),
            ]);
            return;
        }
        startConversation(context(event, "Sir Gawain"), [
            sayNpc(
                getQuestStage(event.player, quest) >= STAGE_SPOKEN_GAWAIN &&
                    getQuestStage(event.player, quest) < STAGE_COMPLETE
                    ? "Morgan Le Faye's stronghold is on the coast south of Camelot."
                    : "Good day to you!",
            ),
        ]);
    };
}

function createLancelotHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) === STAGE_SPOKEN_GAWAIN) {
            startConversation(context(event, "Sir Lancelot"), [
                sayPlayer("How can I get into Morgan Le Faye's stronghold?"),
                sayNpc([
                    "The front doors are nearly impenetrable, but it has a sea entrance.",
                    "Their deliveries arrive by boat from Catherby.",
                ]),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_LANCELOT)),
            ]);
            return;
        }
        startConversation(context(event, "Sir Lancelot"), [
            sayNpc("Greetings! I am Sir Lancelot, the greatest knight in the land!"),
        ]);
    };
}

function createArheinHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const knowsKeep = getQuestStage(event.player, quest) >= STAGE_SPOKEN_LANCELOT;
        startConversation(context(event, "Arhein"), [
            sayPlayer("Is that your ship?"),
            sayNpc([
                "Yes, I deliver goods to customers up and down the coast.",
                knowsKeep
                    ? "I even have a delivery ready for the fort south of here."
                    : "Those crates are ready for my next trip.",
            ]),
            ...(knowsKeep
                ? [
                      sayPlayer("Could you drop me off at the fort?"),
                      sayNpc("Sir Mordred wants no outsiders. I cannot risk losing his business."),
                  ]
                : []),
        ]);
    };
}

function revealMorgan(player: PlayerState, services: ScriptServices, quest: QuestDefinition): void {
    const morgan = services.npc.spawnNpc({
        id: NPC.morganLeFaye,
        name: "Morgan Le Faye",
        ...TILE.morgan,
        ownerPlayerId: player.id,
        worldViewId: player.worldViewId,
        lifetimeTicks: 200,
    });
    startConversation(
        {
            player,
            services,
            npcId: NPC.morganLeFaye,
            npcName: "Morgan Le Faye",
        },
        [
            sayNpc("Stop! Spare my son and I will tell you how to release Merlin."),
            choose([
                option("Tell me how to untrap Merlin and I might.", [
                    sayNpc([
                        "Drop bat bones on the magic symbol near the crystal while carrying a lit black candle.",
                        "Bind the spirit with words from a chaos altar, then use Excalibur to shatter the crystal.",
                    ]),
                    run(({ player: talkingPlayer, services: talkingServices }) => {
                        setQuestStage(talkingPlayer, quest, talkingServices, STAGE_SPOKEN_MORGAN);
                        if (morgan) talkingServices.npc.removeNpc(morgan.id);
                    }),
                ]),
                option("No. He deserves to die.", [sayNpc("Then you will never learn my secret!")]),
                option("All right, I will spare him.", [sayNpc("Then leave this place.")]),
            ]),
        ],
    );
}

function createMorganHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_SPOKEN_MORGAN) {
            startConversation(context(event, "Morgan Le Faye"), [sayNpc("You have no business here.")]);
            return;
        }
        startConversation(context(event, "Morgan Le Faye"), [
            sayNpc([
                "Use bat bones and a lit black candle at the magic symbol near Camelot.",
                "The binding words are inscribed on a chaos altar. You will also need Excalibur.",
            ]),
        ]);
    };
}

function createLadyHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_SPOKEN_MORGAN) {
            startConversation(context(event, "The Lady of the Lake"), [
                sayNpc("Good day. I am the Lady of the Lake."),
            ]);
            return;
        }
        if (hasOwned(event.player, event.services, ITEM.excalibur)) {
            startConversation(context(event, "The Lady of the Lake"), [
                sayNpc("Guard Excalibur well, for it is a valuable artefact."),
            ]);
            return;
        }
        if (stage > STAGE_EXCALIBUR_BOUND) {
            startConversation(context(event, "The Lady of the Lake"), [
                sayNpc("I can replace Excalibur for 500 coins."),
                choose([
                    option("Here are 500 coins.", [
                        run(({ player, services }) => {
                            if (!removeQuantity(player, services, ITEM.coins, 500)) {
                                services.messaging.sendGameMessage(player, "You need 500 coins.");
                                return;
                            }
                            giveItem(player, services, ITEM.excalibur);
                        }),
                    ]),
                    option("No thank you.", []),
                ]),
            ]);
            return;
        }
        startConversation(context(event, "The Lady of the Lake"), [
            sayPlayer("I seek the sword Excalibur."),
            sayNpc(
                hasAux(event.player, AUX.excaliburTestStarted)
                    ? "Complete my test in the upstairs room of the Port Sarim jeweller."
                    : "I give it only to someone worthy. Go upstairs in the Port Sarim jeweller and face my test.",
            ),
            run(({ player, services }) => updateAux(player, services, AUX.excaliburTestStarted, true)),
        ]);
    };
}

function completeBeggarTest(
    player: PlayerState,
    services: ScriptServices,
): void {
    if (!removeQuantity(player, services, ITEM.bread, 1)) {
        updateAux(player, services, AUX.beggarSpoken, true);
        services.messaging.sendGameMessage(player, "You need a loaf of bread for the beggar.");
        return;
    }
    const npcId = beggarByPlayer.get(player.id);
    if (npcId !== undefined) services.npc.removeNpc(npcId);
    beggarByPlayer.delete(player.id);
    updateAux(player, services, AUX.excaliburRewarded, true);
    giveItem(player, services, ITEM.excalibur);
    services.messaging.sendGameMessage(player, "The beggar becomes the Lady of the Lake and presents you with Excalibur.");
}

function beginBeggarDialogue(player: PlayerState, services: ScriptServices): void {
    startConversation(
        { player, services, npcId: NPC.beggar, npcName: "Beggar" },
        [
            sayNpc("Please, kind adventurer, could you spare a simple loaf of bread?"),
            choose([
                option("Yes, certainly.", [
                    showItem(ITEM.bread, "You offer the beggar a loaf of bread."),
                    run(({ player: talkingPlayer, services: talkingServices }) =>
                        completeBeggarTest(talkingPlayer, talkingServices),
                    ),
                ]),
                option("No, I have none.", [
                    run(({ player: talkingPlayer, services: talkingServices }) =>
                        updateAux(talkingPlayer, talkingServices, AUX.beggarSpoken, true),
                    ),
                ]),
            ]),
        ],
    );
}

function ensureBeggar(player: PlayerState, services: ScriptServices, tile: { x: number; y: number }): void {
    const tracked = beggarByPlayer.get(player.id);
    if (tracked !== undefined && services.combat.getNpc(tracked)) return;
    const beggar = services.npc.spawnNpc({
        id: NPC.beggar,
        name: "Beggar",
        x: tile.x,
        y: tile.y + 1,
        level: player.level,
        ownerPlayerId: player.id,
        worldViewId: player.worldViewId,
    });
    if (beggar) beggarByPlayer.set(player.id, beggar.id);
}

function registerExcaliburTest(
    quest: QuestDefinition,
    registry: IScriptRegistry,
): void {
    const previousDoor = registry.findLocInteraction(LOC.jewellersDoor, "open");
    registry.registerLocScript({
        locId: LOC.jewellersDoor,
        action: "open",
        handler: (event) => {
            if (
                getQuestStage(event.player, quest) === STAGE_SPOKEN_MORGAN &&
                hasAux(event.player, AUX.excaliburTestStarted) &&
                !hasAux(event.player, AUX.excaliburRewarded)
            ) {
                ensureBeggar(event.player, event.services, event.tile);
                if (!hasAux(event.player, AUX.beggarSpoken)) {
                    beginBeggarDialogue(event.player, event.services);
                }
            }
            previousDoor?.(event);
        },
    });
    registry.registerNpcScript({
        npcId: NPC.beggar,
        option: "talk-to",
        handler: ({ player, services }) => beginBeggarDialogue(player, services),
    });
}

function registerCandleAndWax(
    quest: QuestDefinition,
    registry: IScriptRegistry,
): void {
    registry.registerNpcScript({
        npcId: NPC.candleMaker,
        option: "talk-to",
        handler: (event) => {
            if (getQuestStage(event.player, quest) !== STAGE_SPOKEN_MORGAN) {
                startConversation(context(event, "Candle maker"), [sayNpc("Would you like to buy one of my fine candles?")]);
                return;
            }
            if (hasAux(event.player, AUX.blackCandleRequested)) {
                if (!hasOwned(event.player, event.services, ITEM.bucketOfWax)) {
                    startConversation(context(event, "Candle maker"), [sayNpc("Bring me a bucket full of wax for the black candle.")]);
                    return;
                }
                startConversation(context(event, "Candle maker"), [
                    sayNpc("Excellent, that wax is just what I need."),
                    showItem(ITEM.blackCandle, "The candle maker gives you a black candle."),
                    run(({ player, services }) => {
                        if (!removeQuantity(player, services, ITEM.bucketOfWax, 1)) return;
                        giveItem(player, services, ITEM.blackCandle);
                        updateAux(player, services, AUX.blackCandleRequested, false);
                    }),
                ]);
                return;
            }
            startConversation(context(event, "Candle maker"), [
                sayPlayer("Have you got any black candles?"),
                sayNpc("Making them is bad luck, but I will make one if you bring me a bucket full of wax."),
                run(({ player, services }) => updateAux(player, services, AUX.blackCandleRequested, true)),
            ]);
        },
    });

    registry.registerItemOnLoc(ITEM.insectRepellent, LOC.beehive, ({ player, services }) => {
        updateAux(player, services, AUX.beehiveRepelled, true);
        services.messaging.sendGameMessage(player, "You pour insect repellent on the hive. The bees fly away.");
    });
    const collectWax = (player: PlayerState, services: ScriptServices, bucketSlot: number): void => {
        if (!hasAux(player, AUX.beehiveRepelled)) {
            services.combat.applyPlayerHitsplat(player, 0, 2, services.system.getCurrentTick());
            services.messaging.sendGameMessage(player, "Bees swarm out and sting you.");
            return;
        }
        if (!services.inventory.consumeItem(player, bucketSlot)) return;
        services.inventory.snapshotInventory(player);
        if (!giveItem(player, services, ITEM.bucketOfWax)) return;
        updateAux(player, services, AUX.beehiveRepelled, false);
        services.messaging.sendGameMessage(player, "You fill the bucket with wax before the bees return.");
    };
    registry.registerItemOnLoc(ITEM.bucket, LOC.beehive, (event) =>
        collectWax(event.player, event.services, event.source.slot),
    );
    registry.registerLocScript({
        locId: LOC.beehive,
        action: "take-from",
        handler: ({ player, services }) => {
            const slot = services.inventory.findInventorySlotWithItem(player, ITEM.bucket);
            if (slot === undefined) {
                services.messaging.sendGameMessage(player, "You need an empty bucket to carry the wax.");
                return;
            }
            collectWax(player, services, slot);
        },
    });
    registry.registerItemOnItem(ITEM.tinderbox, ITEM.blackCandle, (event) => {
        const candleSlot = event.source.itemId === ITEM.blackCandle ? event.source.slot : event.target.slot;
        event.services.inventory.setInventorySlot(event.player, candleSlot, ITEM.litBlackCandle, 1);
        event.services.inventory.snapshotInventory(event.player);
        event.services.messaging.sendGameMessage(event.player, "You light the black candle.");
    });
}

function registerRitual(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.chaosAltar,
        action: "check",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_SPOKEN_MORGAN) {
                services.messaging.sendGameMessage(player, "It is an altar dedicated to chaos.");
                return;
            }
            updateAux(player, services, AUX.chaosWordsKnown, true);
            services.messaging.sendGameMessage(player, `An inscription reads: '${RITUAL_WORDS}'.`);
        },
    });
    registry.registerItemAction(ITEM.batBones, (event) => {
        const nearSymbol =
            event.player.level === TILE.ritual.level &&
            Math.abs(event.player.tileX - TILE.ritual.x) <= 1 &&
            Math.abs(event.player.tileY - TILE.ritual.y) <= 1;
        if (!nearSymbol || getQuestStage(event.player, quest) !== STAGE_SPOKEN_MORGAN) {
            event.services.messaging.sendGameMessage(event.player, "You drop the bat bones.");
            return;
        }
        if (!hasOwned(event.player, event.services, ITEM.litBlackCandle)) {
            event.services.messaging.sendGameMessage(event.player, "You need to carry a lit black candle.");
            return;
        }
        if (!hasAux(event.player, AUX.chaosWordsKnown)) {
            event.services.messaging.sendGameMessage(event.player, "You should learn the binding words before summoning anything.");
            return;
        }
        startConversation({ player: event.player, services: event.services, npcId: -1, npcName: "Thrantax" }, [
            sayPlayer("A mighty spirit appears! What were the magic words?"),
            choose([
                option(RITUAL_WORDS, [
                    sayNpc("Thou hast me in thy control. I shall bind the spell to Excalibur."),
                    run(({ player, services }) => {
                        removeQuantity(player, services, ITEM.batBones, 1);
                        updateAux(player, services, AUX.chaosWordsKnown, false);
                        updateAux(player, services, AUX.blackCandleRequested, false);
                        setQuestStage(player, quest, services, STAGE_EXCALIBUR_BOUND);
                    }),
                ]),
                option("Snarthtrick Candanto Termon", [
                    sayNpc("Those words bind me not!"),
                    run(({ player, services }) => {
                        removeQuantity(player, services, ITEM.litBlackCandle, 1);
                        services.npc.spawnNpc({
                            id: NPC.thrantax,
                            name: "Thrantax the Mighty",
                            ...TILE.ritual,
                            ownerPlayerId: player.id,
                            worldViewId: player.worldViewId,
                            lifetimeTicks: 100,
                        });
                    }),
                ]),
                option("Snarthanto Candon Termtrick", [sayNpc("The spirit rejects your words and vanishes.")]),
            ]),
        ]);
    }, "drop");
}

function registerTravelAndCrystal(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.catherbyCrate,
        action: "hide-in",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) < STAGE_SPOKEN_LANCELOT) {
                services.messaging.sendGameMessage(player, "You have no reason to hide in the crate.");
                return;
            }
            services.movement.teleportPlayer(player, TILE.keepCrate.x, TILE.keepCrate.y, TILE.keepCrate.level);
            services.messaging.sendGameMessage(player, "After a long voyage, you climb out of the crate at Keep Le Faye.");
        },
    });
    registry.registerLocScript({
        locId: LOC.keepCrate,
        action: "hide-in",
        handler: ({ player, services }) => {
            services.movement.teleportPlayer(player, TILE.catherbyCrate.x, TILE.catherbyCrate.y, TILE.catherbyCrate.level);
            services.messaging.sendGameMessage(player, "You hide in the crate and are shipped back to Catherby.");
        },
    });
    registry.registerLocScript({
        locId: LOC.bucketCrate,
        action: "check",
        handler: ({ player, services }) => {
            if (!giveItem(player, services, ITEM.bucket)) return;
            services.messaging.sendGameMessage(player, "You take an empty bucket from the crate.");
        },
    });
    registry.registerLocScript({
        locId: LOC.arheinGangplank,
        action: "cross",
        handler: ({ player, services }) =>
            services.messaging.sendGameMessage(player, "Arhein tells you to stay away from his ship."),
    });
    registry.registerItemOnLoc(ITEM.excalibur, LOC.merlinsCrystal, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_EXCALIBUR_BOUND) {
            event.services.messaging.sendGameMessage(event.player, "A dark force protects the crystal from Excalibur.");
            return;
        }
        if (stage >= STAGE_MERLIN_FREED) {
            event.services.messaging.sendGameMessage(event.player, "Merlin is already free.");
            return;
        }
        setQuestStage(event.player, quest, event.services, STAGE_MERLIN_FREED);
        clearAux(event.player, event.services);
        event.services.location.removeTemporaryLoc(
            { worldViewId: event.player.worldViewId, ownerPlayerId: event.player.id },
            LOC.merlinsCrystal,
            event.target.tile,
            event.target.level,
            { lifetimeTicks: 100 },
        );
        const merlin = event.services.npc.spawnNpc({
            id: NPC.merlin,
            name: "Merlin",
            ...event.target.tile,
            level: event.target.level,
            ownerPlayerId: event.player.id,
            worldViewId: event.player.worldViewId,
            lifetimeTicks: 50,
        });
        event.services.messaging.sendGameMessage(event.player, "Excalibur shatters the crystal and Merlin is set free!");
        if (merlin) event.services.npc.stopNpcMovement(merlin, 3);
    });
}

export function registerMerlinsCrystalInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registry.registerNpcScript({ npcId: NPC.kingArthur, option: "talk-to", handler: createArthurHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.sirGawain, option: "talk-to", handler: createGawainHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.sirLancelot, option: "talk-to", handler: createLancelotHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.arhein, option: "talk-to", handler: createArheinHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.morganLeFaye, option: "talk-to", handler: createMorganHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.ladyOfTheLake, option: "talk-to", handler: createLadyHandler(quest) });
    registry.registerNpcScript({
        npcId: NPC.sirMordred,
        option: "talk-to",
        handler: (event) => startConversation(context(event, "Sir Mordred"), [sayNpc("You dare invade my stronghold? Have at thee!")]),
    });
    registry.registerNpcPreDeath(NPC.sirMordred, (event) => {
        if (!event.killer || getQuestStage(event.killer, quest) !== STAGE_SPOKEN_LANCELOT) {
            return NpcPreDeathDecision.Allow;
        }
        revealMorgan(event.killer, event.services, quest);
        return NpcPreDeathDecision.Prevent;
    });

    registerExcaliburTest(quest, registry);
    registerCandleAndWax(quest, registry);
    registerRitual(quest, registry);
    registerTravelAndCrystal(quest, registry);

    services.system.eventBus?.on("player:logout", ({ playerId }) => {
        beggarByPlayer.delete(playerId);
    });
}
