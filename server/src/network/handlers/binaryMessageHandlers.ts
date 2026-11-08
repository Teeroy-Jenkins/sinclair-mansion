/**
 * Handlers for binary message types that were previously in processBinaryMessage's switch.
 * These are OSRS binary packet types routed through the message system.
 */
import type { WebSocket } from "ws";

import { CustomItemRegistry } from "../../../../client/custom/items";
import { SkillId } from "../../../../client/rs/skill/skills";
import type { WidgetDialogHandler } from "../../game/actions";
import type { PlayerState } from "../../game/player";
import type { ScriptRegistry } from "../../game/scripts";
import type { ScriptRuntime } from "../../game/scripts";
import type { MessageHandlerServices } from "../MessageHandlers";
import type { MessageHandler, MessageRouter } from "../MessageRouter";
import type { Cs2ModalManager } from "../managers";
import type { GroundItemActionPayload } from "../managers";

type InventoryActionDef = {
    inventoryActions?: Array<string | null | undefined>;
    subops?: Array<Array<string | null | undefined> | null | undefined> | null;
};

export interface BinaryHandlerExtServices extends MessageHandlerServices {
    resolveGroundItemOptionByOpNum: (itemId: number, opNum: number) => string | undefined;
    handleGroundItemAction: (ws: WebSocket, payload: GroundItemActionPayload | undefined) => void;
    getScriptRegistry: () => ScriptRegistry;
    getScriptRuntime: () => ScriptRuntime;
    getCs2ModalManager: () => Cs2ModalManager;
    getWidgetDialogHandler: () => WidgetDialogHandler;
    getObjType: (itemId: number) => InventoryActionDef | undefined;
    handleInventoryUseOnMessage: (ws: WebSocket, payload: Record<string, unknown>) => void;
}

function getItemActionDef(
    itemId: number,
    services: BinaryHandlerExtServices,
): InventoryActionDef | undefined {
    const customItem = CustomItemRegistry.get(itemId);
    const customObjType = customItem?.definition?.objType as InventoryActionDef | undefined;
    if (customObjType?.inventoryActions || customObjType?.subops) {
        return customObjType;
    }
    return services.getObjType(itemId);
}

function normalizeActionText(action: string | null | undefined): string | undefined {
    const text = typeof action === "string" ? action.trim() : "";
    return text.length > 0 ? text : undefined;
}

function resolveInventoryAction(
    actionDef: InventoryActionDef | undefined,
    opId: number,
    subOpId?: number,
): string | undefined {
    const opIndex = (opId | 0) - 1;
    if (opIndex < 0) return undefined;

    if (typeof subOpId === "number" && subOpId >= 1) {
        const subops = actionDef?.subops?.[opIndex];
        const subop = Array.isArray(subops)
            ? normalizeActionText(subops[(subOpId | 0) - 1])
            : undefined;
        if (subop) return subop;
    }

    return normalizeActionText(actionDef?.inventoryActions?.[opIndex]);
}

export function registerBinaryHandlers(
    router: MessageRouter,
    services: BinaryHandlerExtServices,
): void {
    router.register("ground_item_action", createGroundItemActionHandler(services));
    router.register("widget_action", createWidgetActionHandler(services));
    router.register("item_spawner_search", createItemSpawnerSearchHandler(services));
    router.register("if_triggeroplocal", createIfTriggerOpLocalHandler(services));
    router.register("if_buttond", createIfButtonDHandler(services));
    router.register("inventory_use_on", createInventoryUseOnHandler(services));
    router.register("resume_pausebutton", createResumePauseButtonHandler(services));
    router.register("friends_chat_action", (ctx) => {
        const player = services.getPlayer(ctx.ws);
        if (player) services.handleFriendsChatAction(player, ctx.payload);
    });
}

function createGroundItemActionHandler(services: BinaryHandlerExtServices): MessageHandler {
    return (ctx) => {
        const player = services.getPlayer(ctx.ws);
        if (!player) return;
        const payload = { ...(ctx.payload as GroundItemActionPayload) };
        if (!payload.option || payload.option.length === 0) {
            const opNum = payload.opNum;
            if (opNum !== undefined && opNum > 0) {
                const resolved = services.resolveGroundItemOptionByOpNum(payload.itemId!, opNum);
                if (resolved) payload.option = resolved;
            }
        }
        services.handleGroundItemAction(ctx.ws, payload);
    };
}

function createWidgetActionHandler(services: BinaryHandlerExtServices): MessageHandler {
    return (ctx) => {
        const player = services.getPlayer(ctx.ws);
        if (!player) return;
        const payload = ctx.payload as unknown as {
            widgetId: number;
            groupId?: number;
            buttonNum?: number;
            opId?: number;
            subOpId?: number;
            slot?: number;
            option?: string;
            itemId?: number;
        };
        const groupId = payload.groupId ?? (payload.widgetId >> 16) & 0xffff;
        const componentId = payload.widgetId & 0xffff;
        const opId = payload.opId ?? payload.buttonNum ?? 1;
        const subOpId = payload.subOpId;
        const slotVal = payload.slot;
        const hasValidSlot = slotVal !== undefined && slotVal >= 0 && slotVal !== 65535;
        const childId = hasValidSlot ? slotVal : componentId;

        if (
            services.handleFriendsChatWidgetAction(
                player,
                groupId,
                componentId,
                payload.option,
                opId,
            )
        ) {
            return;
        }

        const scriptRegistry = services.getScriptRegistry();
        const scriptRuntime = services.getScriptRuntime();
        const buttonHandler = scriptRegistry.findButton(groupId, componentId);
        if (buttonHandler) {
            const tick = services.getCurrentTick();
            buttonHandler({
                tick,
                services: scriptRuntime.getServices(),
                player,
                widgetId: payload.widgetId,
                groupId,
                childId,
                option: payload.option,
                opId,
                subOpId,
                slot: slotVal,
                itemId: payload.itemId,
            });
            return;
        }

        const cs2Modal = services.getCs2ModalManager();
        if (
            cs2Modal.handleWidgetAction(
                player,
                groupId,
                componentId,
                payload.option,
                payload.itemId,
            )
        ) {
            return;
        }

        if (groupId === 219) {
            services.getWidgetDialogHandler().handleDialogOptionClick(ctx.ws, player.id, childId);
        } else {
            // An item's own option (Eat, Drink...) only when the interface doesn't handle this op
            // itself: a shop's "Value" on a prayer potion is op 1, which is also the potion's "Drink".
            if (
                payload.itemId !== undefined &&
                payload.itemId > 0 &&
                hasValidSlot &&
                opId >= 1 &&
                !scriptRegistry.hasWidgetActionFor(payload.widgetId, opId)
            ) {
                const actionDef = getItemActionDef(payload.itemId, services);
                const resolved = resolveInventoryAction(actionDef, opId, subOpId);
                if (resolved) {
                    const tick = services.getCurrentTick();
                    if (
                        scriptRuntime.queueItemAction({
                            tick,
                            player,
                            itemId: payload.itemId,
                            slot: slotVal ?? 0,
                            option: resolved.toLowerCase(),
                        })
                    )
                        return;
                }
                const tick = services.getCurrentTick();
                if (
                    scriptRuntime.queueItemAction({
                        tick,
                        player,
                        itemId: payload.itemId,
                        slot: slotVal ?? 0,
                    })
                )
                    return;
            }
            services
                .getWidgetDialogHandler()
                .handleWidgetActionMessage(ctx.ws, { ...payload, groupId, opId, childId });
        }
    };
}

function createItemSpawnerSearchHandler(services: BinaryHandlerExtServices): MessageHandler {
    return (ctx) => {
        const player = services.getPlayer(ctx.ws);
        if (!player) return;
        const scriptRegistry = services.getScriptRegistry();
        const msgHandler = scriptRegistry.findClientMessageHandler("item_spawner_search");
        if (msgHandler) {
            const tick = services.getCurrentTick();
            const scriptRuntime = services.getScriptRuntime();
            msgHandler({
                tick,
                services: scriptRuntime.getServices(),
                player,
                messageType: "item_spawner_search",
                payload: (ctx.payload ?? {}) as Record<string, unknown>,
            });
        }
    };
}

function createIfTriggerOpLocalHandler(services: BinaryHandlerExtServices): MessageHandler {
    return (ctx) => {
        const player = services.getPlayer(ctx.ws);
        if (!player) return;
        const { widgetUid, childIndex, itemId, opcodeParam } = ctx.payload as unknown as {
            widgetUid: number;
            childIndex: number;
            itemId?: number;
            opcodeParam: number;
        };
        if (opcodeParam >= 1 && opcodeParam <= 10) {
            const groupId = (widgetUid >>> 16) & 0xffff;
            const componentId = widgetUid & 0xffff;
            const hasChild = childIndex >= 0;
            const childId = hasChild ? childIndex : componentId;
            services.getWidgetDialogHandler().handleWidgetActionMessage(ctx.ws, {
                widgetId: widgetUid,
                groupId,
                childId,
                opId: opcodeParam,
                slot: hasChild ? childIndex : undefined,
                itemId,
            });
        }
    };
}

function createIfButtonDHandler(services: BinaryHandlerExtServices): MessageHandler {
    return (ctx) => {
        const player = services.getPlayer(ctx.ws);
        if (!player) return;
        const scriptRegistry = services.getScriptRegistry();
        const msgHandler = scriptRegistry.findClientMessageHandler("if_buttond");
        if (!msgHandler) return;

        const scriptRuntime = services.getScriptRuntime();
        msgHandler({
            tick: services.getCurrentTick(),
            services: scriptRuntime.getServices(),
            player,
            messageType: "if_buttond",
            payload: (ctx.payload ?? {}) as Record<string, unknown>,
        });
    };
}

function createInventoryUseOnHandler(services: BinaryHandlerExtServices): MessageHandler {
    return (ctx) => {
        const player = services.getPlayer(ctx.ws);
        if (!player) return;
        services.handleInventoryUseOnMessage(ctx.ws, ctx.payload as Record<string, unknown>);
    };
}

function createResumePauseButtonHandler(services: BinaryHandlerExtServices): MessageHandler {
    return (ctx) => {
        const player = services.getPlayer(ctx.ws);
        if (!player) return;
        const { widgetId, childIndex } = ctx.payload as unknown as {
            widgetId: number;
            childIndex: number;
        };
        const widgetGroup = (widgetId >> 16) & 0xffff;

        const gamemode = services.getGamemode();
        if (gamemode?.onResumePauseButton?.(player, widgetId, childIndex)) {
            return;
        }

        if (widgetGroup === 270) {
            services.getWidgetDialogHandler().handleWidgetActionMessage(ctx.ws, {
                widgetId,
                groupId: widgetGroup,
                childId: widgetId & 0xffff,
                opId: 1,
                slot: childIndex,
            });
        } else if (
            services.getCs2ModalManager().handleResumePauseButton(player, widgetId, childIndex)
        ) {
            // handled
        } else {
            services
                .getWidgetDialogHandler()
                .handleResumePauseButton(ctx.ws, player.id, widgetId, childIndex);
        }
    };
}
