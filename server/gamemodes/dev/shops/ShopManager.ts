import { ObjStackability } from "../../../../client/rs/config/objtype/ObjStackability";
import type { ObjType } from "../../../../client/rs/config/objtype/ObjType";
import { type InventoryAddResult, type PlayerState } from "../../../src/game/player";
import { getAllShopDefinitions } from "./definitions";
import { type ShopDefinition } from "./types";

type LoggerLike = {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
    debug?: (...args: unknown[]) => void;
};

type ShopSlotState = {
    itemId: number;
    quantity: number;
    defaultQuantity: number;
    basePrice: number;
    restockAmount: number;
    restockTicks: number;
    nextRestockTick: number;
    dynamic: boolean;
};

type ShopState = {
    id: string;
    name: string;
    currencyItemId: number;
    generalStore: boolean;
    capacity: number;
    buyPriceMultiplier: number;
    sellPriceMultiplier: number;
    restockTicks: number;
    slots: ShopSlotState[];
    watchers: Set<number>;
};

export type ShopStockEntry = {
    slot: number;
    itemId: number;
    quantity: number;
    defaultQuantity: number;
    priceEach: number;
    sellPrice?: number;
};

export type ShopSnapshot = {
    shopId: string;
    name: string;
    currencyItemId: number;
    generalStore: boolean;
    stock: ShopStockEntry[];
};

export type ShopManagerOptions = {
    coinsItemId?: number;
    logger?: LoggerLike;
    getObjType: (itemId: number) => ObjType | undefined;
    addItemToInventory: (
        player: PlayerState,
        itemId: number,
        quantity: number,
    ) => InventoryAddResult;
    snapshotInventory: (player: PlayerState) => void;
    sendGameMessage: (player: PlayerState, text: string) => void;
};

export class ShopManager {
    private readonly shops = new Map<string, ShopState>();
    private readonly npcToShop = new Map<number, ShopState>();
    private readonly playerToShop = new Map<number, ShopState>();
    private readonly options: Required<ShopManagerOptions>;

    constructor(opts: ShopManagerOptions) {
        this.options = {
            coinsItemId: opts.coinsItemId ?? 995,
            logger: opts.logger ?? {},
            getObjType: opts.getObjType,
            addItemToInventory: opts.addItemToInventory,
            snapshotInventory: opts.snapshotInventory,
            sendGameMessage: opts.sendGameMessage,
        };
        for (const def of getAllShopDefinitions()) {
            this.registerDefinition(def);
        }
    }

    openShopForNpc(player: PlayerState, npcTypeId: number): ShopSnapshot | undefined {
        const shop = this.npcToShop.get(Math.trunc(npcTypeId));
        if (!shop) return undefined;
        return this.openShop(player, shop);
    }

    openShopById(player: PlayerState, shopId: string): ShopSnapshot | undefined {
        const shop = shopId ? this.shops.get(shopId) : undefined;
        if (!shop) return undefined;
        return this.openShop(player, shop);
    }

    closeShopForPlayer(player: PlayerState): ShopState | undefined {
        const playerId = player.id;
        const existing = this.playerToShop.get(playerId);
        if (!existing) return undefined;
        existing.watchers.delete(playerId);
        this.playerToShop.delete(playerId);
        player.bank.setActiveShopId(undefined);
        return existing;
    }

    getShopIdForPlayer(player: PlayerState): string | undefined {
        return this.playerToShop.get(player.id)?.id;
    }

    getWatchers(shopId: string): number[] {
        const shop = this.shops.get(shopId);
        if (!shop) return [];
        return Array.from(shop.watchers.values());
    }

    getShopSnapshot(shopId: string): ShopSnapshot | undefined {
        const shop = this.shops.get(shopId);
        if (!shop) return undefined;
        return this.buildSnapshot(shop);
    }

    setBuyMode(
        player: PlayerState,
        mode: number,
    ): { shopId?: string; buyMode: number } | undefined {
        const normalized = Math.max(0, Math.min(4, Math.trunc(mode)));
        player.bank.setShopBuyMode(normalized);
        return { shopId: this.getShopIdForPlayer(player), buyMode: normalized };
    }

    setSellMode(
        player: PlayerState,
        mode: number,
    ): { shopId?: string; sellMode: number } | undefined {
        const normalized = Math.max(0, Math.min(4, Math.trunc(mode)));
        player.bank.setShopSellMode(normalized);
        return { shopId: this.getShopIdForPlayer(player), sellMode: normalized };
    }

    getShopSlotValue(
        player: PlayerState,
        slotIndex: number,
    ): { itemId: number; itemName: string; buyPrice: number; sellPrice: number } | undefined {
        const shop = this.playerToShop.get(player.id);
        if (!shop) return undefined;
        const index = Math.max(0, Math.min(shop.slots.length - 1, Math.trunc(slotIndex)));
        const slot = shop.slots[index];
        if (!slot || slot.itemId <= 0 || slot.quantity <= 0) return undefined;
        const obj = this.options.getObjType(slot.itemId);
        const itemName = obj?.name ?? "Unknown";
        return {
            itemId: slot.itemId,
            itemName,
            buyPrice: this.getBuyPrice(shop, slot),
            sellPrice: this.getSellPrice(shop, slot),
        };
    }

    getInventoryItemSellValue(
        player: PlayerState,
        itemId: number,
    ): { itemId: number; itemName: string; sellPrice: number } | undefined {
        const shop = this.playerToShop.get(player.id);
        if (!shop) return undefined;
        const obj = this.options.getObjType(itemId);
        if (!obj) return undefined;
        const itemName = obj.name ?? "Unknown";
        // Quote what selling would pay: the shop's own price for an item it stocks (not the
        // item's cache value, which is 1 coin for most holiday items), else what a general store pays.
        const slotIndex = this.resolveShopSlotForItem(shop, itemId);
        const slot = slotIndex !== undefined ? shop.slots[slotIndex] : undefined;
        if (!this.willBuy(shop, itemId, obj) || !slot) {
            this.options.sendGameMessage(player, `${itemName}: the shop won't buy that item.`);
            return undefined;
        }
        const sellPrice =
            slot.itemId === Math.trunc(itemId)
                ? this.getSellPrice(shop, slot)
                : Math.max(0, Math.floor(this.getBasePrice(itemId) * shop.sellPriceMultiplier));
        return { itemId, itemName, sellPrice };
    }

    /**
     * Whether the shop takes this item at all: never its currency or a note, and an item the
     * game marks untradeable only when it's the shop's own stock (a store's cosmetics).
     */
    private willBuy(shop: ShopState, itemId: number, obj: ObjType): boolean {
        if (this.isCurrencyItem(shop, itemId)) return false;
        if (obj.noteTemplate >= 0 || obj.placeholderTemplate >= 0) return false;
        const ownStock = shop.slots.some((s) => s.itemId === Math.trunc(itemId) && s.defaultQuantity > 0);
        return obj.isTradable !== false || ownStock;
    }

    buyFromShop(
        player: PlayerState,
        slotIndex: number,
        requestedQuantity: number,
        currentTick: number,
    ): { shopId?: string; slot?: ShopStockEntry } | undefined {
        const shop = this.playerToShop.get(player.id);
        if (!shop) {
            this.options.sendGameMessage(player, "You aren't currently viewing a shop.");
            return undefined;
        }
        const index = Math.max(0, Math.min(shop.slots.length - 1, Math.trunc(slotIndex)));
        const slot = shop.slots[index];
        if (!slot || slot.itemId <= 0 || slot.quantity <= 0) {
            this.options.sendGameMessage(player, "There is nothing interesting to buy.");
            return undefined;
        }
        const desired =
            requestedQuantity > 0 ? Math.min(2147483647, Math.floor(requestedQuantity)) : 1;
        const priceEach = this.getBuyPrice(shop, slot);
        // As in OSRS: buy as many as are in stock, affordable and fit, and say what cut it short.
        const affordable =
            priceEach > 0
                ? Math.floor(this.currencyHeld(player, shop.currencyItemId) / priceEach)
                : Infinity;
        const room = this.inventoryRoomFor(player, slot.itemId);
        const quantity = Math.min(slot.quantity, desired, affordable, room);
        if (!(quantity > 0)) {
            this.options.sendGameMessage(
                player,
                affordable < 1 ? "You don't have enough coins." : "You don't have enough inventory space.",
            );
            return undefined;
        }
        const totalCost = priceEach * quantity;
        this.deductCurrency(player, shop.currencyItemId, totalCost);
        if (!this.addItemStack(player, slot.itemId, quantity)) {
            this.refundCurrency(player, shop.currencyItemId, totalCost);
            this.options.sendGameMessage(player, "You don't have enough space to carry that.");
            return undefined;
        }
        slot.quantity = Math.max(0, slot.quantity - quantity);
        if (slot.quantity === 0 && slot.defaultQuantity <= 0) {
            this.clearSlot(slot);
        }
        slot.nextRestockTick = currentTick + slot.restockTicks;
        this.options.snapshotInventory(player);
        if (quantity < Math.min(desired, slot.quantity + quantity)) {
            this.options.sendGameMessage(
                player,
                quantity === affordable ? "You don't have enough coins." : "You don't have enough inventory space.",
            );
        }
        return { shopId: shop.id, slot: this.serializeSlot(shop, index) };
    }

    sellToShop(
        player: PlayerState,
        inventorySlot: number,
        requestedQuantity: number,
        itemId: number,
        currentTick: number,
    ): { shopId?: string; slot?: ShopStockEntry } | undefined {
        const shop = this.playerToShop.get(player.id);
        if (!shop) {
            this.options.sendGameMessage(player, "You aren't currently viewing a shop.");
            return undefined;
        }
        const normalizedInventorySlot = Math.max(0, Math.min(Math.trunc(inventorySlot), 27));
        const normalizedItemId = Math.trunc(itemId);
        const invSlot = player.getInventoryEntries()[normalizedInventorySlot];
        if (!invSlot || invSlot.itemId !== normalizedItemId || invSlot.quantity <= 0) {
            this.options.sendGameMessage(player, "You don't have enough of that item.");
            return undefined;
        }
        const targetSlotIndex = this.resolveShopSlotForItem(shop, normalizedItemId);
        if (targetSlotIndex === undefined) {
            this.options.sendGameMessage(
                player,
                shop.generalStore ? "The shop is full." : "The shop won't buy that item.",
            );
            return undefined;
        }
        const targetSlot = shop.slots[targetSlotIndex];
        const obj = this.options.getObjType(normalizedItemId);
        if (!obj || this.isCurrencyItem(shop, normalizedItemId)) {
            return undefined;
        }
        const isNoted = obj.noteTemplate >= 0 || obj.placeholderTemplate >= 0;
        if (isNoted) {
            this.options.sendGameMessage(player, "You can't sell noted items.");
            return undefined;
        }
        if (!this.willBuy(shop, normalizedItemId, obj)) {
            this.options.sendGameMessage(player, "You can't sell this item to this shop.");
            return undefined;
        }
        const desired =
            requestedQuantity > 0 ? Math.min(2147483647, Math.floor(requestedQuantity)) : 1;
        const quantity = Math.max(1, Math.min(invSlot.quantity, desired));
        if (!(quantity > 0)) return undefined;
        invSlot.quantity -= quantity;
        if (invSlot.quantity <= 0) {
            invSlot.itemId = -1;
            invSlot.quantity = 0;
        }
        if (targetSlot.itemId <= 0) {
            this.fillSlotFromSale(targetSlot, normalizedItemId, quantity, shop, currentTick);
        } else {
            targetSlot.quantity += quantity;
            targetSlot.nextRestockTick = currentTick + targetSlot.restockTicks;
        }
        const sellPrice = this.getSellPrice(shop, targetSlot);
        const totalValue = sellPrice * quantity;
        if (!this.addCurrency(player, shop.currencyItemId, totalValue)) {
            // Refund items if currency couldn't be added (should not happen with space checks)
            invSlot.itemId = normalizedItemId;
            invSlot.quantity += quantity;
            targetSlot.quantity = Math.max(0, targetSlot.quantity - quantity);
            if (targetSlot.quantity <= 0 && targetSlot.defaultQuantity <= 0) {
                this.clearSlot(targetSlot);
            }
            this.options.sendGameMessage(player, "You don't have space for the coins.");
            return undefined;
        }
        this.options.snapshotInventory(player);
        return { shopId: shop.id, slot: this.serializeSlot(shop, targetSlotIndex) };
    }

    tick(currentTick: number): Array<{ shopId: string; slot: ShopStockEntry }> {
        const updates: Array<{ shopId: string; slot: ShopStockEntry }> = [];
        for (const shop of this.shops.values()) {
            for (let i = 0; i < shop.slots.length; i++) {
                const slot = shop.slots[i];
                if (slot.itemId <= 0 || !(slot.restockTicks > 0)) continue;
                if (currentTick < slot.nextRestockTick) continue;
                slot.nextRestockTick = currentTick + slot.restockTicks;
                if (slot.quantity < slot.defaultQuantity) {
                    slot.quantity = Math.min(
                        slot.defaultQuantity,
                        slot.quantity + slot.restockAmount,
                    );
                    updates.push({ shopId: shop.id, slot: this.serializeSlot(shop, i) });
                } else if (slot.quantity > slot.defaultQuantity) {
                    slot.quantity = Math.max(
                        slot.defaultQuantity,
                        slot.quantity - slot.restockAmount,
                    );
                    if (slot.quantity <= 0 && slot.defaultQuantity <= 0) {
                        this.clearSlot(slot);
                    }
                    updates.push({ shopId: shop.id, slot: this.serializeSlot(shop, i) });
                }
            }
        }
        return updates;
    }

    private openShop(player: PlayerState, shop: ShopState): ShopSnapshot {
        this.closeShopForPlayer(player);
        shop.watchers.add(player.id);
        this.playerToShop.set(player.id, shop);
        player.bank.setActiveShopId(shop.id);
        return this.buildSnapshot(shop);
    }

    /** Adds (or replaces) a shop, e.g. a gamemode's own store that isn't in shops.json. */
    registerDefinition(def: ShopDefinition): void {
        const capacity = Math.min(
            80,
            Math.max(40, def.capacity ?? def.stock.length, def.stock.length),
        );
        const shop: ShopState = {
            id: def.id,
            name: def.name,
            currencyItemId: def.currencyItemId ?? this.options.coinsItemId,
            generalStore: !!def.generalStore,
            capacity,
            buyPriceMultiplier: def.buyPriceMultiplier ?? 1,
            sellPriceMultiplier: def.sellPriceMultiplier ?? (def.generalStore ? 0.4 : 0.45),
            restockTicks: Math.max(1, def.restockTicks ?? 40),
            slots: Array.from({ length: capacity }, () => this.createEmptySlot()),
            watchers: new Set(),
        };
        for (let i = 0; i < def.stock.length && i < capacity; i++) {
            this.populateSlot(shop.slots[i], def.stock[i], shop);
        }
        this.shops.set(shop.id, shop);
        for (const npcId of def.npcIds || []) {
            this.npcToShop.set(Math.trunc(npcId), shop);
        }
    }

    private createEmptySlot(): ShopSlotState {
        return {
            itemId: -1,
            quantity: 0,
            defaultQuantity: 0,
            basePrice: 0,
            restockAmount: 1,
            restockTicks: 40,
            nextRestockTick: 0,
            dynamic: false,
        };
    }

    private populateSlot(
        slot: ShopSlotState,
        entry: ShopDefinition["stock"][number],
        shop: ShopState,
    ) {
        slot.itemId = Math.trunc(entry.itemId);
        slot.quantity = Math.max(0, Math.trunc(entry.quantity));
        slot.defaultQuantity = Math.max(0, Math.trunc(entry.quantity));
        slot.basePrice = Math.max(0, entry.price ?? this.getBasePrice(slot.itemId));
        slot.restockAmount = Math.max(1, entry.restockAmount ?? 1);
        slot.restockTicks = Math.max(1, entry.restockTicks ?? shop.restockTicks);
        slot.nextRestockTick = slot.restockTicks;
        slot.dynamic = false;
    }

    private buildSnapshot(shop: ShopState): ShopSnapshot {
        const stock: ShopStockEntry[] = [];
        for (let idx = 0; idx < shop.slots.length; idx++) {
            const slot = shop.slots[idx];
            if (slot && slot.itemId > 0 && slot.quantity > 0) {
                stock.push(this.serializeSlot(shop, idx));
            }
        }
        return {
            shopId: shop.id,
            name: shop.name,
            currencyItemId: shop.currencyItemId,
            generalStore: shop.generalStore,
            stock,
        };
    }

    private serializeSlot(shop: ShopState, slotIndex: number): ShopStockEntry {
        const slot = shop.slots[slotIndex];
        if (!slot)
            return {
                slot: slotIndex,
                itemId: -1,
                quantity: 0,
                defaultQuantity: 0,
                priceEach: 0,
                sellPrice: 0,
            };
        if (slot.itemId <= 0 || slot.quantity <= 0) {
            return {
                slot: slotIndex,
                itemId: -1,
                quantity: 0,
                defaultQuantity: slot.defaultQuantity,
                priceEach: 0,
                sellPrice: 0,
            };
        }
        return {
            slot: slotIndex,
            itemId: slot.itemId,
            quantity: slot.quantity,
            defaultQuantity: slot.defaultQuantity,
            priceEach: this.getBuyPrice(shop, slot),
            sellPrice: this.getSellPrice(shop, slot),
        };
    }

    private getBuyPrice(shop: ShopState, slot: ShopSlotState): number {
        return Math.max(0, Math.floor(slot.basePrice * shop.buyPriceMultiplier));
    }

    private getSellPrice(shop: ShopState, slot: ShopSlotState): number {
        return Math.max(0, Math.floor(slot.basePrice * shop.sellPriceMultiplier));
    }

    private getBasePrice(itemId: number): number {
        const obj = this.options.getObjType(itemId);
        if (!obj) return 0;
        return Math.max(0, Math.trunc(obj.price));
    }

    private currencyHeld(player: PlayerState, currencyItemId: number): number {
        const normalizedCurrencyItemId = Math.trunc(currencyItemId);
        let total = 0;
        for (const entry of player.getInventoryEntries()) {
            if (entry.itemId === normalizedCurrencyItemId && entry.quantity > 0) total += entry.quantity;
        }
        return total;
    }

    private deductCurrency(player: PlayerState, currencyItemId: number, amount: number): void {
        const normalizedCurrencyItemId = Math.trunc(currencyItemId);
        let remaining = Math.max(0, Math.trunc(amount));
        const inv = player.getInventoryEntries();
        for (const entry of inv) {
            if (remaining <= 0) break;
            if (entry.itemId !== normalizedCurrencyItemId || entry.quantity <= 0) continue;
            const take = Math.min(entry.quantity, remaining);
            entry.quantity -= take;
            remaining -= take;
            if (entry.quantity <= 0) {
                entry.itemId = -1;
                entry.quantity = 0;
            }
        }
    }

    private refundCurrency(player: PlayerState, currencyItemId: number, amount: number): void {
        if (!(amount > 0)) return;
        this.addCurrency(player, currencyItemId, amount);
    }

    private addCurrency(player: PlayerState, currencyItemId: number, amount: number): boolean {
        if (!(amount > 0)) return true;
        const result = this.options.addItemToInventory(player, currencyItemId, amount);
        return result.added > 0;
    }

    /** How many of an item the pack can take: any number of a stackable that fits, else one per empty slot. */
    private inventoryRoomFor(player: PlayerState, itemId: number): number {
        const inv = player.getInventoryEntries();
        const obj = this.options.getObjType(itemId);
        const stackable = obj?.stackability === ObjStackability.ALWAYS;
        const empty = inv.filter((entry) => entry.itemId <= 0 || entry.quantity <= 0).length;
        if (stackable) {
            const existing = inv.find((entry) => entry.itemId === itemId && entry.quantity > 0);
            return existing || empty > 0 ? Infinity : 0;
        }
        return empty;
    }

    private addItemStack(player: PlayerState, itemId: number, quantity: number): boolean {
        const obj = this.options.getObjType(itemId);
        const stackable = obj?.stackability === ObjStackability.ALWAYS;
        if (stackable) {
            return this.options.addItemToInventory(player, itemId, quantity).added > 0;
        }
        for (let i = 0; i < quantity; i++) {
            const result = this.options.addItemToInventory(player, itemId, 1);
            if (result.added <= 0) {
                return false;
            }
        }
        return true;
    }

    private resolveShopSlotForItem(shop: ShopState, itemId: number): number | undefined {
        const normalizedItemId = Math.trunc(itemId);
        const baseSlot = shop.slots.findIndex(
            (slot) => slot.itemId === normalizedItemId && slot.defaultQuantity > 0,
        );
        if (baseSlot >= 0) return baseSlot;
        if (!shop.generalStore) {
            const existingDynamic = shop.slots.findIndex(
                (slot) => slot.itemId === normalizedItemId && slot.defaultQuantity === 0,
            );
            return existingDynamic >= 0 ? existingDynamic : undefined;
        }
        const dynamicSlot = shop.slots.findIndex(
            (slot) => slot.itemId === normalizedItemId && slot.defaultQuantity === 0,
        );
        if (dynamicSlot >= 0) return dynamicSlot;
        const empty = shop.slots.findIndex((slot) => slot.itemId <= 0);
        return empty >= 0 ? empty : undefined;
    }

    private fillSlotFromSale(
        slot: ShopSlotState,
        itemId: number,
        quantity: number,
        shop: ShopState,
        currentTick: number,
    ): void {
        const normalizedItemId = Math.trunc(itemId);
        const normalizedQuantity = Math.max(0, Math.trunc(quantity));
        slot.itemId = normalizedItemId;
        slot.quantity = normalizedQuantity;
        slot.defaultQuantity = shop.generalStore ? 0 : normalizedQuantity;
        slot.basePrice = this.getBasePrice(itemId);
        slot.restockAmount = 1;
        slot.restockTicks = shop.restockTicks;
        slot.nextRestockTick = currentTick + slot.restockTicks;
        slot.dynamic = shop.generalStore;
    }

    private clearSlot(slot: ShopSlotState): void {
        slot.itemId = -1;
        slot.quantity = 0;
        slot.defaultQuantity = 0;
        slot.basePrice = 0;
        slot.dynamic = false;
        slot.restockAmount = 1;
    }

    private isCurrencyItem(shop: ShopState, itemId: number): boolean {
        return shop.currencyItemId === Math.trunc(itemId);
    }
}
