import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem, takeQuestItems } from "../../QuestService";
import { BLONDE_WIG_ITEM_ID, PINK_SKIRT_ITEM_ID, SKIN_PASTE_ITEM_ID } from "./constants";

export function ownsItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

export function carriesItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    return countCarriedItem(player, services, itemId) >= quantity;
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

export function hasDisguise(player: PlayerState, services: ScriptServices): boolean {
    return (
        carriesItem(player, services, BLONDE_WIG_ITEM_ID) &&
        carriesItem(player, services, PINK_SKIRT_ITEM_ID) &&
        carriesItem(player, services, SKIN_PASTE_ITEM_ID)
    );
}
