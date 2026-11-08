// Rules tests for the sinclair-mansion gamemode, run against a fake engine.
// Usage (from server/): yarn tsx tests/sinclair-mansion.test.ts
import assert from "node:assert/strict";

import { createBotBrain, typingSec, type BotMover } from "../gamemodes/sinclair-mansion/bots";
import { butlerShop, CHORE_TOKEN, DEMON_BUTLER, WARE_ITEM, warePrice } from "../gamemodes/sinclair-mansion/butler";
import { MURDER_CONFIG as C, secToTicks } from "../gamemodes/sinclair-mansion/config";
import { CRIME_SCENES, ITEMS, LAYOUT, roomAt, TASKS, WEAPON_POOL } from "../gamemodes/sinclair-mansion/mansion";
import { COINS, MurderGame, PrintSet, type CutsceneShot, type GameIO, type Participant, type QuestScroll, type Tile } from "../gamemodes/sinclair-mansion/MurderGame";
import { normalizeRoomCode, RoomManager } from "../gamemodes/sinclair-mansion/rooms";
import { CHUNK_BYTES, FrameReader, toFrames } from "../../client/network/peer/PeerFrames";
import { MatchmakingRegistry, sanitizeEntry } from "../src/matchmaking/registry";

// Players never pick roles, but the tests do, to set up each case.
C.lobby.allowRolePick = true;

type World = {
    game: MurderGame;
    pos: Map<string, Tile>;
    items: Map<string, number[]>;
    inbox: Map<string, string[]>;
    announcements: string[];
    choices: Map<string, (i: number) => void>;
    said: string[];
    scenes: Tile[];
    coins: Map<string, number>;
    tokens: Map<string, number>;
    worn: Map<string, number[]>;
    scrolls: Map<string, QuestScroll>;
    chimes: { n: number };
    wielded: Map<string, number>;
    killMarks: Tile[];
    closed: string[];
    ground: Array<{ id: number; qty: number; tile: Tile }>;
    mover: BotMover;
    frozen: Set<string>;
    anims: Array<{ key: string; kind: string; anim?: string; elapsed: number }>;
    shots: Array<{ key: string; shot: CutsceneShot }>;
    dialogs: Map<string, string[][]>;
    cameraReset: string[];
};

function makeWorld(opts: { humans?: string[]; pickFirst?: boolean; keepIntro?: boolean } = {}): World {
    const pos = new Map<string, Tile>();
    const items = new Map<string, number[]>();
    const inbox = new Map<string, string[]>();
    const announcements: string[] = [];
    const choices = new Map<string, (i: number) => void>();
    const said: string[] = [];
    const scenes: Tile[] = [];
    const coins = new Map<string, number>();
    const tokens = new Map<string, number>();
    const worn = new Map<string, number[]>();
    const statsOf = new Map<string, unknown>();
    const scrolls = new Map<string, QuestScroll>();
    const chimes = { n: 0 };
    const killMarks: Tile[] = [];
    const closed: string[] = [];
    const ground: Array<{ id: number; qty: number; tile: Tile }> = [];
    const wielded = new Map<string, number>();
    const frozen = new Set<string>();
    const anims: World["anims"] = [];
    const shots: World["shots"] = [];
    const dialogs = new Map<string, string[][]>();
    const cameraReset: string[] = [];
    const io: GameIO = {
        pos: (p) => pos.get(p.key),
        roomAt,
        message: (p, t) => inbox.set(p.key, [...(inbox.get(p.key) ?? []), t]),
        announce: (t) => announcements.push(t),
        say: (p, t) => said.push(`${p.name}: ${t}`),
        giveItem: (p, id, qty = 1) => {
            if (id === COINS) coins.set(p.key, (coins.get(p.key) ?? 0) + qty);
            else if (id === CHORE_TOKEN) tokens.set(p.key, (tokens.get(p.key) ?? 0) + qty);
            else items.set(p.key, [...(items.get(p.key) ?? []), id]);
            return true;
        },
        removeItem: (p, id) => {
            const list = items.get(p.key) ?? [];
            const i = list.indexOf(id);
            if (i < 0) return false;
            list.splice(i, 1);
            return true;
        },
        takeCoins: (p, amount) => {
            const have = coins.get(p.key) ?? 0;
            const take = Math.min(have, amount);
            coins.set(p.key, have - take);
            return take;
        },
        hasItem: (p, id) => (items.get(p.key) ?? []).includes(id),
        listItems: (p) => [...(items.get(p.key) ?? [])],
        wielding: (p) => wielded.get(p.key),
        itemName: (id) => WEAPON_POOL.find((w) => w.itemId === id)?.name ?? `item${id}`,
        spawnGround: (id, t, qty = 1) => ground.push({ id, qty, tile: { ...t } }),
        removeGround: (id, t) => {
            const i = ground.findIndex((g) => g.id === id && g.tile.x === t.x && g.tile.y === t.y && g.tile.level === t.level);
            if (i >= 0) ground.splice(i, 1);
        },
        dropAll: (p, t) => {
            const all = [...(items.get(p.key) ?? []), ...(worn.get(p.key) ?? [])];
            for (const id of all) ground.push({ id, qty: 1, tile: { ...t } });
            items.set(p.key, []);
            worn.set(p.key, []);
            return all;
        },
        teleport: (p, t) => pos.set(p.key, { ...t }),
        setFrozen: (p, on) => (on ? frozen.add(p.key) : frozen.delete(p.key)),
        makeGhost: () => {},
        restore: (p) => {
            items.set(p.key, []);
            tokens.delete(p.key);
        },
        rejoin: (p, at) => {
            if (at) pos.set(p.key, { ...at });
        },
        animate: (p, kind, anim, elapsed = 0) => anims.push({ key: p.key, kind, anim, elapsed }),
        cutscene: (p, shot) => shots.push({ key: p.key, shot }),
        endCutscene: (p) => cameraReset.push(p.key),
        dialog: (p, lines) => dialogs.set(p.key, [...(dialogs.get(p.key) ?? []), lines]),
        choose: (p, _t, _o, cb) => {
            if (process.env.DEBUG_CHOICES) console.log("choose", p.name, _t, _o);
            choices.set(p.key, cb);
            if (opts.pickFirst && p.isBot) cb(0);
        },
        fadeOut: () => {},
        closeDialog: (p) => closed.push(p.key),
        fadeIn: () => {},
        face: () => {},
        clearDrops: () => {},
        markKill: (t) => killMarks.push({ ...t }),
        clearKillMarks: () => killMarks.splice(0),
        setCrimeScene: (t, on) => {
            if (on) scenes.push(t);
        },
        setupCombat: (p, stats, wear, carry) => {
            statsOf.set(p.key, stats);
            worn.set(p.key, wear.filter((id) => id > 0));
            items.set(p.key, [...(items.get(p.key) ?? []), ...carry]);
        },
        heal: () => {},
        restoreRun: () => {},
        chime: () => {
            chimes.n++;
        },
        stopCombat: () => {},
        takeKit: (p) => {
            const kit = [...(worn.get(p.key) ?? []), ...(items.get(p.key) ?? []).filter((id) => id === ITEMS.flypaper || id === C.pvp.dragonClaws)];
            worn.set(p.key, []);
            items.set(p.key, (items.get(p.key) ?? []).filter((id) => id !== ITEMS.flypaper && id !== C.pvp.dragonClaws));
            return kit;
        },
        giveKit: (p, kit) => items.set(p.key, [...(items.get(p.key) ?? []), ...kit]),
        questScroll: (p, s) => scrolls.set(p.key, s),
        clearGroundItems: () => {
            ground.splice(0);
        },
    };
    const game = new MurderGame(io, LAYOUT);
    // The opening cutscene has its own test: everywhere else, start() lands in the first round.
    const start = game.start.bind(game);
    game.start = (byKey, total) => {
        const error = start(byKey, total);
        if (!opts.keepIntro) while (game.phase === "intro") game.update();
        return error;
    };
    let botId = 0;
    game.botNames = ["Anna", "Bob", "Carol", "David", "Elizabeth", "Frank", "Donovan", "Pierre", "Hobbes", "Louisa"];
    game.spawnBot = () => `b:${++botId}`;
    const adjacentTo = (c: { tile: Tile; w: number }) => ({ x: c.tile.x - 1, y: c.tile.y, level: c.tile.level });
    const mover: BotMover = {
        approachContainer: (p, c) => (pos.set(p.key, adjacentTo(c)), true),
        approachPerson: (p, q) => {
            const at = pos.get(q.key);
            if (at) pos.set(p.key, { ...at, x: at.x + 1 });
            return !!at;
        },
        approachTile: (p, t) => (pos.set(p.key, { ...t, x: t.x + 1 }), true),
        walkTo: (p, t) => (pos.set(p.key, { ...t }), true),
        isMoving: () => false,
        randomTile: () => ({ x: 2740, y: 3574, level: 0 }),
        attack: () => false, // the fake world has no fights; their engine side is tested in-game
        hitpoints: () => ({ now: 10, max: 10 }),
        attackers: () => [],
        target: () => undefined,
        wield: (p, id) => {
            if (!(items.get(p.key) ?? []).includes(id)) return false;
            wielded.set(p.key, id);
            return true;
        },
        unwield: (p) => wielded.delete(p.key),
        weaponPower: (id) => (id === C.pvp.dragonClaws ? 3630 : id),
        use: (p, id) => io.removeItem(p, id),
        bind: () => true,
        special: () => {},
        specialEnergy: () => 100,
        run: () => {},
        tokens: (p) => tokens.get(p.key) ?? 0,
        buy: (p, ware) => {
            const have = tokens.get(p.key) ?? 0;
            const price = warePrice(ware, game.participants.size);
            if (have < price) return false;
            tokens.set(p.key, have - price);
            if (ware === "runes") for (const [id, qty] of C.rewards.runes) io.giveItem(p, id, qty);
            else io.giveItem(p, WARE_ITEM[ware]);
            return true;
        },
    };
    const brain = createBotBrain(mover);
    game.botThink = brain.think;
    game.onObserve = (q, ev) => brain.observe(game, q, ev);
    game.onActivity = (p, text) => brain.activity(game, p, text);
    for (const name of opts.humans ?? ["Host"]) game.join(`p:${name}`, name);
    return { game, pos, items, inbox, announcements, choices, said, scenes, coins, tokens, worn, statsOf, scrolls, chimes, wielded, killMarks, closed, ground, mover, frozen, anims, shots, dialogs, cameraReset };
}

const ticksFor = (sec: number) => Math.ceil((sec * 1000) / 600) + 2;
const run = (g: MurderGame, n: number) => {
    for (let i = 0; i < n && g.phase !== "gameover"; i++) g.update();
};
let passed = 0;
const check = (name: string, fn: () => void) => {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
};
const realWeapon = (w: World) => w.game.weapons.find((x) => x.real)!;

check("print sets are unordered (sorted), deduplicated, timestamp-free", () => {
    const s = new PrintSet();
    ["Zed", "Amy", "Mo", "Amy"].forEach((n) => s.add(n));
    assert.deepEqual(s.list(), ["Amy", "Mo", "Zed"]);
});

check("every container is in a named room, on both floors and in the garden", () => {
    const w = makeWorld();
    const rooms = new Set([...w.game.containers.values()].map((c) => c.room));
    for (const r of ["Kitchen", "Garden", "Library", "Frank's Room", "Vegetable Patch"]) assert.ok(rooms.has(r), r);
});

check("every chore step targets a real spot, and every chore is reachable from its first item", () => {
    for (const t of TASKS) {
        assert.ok(t.steps.length > 0, t.id);
        for (const s of t.steps) {
            if (s.fetch !== undefined) assert.ok(LAYOUT.itemSpawns.some((i) => i.itemId === s.fetch && (i.tiles?.length || i.in?.length)), `${t.id}: nowhere to find ${s.fetch}`);
            else if (s.mix !== undefined) assert.ok(s.use !== undefined, `${t.id}: a mix step needs two items`);
            else assert.ok(LAYOUT.containers.some((c) => c.id === s.c), `${t.id}: ${s.c}`);
        }
    }
});

check("roles: 1 detective, 1 murderer with a random pool weapon; decoys hidden, unprinted", () => {
    const seen = new Set<number>();
    for (const n of [4, 6, 8, 10, 6, 6, 6, 6]) {
        const w = makeWorld();
        assert.equal(w.game.start("p:Host", n), undefined);
        const all = [...w.game.participants.values()];
        assert.equal(all.length, n);
        assert.equal(all.filter((p) => p.role === "detective").length, 1);
        const murderers = all.filter((p) => p.role === "murderer");
        assert.equal(murderers.length, 1);
        const real = realWeapon(w);
        seen.add(real.itemId);
        assert.deepEqual(real.prints.list(), [murderers[0].name]);
        assert.ok(w.items.get(murderers[0].key)?.includes(real.itemId));
        const decoys = w.game.weapons.filter((x) => !x.real);
        const household = all.filter((p) => p.role === "npc").length;
        assert.equal(decoys.length, Math.max(1, Math.floor(household / 2)), `${n} players: red herrings for ${household} household`);
        for (const d of decoys) {
            assert.equal(d.at.kind, "container");
            assert.equal(d.prints.size, 0);
        }
        assert.ok(w.items.get(w.game.detective()!.key)?.includes(ITEMS.flypaper));
    }
    assert.ok(seen.size > 1, "the murder weapon varies between games");
});

check("leaving mid-game counts as dying: the household member drops everything, and comes back a ghost", () => {
    const w = makeWorld({ humans: ["Host", "Guest"] });
    w.game.setRolePref(w.game.participants.get("p:Guest")!, "npc");
    w.game.setRolePref(w.game.participants.get("p:Host")!, "murderer");
    w.game.start("p:Host", 6);

    const guest = w.game.participants.get("p:Guest")!;
    assert.equal(guest.role, "npc");
    w.pos.set(guest.key, { x: 2740, y: 3575, level: 0 });
    w.game.leave(guest.key);
    assert.ok(!guest.alive && guest.away, "dead at once, seat kept for the game");
    assert.ok(w.announcements.some((a) => a.includes("Guest has left the mansion")));
    assert.notEqual(w.game.phase, "gameover", "the game goes on");
    assert.equal(w.game.join(guest.key, "Guest"), guest, "logging back in finds the same seat");
    assert.ok(!guest.alive && !guest.away, "...as a ghost");
});

check("the Murderer leaving mid-game is the Murderer caught: the game ends with no rewards", () => {
    const w = makeWorld({ humans: ["Host", "Guest"] });
    w.game.setRolePref(w.game.participants.get("p:Guest")!, "murderer");
    w.game.start("p:Host", 6);

    const guest = w.game.participants.get("p:Guest")!;
    assert.equal(guest.role, "murderer");
    w.game.leave(guest.key);
    assert.equal(w.game.phase, "gameover");
    assert.equal(w.game.winner, "detective");
    assert.ok(w.announcements.some((a) => /caught fleeing/.test(a)));
    for (const p of w.game.participants.values()) assert.ok(!p.earned.some((d) => /Solved|Justice|Got away/.test(d.reason)), `${p.name} got a win bonus`);
    assert.ok(!w.game.participants.has(guest.key), "their seat is let go when the game ends");
});

check("lobby: host it (name, password, cap, bots), join with the password, start, hand over, close", () => {
    const w = makeWorld({ humans: [] });
    const g = w.game;
    assert.equal(g.lobbyView("p:Ann"), undefined, "nothing hosted yet");
    assert.equal(g.joinLobby("p:Ann", "Ann"), "Nobody is hosting a game yet.");
    assert.equal(g.hostLobby("p:Ann", "Ann", { name: "  Ann's   party ", password: "pw", maxPlayers: 20, fillWithBots: false }), undefined);
    assert.equal(g.hostKey, "p:Ann");
    const view = g.lobbyView("p:Bob")!;
    assert.deepEqual([view.name, view.host, view.maxPlayers, view.locked, view.joined, view.fillWithBots], ["Ann's party", "Ann", C.lobby.maxPlayers, true, false, false], `cap is ${C.lobby.maxPlayers}`);
    assert.ok(!JSON.stringify(g.visitorHud("p:Bob")).includes("pw"), "the password never goes to the client");
    assert.equal(g.hostLobby("p:Bob", "Bob", {}), "There's already a game here. Join it instead.");
    assert.equal(g.joinLobby("p:Bob", "Bob", "nope"), "Wrong password.");
    assert.equal(g.joinLobby("p:Bob", "Bob", "pw"), undefined);
    assert.ok(g.lobbyView("p:Bob")!.joined);
    // Bots off: the people who joined must make up the numbers.
    assert.equal(g.configureLobby("p:Bob", { maxPlayers: 6 }), "Only the host can change the game.");
    assert.match(g.start("p:Ann") ?? "", /Need at least 4 players/);
    assert.equal(g.configureLobby("p:Ann", { maxPlayers: 4, fillWithBots: true }), undefined);
    assert.ok(g.lobbyView("p:Ann")!.canStart);
    for (const n of ["Cat", "Dan"]) assert.equal(g.joinLobby(`p:${n}`, n, "pw"), undefined);
    assert.equal(g.joinLobby("p:Eve", "Eve", "pw"), "That game is full.");
    assert.equal(g.configureLobby("p:Ann", { maxPlayers: 3 }), undefined, "never below 4");
    assert.equal(g.lobbyView("p:Ann")!.maxPlayers, 4);
    // The host leaves: the next person takes over; the last one out closes the lobby.
    g.leaveLobby("p:Ann");
    assert.equal(g.hostKey, "p:Bob");
    for (const k of ["p:Bob", "p:Cat", "p:Dan"]) g.leaveLobby(k);
    assert.equal(g.lobby, undefined);
    assert.equal(g.hostLobby("p:Eve", "Eve", {}), undefined, "anyone can host again");
});

check("rooms: host gets a code, friends join by it, one room per mansion, host hand-over, empty rooms close", () => {
    const w = makeWorld({ humans: [] });
    const codes = ["AAAAAA", "AAAAAA", "BBBBBB"];
    const rooms = new RoomManager([w.game], () => codes.shift() ?? "CCCCCC");
    assert.equal(rooms.join("p:Ann", "Ann", undefined).error, "Nobody is hosting a game yet.");
    const hosted = rooms.host("p:Ann", "Ann", { name: "Ann's game", password: "pw" });
    assert.equal(hosted.error, undefined);
    assert.equal(w.game.lobby!.roomCode, "AAAAAA");
    assert.equal(rooms.find("aaa-aaa"), w.game, "codes are case- and dash-insensitive");
    assert.equal(rooms.roomOf("p:Ann"), w.game);
    assert.match(rooms.host("p:Ann", "Ann", {}).error ?? "", /already in "Ann's game"/, "one room per player");
    assert.match(rooms.host("p:Bob", "Bob", {}).error ?? "", /already hosting "Ann's game" \(room AAAAAA\)/, "one room per mansion");
    assert.match(rooms.join("p:Bob", "Bob", "ZZZZZZ", "pw").error ?? "", /no game with room code ZZZZZZ/);
    assert.equal(rooms.join("p:Bob", "Bob", "AAAAAA", "nope").error, "Wrong password.");
    assert.equal(rooms.join("p:Bob", "Bob", "AAAAAA", "pw").error, undefined);
    assert.equal(rooms.join("p:Cat", "Cat", undefined, "pw").error, undefined, "no code: the only room here");
    assert.deepEqual(rooms.list(), [{ roomCode: "AAAAAA", name: "Ann's game", host: "Ann", players: 3, maxPlayers: C.lobby.defaultTotalPlayers, locked: true, inGame: false }]);
    assert.ok(!JSON.stringify(rooms.list()).includes("pw"), "listings never carry the password");
    // The host leaves: the next person hosts. Everyone gone: the room closes, its code with it.
    assert.equal(rooms.leave("p:Ann"), undefined);
    assert.equal(rooms.roomOf("p:Ann"), undefined);
    assert.equal(w.game.hostKey, "p:Bob");
    rooms.leave("p:Bob");
    rooms.disconnect("p:Cat"); // dropped between games: out at once
    assert.equal(rooms.rooms().length, 0);
    assert.equal(rooms.find("AAAAAA"), undefined);
    assert.equal(rooms.host("p:Dan", "Dan", {}).error, undefined, "anyone can host again");
    assert.equal(w.game.lobby!.roomCode, "AAAAAA", "a closed room's code is free again");
    // With two mansions, a taken code is re-rolled (Impostor retries its code factory).
    const two = new RoomManager([makeWorld({ humans: [] }).game, makeWorld({ humans: [] }).game], () => codes.shift() ?? "CCCCCC");
    codes.splice(0, codes.length, "DDDDDD", "DDDDDD", "EEEEEE");
    two.host("p:Ann", "Ann", {});
    assert.equal(two.host("p:Bob", "Bob", {}).game?.lobby?.roomCode, "EEEEEE");
    assert.equal(normalizeRoomCode(" bbb bbb "), "BBBBBB");
    assert.equal(normalizeRoomCode("ABC"), undefined);
});

check("rooms: a dropped player keeps their seat mid-game; a room nobody came back to closes after the game", () => {
    const w = makeWorld({ humans: [] });
    const despawned: string[] = [];
    w.game.despawnBot = (p) => despawned.push(p.key);
    const rooms = new RoomManager([w.game]);
    rooms.host("p:Ann", "Ann", { maxPlayers: 5, fillWithBots: true });
    w.game.setRolePref(w.game.participants.get("p:Ann")!, "npc"); // a Murderer leaving would end the game
    assert.equal(w.game.start("p:Ann"), undefined);
    rooms.disconnect("p:Ann");
    assert.equal(rooms.roomOf("p:Ann"), w.game, "still seated (as a ghost) until the game ends");
    rooms.closeEmpty();
    assert.ok(w.game.lobby, "a running game isn't closed under anyone");
    w.game.participants.get("p:Ann")!.isBot = true; // the grace ran out: a sleeper now
    w.game.phase = "gameover";
    rooms.closeEmpty();
    assert.equal(w.game.lobby, undefined);
    assert.equal(w.game.phase, "lobby");
    assert.equal(w.game.participants.size, 0);
    assert.equal(despawned.filter((k) => k.startsWith("b:")).length, 4, "the bots went home");
    assert.equal(rooms.host("p:Bob", "Bob", {}).error, undefined, "the mansion is free for the next host");
});

check("PeerJS frames: big and small messages, binary and text, come back whole and in order", () => {
    const reader = new FrameReader();
    const big = new Uint8Array(CHUNK_BYTES * 3 + 123).map((_, i) => i % 251);
    const messages: Array<Uint8Array | string> = [new Uint8Array([7, 8, 9]), big, "hello é", new Uint8Array(0), "x".repeat(CHUNK_BYTES + 1)];
    const out: Array<ArrayBuffer | string> = [];
    for (const m of messages) {
        const frames = toFrames(m);
        const size = typeof m === "string" ? new TextEncoder().encode(m).length : m.length;
        assert.equal(frames.length, Math.max(1, Math.ceil(size / CHUNK_BYTES)), "one frame per chunk");
        assert.ok(frames.every((f) => f.length <= CHUNK_BYTES + 1), "no frame bigger than a chunk plus its header");
        for (const f of frames) {
            const whole = reader.push(f.slice().buffer);
            if (whole !== undefined) out.push(whole);
        }
    }
    assert.equal(out.length, messages.length);
    messages.forEach((m, i) => {
        if (typeof m === "string") assert.equal(out[i], m);
        else assert.deepEqual(new Uint8Array(out[i] as ArrayBuffer), m);
    });
    // A view into a bigger buffer only sends its own bytes.
    const backing = new Uint8Array([1, 2, 3, 4, 5]);
    assert.deepEqual(new Uint8Array(reader.push(toFrames(backing.subarray(1, 3))[0]) as ArrayBuffer), new Uint8Array([2, 3]));
});

check("matchmaking registry: heartbeats replace a server's rooms, codes resolve to its address, junk is refused", () => {
    const reg = new MatchmakingRegistry();
    const room = { roomCode: "QWERTY", name: "Far game", host: "Zed", players: 2, maxPlayers: 8, locked: false, inGame: false };
    reg.register(sanitizeEntry({ id: "far", address: "10.0.0.9:43594", name: "Far", lobbies: [room, { roomCode: "bad!" }] })!);
    assert.equal(reg.resolveRoomCode("qwerty"), "10.0.0.9:43594");
    assert.deepEqual(reg.getAllRooms(), [{ ...room, address: "10.0.0.9:43594", serverName: "Far" }], "malformed rooms are dropped");
    reg.register({ id: "far", address: "10.0.0.9:43594", name: "Far", lobbies: [] });
    assert.equal(reg.resolveRoomCode("QWERTY"), undefined, "a closed room drops off at the next heartbeat");
    reg.register({ id: "old", address: "10.0.0.8:43594", name: "Old", lobbies: [{ ...room, roomCode: "OLDOLD" }] }, Date.now() - 60_000);
    assert.equal(reg.resolveRoomCode("OLDOLD"), undefined, "servers that stopped heartbeating expire");
    assert.equal(sanitizeEntry({ name: "no address" }), undefined);
});

check("lobby: bots fill the empty seats up to the cap; with bots off only the people who joined play", () => {
    const w = makeWorld({ humans: [] });
    const g = w.game;
    g.hostLobby("p:Ann", "Ann", { maxPlayers: 9, fillWithBots: true });
    g.joinLobby("p:Bob", "Bob");
    assert.equal(g.start("p:Ann"), undefined);
    assert.equal(g.participants.size, 9);
    assert.equal([...g.participants.values()].filter((p) => !p.isBot).length, 2);

    const w2 = makeWorld({ humans: [] });
    const g2 = w2.game;
    g2.hostLobby("p:Ann", "Ann", { maxPlayers: C.lobby.maxPlayers, fillWithBots: false });
    for (const n of ["Bob", "Cat", "Dan", "Eve"]) g2.joinLobby(`p:${n}`, n);
    assert.equal(g2.start("p:Ann"), undefined);
    assert.equal(g2.participants.size, 5, "no bots");
    assert.ok([...g2.participants.values()].every((p) => !p.isBot));
});

check("the player count stays the same when someone leaves and rejoins mid-game (or a ghost drops in)", () => {
    const w = makeWorld({ humans: [] });
    const g = w.game;
    g.hostLobby("p:Ann", "Ann", { maxPlayers: 6, fillWithBots: true });
    for (const n of ["Bob", "Cat"]) g.joinLobby(`p:${n}`, n);
    assert.equal(g.start("p:Ann"), undefined);
    const host = g.participants.get("p:Ann")!;
    const seats = g.hudFor(host).players;
    assert.equal(seats, 6);
    const leaver = ["p:Bob", "p:Cat"].map((k) => g.participants.get(k)!).find((p) => p.role !== "murderer")!;
    g.leaveLobby(leaver.key); // Leave Lobby / Exit Game
    assert.equal(g.hudFor(host).players, seats, "leaving keeps the count");
    assert.equal(g.joinLobby(leaver.key, leaver.name), undefined);
    assert.equal(g.hudFor(host).players, seats, "rejoining as a ghost keeps the count");
    const other = ["p:Bob", "p:Cat"].map((k) => g.participants.get(k)!).find((p) => p.key !== leaver.key && p.role !== "murderer");
    if (other) {
        g.leave(other.key); // a dropped connection
        g.join(other.key, other.name); // back again
        assert.equal(g.hudFor(host).players, seats, "a dropped connection keeps the count");
    }
    g.joinLobby("p:Dan", "Dan"); // a newcomer watching as a ghost
    assert.equal(g.hudFor(host).players, seats, "a newcomer ghost isn't a player in this game");
});

check("role requests are honoured (and only the host can start)", () => {
    for (const role of ["detective", "murderer", "npc"] as const) {
        const w = makeWorld({ humans: ["Host", "Guest"] });
        w.game.setRolePref(w.game.participants.get("p:Host")!, role);
        assert.equal(w.game.start("p:Guest", 6), "Only the host can start the game.");
        w.game.start("p:Host", 6);
        assert.equal(w.game.participants.get("p:Host")!.role, role);
    }
});

function setup(hostRole: "detective" | "murderer" | "npc") {
    const w = makeWorld();
    const host = w.game.participants.get("p:Host")!;
    w.game.setRolePref(host, hostRole);
    w.game.start("p:Host", 6);
    w.game.botThink = undefined; // drive everyone by hand
    return { w, host };
}
const near = (w: World, p: Participant, containerId: string) => {
    const c = w.game.containers.get(containerId)!;
    w.pos.set(p.key, { x: c.tile.x - 1, y: c.tile.y, level: c.tile.level });
};

check("everyone but the Detective gets chores, empty-handed; the Murderer too", () => {
    const { w } = setup("murderer");
    for (const p of w.game.participants.values()) {
        if (p.role === "detective") {
            assert.equal(p.tasks.length, 0);
            continue;
        }
        assert.equal(p.tasks.length, C.tasks.atOnce, p.name);
        for (const t of p.tasks) assert.equal(t.def.steps[0].use, undefined, `${t.def.id} starts by fetching its tool`);
        assert.ok(!(w.items.get(p.key) ?? []).some((id) => w.game.toolIds.has(id)), `${p.name} starts with no chore items`);
    }
});

/** Do one step the way a player would: pick the item up off the floor, Pick a crop, or Use an item on the spot. */
const doStep = (w: World, p: Participant, s: (typeof TASKS)[number]["steps"][number]) => {
    if (s.fetch !== undefined) {
        const spot = w.game.nearestSpot(p, s.fetch)!;
        assert.ok(spot, `nowhere to find: ${s.fetch}`);
        if (spot.in) {
            // Kept in furniture: search it.
            near(w, p, spot.in);
            w.game.useContainer(p, spot.in);
            run(w.game, ticksFor(C.interact.searchSec));
            return;
        }
        w.game.io.removeGround(s.fetch, spot.tile); // the player's Take removes the stack
        w.game.pickUp(p, s.fetch, spot.tile);
        return;
    }
    if (s.mix !== undefined) {
        w.game.mixChore(p, s.use!, s.mix); // item on item, in the pack
        return;
    }
    near(w, p, s.c!);
    if (s.use === undefined) w.game.useContainer(p, s.c!);
    else w.game.doChore(p, s.c!, s.use);
    run(w.game, ticksFor(s.fade ? C.tasks.fadeSec : s.sec)); // a chore's long moment lasts the fade
};

check("nobody starts with food, runes or tokens; a finished chore pays a chore token per step, no reward window", () => {
    const { w, host } = setup("npc");
    const rewardIds = [C.rewards.shark, C.rewards.prayerPotion, ...C.rewards.runes.map(([id]) => id)];
    for (const p of w.game.participants.values()) {
        assert.ok(!(w.items.get(p.key) ?? []).some((id) => rewardIds.includes(id)), `${p.name} starts without food or runes`);
        assert.ok(!w.tokens.get(p.key), `${p.name} starts without chore tokens`);
    }
    // A decoy hidden in a chore's furniture would turn up (a choice), which isn't what this checks.
    for (const weapon of w.game.weapons) if (weapon.at.kind === "container") weapon.at = { kind: "gone" };
    let total = 0;
    for (const def of [TASKS.find((t) => t.id === "crest")!, TASKS.find((t) => t.id === "potatoes")!]) {
        w.items.set(host.key, []);
        run(w.game, ticksFor(C.items.respawnSec + 1)); // the last run's tools lie back where they were
        host.tasks = [{ def, step: 0 }];
        for (const s of def.steps) doStep(w, host, s);
        total += C.tokens.perStep * def.steps.length;
        assert.equal(w.tokens.get(host.key), total, `${def.id} paid ${def.steps.length} steps' worth of tokens`);
        assert.ok(!w.choices.has(host.key), "no reward window: rewards are bought from the Demon butler");
        assert.ok(!w.items.get(host.key)!.some((id) => rewardIds.includes(id)), "finishing a chore hands out no food or runes");
    }
});

check("the Demon butler's prices: stamina potion 1, runes 3, shark 6, potion 10, plus one per three members of the household", () => {
    for (const [household, add] of [[4, 1], [5, 1], [6, 2], [8, 2], [9, 3], [12, 4]]) {
        assert.equal(warePrice("stamina", household), 1 + add, `stamina potion, ${household} players`);
        assert.equal(warePrice("runes", household), 3 + add, `runes, ${household} players`);
        assert.equal(warePrice("shark", household), 6 + add, `shark, ${household} players`);
        assert.equal(warePrice("potion", household), 10 + add, `potion, ${household} players`);
    }
    // The shop sells exactly those, for chore tokens, at those prices, cheapest first.
    const shop = butlerShop(8);
    assert.equal(shop.currencyItemId, CHORE_TOKEN);
    assert.deepEqual(shop.stock.map((s) => [s.itemId, s.price]), [[WARE_ITEM.stamina, 3], [WARE_ITEM.runes, 5], [WARE_ITEM.shark, 8], [WARE_ITEM.potion, 12]]);
    assert.equal(roomAt(DEMON_BUTLER.tile), "Dining Room", "the butler waits in the dining room");
});

check("a bot spends its tokens with the Demon butler on what it lacks, the unarmed household Bind runes first", () => {
    const { w } = setup("detective");
    const bot = [...w.game.participants.values()].find((p) => p.isBot && p.role === "npc" && !w.game.weaponHeldBy(p))!;
    const brain = createBotBrain(w.mover);
    w.game.botThink = (g, p) => (p === bot ? brain.think(g, p) : undefined);
    bot.tasks = [];
    w.items.set(bot.key, []);
    const price = (ware: "runes" | "shark" | "potion") => warePrice(ware, w.game.participants.size);
    w.tokens.set(bot.key, price("runes"));
    assert.equal(brain.wantedWare(w.game, bot), "runes");
    w.tokens.set(bot.key, price("runes") - 1);
    assert.equal(brain.wantedWare(w.game, bot), undefined, "nothing it can afford");
    w.tokens.set(bot.key, price("runes") + price("shark") + price("potion"));
    for (let i = 0; i < 250 && w.tokens.get(bot.key); i++) run(w.game, 1);
    assert.equal(w.tokens.get(bot.key), 0, "it spent them all");
    for (const id of [C.rewards.shark, C.rewards.prayerPotion, ...C.rewards.runes.map(([id]) => id)]) {
        assert.ok(w.items.get(bot.key)!.includes(id), `it bought ${id}`);
    }
    assert.equal(brain.wantedWare(w.game, bot), undefined, "it has one of each");
});

check("every chore can be completed from empty hands by fetching, then using, its items in order", () => {
    for (const def of TASKS) {
        const { w, host } = setup("npc");
        w.items.set(host.key, []);
        host.tasks = [{ def, step: 0 }];
        for (const s of def.steps) doStep(w, host, s);
        assert.equal(host.tasks[0].step, def.steps.length, `${def.id} not finished: ${(w.inbox.get(host.key) ?? []).slice(-2).join(" / ")}`);
        // Tools stay in the pack, as in OSRS, but no food made along the way is left to eat.
        const food = [ITEMS.cheese, ITEMS.bakedPotato, ITEMS.potatoWithButter, ITEMS.cookedMeat];
        assert.ok(!w.items.get(host.key)!.some((id) => (food as number[]).includes(id)), `${def.id} left food behind`);
        // Paid once, on completion, per step (a weapon turning up in chore furniture pays on top).
        assert.deepEqual(host.earned.filter((e) => e.reason === def.name).map((e) => e.amount), [Math.round(C.coins.chorePerStep * def.steps.length)], `${def.id} paid per step, on completion`);
        assert.equal(w.coins.get(host.key), host.points, "the coins went into the inventory");
    }
});

check("a chore needs the right item at the right spot", () => {
    const { w, host } = setup("npc");
    const def = TASKS.find((t) => t.id === "cheese")!;
    host.tasks = [{ def, step: 0 }];
    w.items.set(host.key, []);
    near(w, host, "cow");
    w.game.doChore(host, "cow", ITEMS.bucket); // no bucket yet
    run(w.game, ticksFor(4));
    assert.equal(host.tasks[0].step, 0);
    doStep(w, host, def.steps[0]); // get a bucket from the kitchen sacks
    assert.ok(w.items.get(host.key)!.includes(ITEMS.bucket));
    near(w, host, "churn");
    w.game.doChore(host, "churn", ITEMS.bucket); // milk the cow first
    run(w.game, ticksFor(5));
    assert.equal(host.tasks[0].step, 1);
    doStep(w, host, def.steps[1]);
    assert.equal(host.tasks[0].step, 2);
    assert.ok(w.items.get(host.key)!.includes(ITEMS.bucketOfMilk), "the bucket became a bucket of milk");
});

check("a step's tools must be held too (no nailing a plank without a hammer), and aren't used up", () => {
    const { w, host } = setup("npc");
    const def = TASKS.find((t) => t.id === "library")!;
    host.tasks = [{ def, step: 3 }];
    w.items.set(host.key, [ITEMS.plank, ITEMS.steelNails]);
    near(w, host, "library_w");
    w.game.doChore(host, "library_w", ITEMS.plank);
    run(w.game, ticksFor(4));
    assert.equal(host.tasks[0].step, 3, "no hammer, no nailing");
    assert.ok((w.inbox.get(host.key) ?? []).some((m) => m.startsWith("You need:")), "told what's missing");
    w.items.get(host.key)!.push(ITEMS.hammer);
    doStep(w, host, def.steps[3]);
    assert.equal(host.tasks[0].step, 4);
    assert.ok(w.items.get(host.key)!.includes(ITEMS.hammer) && w.items.get(host.key)!.includes(ITEMS.steelNails), "the hammer and nails are still there");
});

check("every chore has at least five steps", () => {
    for (const def of TASKS) assert.ok(def.steps.length >= 5, `${def.id} has ${def.steps.length} steps`);
});

check("the furniture's own option does the chore when you hold its item (Milk, Churn, Cook...)", () => {
    for (const def of TASKS) {
        const { w, host } = setup("npc");
        w.items.set(host.key, []);
        host.tasks = [{ def, step: 0 }];
        for (const s of def.steps) {
            if (s.fetch !== undefined || s.use === undefined || s.mix !== undefined) {
                doStep(w, host, s);
                continue;
            }
            near(w, host, s.c!);
            w.game.useContainer(host, s.c!); // left-click, not "Use item on"
            run(w.game, ticksFor(s.fade ? C.tasks.fadeSec : s.sec));
        }
        assert.equal(host.tasks[0].step, def.steps.length, `${def.id} by left-click: ${(w.inbox.get(host.key) ?? []).slice(-2).join(" / ")}`);
    }
});

check("two chores sharing one tool: each needs its own (the second goes back to finding one)", () => {
    const { w, host } = setup("npc");
    w.items.set(host.key, []);
    const cheese = TASKS.find((t) => t.id === "cheese")!;
    const drain = TASKS.find((t) => t.id === "drain")!; // its step 2 is "Find a bucket"
    host.tasks = [{ def: cheese, step: 0 }, { def: drain, step: 2 }];
    doStep(w, host, cheese.steps[0]); // one bucket
    assert.deepEqual(host.tasks.map((t) => t.step), [1, 2], "one bucket ticks off one chore");
    doStep(w, host, cheese.steps[1]); // milked: the bucket is now milk
    doStep(w, host, drain.steps[2]); // a second bucket
    assert.equal(host.tasks[1].step, 3);
    doStep(w, host, drain.steps[3]);
    doStep(w, host, drain.steps[4]);
    doStep(w, host, cheese.steps[2]); // churned: butter, and the bucket back
    assert.ok(w.items.get(host.key)!.includes(ITEMS.patOfButter), "the churn makes butter");
    assert.equal(w.items.get(host.key)!.filter((id) => id === ITEMS.bucket).length, 2, "the churn hands the bucket back");
    assert.deepEqual(host.tasks.slice(0, 2).map((t) => t.step), [3, 5], "both moved on (finishing the drain dealt new chores)");
    // And if two chores did claim the same bucket, using it sends the other back to finding one.
    const spiders = TASKS.find((t) => t.id === "spiders")!;
    host.tasks = [{ def: drain, step: 3 }, { def: spiders, step: 3 }];
    w.items.set(host.key, [ITEMS.bucket]);
    doStep(w, host, drain.steps[3]);
    assert.deepEqual(host.tasks.map((t) => t.step), [4, 2]);
});

check("the overlay marks the furniture for your current chore step", () => {
    const { w, host } = setup("npc");
    const def = TASKS.find((t) => t.id === "library")!;
    host.tasks = [{ def, step: 0 }];
    // First the hammer lying on the study table.
    w.pos.set(host.key, { x: 2744, y: 3575, level: 0 });
    const first = w.game.hudFor(host).marker!;
    assert.deepEqual([first.x, first.y, first.level], [2747, 3579, 0]);
    for (const s of def.steps.slice(0, 3)) doStep(w, host, s); // hammer, nails, plank
    const west = w.game.containers.get("library_w")!;
    w.pos.set(host.key, { x: west.tile.x - 1, y: west.tile.y, level: west.tile.level }); // up in the library
    const m = w.game.hudFor(host).marker!;
    assert.deepEqual([m.x, m.y, m.level], [west.tile.x, west.tile.y, west.tile.level]);
    assert.match(w.game.hudFor(host).tasks[0].next ?? "", /Use (Plank|item960) on the Library bookcase \(west\) \(with .+ and .+\)/);
});
check("search leaves a print and a disturbed marker; both reset next round", () => {
    const { w, host } = setup("npc");
    host.tasks = []; // so the barrel is searched, not raided for a chore tool
    near(w, host, "bobs_barrel");
    w.game.search(host, "bobs_barrel");
    run(w.game, ticksFor(C.interact.searchSec));
    const c = w.game.containers.get("bobs_barrel")!;
    assert.ok(c.prints.has("Host"));
    assert.ok(w.game.disturbed.has("bobs_barrel"));
    w.game.phaseEnds = w.game.tick + 1;
    run(w.game, 2 + ticksFor(C.round.freezeSec));
    assert.equal(w.game.phase, "arrest");
    for (const p of w.game.living()) w.game.vote(p, null);
    assert.equal(w.game.phase, "result", "everyone voted for no arrest");
    run(w.game, ticksFor(C.round.resultSec));
    assert.equal(w.game.round, 2);
    assert.equal(c.prints.size, 0);
    assert.equal(w.game.disturbed.size, 0);
});

check("the cow is a chore spot, not a hiding place", () => {
    const { w, host } = setup("murderer");
    near(w, host, "cow");
    w.game.stash(host, "cow", realWeapon(w).itemId);
    run(w.game, ticksFor(C.interact.stashSec));
    assert.equal(realWeapon(w).at.kind, "participant");
});

check("moving away cancels a timed action", () => {
    const { w, host } = setup("npc");
    host.tasks = []; // so the barrel is searched, not raided for a chore tool
    near(w, host, "bobs_barrel");
    w.game.search(host, "bobs_barrel");
    w.pos.set(host.key, { x: 2700, y: 3500, level: 0 });
    run(w.game, ticksFor(C.interact.searchSec));
    assert.ok(!w.game.containers.get("bobs_barrel")!.prints.has("Host"));
});

check("stash + take + hand-off build the weapon print set; detective lift reads it", () => {
    const { w, host } = setup("murderer");
    const wpn = realWeapon(w);
    for (const d of w.game.weapons.filter((x) => !x.real)) d.at = { kind: "gone" }; // keep the drawer to ourselves
    near(w, host, "drawers_bob");
    w.game.stash(host, "drawers_bob", wpn.itemId);
    run(w.game, ticksFor(C.interact.stashSec));
    assert.equal(wpn.at.kind, "container");

    const npc = [...w.game.participants.values()].find((p) => p.role === "npc")!;
    near(w, npc, "drawers_bob");
    w.game.search(npc, "drawers_bob");
    run(w.game, ticksFor(C.interact.searchSec));
    // Found it: taken at once, and the whole house hears who found what, where.
    assert.deepEqual(wpn.at, { kind: "participant", key: npc.key });
    assert.ok(w.announcements.some((a) => a.includes(npc.name) && a.includes(wpn.name)), "the find is announced");

    const victim = [...w.game.participants.values()].find((p) => p.role === "npc" && p !== npc)!;
    w.pos.set(victim.key, { ...w.pos.get(npc.key)!, x: w.pos.get(npc.key)!.x + 1 });
    w.game.give(npc, victim.key, wpn.itemId);
    run(w.game, ticksFor(C.murderer.handoffSec));
    assert.deepEqual(wpn.at, { kind: "participant", key: victim.key });
    assert.deepEqual(wpn.prints.list(), [host.name, npc.name, victim.name].sort((a, b) => a.localeCompare(b)));

    const det = w.game.detective()!;
    w.pos.set(det.key, { ...w.pos.get(victim.key)!, x: w.pos.get(victim.key)!.x - 1, y: w.pos.get(victim.key)!.y + 1 });
    w.game.lift(det, "person", victim.key);
    run(w.game, ticksFor(C.detective.liftSec));
    assert.deepEqual(det.notebook[0].weapons?.[0].prints, wpn.prints.list());
});

check("the crime scene moves; the body gives one clue a round, and enough clues (more with more players) name the weapon type", () => {
    const tiles = new Set<string>();
    for (let i = 0; i < 12; i++) {
        const players = 4 + i; // 4..15
        const w = makeWorld();
        const host = w.game.participants.get("p:Host")!;
        w.game.setRolePref(host, "detective");
        w.game.start("p:Host", players);
        w.game.botThink = undefined;
        const scene = w.game.crimeScene!;
        tiles.add(`${scene.tile.x},${scene.tile.y},${scene.tile.level}`);
        assert.ok(CRIME_SCENES.some((t) => t.x === scene.tile.x && t.y === scene.tile.y && t.level === scene.tile.level));
        const need = w.game.caseFile.needed;
        const n = w.game.participants.size;
        assert.equal(need, Math.max(C.detective.minClues, Math.min(C.detective.maxClues, Math.round(n / C.detective.playersPerClue))), `${n} players`);
        const det = w.game.detective()!;
        const real = realWeapon(w).category;
        for (let k = 1; k <= need; k++) {
            w.game.phaseEnds = w.game.tick + 1000; // the test fakes each new round, so keep the clock running
            w.pos.set(det.key, { ...scene.tile, x: scene.tile.x + 1 });
            w.game.inspectScene(det);
            run(w.game, ticksFor(C.detective.inspectSec));
            assert.equal(w.game.caseFile.clues, k, `${n} players, clue ${k}: ${(w.inbox.get(det.key) ?? []).slice(-2).join(" / ")} (phase ${w.game.phase})`);
            assert.ok(w.game.caseFile.possible.includes(real), "the right type is never ruled out");
            // A second look the same round gives nothing.
            w.game.inspectScene(det);
            run(w.game, ticksFor(C.detective.inspectSec));
            assert.equal(w.game.caseFile.clues, k, "one clue a round");
            if (k < need) {
                assert.equal(det.knownCategory, undefined, `known after only ${k}/${need} clues`);
                assert.equal(w.game.hudFor(det).clues?.have, k);
                w.game.round++; // next round
            }
        }
        assert.equal(det.knownCategory, real);
        assert.equal(w.game.hudFor(det).weaponType, real);
    }
    assert.ok(tiles.size > 1, "the crime scene moves");
});

check("the Detective wears a body and legs but no helmet, gloves, boots or off-hand; the outdoor scene is the West Yard", () => {
    for (const slot of [4, 6]) assert.ok(C.pvp.detectiveGear[slot] > 0, `slot ${slot}`);
    for (const slot of [0, 5, 7, 8]) assert.ok(!(C.pvp.detectiveGear[slot] > 0), `no item in slot ${slot}`);
    assert.equal(C.pvp.detectiveGear.length, 9, "the ring slot (12) is never filled");
    assert.equal(roomAt({ x: 2727, y: 3576, level: 0 }), "West Yard");
});

check("the Murderer's kills leave blood where they happened, cleared next game", () => {
    const { w, host } = setup("murderer");
    const victim = [...w.game.participants.values()].find((p) => p.alive && p.role === "npc")!;
    w.pos.set(victim.key, { x: 2733, y: 3580, level: 0 });
    w.game.onDeath(victim, host);
    assert.deepEqual(w.killMarks, [{ x: 2733, y: 3580, level: 0 }]);
    const other = [...w.game.participants.values()].find((p) => p.alive && p.role !== "murderer" && p !== victim)!;
    w.game.onDeath(other, undefined); // not the Murderer's doing
    assert.equal(w.killMarks.length, 1);
});

check("weapons are never labelled as the murder weapon before an arrest", () => {
    const { w } = setup("npc");
    const npc = [...w.game.participants.values()].find((p) => p.role === "npc" && p.isBot)!;
    const decoy = w.game.weapons.find((x) => !x.real)!;
    const c = decoy.at.kind === "container" ? decoy.at.id : "";
    near(w, npc, c);
    w.game.search(npc, c);
    run(w.game, ticksFor(C.interact.searchSec));
    npc.openContainer = c;
    w.game.report(npc);
    assert.ok(!w.announcements.some((a) => /murder weapon/i.test(a)), w.announcements.join("\n"));
});

check("the detective can't take or be handed a weapon", () => {
    const { w, host } = setup("murderer");
    const det = w.game.detective()!;
    w.pos.set(det.key, { ...w.pos.get(host.key)!, x: w.pos.get(host.key)!.x + 1 });
    w.game.give(host, det.key, realWeapon(w).itemId);
    run(w.game, ticksFor(C.murderer.handoffSec));
    assert.deepEqual(realWeapon(w).at, { kind: "participant", key: host.key });
});

check("hidden info: the murderer is never named in announcements before game over", () => {
    const { w, host } = setup("murderer");
    run(w.game, 50);
    assert.ok(!w.announcements.some((a) => a.includes("MURDERER") || a.includes(`${host.name}: murderer`)));
});

check("hidden info: a kill and a weapon report are never announced; a report reaches the Detective alone", () => {
    const { w, host } = setup("murderer");
    const det = [...w.game.participants.values()].find((p) => p.role === "detective")!;
    const [victim, finder, bystander] = [...w.game.participants.values()].filter((p) => p.role === "npc");
    w.inbox.clear();
    w.announcements.length = 0;
    w.game.onDeath(victim, host);
    assert.equal(victim.alive, false);
    assert.deepEqual(w.announcements, [], "a kill isn't broadcast");
    assert.ok(!(w.inbox.get(bystander.key) ?? []).some((m) => m.includes(victim.name)), "nobody else is told");
    // The finder reports a red herring hidden in some furniture.
    const herring = w.game.weapons.find((x) => !x.real && x.at.kind === "container")!;
    const box = (herring.at as { id: string }).id;
    near(w, finder, box);
    finder.openContainer = box;
    w.game.report(finder);
    assert.deepEqual(w.announcements, [], "a find isn't broadcast");
    assert.ok((w.inbox.get(det.key) ?? []).some((m) => m.includes(finder.name) && m.includes(herring.name)), "the Detective hears of it");
    assert.ok(!(w.inbox.get(bystander.key) ?? []).some((m) => m.includes(herring.name)), "nobody else does");
    assert.equal(w.game.lastReport?.id, box, "the Detective's lead is set");
});

check("arresting an innocent holder drops the murder weapon publicly with its prints", () => {
    const { w } = setup("detective");
    const det = w.game.detective()!;
    const m = [...w.game.participants.values()].find((p) => p.role === "murderer")!;
    const npc = [...w.game.participants.values()].find((p) => p.role === "npc")!;
    const wpn = realWeapon(w);
    w.items.set(m.key, []);
    w.items.set(npc.key, [wpn.itemId]);
    wpn.at = { kind: "participant", key: npc.key };
    wpn.prints.add(npc.name);
    w.game.phaseEnds = w.game.tick + 1;
    run(w.game, 2 + ticksFor(C.round.freezeSec));
    for (const p of w.game.living()) if (p !== npc && w.game.phase === "arrest") w.game.vote(p, npc.key);
    assert.ok(det.alive);
    assert.equal(npc.alive, false);
    assert.equal(wpn.at.kind, "ground");
    assert.ok(w.announcements.some((a) => a.includes(`Prints on it: ${wpn.prints.list().join(", ")}`)));
});

check("bots talk about what they saw: a witnessed hand-off comes up at the table", () => {
    const w = makeWorld();
    const host = w.game.participants.get("p:Host")!;
    w.game.setRolePref(host, "murderer");
    w.game.start("p:Host", 6);
    const npcs = [...w.game.participants.values()].filter((p) => p.role === "npc");
    const [target, witness] = npcs;
    const base = { x: 2741, y: 3577, level: 0 };
    w.pos.set(host.key, base);
    w.pos.set(target.key, { ...base, x: base.x + 1 });
    w.pos.set(witness.key, { ...base, x: base.x + 2 });
    const think = w.game.botThink;
    w.game.botThink = undefined; // keep everyone still while the hand-off happens
    w.game.give(host, target.key, realWeapon(w).itemId);
    run(w.game, ticksFor(C.murderer.handoffSec));
    w.game.botThink = think;
    w.game.phaseEnds = w.game.tick + 1;
    // Bots type at a human pace, so give the table its whole time to talk.
    run(w.game, 2 + ticksFor(C.round.freezeSec) + ticksFor(C.round.arrestSec - 2));
    // Bots word it their own way (and in their own voice), but always name both. Whoever saw it may
    // call it out on the spot or at the table (and their votes may end the table quickly).
    const sawIt = [...w.game.participants.values()].filter((q) => q.isBot && q !== target).map((q) => `${q.name}: `);
    void witness;
    assert.ok(w.said.some((l) => sawIt.some((n) => l.startsWith(n)) && /host/i.test(l) && l.toLowerCase().includes(target.name.toLowerCase())), w.said.join("\n"));
});

check("everyone is seated around the dining table at the bell", () => {
    const { w } = setup("npc");
    w.game.phaseEnds = w.game.tick + 1;
    run(w.game, 2 + ticksFor(C.round.freezeSec));
    assert.equal(w.game.phase, "arrest");
    const seats = new Set([...LAYOUT.seats, LAYOUT.detectiveSpot].map((s) => `${s.x},${s.y}`));
    for (const p of w.game.living()) assert.ok(seats.has(`${w.pos.get(p.key)!.x},${w.pos.get(p.key)!.y}`), p.name);
});

check("the overlay only shows your own role, and chores start with finding the tool (and where it lies)", () => {
    const { w, host } = setup("npc");
    const hud = w.game.hudFor(host);
    assert.equal(hud.role, "npc");
    assert.equal(hud.hasFlypaper, undefined); // and nobody is told who the Detective is
    assert.ok(w.game.hudFor(w.game.detective()!).hasFlypaper);
    assert.ok(!JSON.stringify(hud).includes("murderer"));
    assert.equal(hud.tasks.length, C.tasks.atOnce);
    assert.ok(hud.tasks.every((t) => /^(Find|Pick)/.test(t.next ?? "") && !!t.where), JSON.stringify(hud.tasks));
    assert.equal(hud.weaponType, undefined);
});

check("PvP setup: everyone the same mid-level stats; only the Detective is geared; the Murderer has the weapon and claws; red herrings for half the household", () => {
    const { w } = setup("murderer");
    for (const p of w.game.participants.values()) {
        assert.equal(w.statsOf.get(p.key), C.pvp.stats, `${p.name} has everyone's stats`);
        const gear = w.worn.get(p.key) ?? [];
        if (p.role === "detective") assert.deepEqual(gear, C.pvp.detectiveGear.filter((id) => id > 0));
        else assert.equal(gear.length, 0, `${p.name} has no combat gear`);
        if (p.role === "murderer") {
            assert.ok(w.items.get(p.key)!.includes(C.pvp.dragonClaws));
            assert.ok(w.game.murderWeaponHeldBy(p));
        }
    }
    assert.equal(w.game.weapons.filter((x) => !x.real).length, 2); // 6 players: 4 household
    assert.ok(!w.announcements.some((a) => /Attack|Strength|Hitpoints/.test(a)), "the stats aren't announced");
});

check("fights only happen during the investigation, between the living", () => {
    const { w, host } = setup("npc");
    const other = [...w.game.participants.values()].find((p) => p !== host)!;
    assert.equal(w.game.canAttack(host, other), undefined);
    w.game.phaseEnds = w.game.tick + 1;
    run(w.game, 2);
    assert.equal(w.game.phase, "freeze");
    assert.ok(w.game.canAttack(host, other));
});

check("killing the Murderer ends the game, and the killer is paid", () => {
    const { w, host } = setup("npc");
    const m = [...w.game.participants.values()].find((p) => p.role === "murderer")!;
    w.pos.set(m.key, { x: 2740, y: 3575, level: 0 });
    w.game.onDeath(m, host);
    assert.equal(w.game.phase, "gameover");
    assert.equal(w.game.winner, "detective");
    assert.ok(host.earned.some((e) => /Killed the Murderer/.test(e.reason)));
    assert.equal(w.scrolls.get(host.key)?.title, "Congratulations!");
});

check("the Detective isn't announced; a dead Detective's kit is anyone's, and the flypaper makes its holder the Detective", () => {
    const { w } = setup("npc");
    const m = [...w.game.participants.values()].find((p) => p.role === "murderer")!;
    const det = w.game.detective()!;
    assert.ok(!w.announcements.some((a) => a.includes(det.name)), "nobody is told who the Detective is");
    w.pos.set(det.key, { x: 2742, y: 3579, level: 0 });
    w.game.onDeath(det, m);
    assert.equal(det.alive, false);
    assert.ok(m.earned.some((e) => /Killed/.test(e.reason)));
    assert.ok(w.game.detectiveKit!.items.includes(ITEMS.flypaper));
    assert.equal(w.game.detective(), undefined, "nobody is appointed: the flypaper is on the floor");
    // A member of the household takes the whip: an ordinary pick-up, nobody's the Detective yet.
    const npc = w.game.living().find((p) => p.role === "npc")!;
    const chores = npc.tasks.length;
    const whip = w.game.detectiveKit!.items.find((id) => id !== ITEMS.flypaper)!;
    assert.equal(w.game.takeKitItem(npc, whip), true);
    assert.ok(w.items.get(npc.key)!.includes(whip));
    assert.equal(w.game.detective(), undefined);
    // The Murderer takes the flypaper: now they're the Detective (and still the Murderer).
    assert.equal(w.game.takeKitItem(m, ITEMS.flypaper), true);
    assert.equal(w.game.detective(), m);
    assert.equal(m.role, "murderer");
    assert.ok(w.game.hudFor(m).hasFlypaper && w.game.hudFor(m).clues, "the Murderer sees the Detective's overlay too");
    assert.ok(!w.announcements.some((a) => /new Detective/.test(a)), "never announced");
    assert.equal(npc.tasks.length, chores, "the household keeps its chores");
});

check("someone of the household who picks up the flypaper is the Detective and keeps their chores", () => {
    const { w } = setup("npc");
    const det = w.game.detective()!;
    w.pos.set(det.key, { x: 2742, y: 3579, level: 0 });
    w.game.onDeath(det, undefined);
    const npc = w.game.living().find((p) => p.role === "npc")!;
    const chores = npc.tasks.map((t) => t.def.id);
    w.game.takeKitItem(npc, ITEMS.flypaper);
    assert.equal(w.game.detective(), npc);
    assert.equal(w.game.hudFor(npc).role, "detective");
    assert.deepEqual(npc.tasks.map((t) => t.def.id), chores);
    // ...and next round too.
    w.game.phaseEnds = w.game.tick + 1;
    run(w.game, 2 + ticksFor(C.round.freezeSec) + ticksFor(C.round.arrestSec) + ticksFor(C.round.resultSec));
    assert.ok(npc.tasks.length > 0, "chores carry on");
});

check("Stop and Search: once a round, the Detective confiscates pool weapons (never the dragon claws)", () => {
    const { w } = setup("npc");
    const det = w.game.detective()!;
    const m = [...w.game.participants.values()].find((p) => p.role === "murderer")!;
    const wpn = w.game.murderWeaponHeldBy(m)!;
    w.pos.set(m.key, { x: 2740, y: 3575, level: 0 });
    w.pos.set(det.key, { x: 2741, y: 3575, level: 0 });
    assert.ok(w.game.hudFor(det).stopSearch);
    assert.equal(w.game.hudFor(m).stopSearch, undefined);
    w.game.stopAndSearch(m, det.key); // only the Detective can
    assert.equal(m.action, undefined);
    w.game.stopAndSearch(det, m.key);
    assert.equal(m.heldBy, det.key, "they're stopped where they stand");
    run(w.game, ticksFor(C.detective.stopSearchSec));
    assert.deepEqual(wpn.at, { kind: "participant", key: det.key });
    assert.ok(w.items.get(det.key)!.includes(wpn.itemId));
    assert.ok(w.items.get(m.key)!.includes(C.pvp.dragonClaws), "the claws are hidden too well");
    assert.ok(!wpn.prints.has(det.name), "the Detective handles evidence with care");
    assert.ok(det.notebook.some((e) => e.weapons?.some((x) => x.name === wpn.name)), "and notes its prints");
    assert.equal(m.heldBy, undefined);
    assert.equal(w.game.hudFor(det).stopSearch, undefined);
    const other = w.game.living().find((p) => p !== det && p !== m)!;
    w.pos.set(other.key, { x: 2741, y: 3576, level: 0 });
    w.game.stopAndSearch(det, other.key);
    assert.equal(det.action, undefined, "once a round");
});

check("a find in furniture is taken and announced, or left when there's no room", () => {
    const { w, host } = setup("npc");
    host.tasks = [];
    const herring = w.game.weapons.find((x) => !x.real && x.at.kind === "container")!;
    const at = herring.at as { kind: "container"; id: string };
    near(w, host, at.id);
    // A full pack: the find is still announced, and the weapon stays put.
    const giveItem = w.game.io.giveItem;
    w.game.io.giveItem = () => false;
    w.game.search(host, at.id);
    run(w.game, ticksFor(C.interact.searchSec));
    w.game.io.giveItem = giveItem;
    assert.equal(herring.at.kind, "container");
    assert.ok(w.announcements.some((a) => a.includes(host.name) && a.includes(herring.name) && /no room/.test(a)));
    w.game.search(host, at.id);
    run(w.game, ticksFor(C.interact.searchSec));
    assert.deepEqual(herring.at, { kind: "participant", key: host.key });
    assert.ok(herring.prints.has(host.name));
});

check("a weapon stashed in chore furniture turns up when someone does their chore there", () => {
    const { w, host } = setup("npc");
    const def = TASKS.find((t) => t.id === "bread")!; // find a pot, then fill it at the barrel of flour
    host.tasks = [{ def, step: 0 }];
    doStep(w, host, def.steps[0]);
    const decoy = w.game.weapons.find((x) => !x.real)!;
    decoy.at = { kind: "container", id: "flour" };
    doStep(w, host, def.steps[1]);
    assert.equal(host.tasks[0].step, 2);
    assert.deepEqual(decoy.at, { kind: "participant", key: host.key }, "the hidden weapon was found (and taken)");
});

check("witnesses are limited to the same zone", () => {
    const { w, host } = setup("npc");
    const other = [...w.game.participants.values()].find((p) => p !== host && p.alive)!;
    w.pos.set(host.key, { x: 2741, y: 3579, level: 0 }); // dining room
    w.pos.set(other.key, { x: 2746, y: 3579, level: 0 }); // study, 5 tiles away but another zone
    assert.ok(!w.game.witnesses(host).includes(other));
    w.pos.set(other.key, { x: 2743, y: 3580, level: 0 });
    assert.ok(w.game.witnesses(host).includes(other));
});

check("the grandfather clock ends the round early, once per player per game, and chimes", () => {
    const { w, host } = setup("npc");
    w.pos.set(host.key, { x: 2730, y: 3574, level: 0 });
    w.game.ringClock(host);
    assert.equal(w.game.phase, "investigation", "too far away");
    w.pos.set(host.key, { x: 2742, y: 3581, level: 0 });
    assert.equal(w.game.hudFor(host).clock, true);
    w.game.ringClock(host);
    assert.equal(w.game.phase, "freeze");
    assert.equal(w.chimes.n, 1);
    assert.equal(w.game.hudFor(host).clock, false);
    run(w.game, ticksFor(C.round.freezeSec + C.round.arrestSec + C.round.resultSec));
    if (w.game.phase === "investigation" && host.alive) {
        w.pos.set(host.key, { x: 2742, y: 3581, level: 0 });
        w.game.ringClock(host);
        assert.equal(w.game.phase, "investigation", "a second strike in the same game");
    }
});

check("the chore marker points at the stairs when the chore is on the other floor", () => {
    const { w, host } = setup("npc");
    // Carol's needle only lies upstairs, so finding it starts at the stairs too.
    const upstairs = TASKS.find((t) => t.id === "mending")!; // then mend the dress in Elizabeth's drawers
    host.tasks = [{ def: upstairs, step: 0 }];
    w.pos.set(host.key, { x: 2740, y: 3574, level: 0 });
    const f = w.game.hudFor(host).marker!;
    assert.deepEqual([f.x, f.y, f.level, f.label], [2736, 3581, 0, "Climb up the stairs"]);
    host.tasks = [{ def: upstairs, step: 2 }];
    const m = w.game.hudFor(host).marker!;
    assert.deepEqual([m.x, m.y, m.level, m.label], [2736, 3581, 0, "Climb up the stairs"]);
    w.pos.set(host.key, { x: 2736, y: 3580, level: 1 });
    assert.equal(w.game.hudFor(host).marker!.level, 1);
    assert.notEqual(w.game.hudFor(host).marker!.label, "Climb up the stairs");
});

check("bots who see a human wielding dragon claws run for the clock (or fight) and name them at the table", () => {
    const w = makeWorld();
    const host = w.game.participants.get("p:Host")!;
    w.game.setRolePref(host, "murderer");
    w.game.start("p:Host", 6); // bot brains stay on
    const bot = [...w.game.participants.values()].find((p) => p.isBot && p.role === "npc" && p.alive)!;
    w.wielded.set(host.key, C.pvp.dragonClaws);
    for (let i = 0; i < 8 && w.game.phase === "investigation"; i++) {
        w.pos.set(host.key, { x: 2741, y: 3579, level: 0 });
        if (!(bot.bot as { sawClaws?: string } | undefined)?.sawClaws) w.pos.set(bot.key, { x: 2743, y: 3580, level: 0 });
        w.game.update();
    }
    assert.equal(w.game.phase, "freeze", "the bot struck the clock");
    // The shout comes once it's been typed (a person's reaction and typing time). Everyone at the
    // table saw the claws, so whichever bot reacted first may have rung the clock: any bot counts.
    run(w.game, ticksFor(C.round.freezeSec));
    const bots = [...w.game.participants.values()].filter((p) => p.isBot).map((p) => `${p.name}:`);
    assert.ok(w.said.some((l) => bots.some((b) => l.startsWith(b)) && /claws|murderer/i.test(l)), w.said.join(" | "));
    run(w.game, ticksFor(50));
    assert.ok(w.said.some((l) => bots.some((b) => l.startsWith(b)) && new RegExp(`${host.name}.*claws|claws.*${host.name}`, "i").test(l)), w.said.join(" | "));
});

check("a Murderer bot in a fight wields its dragon claws for the special, then its strongest weapon", () => {
    const w = makeWorld({ humans: ["Host"] });
    w.game.setRolePref(w.game.participants.get("p:Host")!, "detective");
    w.game.start("p:Host", 4);
    const m = [...w.game.participants.values()].find((p) => p.role === "murderer")!;
    const foe = w.game.participants.get("p:Host")!;
    assert.ok(m.isBot && w.game.io.hasItem(m, C.pvp.dragonClaws), "the Murderer bot carries the claws");
    let energy = 100;
    let specs = 0;
    const mover = w.mover as unknown as Record<string, unknown>;
    mover.attackers = (p: Participant) => (p === m ? [foe] : []);
    mover.specialEnergy = () => energy;
    mover.special = () => void specs++;
    m.bot = { lastPhase: w.game.phase, memRound: w.game.round, plan: "kill", fightReactAt: w.game.tick };
    w.game.update();
    w.game.update();
    assert.equal(w.wielded.get(m.key), C.pvp.dragonClaws, "claws out for the special");
    assert.ok(specs > 0, "special turned on");
    // The special is spent: the strongest weapon it carries comes out.
    const held = w.game.weaponsHeldBy(m)[0] ?? w.game.weapons[0];
    const weapon = held.itemId;
    if (!w.game.io.hasItem(m, weapon)) w.items.get(m.key)!.push(weapon);
    held.at = { kind: "participant", key: m.key };
    mover.weaponPower = (id: number) => (id === weapon ? 9999 : 1);
    energy = 0;
    for (let i = 0; i < 4; i++) w.game.update();
    assert.equal(w.wielded.get(m.key), weapon, "strongest weapon after the special");
    // Stronger claws stay in hand with the special spent.
    mover.weaponPower = (id: number) => (id === C.pvp.dragonClaws ? 9999 : 1);
    for (let i = 0; i < 4; i++) w.game.update();
    assert.equal(w.wielded.get(m.key), C.pvp.dragonClaws, "the claws when they are the strongest");
});

check("bots type at a human pace, and their Murderer goes after a bot alone with it as readily as a human", () => {
    // A short shout takes a second or two; a long table line several seconds.
    const shout = typingSec("Help! Hobbes is the Murderer!", true);
    assert.ok(shout > 4 && shout < 9, `shout took ${shout.toFixed(1)} s`);
    const line = typingSec("I was in the kitchen and the library. I churned fresh butter.", false);
    assert.ok(line > 10 && line < 21, `table line took ${line.toFixed(1)} s`);
    // The Murderer bot picks a lone bot victim (the fake mover can't fight, so count the attempts).
    const w = makeWorld({ humans: ["Host"] });
    w.game.setRolePref(w.game.participants.get("p:Host")!, "detective");
    w.game.start("p:Host", 4);
    const m = [...w.game.participants.values()].find((p) => p.role === "murderer")!;
    const victim = [...w.game.participants.values()].find((p) => p.isBot && p.role === "npc")!;
    assert.ok(m.isBot);
    m.bot = { plan: "kill" }; // a killer (an escaper mostly leaves people be)
    const tried: string[] = [];
    (w.mover as { attack: (a: Participant, t: Participant) => boolean }).attack = (_a, t) => (tried.push(t.key), false);
    // Everyone else stands still: the fake world walks instantly, so a bot heading off to a chore
    // would leave the yard within the same tick, before the Murderer looks around.
    // (lastPhase too, or the bot's first think resets its idle time for the new phase.)
    for (const q of w.game.participants.values()) if (q.isBot && q !== m) q.bot = { idleUntil: Number.MAX_SAFE_INTEGER, lastPhase: w.game.phase, memRound: w.game.round };
    for (const q of w.game.participants.values()) w.pos.set(q.key, q === m || q === victim ? { x: 2725, y: 3578, level: 0 } : { x: 2741, y: 3560, level: 0 });
    for (let i = 0; i < 1000 && !tried.length; i++) {
        w.game.phaseEnds = w.game.tick + 100; // a chance roll each tick: keep the round open until it comes up
        for (const q of w.game.participants.values()) w.pos.set(q.key, { x: 2741, y: 3560, level: 0 }); // everyone else out in the garden
        w.pos.set(m.key, { x: 2725, y: 3578, level: 0 });
        w.pos.set(victim.key, { x: 2726, y: 3578, level: 0 });
        w.game.update();
    }
    // (Another bot can wander in during the same tick and be the one picked: any bot counts.)
    assert.ok(tried.some((k) => k.startsWith("b:")), `the bot Murderer went for a bot alone with it (phase ${w.game.phase}, action ${m.action?.kind}, held ${m.heldBy}, tried ${tried})`);
});

check("chore tools (and the lockpick and chisel) lie around the property and respawn after being taken", () => {
    const { w, host } = setup("npc");
    for (const s of LAYOUT.itemSpawns) for (const t of s.tiles ?? []) assert.ok(w.ground.some((g) => g.id === s.itemId && g.tile.x === t.x && g.tile.y === t.y), `${s.itemId} at ${t.x},${t.y}`);
    // Tools kept in furniture never show on the ground.
    for (const s of LAYOUT.itemSpawns) if (!s.tiles?.length) assert.ok(!w.ground.some((g) => g.id === s.itemId), `${s.itemId} is kept in furniture, not lying out`);
    assert.ok(LAYOUT.itemSpawns.some((s) => s.itemId === ITEMS.lockpick) && LAYOUT.itemSpawns.some((s) => s.itemId === ITEMS.chisel));
    const spot = LAYOUT.itemSpawns.find((s) => s.itemId === ITEMS.bucket)!.tiles![0];
    w.game.io.removeGround(ITEMS.bucket, spot);
    assert.ok(w.game.pickUp(host, ITEMS.bucket, spot));
    assert.ok(w.items.get(host.key)!.includes(ITEMS.bucket));
    assert.ok(!w.game.itemsLying(ITEMS.bucket).some((t) => t.x === spot.x && t.y === spot.y), "gone from the floor");
    run(w.game, ticksFor(C.items.respawnSec));
    assert.ok(w.game.itemsLying(ITEMS.bucket).some((t) => t.x === spot.x && t.y === spot.y), "back after a while");
    assert.ok(w.ground.some((g) => g.id === ITEMS.bucket && g.tile.x === spot.x && g.tile.y === spot.y));
});

check("nobody carries two of the same chore item, from the floor or from furniture", () => {
    const { w, host } = setup("npc");
    const def = TASKS.find((t) => t.id === "cheese")!; // starts by finding a bucket
    host.tasks = [{ def, step: 0 }, { def: TASKS.find((t) => t.id === "spiders")!, step: 0 }];
    w.items.set(host.key, []);
    const [first, second] = LAYOUT.itemSpawns.filter((s) => s.itemId === ITEMS.bucket).flatMap((s) => s.tiles ?? []);
    w.game.io.removeGround(ITEMS.bucket, first);
    assert.ok(w.game.pickUp(host, ITEMS.bucket, first));
    assert.ok(w.game.holdsTool(host, ITEMS.bucket));
    assert.ok(!w.game.pickUp(host, ITEMS.bucket, second), "a second bucket stays where it is");
    assert.equal(w.items.get(host.key)!.filter((id) => id === ITEMS.bucket).length, 1);
    // The insect repellent lies by the beehive and is kept in David's barrel: holding one, the barrel keeps its own.
    const repellent = LAYOUT.itemSpawns.find((s) => s.itemId === ITEMS.insectRepellent && s.tiles?.length)!.tiles![0];
    w.game.io.removeGround(ITEMS.insectRepellent, repellent);
    assert.ok(w.game.pickUp(host, ITEMS.insectRepellent, repellent));
    host.tasks.push({ def: TASKS.find((t) => t.id === "bees")!, step: 0 });
    near(w, host, "davids_barrel");
    w.game.useContainer(host, "davids_barrel");
    run(w.game, ticksFor(C.interact.searchSec));
    assert.equal(w.items.get(host.key)!.filter((id) => id === ITEMS.insectRepellent).length, 1);
    assert.ok((w.inbox.get(host.key) ?? []).some((m) => m.includes("already have one")));
    assert.equal(C.items.respawnSec, 8, "a taken item is back after 8 s");
});

check("chores and the tools in hand carry over from round to round", () => {
    const { w, host } = setup("npc");
    const def = TASKS.find((t) => t.id === "cheese")!;
    host.tasks = [{ def, step: 1 }, { def: TASKS.find((t) => t.id === "crest")!, step: 0 }];
    w.items.set(host.key, [ITEMS.bucket]);
    w.game.phaseEnds = w.game.tick + 1;
    run(w.game, 2 + ticksFor(C.round.freezeSec));
    for (const p of w.game.living()) w.game.vote(p, null);
    run(w.game, ticksFor(C.round.resultSec));
    assert.equal(w.game.round, 2);
    assert.equal(host.tasks[0].def, def, "the same chores");
    assert.equal(host.tasks[0].step, 1, "where they left off");
    assert.ok(w.items.get(host.key)!.includes(ITEMS.bucket), "the bucket is still in the pack");
    assert.equal(host.tasks.filter((t) => t.def.steps[t.step]).length, C.tasks.atOnce, "topped up to a full set");
});

check("finishing a chore deals another at once: chores go on until the game ends", () => {
    const { w, host } = setup("npc");
    for (const weapon of w.game.weapons) if (weapon.at.kind === "container") weapon.at = { kind: "gone" };
    const crest = TASKS.find((t) => t.id === "crest")!;
    host.tasks = [{ def: crest, step: 0 }];
    w.items.set(host.key, []);
    for (const s of crest.steps) doStep(w, host, s);
    const open = host.tasks.filter((t) => t.def.steps[t.step]);
    assert.equal(open.length, C.tasks.atOnce, "a full set on the go again");
    assert.ok(open.every((t) => t.def.id !== "crest"), "new chores, not the one just done");
    assert.ok(host.tasks.some((t) => t.def === crest && !t.def.steps[t.step]), "the finished one counts as done");
    assert.ok((w.inbox.get(host.key) ?? []).some((m) => m.startsWith("New chore:")));
});

check("a tool kept in furniture: searching it gives it to whoever needs it, the marker outlines it, it comes back", () => {
    const { w, host } = setup("npc");
    const def = TASKS.find((t) => t.id === "mending")!; // Carol's needle is kept in her drawers
    host.tasks = [{ def, step: 0 }];
    w.items.set(host.key, []);
    w.pos.set(host.key, { x: 2734, y: 3580, level: 1 });
    const marker = w.game.hudFor(host).marker!;
    assert.deepEqual([marker.x, marker.y, marker.level], [2735, 3582, 1], "the drawers are outlined");
    assert.match(marker.label ?? "", /search/);
    // Someone without a use for it only hears it's there.
    const other = [...w.game.participants.values()].find((p) => p !== host && p.role === "npc")!;
    other.tasks = [];
    w.items.set(other.key, []);
    near(w, other, "drawers_carol");
    w.game.useContainer(other, "drawers_carol");
    run(w.game, ticksFor(C.interact.searchSec));
    assert.ok(!w.items.get(other.key)!.includes(ITEMS.needle), "left in the drawers");
    assert.ok((w.inbox.get(other.key) ?? []).some((m) => m.includes("no use for it")));
    // The one who needs it takes it, and the step is done.
    doStep(w, host, def.steps[0]);
    assert.ok(w.items.get(host.key)!.includes(ITEMS.needle));
    assert.equal(host.tasks[0].step, 1);
    assert.equal(w.game.itemsLying(ITEMS.needle).length, 0, "gone from the drawers");
    run(w.game, ticksFor(C.items.respawnSec));
    assert.equal(w.game.itemsLying(ITEMS.needle).length, 1, "back in the drawers after a while");
    assert.ok(!w.ground.some((g) => g.id === ITEMS.needle), "never on the floor");
});

check("a dead player drops everything they carry and wear (never coins) for anyone to take", () => {
    const { w, host } = setup("murderer");
    const victim = [...w.game.participants.values()].find((p) => p.alive && p.role === "npc")!;
    const at = { x: 2740, y: 3575, level: 0 };
    w.pos.set(victim.key, at);
    const herring = w.game.weapons.find((x) => !x.real)!;
    herring.at = { kind: "participant", key: victim.key };
    w.items.set(victim.key, [C.rewards.shark, 557, 555, 561, ITEMS.bucket, herring.itemId]);
    w.coins.set(victim.key, 500);
    w.game.onDeath(victim, host);
    assert.equal(w.items.get(victim.key)!.length, 0, "nothing left on them");
    for (const id of [C.rewards.shark, 557, 555, 561, ITEMS.bucket, herring.itemId]) assert.ok(w.ground.some((g) => g.id === id && g.tile.x === at.x && g.tile.y === at.y), `${id} on the floor`);
    assert.ok(!w.ground.some((g) => g.id === COINS), "coins are never dropped");
    assert.equal(w.coins.get(victim.key), 500);
    assert.equal(herring.at.kind, "ground", "the weapon is on the floor with its prints");
    // ...and anyone can pick the red herring up and fight with it.
    const other = [...w.game.participants.values()].find((p) => p.alive && p.role === "npc")!;
    assert.ok(w.game.takeFromGround(other, herring.itemId));
    assert.ok(w.game.weaponHeldBy(other));
});

check("things drop where the player was killed, even if they were moved during the death animation", () => {
    const { w, host } = setup("murderer");
    const victim = [...w.game.participants.values()].find((p) => p.alive && p.role === "npc")!;
    const killedAt = { x: 2736, y: 3580, level: 1 }; // the top of the stairs
    w.pos.set(victim.key, { x: 2736, y: 3580, level: 0 }); // ...taken down them while dying
    w.items.set(victim.key, [ITEMS.bucket]);
    w.game.onDeath(victim, host, killedAt);
    assert.ok(w.ground.some((g) => g.id === ITEMS.bucket && g.tile.level === 1), "upstairs, where they fell");
    assert.ok(!w.ground.some((g) => g.id === ITEMS.bucket && g.tile.level === 0 && g.tile.x === 2736 && g.tile.y === 3580));
});

check("the Murderer escapes by working one way out once a round; it takes 1.5x the Detective's clues", () => {
    const { w, host } = setup("murderer");
    const need = Math.ceil(w.game.caseFile.needed * C.murderer.escapeRoundsPerClue);
    assert.equal(w.game.escape.needed, need);
    const gate = LAYOUT.escapes.find((e) => e.id === "gate")!;
    const innocent = [...w.game.participants.values()].find((p) => p.alive && p.role === "npc")!;
    w.items.set(innocent.key, [ITEMS.lockpick]);
    w.pos.set(innocent.key, { ...gate.tile, y: gate.tile.y + 1 });
    w.game.workEscape(innocent, "gate", ITEMS.lockpick);
    assert.equal(innocent.action, undefined, "only the Murderer has a reason to leave");
    w.pos.set(host.key, { ...gate.tile, y: gate.tile.y + 1 });
    w.game.workEscape(host, "gate", ITEMS.lockpick);
    assert.equal(host.action, undefined, "needs a lockpick first");
    w.items.set(host.key, [ITEMS.lockpick]);
    for (let k = 1; k <= need; k++) {
        w.pos.set(host.key, { ...gate.tile, y: gate.tile.y + 1 });
        w.game.workEscape(host, "gate", ITEMS.lockpick);
        run(w.game, ticksFor(C.murderer.escapeSec));
        if (k < need) {
            assert.equal(w.game.escape.progress.gate, k);
            w.game.workEscape(host, "gate", ITEMS.lockpick);
            run(w.game, ticksFor(C.murderer.escapeSec));
            assert.equal(w.game.escape.progress.gate, k, "once a round");
            assert.equal(w.game.phase, "investigation");
            w.game.round++;
        }
    }
    assert.equal(w.game.phase, "gameover");
    assert.equal(w.game.winner, "murderer");
});

check("the Murderer also wins by being the last one alive, and there is no round limit", () => {
    const { w, host } = setup("murderer");
    for (const p of [...w.game.participants.values()]) if (p !== host && p.alive) w.game.onDeath(p, host);
    assert.equal(w.game.phase, "gameover");
    assert.equal(w.game.winner, "murderer");
    const g = setup("npc").w;
    for (let r = 0; r < 8 && g.game.phase !== "gameover"; r++) {
        run(g.game, ticksFor(C.round.investigationSec + C.round.freezeSec + C.round.arrestSec + C.round.resultSec));
    }
    assert.ok(g.game.round > 5 || g.game.phase === "gameover", "rounds go on past five");
});

check("without a majority by the bell, the voting dialog closes and nobody is arrested", () => {
    const { w, host } = setup("detective");
    run(w.game, ticksFor(C.round.investigationSec + C.round.freezeSec));
    assert.equal(w.game.phase, "arrest");
    w.game.botThink = undefined; // the bots sit this one out
    w.game.offerVote(host);
    run(w.game, ticksFor(C.round.arrestSec));
    assert.ok(w.closed.includes(host.key), "the dialog was closed");
    assert.ok(w.announcements.some((a) => /Nobody got more than half the votes/.test(a)));
    assert.ok(w.announcements.some((a) => /Nobody is arrested this round/.test(a)));
    assert.ok(w.game.living().every((p) => p.alive));
});

check("everyone alive votes; more than half arrests, and only the totals are shown", () => {
    const { w, host } = setup("npc");
    w.game.botThink = undefined; // votes cast by hand below
    w.game.phaseEnds = w.game.tick + 1;
    run(w.game, 2 + ticksFor(C.round.freezeSec));
    assert.equal(w.game.phase, "arrest");
    const living = w.game.living();
    assert.equal(living.length, 6);
    assert.equal(w.game.votesNeeded(), 4, "more than half of 6");
    const m = living.find((p) => p.role === "murderer")!;
    const [a, b, c] = living.filter((p) => p !== m && p !== host);
    assert.equal(w.game.vote(m, m.key), "You can't vote to arrest yourself.");
    for (const p of [host, a, b]) assert.equal(w.game.vote(p, m.key), undefined);
    assert.equal(w.game.phase, "arrest", "3 of 6 is only half: no arrest yet");
    const hud = w.game.hudFor(host).vote!;
    assert.equal(hud.tally.find((t) => t.key === m.key)?.votes, 3);
    assert.equal(hud.mine, m.key, "you see your own vote");
    assert.equal(w.game.hudFor(a).vote!.mine, m.key);
    assert.equal(w.game.hudFor(c).vote!.mine, undefined, "who voted for whom stays hidden");
    for (const t of hud.tally) assert.deepEqual(Object.keys(t).sort(), ["key", "name", "votes", "you"], "totals only, never voters");
    // Changing a vote counts once.
    w.game.vote(a, host.key);
    w.game.vote(a, m.key);
    assert.equal(w.game.hudFor(host).vote!.tally.find((t) => t.key === host.key)?.votes, 0);
    w.game.vote(c, m.key);
    assert.equal(m.alive, false, "4 of 6 arrests");
    assert.equal(w.game.phase, "gameover", "the Murderer is caught");
    assert.equal(w.game.winner, "detective");
    for (const p of [host, a, b, c]) assert.ok(p.earned.some((e) => e.amount === C.coins.correctArrest), `${p.name} is paid for the right vote`);
});

check("ghosts don't vote, and a majority is of the living only", () => {
    const { w, host } = setup("npc");
    w.game.botThink = undefined;
    const victim = w.game.living().find((p) => p !== host && p.role === "npc")!;
    w.game.onDeath(victim, undefined);
    w.game.phaseEnds = w.game.tick + 1;
    run(w.game, 2 + ticksFor(C.round.freezeSec));
    assert.equal(w.game.vote(victim, host.key), "Ghosts don't get a vote.");
    assert.equal(w.game.votesNeeded(), 3, "more than half of the 5 still alive");
});

check(`killing someone who isn't the Murderer costs the household ${C.penalties.killInnocent} coins`, () => {
    const { w, host } = setup("npc");
    const det = w.game.detective()!;
    const [a, b] = w.game.living().filter((p) => p.role === "npc" && p !== host);
    const fine = C.penalties.killInnocent;
    w.coins.set(host.key, fine + 500);
    w.game.onDeath(a, host);
    assert.equal(w.coins.get(host.key), 500, `${fine} taken`);
    assert.ok((w.inbox.get(host.key) ?? []).some((m) => m.includes(`-${fine} coins`)));
    w.coins.set(det.key, Math.floor(fine / 2));
    w.game.onDeath(b, det);
    assert.equal(w.coins.get(det.key), 0, "never below none");
    const m = w.game.living().find((p) => p.role === "murderer")!;
    const before = w.coins.get(m.key) ?? 0;
    const c = w.game.living().find((p) => p.role === "npc" && p !== host)!;
    w.game.onDeath(c, m);
    assert.ok((w.coins.get(m.key) ?? 0) >= before, "the Murderer is never fined for a kill");
});

check("full bot games always end with a winner; bots do chores; weapon prints never shrink", () => {
    const save = { ...C.round };
    C.round.investigationSec = 40;
    const wins: Record<string, number> = { detective: 0, murderer: 0 };
    let choresDone = 0;
    for (let i = 0; i < 20; i++) {
        const w = makeWorld({ pickFirst: true });
        const host = w.game.participants.get("p:Host")!;
        host.isBot = true; // the host is played by a bot brain too
        w.game.start("p:Host", 4 + (i % 7));
        let before: string[] = [];
        for (let t = 0; t < 20000 && w.game.phase !== "gameover"; t++) {
            w.game.update();
            if (w.game.phase === "freeze") for (const p of w.game.participants.values()) choresDone += p.tasks.filter((k) => k.step > 0).length;
            const now = realWeapon(w)?.prints.list() ?? [];
            before.forEach((n) => assert.ok(now.includes(n), `lost print ${n}`));
            before = now;
        }
        assert.equal(w.game.phase, "gameover");
        wins[w.game.winner!]++;
        // The "Quest complete!" scroll: everyone's points, and the winners got their bonus.
        const s = w.game.scrollFor(host);
        assert.ok(s.itemId && s.lines[0] === `${host.points} Coins`, JSON.stringify(s));
        const winners = [...w.game.participants.values()].filter((p) => (w.game.winner === "murderer") === (p.role === "murderer"));
        for (const p of winners) assert.ok(p.earned.some((d) => /Solved|Justice|Got away/.test(d.reason)), `${p.name} got no win bonus`);
        assert.equal(host.earned.reduce((n, d) => n + d.amount, 0), host.points, "earnings add up");
        // The game is over: nobody's overlay shows chores (or a chore marker) any more.
        for (const p of w.game.participants.values()) {
            const hud = w.game.hudFor(p);
            assert.equal(hud.tasks.length, 0, `${p.name} still sees chores after the game`);
            assert.equal(hud.marker, undefined);
        }
    }
    Object.assign(C.round, save);
    assert.ok(choresDone > 0, "bots never made chore progress");
    console.log("      20 bot games:", wins);
});

check("the opening cutscene: seated and frozen at the table, the guard names the crime scene and the Detective, then round 1", () => {
    const w = makeWorld({ keepIntro: true });
    const host = w.game.participants.get("p:Host")!;
    w.game.setRolePref(host, "npc"); // a Detective has no chores to hand out
    w.game.start("p:Host", 6);
    assert.equal(w.game.phase, "intro");
    for (const p of w.game.participants.values()) assert.ok(w.frozen.has(p.key), `${p.name} is held still at the table`);
    assert.equal(host.tasks.length, 0, "no chores during the cutscene");
    assert.ok(w.game.canAttack(host, [...w.game.participants.values()].find((p) => p !== host)!), "no fighting during the cutscene");
    // Nobody is moved and no camera taken until the screen has faded to black.
    const where = w.pos.get(host.key) && { ...w.pos.get(host.key)! };
    const seatTick = secToTicks(C.intro.seatSec);
    run(w.game, seatTick - 1);
    assert.equal(w.shots.length, 0, "no camera shot while the screen is still fading out");
    assert.deepEqual(w.pos.get(host.key), where, "not seated while the screen is still fading out");
    run(w.game, 1);
    assert.notDeepEqual(w.pos.get(host.key), where, "seated under the black");
    assert.deepEqual(w.shots.filter((s) => s.key === host.key).map((s) => s.shot.camera), [0], "the first shot cut in under the black");
    run(w.game, ticksFor(C.round.introSec) - seatTick - 3);
    const mine = w.shots.filter((s) => s.key === host.key).map((s) => s.shot);
    assert.deepEqual(mine.map((s) => s.camera), [0, 1, 2], "three camera shots, in order");
    const said = mine.filter((s) => s.speaker === "guard").flatMap((s) => s.lines).join(" ");
    assert.ok(said.includes(w.game.crimeScene!.room.toLowerCase()) || said.includes(w.game.crimeScene!.room), `the guard names the room: ${said}`);
    // (The room's name can carry theirs: "David's Room". That isn't naming the Detective.)
    const unroomed = said.split(w.game.crimeScene!.room).join("");
    assert.ok(!unroomed.includes(w.game.detective()!.name) && /detective/i.test(said), "the guard warns of a detective, but never names them");
    while (w.game.phase === "intro") w.game.update();
    assert.equal(w.game.phase, "investigation");
    assert.ok(w.cameraReset.includes(host.key), "the camera goes back to following you");
    assert.ok((w.dialogs.get(host.key) ?? []).length > 0, "then your role");
    assert.ok(!w.frozen.has(host.key), "free to move in round 1");
    assert.ok(host.tasks.length > 0, "chores handed out");
});

check("a chore's long moment: the screen fades for fadeSec, you can't move or do anything else, and dying doesn't cut it short", () => {
    const { w, host } = setup("npc");
    for (const weapon of w.game.weapons) if (weapon.at.kind === "container") weapon.at = { kind: "gone" };
    for (const def of TASKS) assert.equal(def.steps.filter((s) => s.fade).length, 1, `${def.id} has one long moment`);
    const def = TASKS.find((t) => t.id === "water")!;
    w.items.set(host.key, [ITEMS.wateringCan7]);
    host.tasks = [{ def, step: 3 }]; // "Water the wheat": the fade
    near(w, host, "veg_patch");
    w.game.doChore(host, "veg_patch", ITEMS.wateringCan7);
    const hud = w.game.hudFor(host);
    assert.equal(hud.fade?.caption, "You water the plants for some time...");
    assert.equal(hud.marker, undefined, "no quest marker on a black screen");
    assert.ok(w.frozen.has(host.key), "held still");
    w.game.useContainer(host, "sacks"); // a click while blacked out does nothing
    assert.equal(host.action?.kind, "task");
    run(w.game, ticksFor(C.tasks.fadeSec) - 3);
    assert.equal(host.tasks[0].step, 3, "not done until the fade ends");
    run(w.game, 4);
    assert.equal(host.tasks[0].step, 4, "done when the screen comes back");
    assert.equal(w.game.hudFor(host).fade, undefined);
    assert.ok(!w.frozen.has(host.key), "free to move again");

    // Killed mid-fade: the screen stays black until the moment is over.
    const bread = TASKS.find((t) => t.id === "bread")!;
    w.items.set(host.key, [ITEMS.breadDough]);
    host.tasks = [{ def: bread, step: 5 }];
    near(w, host, "range");
    w.game.doChore(host, "range", ITEMS.breadDough);
    const id = w.game.hudFor(host).fade?.id;
    assert.ok(id);
    run(w.game, 3);
    const m = [...w.game.participants.values()].find((p) => p.role === "murderer")!;
    w.game.onDeath(host, m);
    assert.ok(!host.alive);
    assert.equal(w.game.hudFor(host).fade?.id, id, "still black after dying");
    run(w.game, ticksFor(C.tasks.fadeSec));
    assert.equal(w.game.hudFor(host).fade, undefined, "the fade ends on time");
});

check("the clock striking ends a chore's fade (its own fade takes over)", () => {
    const { w, host } = setup("npc");
    const def = TASKS.find((t) => t.id === "kettle")!;
    w.items.set(host.key, [ITEMS.fullKettle]);
    host.tasks = [{ def, step: 4 }];
    near(w, host, "range");
    w.game.doChore(host, "range", ITEMS.fullKettle);
    assert.ok(w.game.hudFor(host).fade);
    w.game.phaseEnds = w.game.tick + 1;
    run(w.game, 2);
    assert.equal(w.game.phase, "freeze");
    assert.equal(w.game.hudFor(host).fade, undefined);
});

check("long actions keep animating: lockpicking the gate, chiselling a wall, studying the body, chores", () => {
    const { w, host } = setup("murderer");
    const gate = LAYOUT.escapes.find((e) => e.id === "gate")!;
    w.items.get(host.key)!.push(ITEMS.lockpick);
    w.pos.set(host.key, { ...gate.tile, y: gate.tile.y + 1 });
    w.game.workEscape(host, "gate", ITEMS.lockpick);
    run(w.game, ticksFor(C.murderer.escapeSec));
    const picks = w.anims.filter((a) => a.key === host.key && a.kind === "escape");
    assert.ok(picks.length > 10, `the lockpicking keeps going (${picks.length} animation calls)`);
    assert.ok(picks.every((a) => a.anim === "lockpick"));
    assert.ok(picks.some((a) => a.elapsed > ticksFor(C.murderer.escapeSec) / 2), "until the end of the go");

    const { w: w2 } = setup("detective");
    const det = w2.game.detective()!;
    w2.pos.set(det.key, { ...w2.game.crimeScene!.tile, x: w2.game.crimeScene!.tile.x + 1 });
    w2.game.inspectScene(det);
    run(w2.game, ticksFor(C.detective.inspectSec));
    const study = w2.anims.filter((a) => a.key === det.key && a.kind === "inspect");
    assert.ok(study.length > 20 && study.some((a) => a.elapsed > 30), "the Detective keeps studying the body");

    const wall = LAYOUT.escapes.find((e) => e.id === "nw_wall")!;
    assert.equal(wall.anim, "chisel");
    assert.ok(TASKS.flatMap((t) => t.steps).filter((s) => s.anim).length >= 20, "chore steps have their own look");
});

check("tools that aren't used up in OSRS stay (tinderbox, rake, insect repellent), and a kept tool counts for the next chore needing it", () => {
    const { w, host } = setup("npc");
    for (const weapon of w.game.weapons) if (weapon.at.kind === "container") weapon.at = { kind: "gone" };
    const kettle = TASKS.find((t) => t.id === "kettle")!;
    const fire = TASKS.find((t) => t.id === "fire")!;
    w.items.set(host.key, []);
    host.tasks = [{ def: kettle, step: 0 }, { def: fire, step: 2 }]; // the fire is at "Find a tinderbox"
    doStep(w, host, kettle.steps[0]); // one tinderbox: spoken for by the kettle's next step
    assert.equal(host.tasks[0].step, 1);
    assert.equal(host.tasks[1].step, 2, "one tinderbox can't tick off both at once");
    doStep(w, host, kettle.steps[1]); // light the range: the tinderbox stays...
    assert.ok(w.items.get(host.key)!.includes(ITEMS.tinderbox), "the tinderbox isn't used up");
    assert.equal(host.tasks[1].step, 3, "...and the study fire's 'Find a tinderbox' is done with it straight away");
    for (const id of ["compost", "bees", "spiders"]) {
        const tool = TASKS.find((t) => t.id === id)!.steps[1];
        assert.ok(tool.keep, `${id}: ${tool.verb} keeps its tool`);
    }
});

check("the new chores: chop willow logs and light the study fire; make a stew", () => {
    for (const id of ["fire", "stew"]) {
        const { w, host } = setup("npc");
        for (const weapon of w.game.weapons) if (weapon.at.kind === "container") weapon.at = { kind: "gone" };
        const def = TASKS.find((t) => t.id === id)!;
        w.items.set(host.key, []);
        host.tasks = [{ def, step: 0 }];
        for (const s of def.steps) doStep(w, host, s);
        assert.equal(host.tasks[0].step, def.steps.length, `${id} done: ${(w.inbox.get(host.key) ?? []).slice(-2).join(" / ")}`);
        assert.ok(!w.items.get(host.key)!.some((x) => [ITEMS.willowLogs, ITEMS.cookedMeat, ITEMS.uncookedStew, ITEMS.incompleteStew].includes(x as never)), "the logs and the stew are used up");
    }
});

check("planting: Use the weapon on someone whose screen is black slips it into their pack, and nobody is told", () => {
    const { w, host } = setup("murderer");
    const victim = [...w.game.participants.values()].find((p) => p.role === "npc")!;
    const weapon = realWeapon(w);
    const spot = { x: 2741, y: 3577, level: 0 };
    for (const q of w.game.participants.values()) w.pos.set(q.key, { x: 3000, y: 3000, level: 3 }); // everyone else far away
    w.pos.set(host.key, spot);
    w.pos.set(victim.key, { ...spot, x: spot.x + 1 });
    // Awake, they'd see it: an ordinary (announced) hand-off would start instead. Here: asleep at a chore.
    victim.fade = { id: 99, caption: "You water the plants for some time...", until: w.game.tick + 30 };
    w.inbox.clear();
    const said = w.announcements.length;
    w.game.give(host, victim.key, weapon.itemId);
    assert.equal(host.action?.kind, "plant");
    run(w.game, ticksFor(C.murderer.plantSec));
    assert.deepEqual(weapon.at, { kind: "participant", key: victim.key });
    assert.ok(w.items.get(victim.key)!.includes(weapon.itemId), "it's in their pack");
    assert.ok(weapon.prints.has(victim.name), "their name joins the prints");
    assert.equal(w.inbox.get(victim.key), undefined, "the victim isn't told");
    assert.equal(w.announcements.length, said, "nothing is announced");
    for (const [key, msgs] of w.inbox) if (key !== host.key) assert.ok(!msgs.some((m) => /hand|slip/i.test(m)), `${key} was told: ${msgs}`);
    // With someone else watching, it can't be done quietly.
    w.game.give(victim, host.key, weapon.itemId); // (the victim is no Murderer; it's just a weapon now)
    const other = [...w.game.participants.values()].find((p) => p.role === "npc" && p !== victim)!;
    w.pos.set(other.key, { ...spot, x: spot.x + 2 });
    w.game.cancel(victim);
    host.fade = { id: 100, caption: "", until: w.game.tick + 30 };
    assert.equal(w.game.plant(victim, host.key, weapon.itemId), "Someone's watching.");
});

check("pickpocketing: the Murderer takes a planted weapon back unseen; on someone awake they're caught at it", () => {
    const { w, host } = setup("murderer");
    const victim = [...w.game.participants.values()].find((p) => p.role === "npc")!;
    const weapon = realWeapon(w);
    const spot = { x: 2741, y: 3577, level: 0 };
    for (const q of w.game.participants.values()) w.pos.set(q.key, { x: 3000, y: 3000, level: 3 });
    w.pos.set(host.key, spot);
    w.pos.set(victim.key, { ...spot, x: spot.x + 1 });
    assert.equal(w.game.pickpocket(host, victim.key), `${victim.name} has nothing of yours.`);
    victim.fade = { id: 99, caption: "", until: w.game.tick + 60 };
    w.game.give(host, victim.key, weapon.itemId);
    run(w.game, ticksFor(C.murderer.plantSec));
    assert.equal(w.game.hudFor(host).pickpocket, true, "the overlay offers Pickpocket");
    // Someone else wanders in: not now.
    const other = [...w.game.participants.values()].find((p) => p.role === "npc" && p !== victim)!;
    w.pos.set(other.key, { ...spot, x: spot.x + 2 });
    assert.equal(w.game.pickpocket(host, victim.key), "Someone's watching.");
    w.pos.set(other.key, { x: 3000, y: 3000, level: 3 });
    // Unseen: back in the Murderer's pack, nobody told. Prints never come off.
    w.inbox.clear();
    assert.equal(w.game.pickpocket(host, victim.key), undefined);
    assert.equal(host.action?.kind, "pickpocket");
    run(w.game, ticksFor(C.murderer.plantSec));
    assert.deepEqual(weapon.at, { kind: "participant", key: host.key });
    assert.ok(w.items.get(host.key)!.includes(weapon.itemId) && !w.items.get(victim.key)!.includes(weapon.itemId));
    assert.ok(weapon.prints.has(victim.name), "their print stays on it");
    assert.equal(w.inbox.get(victim.key), undefined, "the victim isn't told");
    assert.equal(w.game.hudFor(host).pickpocket, undefined);
    // Plant it again, then try it on them awake: they feel it, and nothing is taken.
    w.game.give(host, victim.key, weapon.itemId);
    run(w.game, ticksFor(C.murderer.plantSec));
    victim.fade = undefined;
    assert.match(w.game.pickpocket(host, victim.key)!, /feels your hand/);
    assert.deepEqual(weapon.at, { kind: "participant", key: victim.key });
    assert.ok((w.inbox.get(victim.key) ?? []).some((m) => m.includes(`You catch ${host.name} with a hand in your pocket`)));
});

check("bots pick things up off the floor no faster than once every 2 ticks", () => {
    const { w } = setup("detective");
    const bot = [...w.game.participants.values()].find((p) => p.isBot && p.role === "npc")!;
    const herrings = w.game.weapons.filter((x) => !x.real).slice(0, 2);
    assert.equal(herrings.length, 2, "need two red herrings");
    const tile = { x: 2741, y: 3577, level: 0 };
    for (const h of herrings) {
        h.at = { kind: "ground", tile };
        w.game.io.spawnGround(h.itemId, tile);
    }
    assert.ok(w.game.takeFromGround(bot, herrings[0].itemId));
    assert.equal(w.game.botPickupReady(bot), false);
    assert.equal(w.game.takeFromGround(bot, herrings[1].itemId), false, "too soon");
    w.game.update();
    assert.equal(w.game.takeFromGround(bot, herrings[1].itemId), false, "still too soon after 1 tick");
    w.game.update();
    assert.ok(w.game.takeFromGround(bot, herrings[1].itemId), "fine after 2 ticks");
    // People click as fast as they like.
    const human = w.game.participants.get("p:Host")!;
    assert.ok(w.game.botPickupReady(human));
});

check("at the table every bot waits 12-20 seconds before its first vote (and may change its mind after)", () => {
    const w = makeWorld();
    w.game.start("p:Host", 8);
    const first = new Map<string, number>();
    const vote = w.game.vote.bind(w.game);
    w.game.vote = (p, key) => {
        if (!first.has(p.key)) first.set(p.key, w.game.tick);
        return vote(p, key);
    };
    w.game.phaseEnds = w.game.tick + 1;
    while (w.game.phase !== "arrest") w.game.update();
    const start = w.game.phaseStart;
    const bots = w.game.living().filter((p) => p.isBot);
    const [lo, hi] = C.bots.voteDelaySec;
    run(w.game, ticksFor(hi));
    for (const b of bots) {
        if (w.game.phase !== "arrest" && !first.has(b.key)) continue; // the table broke up before its turn
        assert.ok(first.has(b.key), `${b.name} hadn't voted`);
        assert.ok(first.get(b.key)! - start >= ticksFor(lo) - 1, `${b.name} voted early`);
        assert.ok(first.get(b.key)! - start <= ticksFor(hi), `${b.name} voted late`);
    }
});

console.log(`\n${passed} sinclair-mansion checks passed.`);
