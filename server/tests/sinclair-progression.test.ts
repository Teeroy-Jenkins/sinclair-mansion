// Progression saved in the browser (coins, cosmetics, bank) carries from server to server, and a
// save can't bring game items (murder weapons, chore tools, sharks) out of a game.
import assert from "node:assert/strict";

import { applyProgress, exportProgress, parseProgress, type ProgressIO } from "../gamemodes/sinclair-mansion/progression";
import { COSMETIC_IDS, COSMETIC_SHOP } from "../gamemodes/sinclair-mansion/cosmetics";
import type { BankSnapshotEntry, PlayerState } from "../src/game/player";

const COINS = 995;
const PARTYHAT = 1038;
const SANTA = 1050;
const SHARK = 385;

/** A player with a pack, worn items and a bank, and the IO the gamemode gives progression.ts. */
function fakePlayer() {
    const pack = Array.from({ length: 28 }, () => ({ itemId: -1, quantity: 0 }));
    const equip = { ids: new Array<number>(14).fill(-1), qty: new Array<number>(14).fill(0) };
    let bank: BankSnapshotEntry[] = [];
    const player = {
        bank: { exportBankSnapshot: () => bank.slice(), loadBankSnapshot: (e: BankSnapshotEntry[]) => { bank = [...e]; } },
    } as unknown as PlayerState;
    const io: ProgressIO = {
        pack: () => pack,
        setPackSlot: (_p, slot, itemId, quantity) => { pack[slot] = { itemId, quantity }; },
        addToPack: (_p, itemId, quantity) => {
            const free = pack.findIndex((e) => e.itemId <= 0);
            if (free < 0) return false;
            pack[free] = { itemId, quantity };
            return true;
        },
        equip: () => equip,
        refresh: () => {},
    };
    return { player, io, pack, equip, bank: () => bank };
}

// The store sells 40 cosmetics, all of them protected as cosmetics.
assert.equal(COSMETIC_SHOP.stock.length, 40, "the shop interface shows 40 slots");
assert.ok(COSMETIC_SHOP.stock.every((s) => COSMETIC_IDS.has(s.itemId) && (s.price ?? 0) > 0), "every stock item is a priced cosmetic");

// One server: coins, a party hat in the pack, a santa hat worn, coins and a hat in the bank; a shark is a game item.
const a = fakePlayer();
a.pack[0] = { itemId: COINS, quantity: 1234 };
a.pack[3] = { itemId: PARTYHAT, quantity: 1 };
a.pack[5] = { itemId: SHARK, quantity: 1 };
a.equip.ids[0] = SANTA;
a.equip.qty[0] = 1;
a.player.bank.loadBankSnapshot([
    { slot: 0, itemId: COINS, quantity: 50_000, placeholder: false, filler: false, tab: 0 },
    { slot: 1, itemId: 1042, quantity: 1, placeholder: false, filler: false, tab: 0 },
]);
const saved = exportProgress("bob", a.player, a.io);
assert.deepEqual(saved.pack, [[0, COINS, 1234], [3, PARTYHAT, 1]], "game items aren't saved");
assert.deepEqual(saved.worn, [[0, SANTA]]);
assert.equal(saved.bank.length, 2);

// Through the browser (JSON) to another server, where Bob has 10 coins from before.
const b = fakePlayer();
b.pack[0] = { itemId: COINS, quantity: 10 };
const parsed = parseProgress(JSON.parse(JSON.stringify(saved)));
assert.ok(parsed, "a save parses");
applyProgress(b.player, parsed!, b.io);
assert.deepEqual(b.pack[0], { itemId: COINS, quantity: 1234 }, "the browser's coins replace this server's");
assert.deepEqual(b.pack[3], { itemId: PARTYHAT, quantity: 1 });
assert.equal(b.equip.ids[0], SANTA, "worn cosmetics come too");
assert.deepEqual(b.bank().map((e) => [e.itemId, e.quantity]), [[COINS, 50_000], [1042, 1]], "and the bank");

// A doctored save can't bring game items, bad slots or stacks of hats.
const forged = parseProgress({
    v: 1, name: "bob",
    pack: [[0, SHARK, 1], [1, PARTYHAT, 99], [40, COINS, 5], [2, COINS, -3]],
    worn: [[0, 4151]],
    bank: [{ slot: 0, itemId: 13652, quantity: 1, tab: 0 }],
});
assert.deepEqual(forged?.pack, [[1, PARTYHAT, 1]], "only cosmetics and coins, one hat per slot, sane slots and amounts");
assert.deepEqual(forged?.worn, [], "no worn whip");
assert.deepEqual(forged?.bank, [], "no banked dragon claws");
assert.equal(parseProgress({ v: 2, pack: [], worn: [], bank: [] }), undefined, "another version isn't read");
assert.equal(parseProgress("nonsense"), undefined);

// Something already in a saved item's place: it goes to another pack slot, else the bank.
const c = fakePlayer();
for (let i = 0; i < 28; i++) c.pack[i] = { itemId: SHARK, quantity: 1 };
c.equip.ids[0] = 10828; // a helm the game put on
applyProgress(c.player, parsed!, c.io);
assert.equal(c.equip.ids[0], 10828, "game gear isn't taken off");
assert.ok(c.bank().some((e) => e.itemId === SANTA) && c.bank().some((e) => e.itemId === PARTYHAT), "full pack: to the bank");

console.log("sinclair progression: ok");
