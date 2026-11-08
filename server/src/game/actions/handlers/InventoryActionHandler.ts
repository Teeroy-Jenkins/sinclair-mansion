/**
 * Inventory action execution handler.
 *
 * Handles execution of inventory-related actions extracted from wsServer:
 * - executeInventoryUseOnAction (item use on targets)
 * - executeInventoryEquipAction (equip items)
 * - executeInventoryConsumeAction (consume items)
 * - executeScriptedConsumeAction (scripted item consumption)
 * - executeInventoryMoveAction (move items in inventory)
 * - executeInventoryUnequipAction (unequip items)
 *
 * Uses ServerServices for dependency injection.
 */
import {
    MODIFIER_FLAG_CTRL,
    MODIFIER_FLAG_CTRL_SHIFT,
} from "../../../../../client/common/input/modifierFlags";
import {
    CardinalAdjacentRouteStrategy,
    RectAdjacentRouteStrategy,
    RectWithinRangeRouteStrategy,
} from "../../../pathfinding/legacy/pathfinder/RouteStrategy";
import type { RouteStrategy } from "../../../pathfinding/legacy/pathfinder/RouteStrategy";
import { logger } from "../../../utils/logger";
import { deriveConnectedLocCollisionRect } from "../../../world/LocCollisionRect";
import {
    getSharedLocTileLookup,
    LOC_REACH_FALLBACK,
    LocTileLookupService,
    setSharedLocTileLookup,
} from "../../../world/LocTileLookupService";
import type { ServerServices } from "../../ServerServices";
import { combatConsumableManager } from "../../combat/engine/CombatConsumableManager";
import { pickEquipSound, unequipItemApply } from "../../equipment";
import type { NpcState } from "../../npc";
import type { InventoryAddResult, PlayerState } from "../../player";
import type {
    InventoryConsumableType,
    InventoryConsumeActionData,
    InventoryConsumeScriptActionData,
    InventoryEquipActionData,
    InventoryMoveActionData,
    InventoryUnequipActionData,
    InventoryUseOnActionData,
    InventoryUseOnTarget,
} from "../actionPayloads";
import type { ActionEffect, ActionExecutionResult, ActionRequest } from "../types";

// ============================================================================
// Types
// ============================================================================

/** Vec2 type for tile positions. */
export interface Vec2 {
    x: number;
    y: number;
}

/** Inventory entry type. */
export interface InventoryEntry {
    itemId: number;
    quantity: number;
}

const POTION_OPTIONS = new Set(["drink", "quaff", "sip", "imbibe", "swig"]);

const resolveConsumableType = (
    option: string | undefined,
    explicitType?: InventoryConsumableType,
): InventoryConsumableType => {
    if (explicitType) return explicitType;
    return POTION_OPTIONS.has(option?.trim().toLowerCase() ?? "") ? "potion" : "food";
};

/** Action schedule request. */
export type InventoryScheduledActionKind = string;

export type ActionScheduleRequest<
    K extends InventoryScheduledActionKind = InventoryScheduledActionKind,
> = ActionRequest<K>;

/** Action schedule result. */
export interface ActionScheduleResult {
    ok: boolean;
    reason?: string;
}

/** Equip result. */
export interface EquipResult {
    ok: boolean;
    reason?: string;
    categoryChanged?: boolean;
    weaponItemChanged?: boolean;
}

/** Unequip result. */
export interface UnequipResult {
    ok: boolean;
    reason?: string;
}

function resolveRunWithModifier(baseRun: boolean, rawModifierFlags: number | undefined): boolean {
    const flags = rawModifierFlags ?? 0;
    let run = !!baseRun;
    if ((flags & MODIFIER_FLAG_CTRL) !== 0) {
        run = !run;
    }
    if (flags === MODIFIER_FLAG_CTRL_SHIFT) {
        run = true;
    }
    return run;
}

/** Object type info. */
export interface ObjTypeInfo {
    name?: string;
    options?: string[];
}

/** Path result. */
export interface PathResult {
    ok: boolean;
    steps?: Vec2[];
    end?: Vec2;
}

function pathResultSatisfiesStrategy(
    from: { x: number; y: number; plane: number },
    result: PathResult,
    strategy: RouteStrategy,
): boolean {
    if (!result.ok || !Array.isArray(result.steps)) {
        return false;
    }

    const selectedEnd =
        result.steps.length > 0
            ? (result.end ?? result.steps[result.steps.length - 1]!)
            : { x: from.x, y: from.y };
    return strategy.hasArrived(selectedEnd.x, selectedEnd.y, from.plane);
}

// ============================================================================
// Constants
// ============================================================================

const INVENTORY_SLOT_COUNT = 28;
const EQUIP_SLOT_COUNT = 14;

function isEquipInventoryFullReason(reason: string | undefined): boolean {
    return (
        reason === "inventory_full" ||
        reason === "inventory_full_for_shield" ||
        reason === "inventory_full_for_weapon"
    );
}

// ============================================================================
// InventoryActionHandler
// ============================================================================

/**
 * Handles inventory action execution.
 */
export class InventoryActionHandler {
    constructor(private readonly svc: ServerServices) {}

    private locTiles(): LocTileLookupService | undefined {
        let lookup = getSharedLocTileLookup();
        if (!lookup && this.svc.cacheEnv) {
            lookup = new LocTileLookupService(this.svc.cacheEnv);
            setSharedLocTileLookup(lookup);
        }
        return lookup;
    }

    // ========================================================================
    // Public Methods
    // ========================================================================

    /**
     * Execute inventory use-on action.
     */
    executeInventoryUseOnAction(
        player: PlayerState,
        data: InventoryUseOnActionData,
        tick: number,
    ): ActionExecutionResult {
        try {
            const slot = data.slot;
            const itemId = data.itemId;
            const target = data.target;
            const inv = this.svc.inventoryService.getInventory(player);
            const entry = inv[slot];
            if (!entry || entry.itemId !== itemId || entry.quantity <= 0) {
                return { ok: false, reason: "item_mismatch" };
            }

            const handledItemOnItem = this.tryHandleScriptedItemOnItem(
                player,
                slot,
                itemId,
                target,
                inv,
                tick,
            );
            if (handledItemOnItem) {
                return handledItemOnItem;
            }
            if (target?.kind === "inv") {
                this.svc.messagingService.queueChatMessage({
                    messageType: "game",
                    text: "Nothing interesting happens.",
                    targetPlayerIds: [player.id],
                });
                return { ok: true, groups: ["inventory"] };
            }

            if (target?.kind === "obj" && target.id !== undefined && target.tile) {
                const started = this.svc.groundItemHandler?.startItemOnGroundInteraction(player, {
                    source: { slot, itemId },
                    targetItemId: target.id,
                    tile: {
                        x: target.tile.x,
                        y: target.tile.y,
                        level: target.plane ?? player.level,
                    },
                    modifierFlags: data.modifierFlags,
                });
                if (started) {
                    return { ok: true, groups: ["inventory", "movement"] };
                }
            }

            // Resolve target tile and adjacency size
            let targetX = player.tileX;
            let targetY = player.tileY;
            let sizeX = 1;
            let sizeY = 1;
            if (target?.kind === "npc" && target.id !== undefined) {
                const npc = this.svc.npcManager?.getById(target.id);
                if (npc) {
                    targetX = npc.tileX;
                    targetY = npc.tileY;
                    sizeX = Math.max(1, npc.size);
                    sizeY = Math.max(1, npc.size);
                }
            } else if (target?.kind === "player" && target.id !== undefined) {
                const other = this.svc.players?.getById(target.id);
                if (other) {
                    targetX = other.tileX;
                    targetY = other.tileY;
                }
            } else if (target?.kind === "loc" || target?.kind === "obj") {
                if (target.tile) {
                    targetX = target.tile.x;
                    targetY = target.tile.y;
                }
            }
            // Locs route to their whole footprint (like clicking them), not just their origin tile;
            // otherwise using an item on a 2x1 range or a staircase from across the room finds "no path".
            let allowOverlap = false;
            let wallLoc = false;
            if (target?.kind === "loc" && target.tile && target.id !== undefined) {
                let locSizeX = 1;
                let locSizeY = 1;
                const level = target.plane ?? player.level;
                // The client sends the ground tile under the cursor; snap to the loc's real origin.
                const placement = this.locTiles()?.findNearestPlacement(level, targetX, targetY, target.id);
                if (placement) {
                    targetX = placement.x;
                    targetY = placement.y;
                    target.tile = { x: placement.x, y: placement.y }; // scripts see the real loc tile too
                    wallLoc = placement.type <= 3; // gates, doors, wall decorations
                }
                try {
                    const loc = this.svc.locTypeLoader?.load(target.id);
                    locSizeX = Math.max(1, loc?.sizeX ?? 1);
                    locSizeY = Math.max(1, loc?.sizeY ?? 1);
                    if (placement && (placement.rotation & 1) === 1) [locSizeX, locSizeY] = [locSizeY, locSizeX];
                } catch {}
                const rect = this.svc.pathService
                    ? deriveConnectedLocCollisionRect(
                          (x, y, p) => this.svc.pathService!.getCollisionFlagAt(x, y, p, player.worldViewId),
                          { x: targetX, y: targetY },
                          locSizeX,
                          locSizeY,
                          level,
                      )
                    : undefined;
                targetX = rect?.tile.x ?? targetX;
                targetY = rect?.tile.y ?? targetY;
                sizeX = rect?.sizeX ?? locSizeX;
                sizeY = rect?.sizeY ?? locSizeY;
                allowOverlap = true; // walls/gates and floor decorations can be used from their own tile
            }

            // Check arrival using adjacent rectangle strategy
            // Wall locs (a gate) are used from either side of their own wall edge, like doors.
            const collisionGetter = this.svc.pathService
                ? (x: number, y: number, p: number) =>
                      this.svc.pathService!.getCollisionFlagAt(x, y, p, player.worldViewId)
                : undefined;
            const adjacent = wallLoc
                ? undefined
                : new RectAdjacentRouteStrategy(targetX, targetY, sizeX, sizeY, allowOverlap);
            // Like clicking a loc: standing next to it on the far side of a wall is not "there"
            // (otherwise the kitchen sink could be used from the shed through the wall).
            if (adjacent && collisionGetter) adjacent.setCollisionGetter(collisionGetter, player.level);
            const strategy: RouteStrategy =
                adjacent ?? new CardinalAdjacentRouteStrategy(targetX, targetY, sizeX, sizeY, true, undefined, false);
            // Furniture tucked behind counters has no reachable adjacent tile; fall back to reaching
            // within LOC_REACH_FALLBACK tiles, but only once the strict route has been shown impossible,
            // and never through a wall.
            const reach =
                target?.kind === "loc"
                    ? new RectWithinRangeRouteStrategy(targetX, targetY, sizeX, sizeY, LOC_REACH_FALLBACK)
                    : undefined;
            if (reach && collisionGetter) reach.setCollisionGetter(collisionGetter, player.level);
            let reachFallback = data.reachFallback === true;
            const arrived =
                strategy.hasArrived(player.tileX, player.tileY, player.level) ||
                (reachFallback && !!reach?.hasArrived(player.tileX, player.tileY, player.level));
            if (!arrived) {
                // If not moving, compute a fresh path toward the target
                const q = player.getPathQueue();
                const idle = !Array.isArray(q) || q.length === 0;
                if (idle) {
                    const from = {
                        x: player.tileX,
                        y: player.tileY,
                        plane: player.level,
                    };
                    const pathService = this.svc.pathService;
                    if (!pathService) {
                        return { ok: false, reason: "no_path" };
                    }
                    const route = (rs: RouteStrategy): PathResult => {
                        const res = pathService.findPathSteps(
                            { from, to: { x: targetX, y: targetY }, size: 1 },
                            { maxSteps: 128, routeStrategy: rs },
                        );
                        return { ok: res.ok, steps: res.steps, end: res.end };
                    };
                    let pathResult = route(strategy);
                    let satisfied = pathResultSatisfiesStrategy(from, pathResult, strategy);
                    if (!satisfied && reach) {
                        pathResult = route(reach);
                        satisfied = pathResultSatisfiesStrategy(from, pathResult, reach);
                        reachFallback = satisfied;
                    }
                    const steps = pathResult.steps ?? [];
                    if (satisfied && steps.length > 0) {
                        const run = player.energy.resolveRequestedRun(
                            resolveRunWithModifier(player.energy.wantsToRun(), data?.modifierFlags),
                        );
                        player.setPath(steps, run);
                    } else if (!satisfied) {
                        logger.info(
                            `[inventory] use_on unreachable ${target?.kind}:${target && "id" in target ? target.id : "?"} at ${targetX},${targetY},${player.level} size=${sizeX}x${sizeY} wall=${wallLoc} from ${from.x},${from.y} ok=${pathResult.ok} end=${pathResult.end?.x},${pathResult.end?.y} steps=${pathResult.steps?.length}`,
                        );
                        this.svc.messagingService.queueChatMessage({
                            messageType: "game",
                            text: "I can't reach that!",
                            targetPlayerIds: [player.id],
                        });
                        return { ok: false, reason: "no_path" };
                    }
                }
                // Re-enqueue this action for the next tick until arrival
                try {
                    this.svc.actionScheduler.requestAction(
                        player.id,
                        {
                            kind: "inventory.use_on",
                            data: {
                                slot,
                                itemId,
                                target,
                                modifierFlags: data.modifierFlags,
                                reachFallback,
                            },
                            groups: ["inventory"],
                            delayTicks: 1,
                        },
                        tick,
                    );
                } catch (err) {
                    logger.warn("[inventory] failed to schedule use_on action", err);
                }
                return { ok: true, groups: ["movement"] };
            }

            const handledItemOnLoc = this.tryHandleScriptedItemOnLoc(
                player,
                slot,
                itemId,
                target,
                tick,
            );
            if (handledItemOnLoc) {
                return handledItemOnLoc;
            }

            const handledItemOnNpc = this.tryHandleScriptedItemOnNpc(
                player,
                slot,
                itemId,
                target,
                tick,
            );
            if (handledItemOnNpc) {
                return handledItemOnNpc;
            }

            const handledItemOnPlayer = this.tryHandleScriptedItemOnPlayer(
                player,
                slot,
                itemId,
                target,
                tick,
            );
            if (handledItemOnPlayer) {
                return handledItemOnPlayer;
            }

            // Arrived: perform item-on-target effect (placeholder)
            this.svc.messagingService.queueChatMessage({
                messageType: "game",
                text: "Nothing interesting happens.",
                targetPlayerIds: [player.id],
            });
            return { ok: true, groups: ["inventory"] };
        } catch (err) {
            logger.error(err);
            return { ok: false, reason: "use_on_exception" };
        }
    }

    /**
     * Execute inventory equip action.
     */
    executeInventoryEquipAction(
        player: PlayerState,
        data: InventoryEquipActionData,
    ): ActionExecutionResult {
        const desiredItemId = data.itemId;
        let slotIndex = Math.max(0, Math.min(INVENTORY_SLOT_COUNT - 1, data.slotIndex));
        let equipSlot =
            data.equipSlot !== undefined
                ? Math.max(0, Math.min(EQUIP_SLOT_COUNT - 1, data.equipSlot))
                : this.svc.equipmentService.resolveEquipSlot(desiredItemId);
        if (equipSlot === undefined) {
            return { ok: false, reason: "item_not_equippable" };
        }
        const inv = this.svc.inventoryService.getInventory(player);
        let slotEntry = inv[slotIndex];
        if (!slotEntry || slotEntry.quantity <= 0 || slotEntry.itemId !== desiredItemId) {
            const foundIdx = inv.findIndex(
                (entry) => entry.quantity > 0 && entry.itemId === desiredItemId,
            );
            if (foundIdx >= 0) {
                slotIndex = foundIdx;
                slotEntry = inv[slotIndex];
            }
        }
        if (!slotEntry || slotEntry.quantity <= 0 || slotEntry.itemId !== desiredItemId) {
            return { ok: false, reason: "item_missing" };
        }
        const equipResult = this.svc.equipmentService.equipItem(
            player,
            slotIndex,
            slotEntry.itemId,
            equipSlot,
            { playSound: true },
        );
        if (!equipResult.ok) {
            if (isEquipInventoryFullReason(equipResult.reason)) {
                this.svc.messagingService.queueChatMessage({
                    messageType: "game",
                    text: "You don't have enough inventory space.",
                    targetPlayerIds: [player.id],
                });
            }
            return { ok: false, reason: equipResult.reason ?? "equip_failed" };
        }

        // Mark dirty flags so checkAndSendSnapshots knows to send updates
        player.markAppearanceDirty();
        if (equipResult.categoryChanged || equipResult.weaponItemChanged) {
            player.markCombatStateDirty();
        }

        const effects: ActionEffect[] = [
            { type: "inventorySnapshot", playerId: player.id },
            { type: "appearanceUpdate", playerId: player.id },
        ];
        if (equipResult.categoryChanged || equipResult.weaponItemChanged) {
            effects.push({ type: "combatState", playerId: player.id });
        }
        return {
            ok: true,
            cooldownTicks: 0,
            effects,
        };
    }

    /**
     * Execute inventory consume action.
     */
    executeInventoryConsumeAction(
        player: PlayerState,
        data: InventoryConsumeActionData,
        tick: number,
    ): ActionExecutionResult {
        const slotIndex = Math.max(0, Math.min(INVENTORY_SLOT_COUNT - 1, data.slotIndex));
        const expectedItemId = data.itemId;
        const optionLower = data.option?.toLowerCase() ?? "";
        const inv = this.svc.inventoryService.getInventory(player);
        const slotEntry = inv[slotIndex];
        if (!slotEntry || slotEntry.quantity <= 0 || slotEntry.itemId !== expectedItemId) {
            return { ok: false, reason: "item_missing" };
        }
        const obj = this.svc.dataLoaderService.getObjType(slotEntry.itemId);
        if (
            !this.svc.inventoryMessageService!.isConsumable(
                obj as { inventoryActions?: Array<string | null | undefined> } | undefined,
                optionLower,
            )
        ) {
            return { ok: false, reason: "item_not_consumable" };
        }
        const consumableType = resolveConsumableType(data.option, data.consumableType);
        if (!this.canConsume(player, consumableType, tick)) {
            return { ok: false, reason: `${consumableType}_delay` };
        }
        const consumed = this.svc.inventoryService.consumeItem(player, slotIndex);
        if (!consumed) {
            return { ok: false, reason: "consume_failed" };
        }
        this.applyConsumableDelay(player, consumableType, tick);
        return {
            ok: true,
            cooldownTicks: 0,
            effects: [{ type: "inventorySnapshot", playerId: player.id }],
        };
    }

    /**
     * Execute scripted consume action.
     */
    executeScriptedConsumeAction(
        player: PlayerState,
        data: InventoryConsumeScriptActionData,
        tick: number,
    ): ActionExecutionResult {
        const slotIndex = Math.max(0, Math.min(INVENTORY_SLOT_COUNT - 1, data.slotIndex));
        const expectedItemId = data.itemId;
        const option = data.option;
        const consumableType = resolveConsumableType(option, data.consumableType);
        const inv = this.svc.inventoryService.getInventory(player);
        const slotEntry = inv[slotIndex];
        if (!slotEntry || slotEntry.quantity <= 0 || slotEntry.itemId !== expectedItemId) {
            return { ok: false, reason: "item_missing" };
        }

        if (!this.canConsume(player, consumableType, tick)) {
            return { ok: false, reason: `${consumableType}_delay` };
        }

        const consumed = this.svc.inventoryService.consumeItem(player, slotIndex);
        if (!consumed) {
            return { ok: false, reason: "consume_failed" };
        }
        try {
            data.apply?.();
        } catch (err) {
            logger.warn("[inventory] scripted consume apply failed", err);
        }
        this.applyConsumableDelay(player, consumableType, tick);

        return {
            ok: true,
            cooldownTicks: 0,
            effects: [{ type: "inventorySnapshot", playerId: player.id }],
        };
    }

    private canConsume(
        player: PlayerState,
        consumableType: InventoryConsumableType,
        tick: number,
    ): boolean {
        if (consumableType === "comboFood") return true;
        return consumableType === "potion"
            ? combatConsumableManager.canDrinkPotion(player, tick)
            : combatConsumableManager.canEatFood(player, tick);
    }

    private applyConsumableDelay(
        player: PlayerState,
        consumableType: InventoryConsumableType,
        tick: number,
    ): void {
        if (consumableType === "comboFood") {
            combatConsumableManager.applyComboFoodAttackDelay(player, tick);
            return;
        }
        if (consumableType === "potion") {
            combatConsumableManager.applyPotionDelay(player, tick);
            return;
        }
        combatConsumableManager.applyFoodDelay(player, tick);
    }

    /**
     * Execute inventory move action.
     */
    executeInventoryMoveAction(
        player: PlayerState,
        data: InventoryMoveActionData,
    ): ActionExecutionResult {
        const from = Math.max(0, Math.min(INVENTORY_SLOT_COUNT - 1, data.from));
        const to = Math.max(0, Math.min(INVENTORY_SLOT_COUNT - 1, data.to));
        if (from === to) {
            return { ok: false, reason: "inventory_move_same_slot" };
        }
        const inv = this.svc.inventoryService.getInventory(player);
        const src = inv[from];
        const dst = inv[to];
        if (!src || src.itemId <= 0 || src.quantity <= 0) {
            return { ok: false, reason: "inventory_move_empty_source" };
        }

        inv[from] = {
            itemId: dst ? dst.itemId : -1,
            quantity: dst ? dst.quantity : 0,
        };
        inv[to] = { itemId: src.itemId, quantity: src.quantity };
        player.markInventoryDirty();

        return {
            ok: true,
            cooldownTicks: 0,
            effects: [
                {
                    type: "inventorySnapshot",
                    playerId: player.id,
                },
            ],
        };
    }

    /**
     * Execute inventory unequip action.
     */
    executeInventoryUnequipAction(
        player: PlayerState,
        data: InventoryUnequipActionData,
    ): ActionExecutionResult {
        const slotIndex = Math.max(0, Math.min(EQUIP_SLOT_COUNT - 1, data.slot));
        const playSound = !!data.playSound;

        // Capture item info before unequip for sound
        const equip = this.svc.equipmentService.ensureEquipArray(player);
        const itemId = equip[slotIndex];

        // Unequipping closes interruptible interfaces (modals, dialogs)
        this.svc.interfaceManager.closeInterruptibleInterfaces(player);

        const appearance = this.svc.appearanceService.getOrCreateAppearance(player);
        const res = unequipItemApply({
            appearance,
            equipSlot: slotIndex,
            addItemToInventory: (id, qty) =>
                this.svc.inventoryService.addItemToInventory(player, id, qty),
            slotCount: EQUIP_SLOT_COUNT,
        });
        if (!res.ok) {
            return { ok: false, reason: res.reason ?? "unequip_failed" };
        }

        // Play unequip sound
        if (playSound && itemId > 0) {
            const itemDef = this.svc.dataLoaderService.getObjType(itemId);
            const itemName = (itemDef?.name as string) || "";
            const unequipSoundId = pickEquipSound(slotIndex, itemName);
            this.svc.soundService.playLocSound({
                soundId: unequipSoundId,
                tile: { x: player.tileX, y: player.tileY },
                level: player.level,
            });
        }

        const { categoryChanged, weaponItemChanged } =
            this.svc.equipmentService.refreshCombatWeaponCategory(player);
        this.svc.appearanceService.refreshAppearanceKits(player);

        // Weapon removal invalidates active autocast and any open chooser, even
        // when the player had not selected a spell yet.
        if (weaponItemChanged) {
            this.svc.equipmentService.handleWeaponSlotChanged(player);
        }

        // Mark dirty flags
        player.markEquipmentDirty();
        player.markAppearanceDirty();
        if (categoryChanged || weaponItemChanged) {
            player.markCombatStateDirty();
        }

        const effects: ActionEffect[] = [
            { type: "inventorySnapshot", playerId: player.id },
            { type: "appearanceUpdate", playerId: player.id },
        ];
        if (categoryChanged || weaponItemChanged)
            effects.push({ type: "combatState", playerId: player.id });

        return {
            ok: true,
            cooldownTicks: 0,
            effects,
        };
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    private tryHandleScriptedItemOnLoc(
        player: PlayerState,
        slot: number,
        itemId: number,
        target: InventoryUseOnTarget | undefined,
        tick: number,
    ): ActionExecutionResult | undefined {
        if (target?.kind !== "loc" || target.id === undefined || !target.tile) {
            return undefined;
        }

        const handled = this.svc.scriptRuntime.queueItemOnLoc({
            tick,
            player,
            source: { slot, itemId },
            target: {
                locId: target.id,
                tile: target.tile,
                level: target.plane ?? player.level,
            },
        });
        if (!handled) {
            return undefined;
        }

        return { ok: true, groups: ["inventory"] };
    }

    private tryHandleScriptedItemOnNpc(
        player: PlayerState,
        slot: number,
        itemId: number,
        target: InventoryUseOnTarget | undefined,
        tick: number,
    ): ActionExecutionResult | undefined {
        if (target?.kind !== "npc" || target.id === undefined) {
            return undefined;
        }
        const npc = this.svc.npcManager?.getById(target.id);
        if (!npc) {
            return { ok: false, reason: "npc_not_found" };
        }
        const handled = this.svc.scriptRuntime.queueItemOnNpc({
            tick,
            player,
            source: { slot, itemId },
            target: npc,
        });
        return handled ? { ok: true, groups: ["inventory"] } : undefined;
    }

    private tryHandleScriptedItemOnPlayer(
        player: PlayerState,
        slot: number,
        itemId: number,
        target: InventoryUseOnTarget | undefined,
        tick: number,
    ): ActionExecutionResult | undefined {
        if (target?.kind !== "player" || target.id === undefined) {
            return undefined;
        }
        const other = this.svc.players?.getById(target.id);
        if (!other || other.id === player.id) {
            return { ok: false, reason: "player_not_found" };
        }
        if (other.level !== player.level || other.worldViewId !== player.worldViewId) {
            return { ok: false, reason: "player_not_visible" };
        }
        const handled = this.svc.scriptRuntime.queueItemOnPlayer({
            tick,
            player,
            source: { slot, itemId },
            target: other,
        });
        return handled ? { ok: true, groups: ["inventory"] } : undefined;
    }

    private tryHandleScriptedItemOnItem(
        player: PlayerState,
        slot: number,
        itemId: number,
        target: InventoryUseOnTarget | undefined,
        inventory: InventoryEntry[],
        tick: number,
    ): ActionExecutionResult | undefined {
        if (target?.kind !== "inv") {
            return undefined;
        }

        const targetSlot = Math.max(0, Math.min(INVENTORY_SLOT_COUNT - 1, target.slot | 0));
        const targetEntry = inventory[targetSlot];
        if (!targetEntry || targetEntry.itemId !== target.itemId || targetEntry.quantity <= 0) {
            return { ok: false, reason: "target_item_mismatch" };
        }

        const handled = this.svc.scriptRuntime.queueItemOnItem({
            tick,
            player,
            source: { slot, itemId },
            target: { slot: targetSlot, itemId: target.itemId },
        });
        if (!handled) {
            return undefined;
        }

        return { ok: true, groups: ["inventory"] };
    }
}
