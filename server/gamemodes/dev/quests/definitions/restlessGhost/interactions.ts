import type { NpcState } from "../../../../../src/game/npc";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import { createFatherAereckTalkHandler, createFatherUrhneyTalkHandler, createRestlessGhostTalkHandler } from "./dialogue";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_OBTAINED_SKULL,
    STAGE_SPOKEN_GHOST,
    STAGE_STARTED,
    TILE,
} from "./constants";

function registerTalk(
    registry: IScriptRegistry,
    npcId: number,
    handler: ReturnType<typeof createFatherAereckTalkHandler>,
): void {
    registry.registerNpcScript({ npcId, option: "talk-to", handler });
    registry.registerNpcScript({ npcId, option: undefined, handler });
}

function deleteInventoryItem(
    player: Parameters<ScriptServices["inventory"]["getInventoryItems"]>[0],
    services: ScriptServices,
    slot: number,
    itemId: number,
): boolean {
    const entry = services.inventory
        .getInventoryItems(player)
        .find((candidate) => candidate.slot === slot && candidate.itemId === itemId && candidate.quantity > 0);
    if (!entry) return false;
    const quantity = entry.quantity - 1;
    services.inventory.setInventorySlot(player, slot, quantity > 0 ? itemId : -1, quantity);
    services.inventory.snapshotInventory(player);
    return true;
}

export function registerRestlessGhostInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerTalk(registry, NPC.fatherAereck, createFatherAereckTalkHandler(quest));
    registerTalk(registry, NPC.fatherUrhney, createFatherUrhneyTalkHandler(quest));
    registerTalk(registry, NPC.restlessGhost, createRestlessGhostTalkHandler(quest));

    const spawnedGhostByPlayer = new Map<number, number>();

    const getTrackedGhost = (playerId: number): NpcState | undefined => {
        const npcId = spawnedGhostByPlayer.get(playerId);
        if (npcId === undefined) return undefined;
        const npc = services.combat.getNpc(npcId);
        if (!npc) spawnedGhostByPlayer.delete(playerId);
        return npc;
    };

    const ensureGhost = (playerId: number): void => {
        if (getTrackedGhost(playerId)) return;
        const ghost = services.npc.spawnNpc({
            id: NPC.restlessGhost,
            name: "Restless ghost",
            x: TILE.ghost.x,
            y: TILE.ghost.y,
            level: TILE.ghost.level,
            wanderRadius: 2,
        });
        if (ghost) spawnedGhostByPlayer.set(playerId, ghost.id);
    };

    registry.registerLocScript({
        locId: LOC.closedCoffin,
        action: "open",
        handler: (event) => {
            services.messaging.sendGameMessage(event.player, "You open the coffin.");
            services.location.emitLocChange(
                LOC.closedCoffin,
                LOC.openCoffin,
                event.tile,
                event.level,
            );
            const stage = getQuestStage(event.player, quest);
            if (stage >= STAGE_STARTED && stage < STAGE_COMPLETE) ensureGhost(event.player.id);
        },
    });

    registry.registerLocScript({
        locId: LOC.openCoffin,
        action: "search",
        handler: (event) => {
            const stage = getQuestStage(event.player, quest);
            if (stage >= STAGE_COMPLETE) {
                services.messaging.sendGameMessage(event.player, "There's a nice and complete skeleton in here!");
            } else if (stage >= STAGE_STARTED) {
                services.messaging.sendGameMessage(event.player, "There's a skeleton without a skull in here.");
                ensureGhost(event.player.id);
            } else {
                services.messaging.sendGameMessage(event.player, "You search the coffin and find some human remains.");
            }
        },
    });

    registry.registerLocScript({
        locId: LOC.openCoffin,
        action: "close",
        handler: (event) => {
            services.messaging.sendGameMessage(event.player, "You close the coffin.");
            services.location.emitLocChange(
                LOC.openCoffin,
                LOC.closedCoffin,
                event.tile,
                event.level,
            );
        },
    });

    registry.registerLocScript({
        locId: LOC.completedCoffin,
        action: "search",
        handler: (event) => {
            services.messaging.sendGameMessage(event.player, "The skull is back in there.");
        },
    });

    registry.registerLocScript({
        locId: LOC.skullAltar,
        action: "search",
        handler: (event) => {
            const stage = getQuestStage(event.player, quest);
            if (services.inventory.findOwnedItemLocation(event.player, ITEM.ghostSkull)) {
                services.messaging.sendGameMessage(event.player, "You already have the Ghost's skull.");
                return;
            }
            if (stage < STAGE_SPOKEN_GHOST || stage >= STAGE_COMPLETE) {
                services.messaging.sendGameMessage(event.player, "That skull looks scary. You have no reason to take it.");
                return;
            }
            if (!services.inventory.canStoreItem(event.player, ITEM.ghostSkull)) {
                services.messaging.sendGameMessage(event.player, "You don't have enough inventory space for the skull.");
                return;
            }
            const result = services.inventory.addItemToInventory(event.player, ITEM.ghostSkull, 1);
            if (result.added !== 1) return;
            services.inventory.snapshotInventory(event.player);
            setQuestStage(event.player, quest, event.services, STAGE_OBTAINED_SKULL);
            services.messaging.sendGameMessage(event.player, "You take the Ghost's skull from the altar.");

            const skeleton = services.npc.spawnNpc({
                id: NPC.skeleton,
                name: "Skeleton",
                x: TILE.skullSkeleton.x,
                y: TILE.skullSkeleton.y,
                level: TILE.skullSkeleton.level,
                wanderRadius: 0,
            });
            if (skeleton) {
                skeleton.engageCombat(event.player.id, event.tick, {
                    tileX: event.player.tileX,
                    tileY: event.player.tileY,
                });
            }
            services.messaging.sendGameMessage(event.player, "Out of nowhere a skeleton appears!");
        },
    });

    registry.registerItemOnLoc(ITEM.ghostSkull, LOC.closedCoffin, (event) => {
        services.messaging.sendGameMessage(event.player, "Maybe I should open it first.");
    });

    registry.registerItemOnLoc(ITEM.ghostSkull, LOC.openCoffin, (event) => {
        if (getQuestStage(event.player, quest) !== STAGE_OBTAINED_SKULL) return;
        if (!deleteInventoryItem(event.player, services, event.source.slot, ITEM.ghostSkull)) return;
        services.messaging.sendGameMessage(event.player, "You put the skull in the coffin.");
        const ghost = getTrackedGhost(event.player.id);
        if (ghost) {
            services.npc.queueNpcForcedChat(ghost, "Release! Thank you stranger...");
            services.npc.removeNpc(ghost.id);
            spawnedGhostByPlayer.delete(event.player.id);
        }
        services.location.emitLocChange(
            LOC.openCoffin,
            LOC.completedCoffin,
            event.target.tile,
            event.target.level,
        );
        services.messaging.sendGameMessage(event.player, "The spirit flies into the River Lum.");
        completeQuest(event.player, services, quest);
    });

    registry.registerItemOnNpc(ITEM.ghostSkull, NPC.restlessGhost, (event) => {
        services.messaging.sendGameMessage(event.player, "I can't give it to him. It goes right through him.");
    });
}
