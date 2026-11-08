/**
 * Lava Maze muddy chest (LostCity lava_maze.rs2).
 */
import type { PlayerState } from "../../../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocEvent,
    LocInteractionEvent,
    ScriptServices,
} from "../../../../../../src/game/scripts/types";

const CHEST_CLOSED = 170;
const CHEST_OPEN = 171;
const MUDDY_KEY = 991;

const LOOT: ReadonlyArray<readonly [number, number]> = [
    [2359, 1], // mithril bar
    [563, 2], // law rune
    [2297, 1], // anchovy pizza
    [1209, 1], // mithril dagger
    [995, 50], // coins
    [560, 2], // death rune
    [562, 2], // chaos rune
    [1619, 1], // uncut ruby
];

function lockedMessage(event: LocInteractionEvent): void {
    event.services.messaging.sendGameMessage(event.player, "The chest is locked.");
}

function openWithKey(
    player: PlayerState,
    services: ScriptServices,
    tile: { x: number; y: number },
    level: number,
): void {
    if (!player.items.hasItem(MUDDY_KEY, 1)) {
        services.messaging.sendGameMessage(player, "The chest is locked.");
        return;
    }

    player.items.removeItem(MUDDY_KEY, 1, { assureFullRemoval: true });
    services.messaging.sendGameMessage(player, "You unlock the chest with your key.");
    services.messaging.sendGameMessage(player, "You find some treasure in the chest!");

    for (const [itemId, qty] of LOOT) {
        player.items.addItem(itemId, qty);
    }
    services.inventory.snapshotInventory(player);

    services.location.emitLocChange(CHEST_CLOSED, CHEST_OPEN, tile, level);
    setTimeout(() => {
        services.location.emitLocChange(CHEST_OPEN, CHEST_CLOSED, tile, level);
    }, 1200);
}

export function registerMuddyChestHandlers(registry: IScriptRegistry): void {
    registry.registerLocInteraction(CHEST_CLOSED, lockedMessage, "open");
    registry.registerLocInteraction(CHEST_CLOSED, lockedMessage, undefined);
    registry.registerItemOnLoc(MUDDY_KEY, CHEST_CLOSED, (event: ItemOnLocEvent) => {
        openWithKey(event.player, event.services, event.target.tile, event.target.level);
    });
}
