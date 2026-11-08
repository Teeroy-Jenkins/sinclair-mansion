import type { PlayerState } from "../../../../../src/game/player";
import {
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcInteractionEvent,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_BALLISTA_FIRED,
    STAGE_COMPLETE,
    STAGE_DEFEATED_WARLORD,
    STAGE_FINDING_TRACKERS,
    STAGE_GIVEN_LOGS,
    STAGE_NOT_STARTED,
    STAGE_RETRIEVED_ORB,
    STAGE_RETURNED_FIRST_ORB,
    STAGE_SPOKEN_MONTAI,
    STAGE_STARTED,
    TILE,
} from "./constants";

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function removeItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    if (countCarriedItem(player, services, itemId) < quantity) return false;
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const taken = Math.min(entry.quantity, remaining);
        const left = entry.quantity - taken;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= taken;
        if (remaining === 0) break;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function giveItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    if (!services.inventory.hasInventorySlot(player)) {
        services.messaging.sendGameMessage(player, "You need a free inventory space.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, itemId, 1);
    if (result.added !== 1) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function createBolrenHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context(event, "King Bolren"), [
                sayNpc("Khazard's troops stole an orb that protected our Spirit Tree. My people are in grave danger."),
                choose([
                    option("I will help retrieve it.", [
                        sayNpc("Thank you. Commander Montai waits on the battlefield north of the maze."),
                        run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED)),
                    ]),
                    option("I cannot help.", []),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_RETRIEVED_ORB) {
            if (!owns(event.player, event.services, ITEM.firstOrb)) {
                startConversation(context(event, "King Bolren"), [sayNpc("Please return with the stolen orb.")]);
                return;
            }
            startConversation(context(event, "King Bolren"), [
                sayPlayer("I recovered the first orb."),
                sayNpc("Khazard struck again and stole the other two. Their warlord carried them north-west."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.firstOrb)) return;
                    setQuestStage(player, quest, services, STAGE_RETURNED_FIRST_ORB);
                }),
            ]);
            return;
        }
        if (stage === STAGE_DEFEATED_WARLORD) {
            if (!owns(event.player, event.services, ITEM.remainingOrbs)) {
                startConversation(context(event, "King Bolren"), [sayNpc("The warlord still has our remaining orbs.")]);
                return;
            }
            startConversation(context(event, "King Bolren"), [
                sayNpc("You saved us. The orbs can return to the Spirit Tree at last."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.remainingOrbs)) return;
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context(event, "King Bolren"), [
                sayNpc("The gnomes are safe, and the Spirit Trees will now carry you as a friend."),
                run(({ player, services }) => {
                    if (!owns(player, services, ITEM.gnomeAmulet)) giveItem(player, services, ITEM.gnomeAmulet);
                }),
            ]);
            return;
        }
        startConversation(context(event, "King Bolren"), [sayNpc("Please recover our orbs from Khazard's forces.")]);
    };
}

function createMontaiHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_STARTED) {
            startConversation(context(event, "Commander Montai"), [
                sayNpc("We need six normal logs to strengthen our battlements."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_MONTAI)),
            ]);
            return;
        }
        if (stage === STAGE_SPOKEN_MONTAI) {
            if (countCarriedItem(event.player, event.services, ITEM.logs) < 6) {
                startConversation(context(event, "Commander Montai"), [sayNpc("We still need six normal logs.")]);
                return;
            }
            startConversation(context(event, "Commander Montai"), [
                sayNpc("Excellent. Give me a moment to organise the troops."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.logs, 6)) return;
                    setQuestStage(player, quest, services, STAGE_GIVEN_LOGS);
                }),
            ]);
            return;
        }
        if (stage === STAGE_GIVEN_LOGS) {
            startConversation(context(event, "Commander Montai"), [
                sayNpc("Find our three tracker gnomes, then use their coordinates to fire the ballista."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_FINDING_TRACKERS)),
            ]);
            return;
        }
        startConversation(context(event, "Commander Montai"), [
            sayNpc(stage >= STAGE_BALLISTA_FIRED ? "The stronghold is breached. Retrieve the orb!" : "Hold the line, soldier."),
        ]);
    };
}

function createTrackerHandler(index: number) {
    const dialogue = [
        "The height coordinate is four.",
        "The y coordinate is five.",
        "More than we, but less than our feet. The missing coordinate is three.",
    ];
    return (event: NpcInteractionEvent): void => {
        startConversation(context(event, `Tracker gnome ${index + 1}`), [sayNpc(dialogue[index])]);
    };
}

function registerStronghold(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.ballista,
        action: "fire",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_FINDING_TRACKERS) {
                services.messaging.sendGameMessage(player, "The ballista cannot help you right now.");
                return;
            }
            setQuestStage(player, quest, services, STAGE_BALLISTA_FIRED);
            services.messaging.sendGameMessage(player, "The spear crashes into the Khazard stronghold, reducing its wall to rubble.");
        },
    });
    registry.registerLocScript({
        locId: LOC.crumbledWall,
        action: "climb-over",
        handler: ({ player, services, tile, level }) => {
            if (getQuestStage(player, quest) < STAGE_BALLISTA_FIRED) {
                services.messaging.sendGameMessage(player, "The wall is too high to climb.");
                return;
            }
            const dy = player.tileY <= tile.y ? 1 : -1;
            services.movement.teleportPlayer(player, tile.x, tile.y + dy, level);
        },
    });
    registry.registerLocScript({
        locId: LOC.closedChest,
        action: "open",
        handler: ({ player, services, tile, level }) => {
            services.location.replaceTemporaryLoc(
                { worldViewId: player.worldViewId, ownerPlayerId: player.id },
                LOC.closedChest,
                LOC.openChest,
                tile,
                level,
                { lifetimeTicks: 500 },
            );
            services.messaging.sendGameMessage(player, "You open the chest.");
        },
    });
    registry.registerLocScript({
        locId: LOC.openChest,
        action: "search",
        handler: ({ player, services }) => {
            const stage = getQuestStage(player, quest);
            if ((stage !== STAGE_BALLISTA_FIRED && stage !== STAGE_RETRIEVED_ORB) ||
                owns(player, services, ITEM.firstOrb)) {
                services.messaging.sendGameMessage(player, "You search the chest but find nothing.");
                return;
            }
            if (!giveItem(player, services, ITEM.firstOrb)) return;
            if (stage === STAGE_BALLISTA_FIRED)
                setQuestStage(player, quest, services, STAGE_RETRIEVED_ORB);
            services.messaging.sendGameMessage(player, "Inside you find the stolen orb of protection.");
        },
    });
}

function registerWarlord(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerNpcScript({
        npcId: NPC.khazardWarlord,
        option: "talk-to",
        handler: (event) =>
            startConversation(context(event, "Khazard warlord"), [
                sayNpc(getQuestStage(event.player, quest) === STAGE_RETURNED_FIRST_ORB
                    ? "The orbs belong to Khazard now. I will crush you!"
                    : "Do not speak to me, insignificant wretch."),
            ]),
    });
    registry.registerNpcPreDeath(NPC.khazardWarlord, (event) => {
        const player = event.killer;
        if (!player || (getQuestStage(player, quest) !== STAGE_RETURNED_FIRST_ORB &&
            getQuestStage(player, quest) !== STAGE_DEFEATED_WARLORD)) {
            return NpcPreDeathDecision.Allow;
        }
        setQuestStage(player, quest, event.services, STAGE_DEFEATED_WARLORD);
        if (!owns(player, event.services, ITEM.remainingOrbs)) {
            event.services.groundItems.spawn(
                ITEM.remainingOrbs,
                1,
                { x: event.npc.tileX, y: event.npc.tileY, level: event.npc.level },
                { ownerId: player.id, worldViewId: player.worldViewId },
            );
        }
        return NpcPreDeathDecision.Allow;
    });
}

function registerElkoy(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const [npcId, destination] of [
        [NPC.elkoyOutside, TILE.village],
        [NPC.elkoyInside, TILE.mazeEntrance],
    ] as const) {
        registry.registerNpcScript({
            npcId,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) === STAGE_NOT_STARTED) {
                    startConversation(context(event, "Elkoy"), [sayNpc("Welcome to our maze. King Bolren waits in the village.")]);
                    return;
                }
                startConversation(context(event, "Elkoy"), [
                    sayNpc("I can guide you through the maze."),
                    choose([
                        option("Yes please.", [
                            run(({ player, services }) =>
                                services.movement.teleportPlayer(player, destination.x, destination.y, destination.level),
                            ),
                        ]),
                        option("Not now.", []),
                    ]),
                ]);
            },
        });
    }
}

export function registerTreeGnomeVillageInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registry.registerNpcScript({ npcId: NPC.kingBolren, option: "talk-to", handler: createBolrenHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.commanderMontai, option: "talk-to", handler: createMontaiHandler(quest) });
    NPC.trackers.forEach((npcId, index) =>
        registry.registerNpcScript({ npcId, option: "talk-to", handler: createTrackerHandler(index) }),
    );
    registerStronghold(quest, registry);
    registerWarlord(quest, registry);
    registerElkoy(quest, registry);
}
