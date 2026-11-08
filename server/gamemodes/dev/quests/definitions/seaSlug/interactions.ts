import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    getQuestStage,
    meetsQuestRequirements,
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
import type { DialogueStep } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOC,
    NPC,
    PLATFORM_ZONE,
    STAGE_BOAT_REPAIRED,
    STAGE_COMPLETE,
    STAGE_KENNITH_NEEDS_ESCAPE,
    STAGE_LIT_TORCH,
    STAGE_NEEDS_CRANE,
    STAGE_NEEDS_SWAMP_PASTE,
    STAGE_NOT_STARTED,
    STAGE_PANEL_OPENED,
    STAGE_SAILED_TO_KENT,
    STAGE_SAVED_KENNITH,
    STAGE_SPOKEN_TO_KENNITH,
    STAGE_SPOKEN_TO_KENT,
    STAGE_STARTED,
    TILE,
} from "./constants";

const platformHolgartByPlayer = new Map<number, number>();

function ctx(event: NpcInteractionEvent, npcId: number, npcName: string) {
    return { player: event.player, services: event.services, npcId, npcName };
}

function has(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.playerHasItem(player, itemId);
}

function give(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function consumeById(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    const slot = services.inventory.findInventorySlotWithItem(player, itemId);
    if (slot === undefined || !services.inventory.consumeItem(player, slot)) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function ensurePlatformHolgart(player: PlayerState, services: ScriptServices): void {
    const tracked = platformHolgartByPlayer.get(player.id);
    if (tracked !== undefined && services.combat.getNpc(tracked)) return;
    platformHolgartByPlayer.delete(player.id);
    const npc = services.npc.spawnNpc({
        id: NPC.platformHolgart,
        name: "Holgart",
        ...TILE.platformHolgart,
        wanderRadius: 0,
        ownerPlayerId: player.id,
        worldViewId: player.worldViewId,
    });
    if (npc) platformHolgartByPlayer.set(player.id, npc.id);
}

function removePlatformHolgart(playerId: number, services: ScriptServices): void {
    const npcId = platformHolgartByPlayer.get(playerId);
    if (npcId !== undefined) services.npc.removeNpc(npcId);
    platformHolgartByPlayer.delete(playerId);
}

function extinguishTorches(player: PlayerState, services: ScriptServices): void {
    let changed = false;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== ITEM.litTorch || entry.quantity <= 0) continue;
        services.inventory.setInventorySlot(player, entry.slot, ITEM.unlitTorch, entry.quantity);
        changed = true;
    }
    if (changed) {
        services.inventory.snapshotInventory(player);
        services.messaging.sendGameMessage(player, "Your torch goes out on the crossing.");
    }
}

function travelToPlatform(player: PlayerState, services: ScriptServices): void {
    extinguishTorches(player, services);
    services.movement.teleportPlayer(player, TILE.platform.x, TILE.platform.y, TILE.platform.level, true);
    ensurePlatformHolgart(player, services);
    services.messaging.sendGameMessage(player, "You arrive at the Fishing Platform.");
}

function travelToIsland(player: PlayerState, services: ScriptServices): void {
    removePlatformHolgart(player.id, services);
    services.movement.teleportPlayer(player, TILE.island.x, TILE.island.y, TILE.island.level, true);
    services.messaging.sendGameMessage(player, "You arrive on a small island.");
}

function travelToShore(player: PlayerState, services: ScriptServices): void {
    removePlatformHolgart(player.id, services);
    services.movement.teleportPlayer(player, TILE.shore.x, TILE.shore.y, TILE.shore.level, true);
    services.messaging.sendGameMessage(player, "You arrive back on shore.");
}

function createCarolineHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const context = ctx(event, NPC.caroline, "Caroline");
        if (stage === STAGE_NOT_STARTED) {
            const accept = meetsQuestRequirements(event.player, event.services, quest)
                ? [
                      sayNpc("My friend Holgart will take you to the Fishing Platform."),
                      run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED)),
                      sayNpc("Please bring Kennith and Kent back safely."),
                  ]
                : [sayNpc("The journey is dangerous. You need level 30 Firemaking first.")];
            startConversation(context, [
                sayPlayer("Hello there."),
                sayNpc([
                    "My husband Kent and our son Kennith went to the Fishing Platform.",
                    "No-one has heard from any of the fishermen all week.",
                    "Could you visit the platform and find out what is going on?",
                ]),
                choose([
                    option("I suppose so, how do I get there?", accept),
                    option("I'm sorry, I'm too busy.", [sayNpc("That's a shame.")]),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_SAVED_KENNITH) {
            startConversation(context, [
                sayNpc([
                    "Kennith told me about the strange events on the platform.",
                    "Kent is home too. I could have lost them both without you.",
                ]),
                sayNpc("Please take these oyster pearls as a reward."),
                run(({ player, services }) => completeQuest(player, services, quest)),
                sayPlayer("Thanks!"),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [sayNpc("Kent and Kennith are doing well. Thank you again.")]);
            return;
        }
        startConversation(context, [
            sayNpc("Have you any news about my son and his father?"),
            sayPlayer("I'm working on it now, Caroline."),
        ]);
    };
}

function createShoreHolgartHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const context = ctx(event, event.npc.typeId, "Holgart");
        if (event.option?.toLowerCase() === "travel" && stage >= STAGE_BOAT_REPAIRED) {
            travelToPlatform(event.player, event.services);
            return;
        }
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context, [sayNpc("Beautiful day, isn't it? Just smell that sea air.")]);
            return;
        }
        if (stage === STAGE_STARTED) {
            if (has(event.player, event.services, ITEM.swampPaste)) {
                consumeById(event.player, event.services, ITEM.swampPaste);
                setQuestStage(event.player, quest, event.services, STAGE_BOAT_REPAIRED);
                startConversation(context, [
                    sayNpc("That swamp paste is just what I need. The boat is repaired; jump aboard!"),
                ]);
            } else {
                setQuestStage(event.player, quest, event.services, STAGE_NEEDS_SWAMP_PASTE);
                startConversation(context, [
                    sayNpc([
                        "My boat is full of holes. I need swamp paste to repair it.",
                        "Mix swamp tar with flour, then warm the raw paste over a fire.",
                    ]),
                ]);
            }
            return;
        }
        if (stage === STAGE_NEEDS_SWAMP_PASTE) {
            if (!has(event.player, event.services, ITEM.swampPaste)) {
                startConversation(context, [sayNpc("I still need swamp paste before the boat can sail.")]);
                return;
            }
            consumeById(event.player, event.services, ITEM.swampPaste);
            setQuestStage(event.player, quest, event.services, STAGE_BOAT_REPAIRED);
            startConversation(context, [sayNpc("Superb! The boat is repaired and ready to sail.")]);
            return;
        }
        startConversation(context, [
            sayNpc("There are strange goings-on at that platform."),
            choose([
                option("Take me to the platform.", [
                    run(({ player, services }) => travelToPlatform(player, services)),
                ]),
                option("I'll stay here for now."),
            ]),
        ]);
    };
}

function createKennithHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const context = ctx(event, event.npc.typeId, "Kennith");
        if (stage === STAGE_BOAT_REPAIRED) {
            startConversation(context, [
                sayNpc("I want my daddy! The fishermen tried to throw us into the sea."),
                sayPlayer("Stay hidden. I'll find your father."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_SPOKEN_TO_KENNITH),
                ),
            ]);
            return;
        }
        if (stage === STAGE_LIT_TORCH) {
            startConversation(context, [
                sayPlayer("Come with me to Holgart's boat."),
                sayNpc("No! I won't go near those nasty sea slugs."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_KENNITH_NEEDS_ESCAPE),
                ),
            ]);
            return;
        }
        if (stage === STAGE_PANEL_OPENED) {
            startConversation(context, [
                sayPlayer("I made an opening in the wall for you."),
                sayNpc("How will I get down to the boat?"),
                sayPlayer("I'll figure that out."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_NEEDS_CRANE),
                ),
            ]);
            return;
        }
        startConversation(context, [sayNpc("Please find my daddy!")]);
    };
}

function createPlatformHolgartHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_SPOKEN_TO_KENNITH) {
            setQuestStage(event.player, quest, event.services, STAGE_SAILED_TO_KENT);
            travelToIsland(event.player, event.services);
            return;
        }
        if (stage === STAGE_SAVED_KENNITH) {
            travelToShore(event.player, event.services);
            return;
        }
        startConversation(ctx(event, NPC.platformHolgart, "Holgart"), [
            sayNpc("Have you had enough of this place yet?"),
            choose([
                option("Take me back to shore.", [
                    run(({ player, services }) => travelToShore(player, services)),
                ]),
                option("I'll stay a while."),
            ]),
        ]);
    };
}

function createKentHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) !== STAGE_SAILED_TO_KENT) {
            startConversation(ctx(event, NPC.kent, "Kent"), [sayNpc("I must get back to shore.")]);
            return;
        }
        startConversation(ctx(event, NPC.kent, "Kent"), [
            sayNpc([
                "Thank Saradomin! Sea slugs have taken control of the fishermen.",
                "Kennith is still on the platform. Please get him out of there.",
            ]),
            showItem(ITEM.seaSlug, "Kent pulls a sea slug from under your clothing. You drop it in disgust."),
            run(({ player, services }) => {
                setQuestStage(player, quest, services, STAGE_SPOKEN_TO_KENT);
                services.groundItems.spawn(ITEM.seaSlug, 1, {
                    x: player.tileX,
                    y: player.tileY,
                    level: player.level,
                }, { ownerId: player.id, privateTicks: 100, durationTicks: 100 });
            }),
        ]);
    };
}

function createIslandHolgartHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_SPOKEN_TO_KENT) {
            startConversation(ctx(event, NPC.islandHolgart, "Holgart"), [
                sayNpc("We'd better check whether Kent is all right."),
            ]);
            return;
        }
        setQuestStage(event.player, quest, event.services, STAGE_SPOKEN_TO_KENT);
        travelToPlatform(event.player, event.services);
    };
}

function createBaileyHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const context = ctx(event, NPC.bailey, "Bailey");
        if (stage === STAGE_SPOKEN_TO_KENT) {
            const steps: DialogueStep[] = [
                sayNpc("The sea slugs are afraid of heat. A lit torch will keep the fishermen away."),
            ];
            if (!has(event.player, event.services, ITEM.unlitTorch) &&
                !has(event.player, event.services, ITEM.litTorch)) {
                steps.push(
                    showItem(ITEM.unlitTorch, "Bailey gives you an unlit torch."),
                    run(({ player, services }) => {
                        give(player, services, ITEM.unlitTorch);
                    }),
                );
            }
            startConversation(context, steps);
            return;
        }
        if (stage >= STAGE_LIT_TORCH && stage < STAGE_SAVED_KENNITH) {
            startConversation(context, [sayNpc("Get Kennith away from those slugs as soon as you can.")]);
            return;
        }
        startConversation(context, [sayNpc("Something very strange is happening on this platform.")]);
    };
}

function registerItemRecipes(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerItemOnItem(ITEM.swampTar, ITEM.potOfFlour, (event) => {
        const tar = event.source.itemId === ITEM.swampTar ? event.source : event.target;
        const flour = event.source.itemId === ITEM.potOfFlour ? event.source : event.target;
        const tarEntry = event.services.inventory.getInventoryItems(event.player)[tar.slot];
        if (tarEntry.quantity > 1 && !event.services.inventory.hasInventorySlot(event.player)) {
            event.services.messaging.sendGameMessage(event.player, "You need another free inventory space.");
            return;
        }
        if (!event.services.inventory.consumeItem(event.player, tar.slot) ||
            !event.services.inventory.consumeItem(event.player, flour.slot)) return;
        event.services.inventory.setInventorySlot(event.player, flour.slot, ITEM.emptyPot, 1);
        if (tarEntry.quantity === 1) {
            event.services.inventory.setInventorySlot(event.player, tar.slot, ITEM.rawSwampPaste, 1);
        } else {
            event.services.inventory.addItemToInventory(event.player, ITEM.rawSwampPaste, 1);
        }
        event.services.inventory.snapshotInventory(event.player);
        event.services.messaging.sendGameMessage(event.player, "You mix the flour and swamp tar into raw swamp paste.");
    });
    for (const fireLocId of LOC.fires) {
        registry.registerItemOnLoc(ITEM.rawSwampPaste, fireLocId, (event) => {
            const entry = event.services.inventory.getInventoryItems(event.player)[event.source.slot];
            if (entry.quantity === 1) {
                event.services.inventory.setInventorySlot(event.player, event.source.slot, ITEM.swampPaste, 1);
            } else {
                if (!event.services.inventory.hasInventorySlot(event.player)) {
                    event.services.messaging.sendGameMessage(event.player, "You need another free inventory space.");
                    return;
                }
                event.services.inventory.consumeItem(event.player, event.source.slot);
                event.services.inventory.addItemToInventory(event.player, ITEM.swampPaste, 1);
            }
            event.services.inventory.snapshotInventory(event.player);
            event.services.messaging.sendGameMessage(event.player, "You warm the mixture into swamp paste.");
        });
    }
    registry.registerItemOnItem(ITEM.brokenGlass, ITEM.dampSticks, (event) => {
        const sticks = event.source.itemId === ITEM.dampSticks ? event.source : event.target;
        event.services.inventory.setInventorySlot(event.player, sticks.slot, ITEM.drySticks, 1);
        event.services.inventory.snapshotInventory(event.player);
        event.services.messaging.sendGameMessage(event.player, "The glass focuses the sunlight and dries the sticks.");
    });
    registry.registerItemAction(ITEM.drySticks, ({ player, services }) => {
        if (services.skills.getSkill(player, SkillId.Firemaking).baseLevel < 30) {
            services.messaging.sendGameMessage(player, "You need level 30 Firemaking to light the sticks.");
            return;
        }
        const torchSlot = services.inventory.findInventorySlotWithItem(player, ITEM.unlitTorch);
        if (torchSlot === undefined) {
            services.messaging.sendGameMessage(player, "The sticks smoke, but you have no torch to light.");
            return;
        }
        services.inventory.setInventorySlot(player, torchSlot, ITEM.litTorch, 1);
        services.inventory.snapshotInventory(player);
        if (getQuestStage(player, quest) === STAGE_SPOKEN_TO_KENT) {
            setQuestStage(player, quest, services, STAGE_LIT_TORCH);
        }
        services.messaging.sendGameMessage(player, "You rub the sticks together and light the torch.");
    }, "rub-together");
}

export function registerSeaSlugInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const caroline = createCarolineHandler(quest);
    registry.registerNpcScript({ npcId: NPC.caroline, option: "talk-to", handler: caroline });
    registry.registerNpcScript({ npcId: NPC.caroline, option: undefined, handler: caroline });

    const shoreHolgart = createShoreHolgartHandler(quest);
    for (const npcId of [NPC.shoreHolgartBase, ...NPC.shoreHolgart]) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: shoreHolgart });
        registry.registerNpcScript({ npcId, option: "travel", handler: shoreHolgart });
        registry.registerNpcScript({ npcId, option: undefined, handler: shoreHolgart });
    }
    const kennith = createKennithHandler(quest);
    for (const npcId of [NPC.kennithBase, NPC.kennith]) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: kennith });
        registry.registerNpcScript({ npcId, option: undefined, handler: kennith });
    }
    const platformHolgart = createPlatformHolgartHandler(quest);
    registry.registerNpcScript({ npcId: NPC.platformHolgart, option: "talk-to", handler: platformHolgart });
    registry.registerNpcScript({ npcId: NPC.platformHolgart, option: "travel", handler: platformHolgart });
    registry.registerNpcScript({ npcId: NPC.platformHolgart, option: undefined, handler: platformHolgart });
    const kent = createKentHandler(quest);
    registry.registerNpcScript({ npcId: NPC.kent, option: "talk-to", handler: kent });
    registry.registerNpcScript({ npcId: NPC.kent, option: undefined, handler: kent });
    const islandHolgart = createIslandHolgartHandler(quest);
    registry.registerNpcScript({ npcId: NPC.islandHolgart, option: "talk-to", handler: islandHolgart });
    registry.registerNpcScript({ npcId: NPC.islandHolgart, option: "travel", handler: islandHolgart });
    registry.registerNpcScript({ npcId: NPC.islandHolgart, option: undefined, handler: islandHolgart });
    const bailey = createBaileyHandler(quest);
    registry.registerNpcScript({ npcId: NPC.bailey, option: "talk-to", handler: bailey });
    registry.registerNpcScript({ npcId: NPC.bailey, option: undefined, handler: bailey });

    const slugDamage = (player: PlayerState, eventServices: ScriptServices): void => {
        eventServices.messaging.sendGameMessage(player, "The sea slug sinks its teeth into your hand. Ouch!");
        eventServices.combat.applyPlayerHitsplat(player, 0, 3, eventServices.system.getCurrentTick());
    };
    registry.registerNpcScript({
        npcId: NPC.seaSlug,
        option: "take",
        handler: ({ player, services: eventServices }) => slugDamage(player, eventServices),
    });
    registry.registerGroundItemInteraction(
        ITEM.seaSlug,
        ({ player, services: eventServices }) => slugDamage(player, eventServices),
        "take",
    );

    registerItemRecipes(quest, registry);

    for (const locId of LOC.laddersUp) {
        registry.registerLocScript({
            locId,
            action: "climb-up",
            handler: (event) => {
                const stage = getQuestStage(event.player, quest);
                if (stage >= STAGE_SPOKEN_TO_KENT && stage < STAGE_COMPLETE &&
                    !has(event.player, event.services, ITEM.litTorch)) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "The fishermen knock you back from the ladder with a fishing rod!",
                    );
                    event.services.combat.applyPlayerHitsplat(
                        event.player,
                        0,
                        4,
                        event.services.system.getCurrentTick(),
                    );
                    return;
                }
                event.services.movement.teleportPlayer(
                    event.player,
                    event.tile.x,
                    event.tile.y,
                    event.level + 1,
                );
            },
        });
    }
    for (const locId of LOC.laddersDown) {
        registry.registerLocScript({
            locId,
            action: "climb-down",
            handler: (event) => event.services.movement.teleportPlayer(
                event.player,
                event.tile.x,
                event.tile.y,
                Math.max(0, event.level - 1),
            ),
        });
    }
    for (const locId of LOC.panelsClosed) {
        registry.registerLocScript({
            locId,
            action: "kick",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== STAGE_KENNITH_NEEDS_ESCAPE) {
                    event.services.messaging.sendGameMessage(event.player, "You kick the panel, but nothing happens.");
                    return;
                }
                setQuestStage(event.player, quest, event.services, STAGE_PANEL_OPENED);
                event.services.location.replaceTemporaryLoc(
                    { worldViewId: event.player.worldViewId, ownerPlayerId: event.player.id },
                    locId,
                    LOC.panelOpen,
                    event.tile,
                    event.level,
                );
                event.services.messaging.sendGameMessage(event.player, "The rotten panel crumbles, leaving an opening.");
            },
        });
    }
    for (const locId of LOC.cranes) {
        registry.registerLocScript({
            locId,
            action: "rotate",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== STAGE_NEEDS_CRANE) {
                    event.services.messaging.sendGameMessage(event.player, "You rotate the crane.");
                    return;
                }
                setQuestStage(event.player, quest, event.services, STAGE_SAVED_KENNITH);
                event.services.messaging.sendGameMessage(
                    event.player,
                    "Kennith climbs onto the net and you lower him safely into Holgart's boat.",
                );
            },
        });
    }

    registry.registerZone(PLATFORM_ZONE, {
        enter: ({ player, services: eventServices }) => {
            const stage = getQuestStage(player, quest);
            if (stage >= STAGE_BOAT_REPAIRED && stage <= STAGE_SAVED_KENNITH) {
                ensurePlatformHolgart(player, eventServices);
            }
        },
        exit: ({ player, services: eventServices }) => removePlatformHolgart(player.id, eventServices),
    });
    services.system.eventBus?.on("player:logout", ({ playerId }) => {
        platformHolgartByPlayer.delete(playerId);
    });
}
