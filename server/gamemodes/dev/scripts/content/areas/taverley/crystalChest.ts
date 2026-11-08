/**
 * Taverley crystal chest + key halves (LostCity crystal_chest.rs2 / crystal_key.rs2).
 */
import type { PlayerState } from "../../../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    ItemOnLocEvent,
    LocInteractionEvent,
    ScriptServices,
} from "../../../../../../src/game/scripts/types";

const CHEST_CLOSED = 172;
const CHEST_OPEN = 173;
const CRYSTAL_KEY = 989;
const KEY_HALF_LOOP = 985;
const KEY_HALF_TOOTH = 987;
const UNCUT_DRAGONSTONE = 1631;

const COINS = 995;
const SPINACH_ROLL = 1969;
const RUBY = 1603;
const DIAMOND = 1601;
const RUNITE_BAR = 2363;
const CERT_IRON_ORE = 441;
const CERT_COAL = 454;
const RAW_SWORDFISH = 371;
const ADAMANT_SQ = 1183;
const RUNE_PLATELEGS = 1079;
const RUNE_PLATESKIRT = 1093;

const RUNES = [
    [556, 50],
    [555, 50],
    [557, 50],
    [554, 50],
    [559, 50],
    [558, 50],
    [562, 10],
    [560, 10],
    [564, 10],
    [561, 10],
    [563, 10],
] as const;

function give(player: PlayerState, itemId: number, qty: number): void {
    player.items.addItem(itemId, qty);
}

function rollLoot(player: PlayerState): void {
    give(player, UNCUT_DRAGONSTONE, 1);
    const roll = Math.floor(Math.random() * 128);

    if (roll < 34) {
        give(player, SPINACH_ROLL, 1);
        give(player, COINS, 2000);
    } else if (roll < 46) {
        for (const [id, qty] of RUNES) give(player, id, qty);
    } else if (roll < 58) {
        give(player, RUBY, 2);
        give(player, DIAMOND, 2);
    } else if (roll < 70) {
        give(player, RUNITE_BAR, 3);
    } else if (roll < 80) {
        give(player, COINS, 750);
        give(player, Math.random() < 0.5 ? KEY_HALF_LOOP : KEY_HALF_TOOTH, 1);
    } else if (roll < 90) {
        give(player, CERT_IRON_ORE, 150);
    } else if (roll < 100) {
        give(player, CERT_COAL, 100);
    } else if (roll < 108) {
        give(player, RAW_SWORDFISH, 5);
        give(player, COINS, 1000);
    } else if (roll < 110) {
        give(player, ADAMANT_SQ, 1);
    } else if (roll < 111) {
        const female = (player.appearance?.gender ?? 0) === 1;
        give(player, female ? RUNE_PLATESKIRT : RUNE_PLATELEGS, 1);
    }
}

function lockedMessage(event: LocInteractionEvent): void {
    event.services.messaging.sendGameMessage(event.player, "This chest is securely locked shut.");
}

function openWithKey(
    player: PlayerState,
    services: ScriptServices,
    tile: { x: number; y: number },
    level: number,
): void {
    if (!player.items.hasItem(CRYSTAL_KEY, 1)) {
        services.messaging.sendGameMessage(player, "This chest is securely locked shut.");
        return;
    }

    player.items.removeItem(CRYSTAL_KEY, 1, { assureFullRemoval: true });
    services.messaging.sendGameMessage(player, "You unlock the chest with your key.");
    services.messaging.sendGameMessage(player, "You find some treasure in the chest!");

    services.location.emitLocChange(CHEST_CLOSED, CHEST_OPEN, tile, level);
    setTimeout(() => {
        services.location.emitLocChange(CHEST_OPEN, CHEST_CLOSED, tile, level);
    }, 1200);

    rollLoot(player);
    services.inventory.snapshotInventory(player);
}

function joinKeyHalves(event: ItemOnItemEvent): void {
    const { player, services } = event;
    if (!player.items.hasItem(KEY_HALF_LOOP, 1) || !player.items.hasItem(KEY_HALF_TOOTH, 1)) {
        return;
    }
    player.items.removeItem(KEY_HALF_LOOP, 1, { assureFullRemoval: true });
    player.items.removeItem(KEY_HALF_TOOTH, 1, { assureFullRemoval: true });
    player.items.addItem(CRYSTAL_KEY, 1);
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(player, "You join the two halves of the key together.");
}

export function registerCrystalChestHandlers(registry: IScriptRegistry): void {
    registry.registerLocInteraction(CHEST_CLOSED, lockedMessage, "open");
    registry.registerLocInteraction(CHEST_CLOSED, lockedMessage, undefined);
    registry.registerItemOnLoc(CRYSTAL_KEY, CHEST_CLOSED, (event: ItemOnLocEvent) => {
        openWithKey(event.player, event.services, event.target.tile, event.target.level);
    });

    registry.registerItemOnItem(KEY_HALF_LOOP, KEY_HALF_TOOTH, joinKeyHalves);
}
