import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOC,
    NPC,
    SHEEP,
    SHEEP_FARM_ZONE,
    STAGE_COMPLETE,
    STAGE_DISPOSING_SHEEP,
    STAGE_NEEDS_PROTECTIVE_CLOTHING,
    STAGE_NOT_STARTED,
    VARP_SHEEP_DISPOSAL,
} from "./constants";

type SheepDefinition = (typeof SHEEP)[number];

const sheepByPlayer = new Map<number, Map<number, number>>();

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function getDisposalProgress(player: PlayerState, sheep: SheepDefinition): number {
    return (player.varps.getVarpValue(VARP_SHEEP_DISPOSAL) >>> sheep.startBit) & 0x7;
}

function setDisposalProgress(
    player: PlayerState,
    services: ScriptServices,
    sheep: SheepDefinition,
    value: number,
): void {
    const mask = 0x7 << sheep.startBit;
    const current = player.varps.getVarpValue(VARP_SHEEP_DISPOSAL);
    const next = (current & ~mask) | ((value & 0x7) << sheep.startBit);
    player.varps.setVarpValue(VARP_SHEEP_DISPOSAL, next);
    services.variables.sendVarp(player, VARP_SHEEP_DISPOSAL, next);
}

function allSheepDisposed(player: PlayerState): boolean {
    return SHEEP.every((sheep) => getDisposalProgress(player, sheep) === 6);
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
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
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
    if (remaining > 0) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function trackSheep(playerId: number, npcTypeId: number, npcId: number): void {
    const tracked = sheepByPlayer.get(playerId) ?? new Map<number, number>();
    tracked.set(npcTypeId, npcId);
    sheepByPlayer.set(playerId, tracked);
}

function removeTrackedSheep(
    playerId: number,
    npcTypeId: number,
    services: ScriptServices,
): void {
    const tracked = sheepByPlayer.get(playerId);
    const npcId = tracked?.get(npcTypeId);
    if (npcId !== undefined) services.npc.removeNpc(npcId);
    tracked?.delete(npcTypeId);
    if (tracked?.size === 0) sheepByPlayer.delete(playerId);
}

function spawnSheep(
    player: PlayerState,
    services: ScriptServices,
    sheep: SheepDefinition,
    inPen: boolean,
): void {
    removeTrackedSheep(player.id, sheep.npcId, services);
    const npc = services.npc.spawnNpc({
        id: sheep.npcId,
        name: sheep.name,
        ...(inPen ? sheep.pen : sheep.start),
        wanderRadius: inPen ? 1 : 3,
        ownerPlayerId: player.id,
        worldViewId: player.worldViewId,
    });
    if (npc) trackSheep(player.id, sheep.npcId, npc.id);
}

function ensureSheep(player: PlayerState, services: ScriptServices, quest: QuestDefinition): void {
    if (getQuestStage(player, quest) !== STAGE_DISPOSING_SHEEP) return;
    for (const sheep of SHEEP) {
        const value = getDisposalProgress(player, sheep);
        if (value === 2 || value === 6) {
            removeTrackedSheep(player.id, sheep.npcId, services);
            continue;
        }
        const trackedNpcId = sheepByPlayer.get(player.id)?.get(sheep.npcId);
        if (trackedNpcId !== undefined && services.combat.getNpc(trackedNpcId)) continue;
        spawnSheep(player, services, sheep, value === 1);
    }
}

function removeAllSheep(playerId: number, services: ScriptServices): void {
    for (const npcId of sheepByPlayer.get(playerId)?.values() ?? []) services.npc.removeNpc(npcId);
    sheepByPlayer.delete(playerId);
}

function isPlayersSheep(event: { player: PlayerState; target: { id: number; typeId: number } }): boolean {
    return sheepByPlayer.get(event.player.id)?.get(event.target.typeId) === event.target.id;
}

function wearingProtectiveClothing(player: PlayerState, services: ScriptServices): boolean {
    return (
        services.equipment.getEquippedItem(player, EquipmentSlot.BODY) === ITEM.plagueJacket &&
        services.equipment.getEquippedItem(player, EquipmentSlot.LEGS) === ITEM.plagueTrousers
    );
}

function createHalgriveHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context(event, "Councillor Halgrive"), [
                sayNpc([
                    "Four strangely discoloured sheep may be carrying the plague.",
                    "They must be herded into Farmer Brumty's enclosure, poisoned, and incinerated.",
                ]),
                choose([
                    option("I can do that for you.", [
                        sayNpc("Doctor Orbon can sell you protective clothing. Take this poisoned feed."),
                        showItem(ITEM.sheepFeed, "The councillor gives you some poisoned sheep feed."),
                        run(({ player, services }) => {
                            if (!hasOwned(player, services, ITEM.sheepFeed) && !giveItem(player, services, ITEM.sheepFeed)) {
                                return;
                            }
                            setQuestStage(player, quest, services, STAGE_NEEDS_PROTECTIVE_CLOTHING);
                        }),
                    ]),
                    option("That's not a job for me.", [sayNpc("I understand, but time is of the essence.")]),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_DISPOSING_SHEEP && allSheepDisposed(event.player)) {
            startConversation(context(event, "Councillor Halgrive"), [
                sayNpc("Have you managed to dispose of all four sheep?"),
                sayPlayer("Yes, I have."),
                sayNpc("Excellent work. Please accept your expenses and a reward from Ardougne."),
                run(({ player, services }) => {
                    removeAllSheep(player.id, services);
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        if (stage < STAGE_COMPLETE && !hasOwned(event.player, event.services, ITEM.sheepFeed)) {
            startConversation(context(event, "Councillor Halgrive"), [
                sayPlayer("I need some more sheep feed."),
                sayNpc("Certainly. Please hurry!"),
                run(({ player, services }) => {
                    giveItem(player, services, ITEM.sheepFeed);
                }),
            ]);
            return;
        }
        if (stage === STAGE_COMPLETE) {
            startConversation(context(event, "Councillor Halgrive"), [
                sayNpc("Some more diseased sheep appeared, but you've done enough. Thank you again."),
            ]);
            return;
        }
        startConversation(context(event, "Councillor Halgrive"), [
            sayNpc("Please dispose of the infected sheep as quickly as possible."),
        ]);
    };
}

function buyPlagueSuit(player: PlayerState, services: ScriptServices, quest: QuestDefinition): void {
    const missing = [ITEM.plagueJacket, ITEM.plagueTrousers].filter(
        (itemId) => !hasOwned(player, services, itemId),
    );
    if (missing.length === 0) {
        services.messaging.sendGameMessage(player, "You already own a complete plague suit.");
        if (getQuestStage(player, quest) === STAGE_NEEDS_PROTECTIVE_CLOTHING) {
            setQuestStage(player, quest, services, STAGE_DISPOSING_SHEEP);
            ensureSheep(player, services, quest);
        }
        return;
    }
    const freeSlots = services.inventory
        .getInventoryItems(player)
        .filter((entry) => entry.itemId <= 0 || entry.quantity <= 0).length;
    if (freeSlots < missing.length) {
        services.messaging.sendGameMessage(player, `You need ${missing.length} free inventory spaces.`);
        return;
    }
    if (!removeQuantity(player, services, ITEM.coins, 100)) {
        services.messaging.sendGameMessage(player, "You need 100 coins for the protective clothing.");
        return;
    }
    for (const itemId of missing) giveItem(player, services, itemId);
    if (getQuestStage(player, quest) === STAGE_NEEDS_PROTECTIVE_CLOTHING) {
        setQuestStage(player, quest, services, STAGE_DISPOSING_SHEEP);
    }
    ensureSheep(player, services, quest);
    services.messaging.sendGameMessage(player, "Doctor Orbon hands you a protective plague suit.");
}

function createDoctorHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context(event, "Doctor Orbon"), [
                sayNpc("No flu, shivers, nausea, or nightmares? Good. This plague spreads very quickly."),
            ]);
            return;
        }
        if (stage === STAGE_COMPLETE) {
            startConversation(context(event, "Doctor Orbon"), [sayNpc("I hear you disposed of those sheep. Good work.")]);
            return;
        }
        startConversation(context(event, "Doctor Orbon"), [
            sayNpc("I can sell you a protective plague suit for 100 coins."),
            choose([
                option("Okay, I'll take it.", [
                    run(({ player, services }) => buyPlagueSuit(player, services, quest)),
                ]),
                option("Sorry, that's too much.", [sayNpc("I cannot replace it for any less.")]),
            ]),
        ]);
    };
}

function createFarmerHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        ensureSheep(event.player, event.services, quest);
        const stage = getQuestStage(event.player, quest);
        startConversation(context(event, "Farmer Brumty"), [
            sayNpc(
                stage === STAGE_COMPLETE
                    ? "I'm sorry about my sheep, but it had to be done for the town."
                    : "Use the cattleprod from the barn to herd the sheep without touching them.",
            ),
        ]);
    };
}

function registerSheep(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const sheep of SHEEP) {
        registry.registerNpcScript({
            npcId: sheep.npcId,
            option: "prod",
            handler: (event) => {
                if (!isPlayersSheep({ player: event.player, target: event.npc })) return;
                if (getQuestStage(event.player, quest) !== STAGE_DISPOSING_SHEEP) {
                    event.services.messaging.sendGameMessage(event.player, "You have no reason to interfere with this sheep.");
                    return;
                }
                if (!wearingProtectiveClothing(event.player, event.services)) {
                    event.services.messaging.sendGameMessage(event.player, "You need to wear the full protective plague suit.");
                    return;
                }
                if (event.services.equipment.getEquippedItem(event.player, EquipmentSlot.WEAPON) !== ITEM.cattleprod) {
                    event.services.messaging.sendGameMessage(event.player, "You need to equip the cattleprod first.");
                    return;
                }
                const value = getDisposalProgress(event.player, sheep);
                if (value !== 0) {
                    event.services.messaging.sendGameMessage(event.player, "This sheep is already in the enclosure.");
                    return;
                }
                setDisposalProgress(event.player, event.services, sheep, 1);
                spawnSheep(event.player, event.services, sheep, true);
                event.services.messaging.sendGameMessage(event.player, "The sheep jumps over the gate and into the enclosure.");
            },
        });
        registry.registerItemOnNpc(ITEM.cattleprod, sheep.npcId, ({ player, services }) => {
            services.messaging.sendGameMessage(player, "You would do better to equip the cattleprod first.");
        });
        registry.registerItemOnNpc(ITEM.sheepFeed, sheep.npcId, (event) => {
            if (!isPlayersSheep(event)) return;
            if (getDisposalProgress(event.player, sheep) !== 1) {
                event.services.messaging.sendGameMessage(event.player, "The sheep must be safely inside the enclosure first.");
                return;
            }
            if (!event.services.inventory.hasInventorySlot(event.player)) {
                event.services.messaging.sendGameMessage(event.player, "You need a free inventory space for the sheep's remains.");
                return;
            }
            setDisposalProgress(event.player, event.services, sheep, 2);
            removeTrackedSheep(event.player.id, sheep.npcId, event.services);
            giveItem(event.player, event.services, sheep.bonesItemId);
            event.services.messaging.sendGameMessage(event.player, "The sheep eats the poisoned feed and collapses. You collect its remains.");
        });
        registry.registerItemOnLoc(sheep.bonesItemId, LOC.incinerator, (event) => {
            if (getDisposalProgress(event.player, sheep) !== 2) return;
            if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
            event.services.inventory.snapshotInventory(event.player);
            setDisposalProgress(event.player, event.services, sheep, 6);
            event.services.messaging.sendGameMessage(event.player, "You put the remains into the incinerator. They burn to dust.");
        });
    }
}

export function registerSheepHerderInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const halgrive = createHalgriveHandler(quest);
    for (const npcId of NPC.councillorHalgrive) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: halgrive });
    }
    registry.registerNpcScript({
        npcId: NPC.doctorOrbon,
        option: "talk-to",
        handler: createDoctorHandler(quest),
    });
    registry.registerNpcScript({
        npcId: NPC.farmerBrumty,
        option: "talk-to",
        handler: createFarmerHandler(quest),
    });
    registerSheep(quest, registry);

    for (const locId of LOC.enclosureGates) {
        registry.registerLocScript({
            locId,
            action: undefined,
            handler: (event) => {
                const entering = event.player.tileX <= event.tile.x;
                if (entering && !wearingProtectiveClothing(event.player, event.services)) {
                    event.services.messaging.sendGameMessage(event.player, "You cannot enter without protective clothing.");
                    return;
                }
                event.services.movement.teleportPlayer(
                    event.player,
                    entering ? event.tile.x + 1 : event.tile.x - 1,
                    event.tile.y,
                    event.level,
                );
            },
        });
    }
    registry.registerZone(SHEEP_FARM_ZONE, {
        enter: ({ player, services: eventServices }) => ensureSheep(player, eventServices, quest),
        step: ({ player, services: eventServices }) => ensureSheep(player, eventServices, quest),
    });
    services.system.eventBus?.on("player:logout", ({ playerId }) => {
        sheepByPlayer.delete(playerId);
    });
}
