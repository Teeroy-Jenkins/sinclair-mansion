import type { PlayerState } from "../../../../../../src/game/player";
import type { ScriptServices } from "../../../../../../src/game/scripts/types";
import { COINS, FARE_COINS } from "./constants";

export function takeCoins(player: PlayerState, services: ScriptServices, amount: number): boolean {
    if (!player.items.hasItem(COINS, amount)) return false;
    player.items.removeItem(COINS, amount);
    services.inventory.snapshotInventory(player);
    return true;
}

export function sailTo(
    player: PlayerState,
    services: ScriptServices,
    dest: { x: number; y: number; level: number },
    message: string,
): void {
    services.messaging.sendGameMessage(player, message);
    services.movement.teleportPlayer(player, dest.x, dest.y, dest.level, true);
}

export function tryPayFare(player: PlayerState, services: ScriptServices): "ok" | "poor" {
    if (!player.items.hasItem(COINS, FARE_COINS)) return "poor";
    takeCoins(player, services, FARE_COINS);
    return "ok";
}
