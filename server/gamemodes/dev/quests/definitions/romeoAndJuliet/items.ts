import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem, takeQuestItems } from "../../QuestService";

export function hasOwnedItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

export function hasCarriedItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
): boolean {
    return countCarriedItem(player, services, itemId) > 0;
}

export function giveItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    if (!services.inventory.canStoreItem(player, itemId)) return false;
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

export function takeItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    return takeQuestItems(player, services, [{ itemId, quantity, journalLabel: "" }]);
}

