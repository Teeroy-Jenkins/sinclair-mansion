import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
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
    MERLINS_CRYSTAL_COMPLETE,
    NPC,
    STAGE_COMPLETE,
    STAGE_FAILED_TITAN,
    STAGE_FINDING_PERCIVAL,
    STAGE_GIVEN_WHISTLE,
    STAGE_NOT_STARTED,
    STAGE_SPOKEN_CRONE,
    STAGE_SPOKEN_MERLIN,
    STAGE_STARTED,
    TILE,
    VARP_MERLINS_CRYSTAL,
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

function removeItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const left = entry.quantity - 1;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        services.inventory.snapshotInventory(player);
        return true;
    }
    return false;
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

function spawnQuestNpc(
    player: PlayerState,
    services: ScriptServices,
    npcId: number,
    tile: { x: number; y: number; level: number },
): void {
    if (services.npc.findNearbyNpc(player, npcId, 64)) return;
    services.npc.spawnNpc({
        id: npcId,
        x: tile.x,
        y: tile.y,
        level: tile.level,
        worldViewId: player.worldViewId,
        ownerPlayerId: player.id,
        lifetimeTicks: 500,
    });
}

function createArthurHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            if ((event.player.varps.getVarpValue(VARP_MERLINS_CRYSTAL) & 0x7) < MERLINS_CRYSTAL_COMPLETE) {
                startConversation(context(event, "King Arthur"), [sayNpc("First prove yourself by rescuing Merlin from his crystal.")]);
                return;
            }
            startConversation(context(event, "King Arthur"), [
                sayNpc("The Holy Grail has passed into Gielinor. Will you join my knights in seeking it?"),
                choose([
                    option("I would enjoy that quest.", [
                        sayNpc("Speak to Merlin in his workshop beside the library."),
                        run(({ player, services }) => {
                            setQuestStage(player, quest, services, STAGE_STARTED);
                            spawnQuestNpc(player, services, NPC.merlin, TILE.merlinWorkshop);
                        }),
                    ]),
                    option("Perhaps later.", []),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_FINDING_PERCIVAL) {
            startConversation(context(event, "King Arthur"), [
                sayNpc("Percival sought the boots of Arkaneeses. This magic feather will point towards him."),
                run(({ player, services }) => {
                    if (!owns(player, services, ITEM.magicFeather)) giveItem(player, services, ITEM.magicFeather);
                }),
            ]);
            return;
        }
        if (stage === STAGE_GIVEN_WHISTLE && owns(event.player, event.services, ITEM.holyGrail)) {
            startConversation(context(event, "King Arthur"), [
                sayPlayer("I have retrieved the Holy Grail!"),
                sayNpc("Incredible. You shall be remembered among the greatest Knights of the Round Table."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.holyGrail)) return;
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        startConversation(context(event, "King Arthur"), [
            sayNpc(stage >= STAGE_COMPLETE ? "Thank you for returning the Holy Grail." : "How goes your search for the Grail?"),
        ]);
    };
}

function createMerlinHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_STARTED) {
            startConversation(context(event, "Merlin"), [
                sayNpc("The Grail should reside in a holy place. Seek guidance on Entrana, and speak with Galahad."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_MERLIN)),
            ]);
            return;
        }
        startConversation(context(event, "Merlin"), [sayNpc("A holy island and Sir Galahad are your best clues.")]);
    };
}

function createHighPriestHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) === STAGE_SPOKEN_MERLIN) {
            startConversation(context(event, "High Priest"), [
                sayNpc("The Grail passed through Entrana, but an old crone says the Fisher King is in pain."),
                sayNpc("Carry something from his realm, then find a magic whistle at a haunted manor."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_CRONE)),
            ]);
            return;
        }
        startConversation(context(event, "High Priest"), [sayNpc("Welcome to holy Entrana.")]);
    };
}

function createGalahadHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_SPOKEN_CRONE) {
            startConversation(context(event, "Galahad"), [sayNpc("I once quested for the Grail, though it found me rather than the reverse.")]);
            return;
        }
        startConversation(context(event, "Galahad"), [
            sayNpc("I kept this table napkin from the Fisher Realm. It may reveal what is hidden in Draynor Manor."),
            run(({ player, services }) => {
                if (!owns(player, services, ITEM.napkin)) giveItem(player, services, ITEM.napkin);
            }),
        ]);
    };
}

function registerWhistles(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.whistleRoomDoor,
        action: "open",
        handler: ({ player, services }) => {
            if (!owns(player, services, ITEM.napkin) || countCarriedItem(player, services, ITEM.magicWhistle) >= 2) return;
            services.groundItems.spawn(ITEM.magicWhistle, 2, TILE.whistleTable, {
                ownerId: player.id,
                worldViewId: player.worldViewId,
                privateTicks: 250,
            });
            services.messaging.sendGameMessage(player, "The napkin reveals two magic whistles on the table.");
        },
    });
    registry.registerItemAction(ITEM.magicWhistle, ({ player, services }) => {
        const inKaramja = player.tileX >= 2738 && player.tileX <= 2744 && player.tileY >= 3232 && player.tileY <= 3239;
        const inRealm = player.tileX >= 2624 && player.tileX <= 2815 && player.tileY >= 4672 && player.tileY <= 4735;
        if (inKaramja) {
            const restored = getQuestStage(player, quest) >= STAGE_GIVEN_WHISTLE;
            const destination = restored ? TILE.realmRestored : TILE.realmDying;
            services.movement.teleportPlayer(player, destination.x, destination.y, destination.level);
            if (restored && !owns(player, services, ITEM.holyGrail)) {
                services.groundItems.spawn(ITEM.holyGrail, 1, destination, {
                    ownerId: player.id,
                    worldViewId: player.worldViewId,
                    privateTicks: 250,
                });
            }
            return;
        }
        if (inRealm) {
            services.movement.teleportPlayer(player, TILE.karamjaTower.x, TILE.karamjaTower.y, TILE.karamjaTower.level);
            return;
        }
        services.messaging.sendGameMessage(player, "The whistle makes no noise here.");
    });
}

function registerTitan(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerNpcScript({
        npcId: NPC.blackKnightTitan,
        option: "talk-to",
        handler: (event) => startConversation(context(event, "Black Knight Titan"), [sayNpc("You must pass through me to continue in this realm!")]),
    });
    registry.registerNpcPreDeath(NPC.blackKnightTitan, (event) => {
        const player = event.killer;
        if (!player) return NpcPreDeathDecision.Allow;
        if (event.services.equipment.getEquippedItem(player, EquipmentSlot.WEAPON) !== ITEM.excalibur) {
            if (getQuestStage(player, quest) === STAGE_SPOKEN_CRONE)
                setQuestStage(player, quest, event.services, STAGE_FAILED_TITAN);
            event.npc.heal(10_000);
            event.services.messaging.sendGameMessage(player, "The Titan regenerates. The final blow requires a special sword.");
            return NpcPreDeathDecision.Prevent;
        }
        event.services.messaging.sendGameMessage(player, "Well done! You have defeated the Black Knight Titan!");
        return NpcPreDeathDecision.Allow;
    });
}

function createFishermanHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_SPOKEN_CRONE) return;
        startConversation(context(event, "Fisherman"), [
            sayNpc("Ring this Grail bell outside the castle and a maiden will invite you inside."),
            run(({ player, services }) => {
                if (!owns(player, services, ITEM.grailBell)) giveItem(player, services, ITEM.grailBell);
            }),
        ]);
    };
}

function registerBell(registry: IScriptRegistry): void {
    registry.registerItemAction(ITEM.grailBell, ({ player, services }) => {
        const inRealm = player.tileX >= 2624 && player.tileX <= 2815 && player.tileY >= 4672 && player.tileY <= 4735;
        if (!inRealm) {
            services.messaging.sendGameMessage(player, "Ting-a-ling-a-ling! Nothing else happens.");
            return;
        }
        services.movement.teleportPlayer(player, TILE.fisherCastle.x, TILE.fisherCastle.y, TILE.fisherCastle.level);
    });
}

function createFisherKingHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_SPOKEN_CRONE || stage === STAGE_FAILED_TITAN) {
            startConversation(context(event, "The Fisher King"), [
                sayNpc("My life is fading and my son Percival is absent. Find him and send him home."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_FINDING_PERCIVAL)),
            ]);
            return;
        }
        startConversation(context(event, "The Fisher King"), [sayNpc("Only my heir can restore this realm and release the Grail.")]);
    };
}

function registerPercival(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.percivalSacks,
        action: "open",
        handler: ({ player, services, tile, level }) => {
            if (getQuestStage(player, quest) !== STAGE_FINDING_PERCIVAL || !owns(player, services, ITEM.magicFeather)) {
                services.messaging.sendGameMessage(player, "You have no reason to open these sacks.");
                return;
            }
            spawnQuestNpc(player, services, NPC.sirPercival, { x: tile.x - 1, y: tile.y, level });
            services.messaging.sendGameMessage(player, "You open the sacks and free Sir Percival.");
        },
    });
    registry.registerNpcScript({
        npcId: NPC.sirPercival,
        option: "talk-to",
        handler: (event) => {
            if (getQuestStage(event.player, quest) !== STAGE_FINDING_PERCIVAL) return;
            startConversation(context(event, "Sir Percival"), [
                sayNpc("My father is the Fisher King? I have no way to reach his realm."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.magicWhistle)) {
                        services.messaging.sendGameMessage(player, "You need a spare magic whistle for Percival.");
                        return;
                    }
                    setQuestStage(player, quest, services, STAGE_GIVEN_WHISTLE);
                    services.npc.removeNpc(event.npc.id);
                }),
            ]);
        },
    });
}

export function registerHolyGrailInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registry.registerNpcScript({ npcId: NPC.kingArthur, option: "talk-to", handler: createArthurHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.merlin, option: "talk-to", handler: createMerlinHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.highPriest, option: "talk-to", handler: createHighPriestHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.galahad, option: "talk-to", handler: createGalahadHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.fisherman, option: "talk-to", handler: createFishermanHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.fisherKing, option: "talk-to", handler: createFisherKingHandler(quest) });
    registerWhistles(quest, registry);
    registerTitan(quest, registry);
    registerBell(registry);
    registerPercival(quest, registry);
}
