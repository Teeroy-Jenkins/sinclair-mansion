// Your progression (coins, cosmetics in your pack and worn, and your bank) lives in your own
// browser, so it goes with you to any copy of the game you play on (a friend's room, the LAN,
// PeerJS). Each new session asks for it (`hud.progressWanted`), the client answers with a
// "sinclair_progress" message, and every change comes back in `hud.progress` for the browser to
// save. Game items never leave the game: only coins and cosmetics are carried.
//
// The save is the player's own data, so it is trusted as far as it is well formed (each copy
// of the game is somebody's own server anyway): ids must be coins or cosmetics, amounts sane.
import type { BankSnapshotEntry, PlayerState } from "../../src/game/player";
import { COINS, isCosmetic } from "./store";

export const PROGRESS_VERSION = 1;
const MAX_STACK = 2_147_483_647;
const PACK_SLOTS = 28;
const EQUIP_SLOTS = 14;

export interface Progress {
    v: number;
    /** Lowercase name: the browser keeps one save per name. */
    name: string;
    /** [slot, item id, quantity] of the coins and cosmetics in your pack. */
    pack: Array<[number, number, number]>;
    /** [equipment slot, item id] of the cosmetics you wear. */
    worn: Array<[number, number]>;
    bank: BankSnapshotEntry[];
}

/** How progression reaches a player's pack, gear and bank. */
export interface ProgressIO {
    pack(player: PlayerState): Array<{ itemId: number; quantity: number }>;
    setPackSlot(player: PlayerState, slot: number, itemId: number, quantity: number): void;
    addToPack(player: PlayerState, itemId: number, quantity: number): boolean;
    equip(player: PlayerState): { ids: number[]; qty: number[] };
    /** Send the pack and re-dress after direct changes. */
    refresh(player: PlayerState): void;
}

const carried = (itemId: number) => itemId === COINS || isCosmetic(itemId);
const int = (v: unknown, min: number, max: number): number | undefined =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

export function exportProgress(name: string, player: PlayerState, io: ProgressIO): Progress {
    const pack: Progress["pack"] = [];
    io.pack(player).forEach((e, slot) => {
        if (e.itemId > 0 && e.quantity > 0 && carried(e.itemId)) pack.push([slot, e.itemId, e.quantity]);
    });
    const worn: Progress["worn"] = [];
    io.equip(player).ids.forEach((id, slot) => {
        if (id > 0 && isCosmetic(id)) worn.push([slot, id]);
    });
    const bank = player.bank.exportBankSnapshot().filter((e) => carried(e.itemId));
    return { v: PROGRESS_VERSION, name, pack, worn, bank };
}

/** A save from the browser, checked; undefined when it isn't one. */
export function parseProgress(raw: unknown): Progress | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const r = raw as Record<string, unknown>;
    if (r.v !== PROGRESS_VERSION || !Array.isArray(r.pack) || !Array.isArray(r.worn) || !Array.isArray(r.bank)) return undefined;
    const pack: Progress["pack"] = [];
    for (const e of r.pack) {
        if (!Array.isArray(e)) continue;
        const slot = int(e[0], 0, PACK_SLOTS - 1);
        const id = int(e[1], 1, MAX_STACK);
        const qty = int(e[2], 1, MAX_STACK);
        if (slot === undefined || id === undefined || qty === undefined || !carried(id)) continue;
        pack.push([slot, id, id === COINS ? qty : 1]);
    }
    const worn: Progress["worn"] = [];
    for (const e of r.worn) {
        if (!Array.isArray(e)) continue;
        const slot = int(e[0], 0, EQUIP_SLOTS - 1);
        const id = int(e[1], 1, MAX_STACK);
        if (slot !== undefined && id !== undefined && isCosmetic(id)) worn.push([slot, id]);
    }
    const bank: BankSnapshotEntry[] = [];
    for (const e of r.bank as Array<Record<string, unknown>>) {
        const slot = int(e?.slot, 0, 1409);
        const itemId = int(e?.itemId, 1, MAX_STACK);
        const quantity = int(e?.quantity, 0, MAX_STACK);
        if (slot === undefined || itemId === undefined || quantity === undefined || !carried(itemId)) continue;
        bank.push({ slot, itemId, quantity, placeholder: e.placeholder === true, filler: false, tab: int(e.tab, 0, 9) ?? 0 });
    }
    return { v: PROGRESS_VERSION, name: typeof r.name === "string" ? r.name : "", pack, worn, bank };
}

/**
 * Puts a save on a player who is between games: their coins and cosmetics (carried, worn and
 * banked) become the save's. Anything else they hold is left alone.
 */
export function applyProgress(player: PlayerState, save: Progress, io: ProgressIO): void {
    const pack = io.pack(player);
    for (let slot = 0; slot < Math.min(PACK_SLOTS, pack.length); slot++) {
        if (carried(pack[slot]?.itemId ?? -1)) io.setPackSlot(player, slot, -1, 0);
    }
    const later: Array<[number, number]> = [];
    for (const [slot, id, qty] of save.pack) {
        if ((io.pack(player)[slot]?.itemId ?? -1) > 0) later.push([id, qty]);
        else io.setPackSlot(player, slot, id, qty);
    }
    const { ids, qty } = io.equip(player);
    for (let slot = 0; slot < Math.min(EQUIP_SLOTS, ids.length); slot++) {
        if (isCosmetic(ids[slot])) {
            ids[slot] = -1;
            qty[slot] = 0;
        }
    }
    for (const [slot, id] of save.worn) {
        if (ids[slot] > 0) later.push([id, 1]);
        else {
            ids[slot] = id;
            qty[slot] = 1;
        }
    }
    // Whatever doesn't fit where it was goes to the pack, else the bank.
    const bank = save.bank.slice();
    for (const [id, amount] of later) {
        if (!io.addToPack(player, id, amount)) bank.push({ slot: nextFreeSlot(bank), itemId: id, quantity: amount, placeholder: false, filler: false, tab: 0 });
    }
    player.bank.loadBankSnapshot(bank);
    io.refresh(player);
}

/** Put an item in the bank, in the first empty slot (main tab). */
export function bankItem(player: PlayerState, itemId: number, quantity: number): void {
    const bank = player.bank.exportBankSnapshot();
    player.bank.loadBankSnapshot([...bank, { slot: nextFreeSlot(bank), itemId, quantity, placeholder: false, filler: false, tab: 0 }]);
}

function nextFreeSlot(bank: BankSnapshotEntry[]): number {
    const used = new Set(bank.map((e) => e.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    return slot;
}
