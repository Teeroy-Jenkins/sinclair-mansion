import { logger } from "../../utils/logger";
import {
    ANY_ITEM_ID,
    ANY_LOC_ID,
    ANY_NPC_ID,
    type ClientMessageHandler,
    type CommandHandler,
    type EquipmentActionHandler,
    type GroundItemInteractionHandler,
    type IScriptRegistry,
    type ItemOnGroundHandler,
    type ItemOnItemHandler,
    type ItemOnLocHandler,
    type ItemOnNpcHandler,
    type ItemOnPlayerHandler,
    type LocInteractionHandler,
    type NpcInteractionHandler,
    type NpcMagicHitHandler,
    type NpcAttackHandler,
    type NpcPreDeathHandler,
    type RegionEventHandler,
    type ScriptActionHandler,
    type ScriptRegistrationResult,
    type TickHandler,
    type WidgetActionHandler,
    type ZoneDefinition,
    type ZoneEventHandler,
    type ZoneEventType,
    type ZoneHandlers,
} from "./types";

type RegistryKey = string;
type HandlerRegistration<T> = { readonly handler: T };
type HandlerStackMap<K, T> = Map<K, HandlerRegistration<T>[]>;

const normalizeOption = (value?: string): string => {
    if (!value) return "";
    return value.trim().toLowerCase();
};

const makeNpcKey = (npcId: number, option?: string): RegistryKey =>
    `${npcId}#${normalizeOption(option)}`;

const makeLocKey = (locId: number, action?: string): RegistryKey =>
    `${locId}#${normalizeOption(action)}`;

const makeItemKey = (sourceItemId: number, targetItemId?: number, option?: string): RegistryKey => {
    const secondary = targetItemId !== undefined ? `${targetItemId}` : "";
    return `${sourceItemId}#${secondary}#${normalizeOption(option)}`;
};

const ANY_WIDGET_OP = "*";
const ANY_WIDGET_ID = "*";
const makeWidgetKey = (
    widgetId: number | undefined,
    opId?: number,
    option?: string,
): RegistryKey => {
    const wid = Number.isFinite(widgetId) ? String(widgetId) : ANY_WIDGET_ID;
    const op = Number.isFinite(opId) ? String(opId) : ANY_WIDGET_OP;
    return `${wid}#${op}#${normalizeOption(option)}`;
};

const makeEquipmentKey = (itemId: number, option?: string): RegistryKey =>
    `${itemId}#${normalizeOption(option)}`;

const makeZoneKey = (zoneId: string, type: ZoneEventType): RegistryKey => `${zoneId}#${type}`;

function normalizeZoneDefinition(definition: ZoneDefinition): ZoneDefinition {
    const id = definition.id.trim();
    if (!id) throw new Error("Zone definitions require a non-empty id.");
    const x1 = Math.trunc(definition.minX);
    const x2 = Math.trunc(definition.maxX);
    const y1 = Math.trunc(definition.minY);
    const y2 = Math.trunc(definition.maxY);
    const normalizeValues = (values?: readonly number[]): number[] | undefined => {
        if (!values) return undefined;
        return [...new Set(values.filter(Number.isFinite).map(Math.trunc))];
    };
    return {
        id,
        minX: Math.min(x1, x2),
        maxX: Math.max(x1, x2),
        minY: Math.min(y1, y2),
        maxY: Math.max(y1, y2),
        levels: normalizeValues(definition.levels),
        worldViewIds: normalizeValues(definition.worldViewIds),
    };
}

function logStackedRegistration(map: { has(key: unknown): boolean }, key: unknown, label: string): void {
    if (map.has(key)) {
        logger.debug(`[script] stacked ${label} handler for key "${key}"`);
    }
}

function warnOverwrite(map: { has(key: unknown): boolean }, key: unknown, label: string): void {
    if (map.has(key)) {
        logger.warn(`[script] overwriting ${label} handler for key "${key}"`);
    }
}

function registerStackedHandler<K, T>(
    map: HandlerStackMap<K, T>,
    key: K,
    handler: T,
    label: string,
): ScriptRegistrationResult {
    logStackedRegistration(map, key, label);
    const entry: HandlerRegistration<T> = { handler };
    const stack = map.get(key) ?? [];
    stack.push(entry);
    map.set(key, stack);

    let registered = true;
    return {
        unregister: () => {
            if (!registered) return;
            registered = false;
            const current = map.get(key);
            if (!current) return;
            const index = current.indexOf(entry);
            if (index < 0) return;
            current.splice(index, 1);
            if (current.length === 0) {
                map.delete(key);
            }
        },
    };
}

function findStackedHandler<K, T>(map: HandlerStackMap<K, T>, key: K): T | undefined {
    const stack = map.get(key);
    return stack?.[stack.length - 1]?.handler;
}

function combineRegistrations(
    registrations: readonly ScriptRegistrationResult[],
): ScriptRegistrationResult {
    return {
        unregister: () => {
            for (const registration of registrations) {
                registration.unregister();
            }
        },
    };
}

export class ScriptRegistry implements IScriptRegistry {
    private readonly npcHandlers: HandlerStackMap<RegistryKey, NpcInteractionHandler> = new Map();
    private readonly locHandlers: HandlerStackMap<RegistryKey, LocInteractionHandler> = new Map();
    private readonly locActionHandlers: HandlerStackMap<string, LocInteractionHandler> = new Map();
    private readonly npcActionHandlers: HandlerStackMap<string, NpcInteractionHandler> = new Map();
    private readonly npcPreDeathHandlers: HandlerStackMap<number, NpcPreDeathHandler> = new Map();
    private readonly npcMagicHitHandlers: HandlerStackMap<number, NpcMagicHitHandler> = new Map();
    private readonly npcAttackHandlers: HandlerStackMap<number, NpcAttackHandler> = new Map();
    private readonly itemHandlers: HandlerStackMap<RegistryKey, ItemOnItemHandler> = new Map();
    private readonly itemOnLocHandlers: HandlerStackMap<RegistryKey, ItemOnLocHandler> = new Map();
    private readonly itemOnNpcHandlers: HandlerStackMap<RegistryKey, ItemOnNpcHandler> = new Map();
    private readonly itemOnPlayerHandlers: HandlerStackMap<RegistryKey, ItemOnPlayerHandler> =
        new Map();
    private readonly groundItemHandlers: HandlerStackMap<
        RegistryKey,
        GroundItemInteractionHandler
    > = new Map();
    private readonly itemOnGroundHandlers: HandlerStackMap<RegistryKey, ItemOnGroundHandler> =
        new Map();
    private readonly itemActionHandlers: HandlerStackMap<string, ItemOnItemHandler> = new Map();
    private readonly equipmentHandlers: HandlerStackMap<RegistryKey, EquipmentActionHandler> =
        new Map();
    private readonly equipmentOptionHandlers: HandlerStackMap<string, EquipmentActionHandler> =
        new Map();
    private readonly regionHandlers = new Map<number, Set<RegionEventHandler>>();
    private readonly zoneDefinitions: HandlerStackMap<string, ZoneDefinition> = new Map();
    private readonly zoneHandlers: HandlerStackMap<RegistryKey, ZoneEventHandler> = new Map();
    private readonly tickHandlers = new Set<TickHandler>();
    private readonly widgetHandlers = new Map<RegistryKey, WidgetActionHandler[]>();
    /** RSMod-style button handlers keyed by (interfaceId << 16) | componentId */
    private readonly buttonHandlers = new Map<number, WidgetActionHandler>();
    private readonly commandHandlers = new Map<string, CommandHandler>();
    private readonly clientMessageHandlers = new Map<string, ClientMessageHandler>();
    private readonly actionHandlers = new Map<string, ScriptActionHandler>();

    registerNpcInteraction(
        npcId: number,
        handler: NpcInteractionHandler,
        option?: string,
    ): ScriptRegistrationResult {
        const key = makeNpcKey(npcId, option);
        return registerStackedHandler(this.npcHandlers, key, handler, "npc");
    }

    registerNpcScript(params: {
        npcId: number;
        option?: string;
        handler: NpcInteractionHandler;
    }): ScriptRegistrationResult {
        return this.registerNpcInteraction(params.npcId, params.handler, params.option);
    }

    registerNpcPreDeath(
        npcId: number,
        handler: NpcPreDeathHandler,
    ): ScriptRegistrationResult {
        return registerStackedHandler(this.npcPreDeathHandlers, npcId, handler, "npc-pre-death");
    }

    registerNpcMagicHit(
        npcId: number,
        handler: NpcMagicHitHandler,
    ): ScriptRegistrationResult {
        return registerStackedHandler(this.npcMagicHitHandlers, npcId, handler, "npc-magic-hit");
    }

    registerNpcAttack(npcId: number, handler: NpcAttackHandler): ScriptRegistrationResult {
        return registerStackedHandler(this.npcAttackHandlers, npcId, handler, "npc-attack");
    }

    registerLocInteraction(
        locId: number,
        handler: LocInteractionHandler,
        action?: string,
    ): ScriptRegistrationResult {
        const key = makeLocKey(locId, action);
        return registerStackedHandler(this.locHandlers, key, handler, "loc");
    }

    registerLocScript(params: {
        locId: number;
        action?: string;
        handler: LocInteractionHandler;
    }): ScriptRegistrationResult {
        return this.registerLocInteraction(params.locId, params.handler, params.action);
    }

    registerLocAction(action: string, handler: LocInteractionHandler): ScriptRegistrationResult {
        const key = normalizeOption(action);
        return registerStackedHandler(this.locActionHandlers, key, handler, "loc-action");
    }

    registerItemOnItem(
        sourceItemId: number,
        targetItemId: number,
        handler: ItemOnItemHandler,
        option?: string,
    ): ScriptRegistrationResult {
        const forwardKey = makeItemKey(sourceItemId, targetItemId, option);
        const reverseKey = makeItemKey(targetItemId, sourceItemId, option);
        const registrations = [...new Set([forwardKey, reverseKey])].map((key) =>
            registerStackedHandler(this.itemHandlers, key, handler, "item-on-item"),
        );
        return combineRegistrations(registrations);
    }

    registerItemOnLoc(
        sourceItemId: number,
        locId: number,
        handler: ItemOnLocHandler,
        option?: string,
    ): ScriptRegistrationResult {
        const key = makeItemKey(sourceItemId, locId, option);
        return registerStackedHandler(this.itemOnLocHandlers, key, handler, "item-on-loc");
    }

    registerItemOnNpc(
        sourceItemId: number,
        npcId: number,
        handler: ItemOnNpcHandler,
        option?: string,
    ): ScriptRegistrationResult {
        const key = makeItemKey(sourceItemId, npcId, option);
        return registerStackedHandler(this.itemOnNpcHandlers, key, handler, "item-on-npc");
    }

    registerItemOnPlayer(
        sourceItemId: number,
        handler: ItemOnPlayerHandler,
        option?: string,
    ): ScriptRegistrationResult {
        const key = makeItemKey(sourceItemId, undefined, option);
        return registerStackedHandler(this.itemOnPlayerHandlers, key, handler, "item-on-player");
    }

    registerGroundItemInteraction(
        itemId: number,
        handler: GroundItemInteractionHandler,
        option?: string,
    ): ScriptRegistrationResult {
        const key = makeItemKey(itemId, undefined, option);
        return registerStackedHandler(this.groundItemHandlers, key, handler, "ground-item");
    }

    registerItemOnGround(
        sourceItemId: number,
        targetItemId: number,
        handler: ItemOnGroundHandler,
        option?: string,
    ): ScriptRegistrationResult {
        const key = makeItemKey(sourceItemId, targetItemId, option);
        return registerStackedHandler(this.itemOnGroundHandlers, key, handler, "item-on-ground");
    }

    registerItemAction(
        itemId: number,
        handler: ItemOnItemHandler,
        option?: string,
    ): ScriptRegistrationResult {
        const key = makeItemKey(itemId, undefined, option);
        return registerStackedHandler(this.itemActionHandlers, key, handler, "item-action");
    }

    registerEquipmentAction(
        itemId: number,
        handler: EquipmentActionHandler,
        option?: string,
    ): ScriptRegistrationResult {
        const key = makeEquipmentKey(itemId, option);
        return registerStackedHandler(this.equipmentHandlers, key, handler, "equipment");
    }

    registerEquipmentOption(
        option: string,
        handler: EquipmentActionHandler,
    ): ScriptRegistrationResult {
        const key = normalizeOption(option);
        return registerStackedHandler(
            this.equipmentOptionHandlers,
            key,
            handler,
            "equipment-option",
        );
    }

    registerWidgetAction(params: {
        widgetId?: number;
        opId?: number;
        option?: string;
        handler: WidgetActionHandler;
    }): ScriptRegistrationResult {
        const key = makeWidgetKey(params.widgetId, params.opId, params.option);
        const existing = this.widgetHandlers.get(key) ?? [];
        existing.push(params.handler);
        this.widgetHandlers.set(key, existing);
        return {
            unregister: () => {
                const arr = this.widgetHandlers.get(key);
                if (arr) {
                    const idx = arr.indexOf(params.handler);
                    if (idx >= 0) arr.splice(idx, 1);
                    if (arr.length === 0) this.widgetHandlers.delete(key);
                }
            },
        };
    }

    /**
     * RSMod-style button registration by (interfaceId, componentId) hash.
     * This is the preferred method for registering widget button handlers.
     */
    onButton(
        interfaceId: number,
        component: number,
        handler: WidgetActionHandler,
    ): ScriptRegistrationResult {
        const hash = (interfaceId << 16) | (component & 0xffff);
        warnOverwrite(this.buttonHandlers, hash, `button(${interfaceId}:${component})`);
        this.buttonHandlers.set(hash, handler);
        return {
            unregister: () => {
                this.buttonHandlers.delete(hash);
            },
        };
    }

    /**
     * RSMod-style button lookup by (interfaceId, componentId) hash.
     */
    findButton(interfaceId: number, component: number): WidgetActionHandler | undefined {
        const hash = (interfaceId << 16) | (component & 0xffff);
        return this.buttonHandlers.get(hash);
    }

    registerNpcAction(option: string, handler: NpcInteractionHandler): ScriptRegistrationResult {
        const key = normalizeOption(option);
        return registerStackedHandler(this.npcActionHandlers, key, handler, "npc-action");
    }

    registerZone(
        definition: ZoneDefinition,
        handlers: ZoneHandlers,
    ): ScriptRegistrationResult {
        const zone = normalizeZoneDefinition(definition);
        const registrations: ScriptRegistrationResult[] = [
            registerStackedHandler(this.zoneDefinitions, zone.id, zone, "zone-definition"),
        ];
        for (const type of ["enter", "exit", "step"] as const) {
            const handler = handlers[type];
            if (!handler) continue;
            registrations.push(
                registerStackedHandler(
                    this.zoneHandlers,
                    makeZoneKey(zone.id, type),
                    handler,
                    `zone-${type}`,
                ),
            );
        }
        return combineRegistrations(registrations);
    }

    findZoneHandler(zoneId: string, type: ZoneEventType): ZoneEventHandler | undefined {
        return findStackedHandler(this.zoneHandlers, makeZoneKey(zoneId.trim(), type));
    }

    registerRegionHandler(regionId: number, handler: RegionEventHandler): ScriptRegistrationResult {
        const key = regionId;
        const set = this.regionHandlers.get(key) ?? new Set<RegionEventHandler>();
        set.add(handler);
        this.regionHandlers.set(key, set);
        return {
            unregister: () => {
                const bucket = this.regionHandlers.get(key);
                if (!bucket) return;
                bucket.delete(handler);
                if (bucket.size === 0) {
                    this.regionHandlers.delete(key);
                }
            },
        };
    }

    registerTickHandler(handler: TickHandler): ScriptRegistrationResult {
        this.tickHandlers.add(handler);
        return {
            unregister: () => {
                this.tickHandlers.delete(handler);
            },
        };
    }

    registerCommand(name: string, handler: CommandHandler): ScriptRegistrationResult {
        const normalized = name.trim().toLowerCase();
        warnOverwrite(this.commandHandlers, normalized, "command");
        this.commandHandlers.set(normalized, handler);
        return {
            unregister: () => {
                this.commandHandlers.delete(normalized);
            },
        };
    }

    findCommand(name: string): CommandHandler | undefined {
        return this.commandHandlers.get(name.trim().toLowerCase());
    }

    registerClientMessageHandler(
        messageType: string,
        handler: ClientMessageHandler,
    ): ScriptRegistrationResult {
        const key = messageType.trim().toLowerCase();
        warnOverwrite(this.clientMessageHandlers, key, "client-message");
        this.clientMessageHandlers.set(key, handler);
        return {
            unregister: () => {
                this.clientMessageHandlers.delete(key);
            },
        };
    }

    findClientMessageHandler(messageType: string): ClientMessageHandler | undefined {
        return this.clientMessageHandlers.get(messageType.trim().toLowerCase());
    }

    registerActionHandler(kind: string, handler: ScriptActionHandler): ScriptRegistrationResult {
        warnOverwrite(this.actionHandlers, kind, "action");
        this.actionHandlers.set(kind, handler);
        return {
            unregister: () => {
                this.actionHandlers.delete(kind);
            },
        };
    }

    findActionHandler(kind: string): ScriptActionHandler | undefined {
        return this.actionHandlers.get(kind);
    }

    findItemAction(itemId: number, option?: string): ItemOnItemHandler | undefined {
        const key = makeItemKey(itemId, undefined, option);
        const direct = findStackedHandler(this.itemActionHandlers, key);
        if (direct) return direct;
        if (option) {
            const fallback = makeItemKey(itemId, undefined, undefined);
            return findStackedHandler(this.itemActionHandlers, fallback);
        }
        return undefined;
    }

    findNpcInteraction(npcId: number, option?: string): NpcInteractionHandler | undefined {
        const key = makeNpcKey(npcId, option);
        const direct = findStackedHandler(this.npcHandlers, key);
        if (direct) return direct;
        return findStackedHandler(this.npcActionHandlers, normalizeOption(option));
    }

    findNpcInteractionDirect(npcId: number, option?: string): NpcInteractionHandler | undefined {
        const key = makeNpcKey(npcId, option);
        return findStackedHandler(this.npcHandlers, key);
    }

    findNpcPreDeath(npcId: number): NpcPreDeathHandler | undefined {
        return findStackedHandler(this.npcPreDeathHandlers, npcId);
    }

    findNpcMagicHit(npcId: number): NpcMagicHitHandler | undefined {
        return findStackedHandler(this.npcMagicHitHandlers, npcId);
    }

    findNpcAttack(npcId: number): NpcAttackHandler | undefined {
        return findStackedHandler(this.npcAttackHandlers, npcId);
    }

    findNpcAction(option?: string): NpcInteractionHandler | undefined {
        return findStackedHandler(this.npcActionHandlers, normalizeOption(option));
    }

    findLocInteraction(locId: number, action?: string): LocInteractionHandler | undefined {
        const key = makeLocKey(locId, action);
        const handler = findStackedHandler(this.locHandlers, key);
        if (handler) return handler;
        const actionHandler = findStackedHandler(
            this.locActionHandlers,
            normalizeOption(action),
        );
        return actionHandler;
    }

    findItemOnItem(
        sourceItemId: number,
        targetItemId: number,
        option?: string,
    ): ItemOnItemHandler | undefined {
        const keys = [
            makeItemKey(sourceItemId, targetItemId, option),
            makeItemKey(ANY_ITEM_ID, targetItemId, option),
            makeItemKey(sourceItemId, ANY_ITEM_ID, option),
            makeItemKey(ANY_ITEM_ID, ANY_ITEM_ID, option),
        ];
        for (const key of keys) {
            const handler = findStackedHandler(this.itemHandlers, key);
            if (handler) return handler;
        }
        const actionKey = makeItemKey(sourceItemId, undefined, option);
        const actionDirect = findStackedHandler(this.itemActionHandlers, actionKey);
        if (actionDirect) return actionDirect;
        if (option) {
            const fallback = makeItemKey(sourceItemId, undefined, undefined);
            return findStackedHandler(this.itemActionHandlers, fallback);
        }
        return undefined;
    }

    findItemOnLoc(
        sourceItemId: number,
        locId: number,
        option?: string,
    ): ItemOnLocHandler | undefined {
        const key = makeItemKey(sourceItemId, locId, option);
        const direct = findStackedHandler(this.itemOnLocHandlers, key);
        if (direct) return direct;
        const itemWildcard = makeItemKey(ANY_ITEM_ID, locId, option);
        const byItemWild = findStackedHandler(this.itemOnLocHandlers, itemWildcard);
        if (byItemWild) return byItemWild;
        const locWildcard = makeItemKey(sourceItemId, ANY_LOC_ID, option);
        return findStackedHandler(this.itemOnLocHandlers, locWildcard);
    }

    findItemOnNpc(
        sourceItemId: number,
        npcId: number,
        option?: string,
    ): ItemOnNpcHandler | undefined {
        const keys = [
            makeItemKey(sourceItemId, npcId, option),
            makeItemKey(ANY_ITEM_ID, npcId, option),
            makeItemKey(sourceItemId, ANY_NPC_ID, option),
            makeItemKey(ANY_ITEM_ID, ANY_NPC_ID, option),
        ];
        for (const key of keys) {
            const handler = findStackedHandler(this.itemOnNpcHandlers, key);
            if (handler) return handler;
        }
        return undefined;
    }

    findItemOnPlayer(sourceItemId: number, option?: string): ItemOnPlayerHandler | undefined {
        const direct = findStackedHandler(
            this.itemOnPlayerHandlers,
            makeItemKey(sourceItemId, undefined, option),
        );
        if (direct) return direct;
        return findStackedHandler(
            this.itemOnPlayerHandlers,
            makeItemKey(ANY_ITEM_ID, undefined, option),
        );
    }

    findGroundItemInteraction(
        itemId: number,
        option?: string,
    ): GroundItemInteractionHandler | undefined {
        const direct = findStackedHandler(
            this.groundItemHandlers,
            makeItemKey(itemId, undefined, option),
        );
        if (direct) return direct;
        return findStackedHandler(
            this.groundItemHandlers,
            makeItemKey(ANY_ITEM_ID, undefined, option),
        );
    }

    findItemOnGround(
        sourceItemId: number,
        targetItemId: number,
        option?: string,
    ): ItemOnGroundHandler | undefined {
        const keys = [
            makeItemKey(sourceItemId, targetItemId, option),
            makeItemKey(ANY_ITEM_ID, targetItemId, option),
            makeItemKey(sourceItemId, ANY_ITEM_ID, option),
            makeItemKey(ANY_ITEM_ID, ANY_ITEM_ID, option),
        ];
        for (const key of keys) {
            const handler = findStackedHandler(this.itemOnGroundHandlers, key);
            if (handler) return handler;
        }
        return undefined;
    }

    findEquipmentAction(itemId: number, option?: string): EquipmentActionHandler | undefined {
        const key = makeEquipmentKey(itemId, option);
        const direct = findStackedHandler(this.equipmentHandlers, key);
        if (direct) return direct;
        return findStackedHandler(this.equipmentOptionHandlers, normalizeOption(option));
    }

    findWidgetAction(
        widgetId: number,
        opId?: number,
        option?: string,
    ): WidgetActionHandler | undefined {
        // RSMod-style: First check hash-based button handlers
        // widgetId here is the full UID = (interfaceId << 16) | componentId
        const normalizedWidgetId = widgetId;
        const buttonHandler = this.buttonHandlers.get(normalizedWidgetId);
        if (buttonHandler) {
            return buttonHandler;
        }

        // Collect matching handlers from legacy option-based handlers
        // Specific option handlers take priority over generic handlers for the same widget/op
        const allHandlers: WidgetActionHandler[] = [];
        const normalizedOption = normalizeOption(option);
        const widgetKeys = [...new Set([`${normalizedWidgetId}`, ANY_WIDGET_ID])];
        const opKey = Number.isFinite(opId) ? `${opId as number}` : ANY_WIDGET_OP;
        const opKeys = [...new Set([opKey, ANY_WIDGET_OP])];
        for (const wid of widgetKeys) {
            for (const op of opKeys) {
                // Try specific option handler first
                const specificKey = `${wid}#${op}#${normalizedOption}`;
                const specificHandlers = normalizedOption
                    ? this.widgetHandlers.get(specificKey)
                    : undefined;
                if (specificHandlers && specificHandlers.length > 0) {
                    // Specific handler found - use it, skip generic for this widget/op
                    allHandlers.push(...specificHandlers);
                } else {
                    // No specific handler - fall back to generic
                    const genericKey = `${wid}#${op}#`;
                    const genericHandlers = this.widgetHandlers.get(genericKey);
                    if (genericHandlers && genericHandlers.length > 0) {
                        allHandlers.push(...genericHandlers);
                    }
                }
            }
        }
        if (allHandlers.length === 0) return undefined;
        if (allHandlers.length === 1) return allHandlers[0];
        // Return a composite handler that calls all matching handlers
        return (event) => {
            for (const handler of allHandlers) {
                handler(event);
            }
        };
    }

    /**
     * Whether a handler is registered for this exact widget (and op, or any op), ignoring
     * wildcard-widget handlers: e.g. a shop's "Value" on its stock, which must not be taken for
     * the item's own option with the same number (a potion's op 1 is "Drink").
     */
    hasWidgetActionFor(widgetId: number, opId: number): boolean {
        const prefixes = [`${widgetId}#${opId}#`, `${widgetId}#${ANY_WIDGET_OP}#`];
        for (const [key, handlers] of this.widgetHandlers) {
            if (handlers.length > 0 && prefixes.some((p) => key.startsWith(p))) return true;
        }
        return this.buttonHandlers.has(widgetId);
    }

    getRegionHandlers(regionId: number): ReadonlySet<RegionEventHandler> | undefined {
        return this.regionHandlers.get(regionId);
    }

    getZoneDefinitions(): readonly ZoneDefinition[] {
        const definitions: ZoneDefinition[] = [];
        for (const stack of this.zoneDefinitions.values()) {
            const definition = stack[stack.length - 1]?.handler;
            if (definition) definitions.push(definition);
        }
        return definitions;
    }

    getTickHandlers(): ReadonlySet<TickHandler> {
        return this.tickHandlers;
    }

    clearAll(): void {
        this.npcHandlers.clear();
        this.locHandlers.clear();
        this.locActionHandlers.clear();
        this.npcActionHandlers.clear();
        this.npcPreDeathHandlers.clear();
        this.itemHandlers.clear();
        this.itemOnLocHandlers.clear();
        this.itemOnNpcHandlers.clear();
        this.itemOnPlayerHandlers.clear();
        this.groundItemHandlers.clear();
        this.itemOnGroundHandlers.clear();
        this.itemActionHandlers.clear();
        this.equipmentHandlers.clear();
        this.equipmentOptionHandlers.clear();
        this.regionHandlers.clear();
        this.zoneDefinitions.clear();
        this.zoneHandlers.clear();
        this.tickHandlers.clear();
        this.widgetHandlers.clear();
        this.buttonHandlers.clear();
        this.commandHandlers.clear();
        this.clientMessageHandlers.clear();
        this.actionHandlers.clear();
    }
}
