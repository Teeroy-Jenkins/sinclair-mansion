import type { InventoryEntry } from "../player";

export const MAX_ITEM_STACK_QUANTITY = 2_147_483_647;

export type TradeCapacityOffer = Readonly<{
    itemId: number;
    quantity: number;
}>;

export function countFreeInventorySlots(inventory: readonly InventoryEntry[]): number {
    return inventory.reduce(
        (count, slot) => count + (slot.itemId <= 0 || slot.quantity <= 0 ? 1 : 0),
        0,
    );
}

/**
 * Simulate receiving an entire trade offer without mutating the real
 * inventory. Stackable items can use an existing stack; non-stackable items
 * need one slot each.
 */
export function canInventoryReceiveTradeOffers(
    inventory: readonly InventoryEntry[],
    offers: readonly TradeCapacityOffer[],
    isStackable: (itemId: number) => boolean,
): boolean {
    const simulatedInventory = inventory.map((slot) => ({
        itemId: slot.itemId,
        quantity: slot.quantity,
    }));
    const findFreeSlot = () =>
        simulatedInventory.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);

    for (const offer of offers) {
        if (
            !Number.isSafeInteger(offer.itemId) ||
            offer.itemId <= 0 ||
            !Number.isSafeInteger(offer.quantity) ||
            offer.quantity <= 0 ||
            offer.quantity > MAX_ITEM_STACK_QUANTITY
        ) {
            return false;
        }

        if (isStackable(offer.itemId)) {
            const existing = simulatedInventory.find(
                (slot) => slot.itemId === offer.itemId && slot.quantity > 0,
            );
            if (existing) {
                if (existing.quantity > MAX_ITEM_STACK_QUANTITY - offer.quantity) return false;
                existing.quantity += offer.quantity;
                continue;
            }

            const free = findFreeSlot();
            if (!free) return false;
            free.itemId = offer.itemId;
            free.quantity = offer.quantity;
            continue;
        }

        let remaining = offer.quantity;
        while (remaining > 0) {
            const free = findFreeSlot();
            if (!free) return false;
            free.itemId = offer.itemId;
            free.quantity = 1;
            remaining--;
        }
    }

    return true;
}

export function formatTradeFreeSlotsMessage(playerName: string, freeSlots: number): string {
    const count = Math.max(0, Math.trunc(freeSlots));
    return `${playerName} has ${count} free inventory slot${count === 1 ? "" : "s"}.`;
}
