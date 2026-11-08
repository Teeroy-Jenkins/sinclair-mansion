import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { NpcPreDeathDecision } from "../../../../../src/game/scripts/types";
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
    GARDEN_ZONE,
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_DEFEATED_EXPERIMENT,
    STAGE_FOUND_MAGNET,
    STAGE_NOT_STARTED,
    STAGE_READ_DIARY,
    STAGE_STARTED,
    STAGE_UNLOCKED_BACK_DOOR,
    TILE,
} from "./constants";

const experimentByPlayer = new Map<number, number>();
const mouseByPlayer = new Map<number, number>();
const playersInGarden = new Map<number, PlayerState>();

function context(event: NpcInteractionEvent, npcId: number, npcName: string) {
    return { player: event.player, services: event.services, npcId, npcName };
}

function hasInventoryItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory
        .getInventoryItems(player)
        .some((entry) => entry.itemId === itemId && entry.quantity > 0);
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

function removeInventoryItems(
    player: PlayerState,
    services: ScriptServices,
    itemIds: readonly number[],
): void {
    const wanted = new Set(itemIds);
    let changed = false;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (!wanted.has(entry.itemId) || entry.quantity <= 0) continue;
        services.inventory.setInventorySlot(player, entry.slot, -1, 0);
        changed = true;
    }
    if (changed) services.inventory.snapshotInventory(player);
}

function crossNorthSouthDoor(event: LocInteractionEvent): void {
    const destinationY = event.player.tileY >= event.tile.y ? event.tile.y - 1 : event.tile.y + 1;
    event.services.movement.teleportPlayer(event.player, event.tile.x, destinationY, event.level);
}

function crossElectricGate(event: LocInteractionEvent): void {
    const destinationX = event.player.tileX <= event.tile.x ? event.tile.x + 1 : event.tile.x - 1;
    event.services.movement.teleportPlayer(event.player, destinationX, event.tile.y, event.level);
}

function createBoyHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = context(event, NPC.boy, "Boy");
        if (stage === STAGE_NOT_STARTED) {
            startConversation(ctx, [
                sayPlayer("Hello young man."),
                sayNpc("*sob*"),
                choose([
                    option("What's the matter?", [
                        sayNpc([
                            "I've kicked my ball over that hedge, into that garden!",
                            "The old lady who lives there is scary...",
                            "She's locked the ball in her wooden shed!",
                            "Can you get my ball back for me please?",
                        ]),
                        choose([
                            option("Ok, I'll see what I can do.", [
                                run(({ player, services }) =>
                                    setQuestStage(player, quest, services, STAGE_STARTED),
                                ),
                                sayNpc("Thanks!"),
                            ]),
                            option("Get it back yourself.", [
                                sayNpc("You're a meany!"),
                                showItem(ITEM.ball, "The boy starts crying again."),
                            ]),
                        ]),
                    ]),
                    option("Well if you're not going to answer, I'll go.", [
                        sayNpc("*sniff*"),
                    ]),
                ]),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(ctx, [sayNpc("Thank you for getting my ball back!")]);
            return;
        }
        if (hasInventoryItem(event.player, event.services, ITEM.ball)) {
            startConversation(ctx, [
                sayPlayer("Hi, I have got your ball back. It was MUCH harder than I thought it would be."),
                showItem(ITEM.ball, "You give the ball back."),
                sayNpc("Thank you so much!"),
                run(({ player, services }) => {
                    if (!takeQuestItems(player, services, [
                        { itemId: ITEM.ball, quantity: 1, journalLabel: "Ball" },
                    ])) return;
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        startConversation(ctx, [
            sayNpc("Have you got my ball back yet?"),
            sayPlayer("Not yet."),
            sayNpc("Well, it's in the shed in that garden."),
        ]);
    };
}

function ensureExperiment(player: PlayerState, services: ScriptServices): void {
    const trackedId = experimentByPlayer.get(player.id);
    if (trackedId !== undefined && services.combat.getNpc(trackedId)) return;
    experimentByPlayer.delete(player.id);
    const npc = services.npc.spawnNpc({
        id: NPC.experimentForms[0],
        name: "Witch's experiment",
        ...TILE.experiment,
        wanderRadius: 0,
        ownerPlayerId: player.id,
        worldViewId: player.worldViewId,
        lifetimeTicks: 500,
    });
    if (!npc) return;
    experimentByPlayer.set(player.id, npc.id);
    npc.engageCombat(player.id, services.system.getCurrentTick(), {
        tileX: player.tileX,
        tileY: player.tileY,
    });
}

function registerExperiment(
    quest: QuestDefinition,
    registry: IScriptRegistry,
): void {
    NPC.experimentForms.forEach((npcTypeId, index) => {
        registry.registerNpcPreDeath(npcTypeId, (event) => {
            const player = event.killer;
            if (
                !player ||
                event.npc.ownerPlayerId !== player.id ||
                experimentByPlayer.get(player.id) !== event.npc.id
            ) {
                return;
            }
            if (index === NPC.experimentForms.length - 1) {
                experimentByPlayer.delete(player.id);
                if (getQuestStage(player, quest) < STAGE_DEFEATED_EXPERIMENT) {
                    setQuestStage(player, quest, event.services, STAGE_DEFEATED_EXPERIMENT);
                }
                event.services.messaging.sendGameMessage(
                    player,
                    "You finally kill the shapeshifter once and for all.",
                );
                return NpcPreDeathDecision.Allow;
            }

            experimentByPlayer.delete(player.id);
            event.services.npc.removeNpc(event.npc.id);
            const next = event.services.npc.spawnNpc({
                id: NPC.experimentForms[index + 1],
                name: "Witch's experiment",
                ...TILE.experiment,
                wanderRadius: 0,
                ownerPlayerId: player.id,
                worldViewId: player.worldViewId,
                lifetimeTicks: 500,
            });
            if (next) {
                experimentByPlayer.set(player.id, next.id);
                next.engageCombat(player.id, event.services.system.getCurrentTick(), {
                    tileX: player.tileX,
                    tileY: player.tileY,
                });
            }
            const forms = ["spider", "bear", "wolf"];
            event.services.messaging.sendGameMessage(
                player,
                `The shapeshifter's body deforms and turns into a ${forms[index]}!`,
            );
            return NpcPreDeathDecision.Prevent;
        });
    });
}

function tryWitchCatch(player: PlayerState, services: ScriptServices, quest: QuestDefinition): void {
    const witch = services.npc.findNearbyNpc(player, NPC.nora, 3);
    if (!witch || !services.npc.hasLineOfSightToPlayer(witch, player)) return;
    services.npc.stopNpcMovement(witch, 4);
    services.npc.faceNpcToPlayer(witch, player);
    services.npc.queueNpcForcedChat(witch, "Stop! Thief!");
    services.messaging.sendGameMessage(player, "Nora T. Hagg spots you and casts a spell!");
    if (getQuestStage(player, quest) === STAGE_UNLOCKED_BACK_DOOR) {
        setQuestStage(player, quest, services, STAGE_STARTED);
    }
    removeInventoryItems(player, services, [ITEM.shedKey, ITEM.ball]);
    const experiment = experimentByPlayer.get(player.id);
    if (experiment !== undefined) services.npc.removeNpc(experiment);
    experimentByPlayer.delete(player.id);
    playersInGarden.delete(player.id);
    services.movement.teleportPlayer(
        player,
        TILE.outsideGarden.x,
        TILE.outsideGarden.y,
        TILE.outsideGarden.level,
    );
}

export function registerWitchsHouseInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const boy = createBoyHandler(quest);
    registry.registerNpcScript({ npcId: NPC.boy, option: "talk-to", handler: boy });
    registry.registerNpcScript({ npcId: NPC.boy, option: undefined, handler: boy });

    const searchPlant = (event: LocInteractionEvent): void => {
        if (hasInventoryItem(event.player, event.services, ITEM.doorKey)) {
            event.services.messaging.sendGameMessage(event.player, "You don't find anything interesting.");
            return;
        }
        if (giveItem(event.player, event.services, ITEM.doorKey)) {
            event.services.messaging.sendGameMessage(event.player, "You find a key hidden under the flower pot.");
        }
    };
    registry.registerLocScript({ locId: LOC.pottedPlant, action: "look-under", handler: searchPlant });
    registry.registerLocScript({ locId: LOC.pottedPlant, action: undefined, handler: searchPlant });

    const frontDoor = (event: LocInteractionEvent): void => {
        const leaving = event.player.tileY < event.tile.y;
        const stage = getQuestStage(event.player, quest);
        if (!leaving && (stage < STAGE_STARTED || stage >= STAGE_COMPLETE)) {
            event.services.messaging.sendGameMessage(event.player, "It would be rude to break into this house.");
            return;
        }
        if (!leaving && !hasInventoryItem(event.player, event.services, ITEM.doorKey)) {
            event.services.messaging.sendGameMessage(event.player, "The door is locked.");
            return;
        }
        crossNorthSouthDoor(event);
    };
    registry.registerLocScript({ locId: LOC.frontDoor, action: undefined, handler: frontDoor });
    registry.registerItemOnLoc(ITEM.doorKey, LOC.frontDoor, (event) =>
        frontDoor({
            ...event,
            locId: event.target.locId,
            tile: event.target.tile,
            level: event.target.level,
        }),
    );

    for (const locId of LOC.electricGates) {
        registry.registerLocScript({
            locId,
            action: undefined,
            handler: (event) => {
                if (
                    event.services.equipment.getEquippedItem(event.player, EquipmentSlot.GLOVES) !==
                    ITEM.leatherGloves
                ) {
                    const hitpoints = event.services.skills.getSkill(event.player, SkillId.Hitpoints);
                    const damage = Math.max(1, Math.floor((hitpoints.baseLevel + hitpoints.boost) / 10) + 1);
                    event.services.combat.applyPlayerHitsplat(
                        event.player,
                        0,
                        damage,
                        event.services.system.getCurrentTick(),
                    );
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "As your bare hands touch the gate you feel a shock.",
                    );
                    return;
                }
                crossElectricGate(event);
            },
        });
    }

    registry.registerLocScript({
        locId: LOC.cupboardClosed,
        action: undefined,
        handler: (event) => {
            event.services.location.replaceTemporaryLoc(
                { worldViewId: event.player.worldViewId, ownerPlayerId: event.player.id },
                LOC.cupboardClosed,
                LOC.cupboardOpen,
                event.tile,
                event.level,
                { lifetimeTicks: 500 },
            );
            event.services.messaging.sendGameMessage(event.player, "You open the cupboard.");
        },
    });
    registry.registerLocScript({
        locId: LOC.cupboardOpen,
        action: "search",
        handler: (event) => {
            if (event.services.inventory.findOwnedItemLocation(event.player, ITEM.magnet)) {
                event.services.messaging.sendGameMessage(event.player, "You don't find anything interesting.");
                return;
            }
            if (!giveItem(event.player, event.services, ITEM.magnet)) return;
            if (getQuestStage(event.player, quest) === STAGE_STARTED) {
                setQuestStage(event.player, quest, event.services, STAGE_FOUND_MAGNET);
            }
            event.services.messaging.sendGameMessage(event.player, "You find a magnet in the cupboard.");
        },
    });

    for (const locId of LOC.mouseHoles) {
        registry.registerItemOnLoc(ITEM.cheese, locId, (event) => {
            if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
            event.services.inventory.snapshotInventory(event.player);
            const oldMouse = mouseByPlayer.get(event.player.id);
            if (oldMouse !== undefined) event.services.npc.removeNpc(oldMouse);
            const mouse = event.services.npc.spawnNpc({
                id: NPC.mouse,
                name: "Mouse",
                ...TILE.mouse,
                wanderRadius: 1,
                ownerPlayerId: event.player.id,
                worldViewId: event.player.worldViewId,
                lifetimeTicks: 50,
            });
            if (mouse) mouseByPlayer.set(event.player.id, mouse.id);
            event.services.messaging.sendGameMessage(event.player, "A mouse runs out of the hole.");
        });
    }
    registry.registerItemOnNpc(ITEM.magnet, NPC.mouse, (event) => {
        if (mouseByPlayer.get(event.player.id) !== event.target.id) return;
        const stage = getQuestStage(event.player, quest);
        if (stage >= STAGE_UNLOCKED_BACK_DOOR) {
            event.services.messaging.sendGameMessage(event.player, "You have already unlocked this door.");
            return;
        }
        if (stage < STAGE_FOUND_MAGNET) {
            event.services.messaging.sendGameMessage(event.player, "This doesn't seem to be the right magnet.");
            return;
        }
        if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
        event.services.inventory.snapshotInventory(event.player);
        event.services.npc.removeNpc(event.target.id);
        mouseByPlayer.delete(event.player.id);
        setQuestStage(event.player, quest, event.services, STAGE_UNLOCKED_BACK_DOOR);
        event.services.messaging.sendGameMessage(
            event.player,
            "The mouse runs back into its hole. A strange whirring noise comes from above the door.",
        );
    });

    registry.registerLocScript({
        locId: LOC.backDoor,
        action: undefined,
        handler: (event) => {
            if (getQuestStage(event.player, quest) < STAGE_UNLOCKED_BACK_DOOR) {
                event.services.messaging.sendGameMessage(event.player, "This door is locked.");
                return;
            }
            crossNorthSouthDoor(event);
        },
    });

    registry.registerItemAction(ITEM.diary, ({ player, services }) => {
        if (getQuestStage(player, quest) === STAGE_UNLOCKED_BACK_DOOR) {
            setQuestStage(player, quest, services, STAGE_READ_DIARY);
        }
        services.messaging.sendGameMessage(
            player,
            "The diary explains the mouse lock and says the shed key is hidden in the garden fountain.",
        );
    }, "read");

    registry.registerLocScript({
        locId: LOC.fountain,
        action: "check",
        handler: (event) => {
            if (event.services.inventory.findOwnedItemLocation(event.player, ITEM.shedKey)) {
                event.services.messaging.sendGameMessage(event.player, "There is nothing in the fountain.");
                return;
            }
            if (giveItem(event.player, event.services, ITEM.shedKey)) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "You find the diary's secret compartment and take the small key inside.",
                );
            }
        },
    });

    const shedDoor = (event: LocInteractionEvent, usedKey: boolean): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_DEFEATED_EXPERIMENT && !usedKey) {
            event.services.messaging.sendGameMessage(event.player, "The shed door is locked.");
            return;
        }
        const entering = event.player.tileY >= event.tile.y;
        if (entering && stage < STAGE_DEFEATED_EXPERIMENT) ensureExperiment(event.player, event.services);
        crossNorthSouthDoor(event);
    };
    registry.registerLocScript({
        locId: LOC.shedDoor,
        action: undefined,
        handler: (event) => shedDoor(event, false),
    });
    registry.registerItemOnLoc(ITEM.shedKey, LOC.shedDoor, (event) =>
        shedDoor(
            {
                ...event,
                locId: event.target.locId,
                tile: event.target.tile,
                level: event.target.level,
            },
            true,
        ),
    );

    registry.registerGroundItemInteraction(ITEM.ball, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage >= STAGE_COMPLETE) {
            event.services.messaging.sendGameMessage(
                event.player,
                "The witch must have found another ball. You decide to leave it here.",
            );
            return;
        }
        if (stage === STAGE_DEFEATED_EXPERIMENT) {
            if (hasInventoryItem(event.player, event.services, ITEM.ball)) {
                event.services.messaging.sendGameMessage(event.player, "You already have the boy's ball.");
                return;
            }
            if (!event.services.inventory.hasInventorySlot(event.player)) {
                event.services.messaging.sendGameMessage(event.player, "You need more free inventory space.");
                return;
            }
            const removed = event.services.groundItems.remove(event.target.stackId, 1, event.player);
            if (!removed?.removed) return;
            giveItem(event.player, event.services, ITEM.ball);
            return;
        }
        ensureExperiment(event.player, event.services);
        event.services.messaging.sendGameMessage(
            event.player,
            "A shapeshifter appears and knocks you back from the ball!",
        );
    }, "take");

    registry.registerLocScript({
        locId: LOC.ladderDown,
        action: "climb-down",
        handler: (event) =>
            event.services.movement.teleportPlayer(
                event.player,
                TILE.basement.x,
                TILE.basement.y,
                TILE.basement.level,
                true,
            ),
    });
    registry.registerLocScript({
        locId: LOC.ladderUp,
        action: "climb-up",
        handler: (event) =>
            event.services.movement.teleportPlayer(
                event.player,
                TILE.groundFloor.x,
                TILE.groundFloor.y,
                TILE.groundFloor.level,
                true,
            ),
    });

    registerExperiment(quest, registry);
    registry.registerZone(GARDEN_ZONE, {
        enter: ({ player, services }) => {
            playersInGarden.set(player.id, player);
            tryWitchCatch(player, services, quest);
        },
        step: ({ player, services }) => {
            playersInGarden.set(player.id, player);
            tryWitchCatch(player, services, quest);
        },
        exit: ({ player }) => {
            playersInGarden.delete(player.id);
        },
    });
    registry.registerTickHandler(({ services }) => {
        for (const player of playersInGarden.values()) tryWitchCatch(player, services, quest);
    });
    services.system.eventBus?.on("player:logout", ({ playerId }) => {
        playersInGarden.delete(playerId);
        experimentByPlayer.delete(playerId);
        mouseByPlayer.delete(playerId);
    });
}
