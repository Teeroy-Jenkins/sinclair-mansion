import type { WebSocket } from "ws";

import { logger } from "../../utils/logger";
import type { InterfaceService } from "../../widgets/InterfaceService";
import type { HitsplatBroadcast } from "../systems/BroadcastScheduler";
import { HITMARK_BLOCK, HITMARK_DAMAGE, combatEffectApplicator } from "../combat";
import type { PathService } from "../../pathfinding/PathService";
import type { GameEventBus } from "../events/GameEventBus";
import type { GamemodeServerServices } from "../gamemodes/GamemodeDefinition";
import type { GroundItemManager } from "../items/GroundItemManager";
import type { PlayerState } from "../player";
import type { PlayerManager } from "../PlayerManager";
import type { NpcManager } from "../npcManager";
import type { AppearanceService } from "./AppearanceService";
import type { DataLoaderService } from "./DataLoaderService";
import type { EquipmentService } from "./EquipmentService";
import type { InventoryService } from "./InventoryService";
import type { LocationService } from "./LocationService";
import type { MessagingService } from "./MessagingService";
import type { PlayerCombatService } from "./PlayerCombatService";
import type { VariableService } from "./VariableService";

export interface GamemodeServiceAdapterDeps {
    dataLoaders: DataLoaderService;
    variableService: VariableService;
    messagingService: MessagingService;
    inventoryService: InventoryService;
    equipmentService: EquipmentService;
    playerCombatService?: PlayerCombatService;
    appearanceService: AppearanceService;
    getCurrentTick: () => number;
    getPlayerById: (id: number) => PlayerState | undefined;
    getSocketByPlayerId: (id: number) => WebSocket | undefined;
    refreshCombatWeaponCategory: (player: PlayerState) => {
        categoryChanged: boolean;
        weaponItemChanged: boolean;
    };
    queueCombatSnapshot: (
        playerId: number,
        category: number,
        weaponItemId: number,
        autoRetaliate: boolean,
        styleSlot: number,
        activePrayers: string[],
        combatSpellId?: number,
    ) => void;
    queueWidgetEvent: (playerId: number, event: unknown) => void;
    queueGamemodeSnapshot: (key: string, playerId: number, payload: unknown) => void;
    registerSnapshotEncoder: (
        key: string,
        encoder: (
            playerId: number,
            payload: unknown,
        ) => { message: string | Uint8Array; context: string } | undefined,
        onSent?: (playerId: number, payload: unknown) => void,
    ) => void;
    gamemodeTickCallbacks: Array<(tick: number) => void>;
    interfaceService: InterfaceService | undefined;
    eventBus: GameEventBus;
    npcManager?: NpcManager;
    groundItems?: Pick<GroundItemManager, "registerStaticSpawn">;
    locationService?: LocationService;
    pathService?: PathService;
    queueHitsplat?: (evt: HitsplatBroadcast) => void;
    players?: Pick<PlayerManager, "addBot" | "removeBot" | "startBotCombat">;
    /** Bots queue their clicks (Wield, Eat, Drink...) as actions, as people do: they need a queue. */
    actionScheduler?: { registerPlayer(player: PlayerState): void; unregisterPlayer(playerId: number): void };
    useInventoryItem?: (player: PlayerState, payload: { slot: number; itemId: number; option: string }) => void;
    castSpellOnPlayer?: (caster: PlayerState, target: PlayerState, spellId: number) => void;
}

/** The identity kits the character designer offers for each body part of a gender. */
function identityKits(dataLoaders: DataLoaderService, gender: number): number[][] {
    const out: number[][] = [[], [], [], [], [], [], []];
    const loader = dataLoaders.getIdkTypeLoader();
    const count = loader?.getCount() ?? 0;
    for (let id = 0; id < count; id++) {
        const kit = loader!.load(id) as { nonSelectable?: boolean; bodyPartId?: number; bodyPartyId?: number };
        if (!kit || kit.nonSelectable) continue;
        const part = (kit.bodyPartId ?? kit.bodyPartyId ?? -1) - (gender === 1 ? 7 : 0);
        if (part >= 0 && part < 7) out[part].push(id);
    }
    return out;
}

/**
 * Builds the GamemodeServerServices bag from extracted services.
 * Replaces the buildGamemodeServerServices anonymous object from WSServer.
 */
export function buildGamemodeServices(deps: GamemodeServiceAdapterDeps): GamemodeServerServices {
    return {
        getPlayer: (playerId) => deps.getPlayerById(playerId),
        getInventory: (player) => deps.inventoryService.getInventory(player),
        getEquipArray: (player) => deps.equipmentService.ensureEquipArray(player),
        getEquipQtyArray: (player) => deps.equipmentService.ensureEquipQtyArray(player),
        computeEquipmentStatBonuses: (player) =>
            deps.equipmentService.computeEquipmentStatBonuses(player),
        resolveBaseAttackSpeed: (player) =>
            deps.playerCombatService?.resolveBaseAttackSpeed(player) ?? 4,
        pickAttackSpeed: (player) => deps.playerCombatService?.pickAttackSpeed(player) ?? 4,
        addItemToInventory: (player, itemId, qty) =>
            deps.inventoryService.addItemToInventory(player, itemId, qty),
        sendInventorySnapshot: (playerId) => {
            const player = deps.getPlayerById(playerId);
            if (player) deps.inventoryService.snapshotInventory(player);
        },
        refreshAppearance: (player) => deps.appearanceService.refreshAppearanceKits(player),
        refreshCombatWeapon: (player) => deps.refreshCombatWeaponCategory(player),
        sendAppearanceUpdate: (playerId) => {
            const player = deps.getPlayerById(playerId);
            if (player) deps.appearanceService.sendAppearanceUpdate(player);
        },
        queueCombatSnapshot: (
            playerId,
            category,
            weaponItemId,
            autoRetaliate,
            styleSlot,
            activePrayers,
            combatSpellId,
        ) => {
            deps.queueCombatSnapshot(
                playerId,
                category,
                weaponItemId,
                autoRetaliate,
                styleSlot,
                activePrayers,
                combatSpellId,
            );
        },
        queueChatMessage: (opts) => deps.messagingService.queueChatMessage(opts),
        queueVarbit: (playerId, varbitId, value) =>
            deps.variableService.queueVarbit(playerId, varbitId, value),
        queueWidgetEvent: (playerId, event) => deps.queueWidgetEvent(playerId, event),
        queueGamemodeSnapshot: (key, playerId, payload) =>
            deps.queueGamemodeSnapshot(key, playerId, payload),
        registerSnapshotEncoder: (key, encoder, onSent) =>
            deps.registerSnapshotEncoder(key, encoder, onSent),
        getObjType: (itemId) => deps.dataLoaders.getObjType(itemId),
        spawnNpc: (config) => deps.npcManager?.spawnTransientNpc(config),
        removeNpc: (npcId) => deps.npcManager?.removeNpc(npcId) ?? false,
        emitLocChange: (oldId, newId, tile, level, opts) =>
            deps.locationService?.emitLocChange(oldId, newId, tile, level, opts),
        addCollisionFlags: (x, y, level, flags) =>
            deps.pathService?.getCollisionOverlays()?.addFlags(x, y, level, flags),
        removeCollisionFlags: (x, y, level, flags) =>
            deps.pathService?.getCollisionOverlays()?.removeFlags(x, y, level, flags),
        registerStaticGroundItem: (spawn) => {
            deps.groundItems?.registerStaticSpawn(spawn, deps.getCurrentTick());
        },
        hitNpc: (npc, damage) => {
            const tick = deps.getCurrentTick();
            const hit = combatEffectApplicator.applyNpcHitsplat(npc, damage > 0 ? HITMARK_DAMAGE : HITMARK_BLOCK, damage, tick);
            deps.queueHitsplat?.({
                targetType: "npc",
                targetId: npc.id,
                damage: hit.amount,
                style: hit.style,
                hpCurrent: hit.hpCurrent,
                hpMax: hit.hpMax,
                tick,
            });
            return { hpCurrent: hit.hpCurrent, hpMax: hit.hpMax };
        },
        addPlayerBot: ({ name, x, y, level, gender, kits, colors }) => {
            const bot = deps.players?.addBot(x, y, level, { name, gender, kits, colors });
            // Without an action queue every Wield, Eat and Drink a bot chooses is dropped.
            if (bot) deps.actionScheduler?.registerPlayer(bot);
            return bot;
        },
        removePlayerBot: (bot) => {
            deps.actionScheduler?.unregisterPlayer(bot.id);
            deps.players?.removeBot(bot);
        },
        getIdentityKits: (gender) => identityKits(deps.dataLoaders, gender),
        useInventoryItem: (player, slot, option) => {
            const entry = deps.inventoryService.getInventory(player)[slot];
            if (entry && entry.itemId > 0) deps.useInventoryItem?.(player, { slot, itemId: entry.itemId, option });
        },
        castSpellOnPlayer: (caster, target, spellId) => deps.castSpellOnPlayer?.(caster, target, spellId),
        attackPlayer: (attacker, target) => deps.players?.startBotCombat(attacker, target) ?? false,
        getInterfaceService: () => deps.interfaceService,
        getCurrentTick: () => deps.getCurrentTick(),
        registerTickCallback: (callback) => deps.gamemodeTickCallbacks.push(callback),
        eventBus: deps.eventBus,
        logger,
    };
}
