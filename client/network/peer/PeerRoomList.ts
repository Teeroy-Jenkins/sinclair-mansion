// The internet room list for the Join browser. PeerJS's free cloud can't list who is online, so
// the hosts keep the list themselves: one hosting tab holds the well-known PeerJS id ROOM_LIST_ID
// and every other host reports its room to it every few seconds; a browser asks it for the rows.
// PeerJS lets only one tab hold an id, so when that tab closes, the next host to notice claims it
// and the list carries on for as long as anyone is hosting.
//
//   host's tab --report--> list holder (a host's tab) <--list-- friend's Join browser
//
// Rows are only what a host chose to show (name, host, seats, lock, in game), never a password or
// an address: joining goes through the room code, like typing it in.
import Peer, { type DataConnection, type PeerError } from "peerjs";

const ROOM_LIST_ID = "sinclair-mansion-room-list-v1";
/** How often hosts report and browsers ask. */
const REFRESH_MS = 4000;
/** A room that stopped reporting drops off the list. */
const ROOM_TTL_MS = 15_000;
/** Looking for the list again after it went away (plus up to 2 s of jitter, so hosts don't all claim at once). */
const RETRY_MS = 4000;
const CONNECT_TIMEOUT_MS = 12_000;
const MAX_ROOMS = 100;
const ROOM_CODE = /^[A-Z0-9]{6}$/;

/** One room on the list; joined over PeerJS with its code. */
export interface InternetRoom {
    roomCode: string;
    name: string;
    host: string;
    players: number;
    maxPlayers: number;
    locked: boolean;
    inGame: boolean;
}

type Message =
    | { t: "report"; room: InternetRoom | null }
    | { t: "list" }
    | { t: "rooms"; rooms: InternetRoom[] };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const count = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.trunc(v))) : min;

/** A row from another tab, checked (anyone can talk to the list); undefined when it isn't one. */
export function cleanRoom(raw: unknown): InternetRoom | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const r = raw as Record<string, unknown>;
    const roomCode = typeof r.roomCode === "string" ? r.roomCode.toUpperCase() : "";
    if (!ROOM_CODE.test(roomCode)) return undefined;
    return {
        roomCode,
        name: text(r.name, 24) || "Sinclair Mansion",
        host: text(r.host, 24),
        players: count(r.players, 0, 99),
        maxPlayers: count(r.maxPlayers, 1, 99),
        locked: r.locked === true,
        inGame: r.inGame === true,
    };
}

class RoomList {
    /** This tab's own room, while it hosts one. */
    private room?: InternetRoom;
    private readonly watchers = new Set<(rooms: InternetRoom[]) => void>();
    private rooms: InternetRoom[] = [];
    private running = false;
    /** This tab's anonymous peer, for reporting to and asking the list holder. */
    private peer?: Peer;
    private conn?: DataConnection;
    /** The list itself, while this tab holds ROOM_LIST_ID (claiming or claimed). */
    private holder?: Peer;
    private holding = false;
    private readonly reports = new Map<DataConnection, { room: InternetRoom; at: number }>();
    private tick?: ReturnType<typeof setInterval>;
    private retry?: ReturnType<typeof setTimeout>;
    private connectTimer?: ReturnType<typeof setTimeout>;

    setRoom(room: InternetRoom | undefined): void {
        this.room = room;
        this.report();
        this.update();
    }

    watch(cb: (rooms: InternetRoom[]) => void): () => void {
        this.watchers.add(cb);
        cb(this.rooms);
        this.update();
        this.ask();
        return () => {
            this.watchers.delete(cb);
            this.update();
        };
    }

    /** Runs while this tab hosts a room or has the Join browser open. */
    private update(): void {
        const wanted = !!this.room || this.watchers.size > 0;
        if (wanted && !this.running) this.start();
        else if (!wanted && this.running) this.stop();
    }

    private start(): void {
        this.running = true;
        this.tick = setInterval(() => this.refresh(), REFRESH_MS);
        this.connect();
    }

    private stop(): void {
        this.running = false;
        clearInterval(this.tick);
        clearTimeout(this.retry);
        clearTimeout(this.connectTimer);
        this.retry = undefined;
        this.dropConn();
        this.peer?.destroy();
        this.peer = undefined;
        this.holder?.destroy();
        this.holder = undefined;
        this.holding = false;
        this.reports.clear();
        this.publish([]);
    }

    private refresh(): void {
        if (this.holding) this.publish(this.heldRooms());
        else {
            this.report();
            this.ask();
        }
    }

    // ------------------------------------------------------------------ talking to the holder
    private connect(): void {
        if (!this.running || this.holder || this.conn) return;
        if (!this.peer || this.peer.destroyed) {
            const peer = new Peer();
            this.peer = peer;
            peer.on("open", () => this.peer === peer && this.connect());
            peer.on("error", (err: PeerError<string>) => this.peer === peer && this.onPeerError(err));
            peer.on("disconnected", () => {
                if (this.peer === peer && !peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 3000);
            });
            return;
        }
        if (!this.peer.open) return; // its "open" connects
        const conn = this.peer.connect(ROOM_LIST_ID, { reliable: true, serialization: "json" });
        this.conn = conn;
        this.connectTimer = setTimeout(() => this.lost(conn), CONNECT_TIMEOUT_MS);
        conn.on("open", () => {
            clearTimeout(this.connectTimer);
            this.report();
            this.ask();
        });
        conn.on("data", (data) => {
            const m = data as Message;
            if (m?.t === "rooms" && Array.isArray(m.rooms)) this.publish(this.cleanRows(m.rooms));
        });
        conn.on("close", () => this.lost(conn));
        conn.on("error", () => this.lost(conn));
    }

    private onPeerError(err: PeerError<string>): void {
        if (err.type === "peer-unavailable") {
            // Nobody holds the list. A host claims it; a browser shows no internet rooms for now.
            this.dropConn();
            if (this.room) this.claim();
            else {
                this.publish([]);
                this.later();
            }
            return;
        }
        // Lost the PeerJS cloud: start over with a fresh peer shortly.
        this.dropConn();
        this.peer?.destroy();
        this.peer = undefined;
        this.later();
    }

    private lost(conn: DataConnection): void {
        if (conn !== this.conn) return;
        this.dropConn();
        this.later();
    }

    private dropConn(): void {
        clearTimeout(this.connectTimer);
        const conn = this.conn;
        this.conn = undefined;
        try {
            conn?.close();
        } catch {}
    }

    private later(): void {
        if (!this.running || this.retry) return;
        this.retry = setTimeout(() => {
            this.retry = undefined;
            this.connect();
        }, RETRY_MS + Math.random() * 2000);
    }

    private send(message: Message): void {
        if (this.conn?.open) this.conn.send(message);
    }

    private report(): void {
        this.send({ t: "report", room: this.room ?? null });
    }

    private ask(): void {
        if (this.watchers.size > 0) this.send({ t: "list" });
        else if (this.holding) this.publish(this.heldRooms());
    }

    // ------------------------------------------------------------------ holding the list
    private claim(): void {
        if (this.holder) return;
        const holder = new Peer(ROOM_LIST_ID);
        this.holder = holder;
        holder.on("open", () => {
            if (this.holder !== holder) return;
            this.holding = true;
            this.publish(this.heldRooms());
        });
        holder.on("connection", (conn) => this.serve(conn));
        holder.on("disconnected", () => {
            if (this.holder === holder && !holder.destroyed) setTimeout(() => !holder.destroyed && holder.reconnect(), 3000);
        });
        holder.on("error", (err: PeerError<string>) => {
            if (err.type === "peer-unavailable") return;
            // "unavailable-id": another host claimed it first, so report to theirs instead.
            if (this.holder !== holder) return;
            holder.destroy();
            this.holder = undefined;
            this.holding = false;
            this.reports.clear();
            this.later();
        });
    }

    private serve(conn: DataConnection): void {
        conn.on("data", (data) => {
            const m = data as Message;
            if (m?.t === "report") {
                const room = cleanRoom(m.room);
                if (room) this.reports.set(conn, { room, at: Date.now() });
                else this.reports.delete(conn);
            } else if (m?.t === "list") {
                const reply: Message = { t: "rooms", rooms: this.heldRooms() };
                conn.send(reply);
            }
        });
        const end = () => this.reports.delete(conn);
        conn.on("close", end);
        conn.on("error", end);
    }

    /** Every room still reporting, this tab's own first, each room code once. */
    private heldRooms(): InternetRoom[] {
        const now = Date.now();
        const rows: InternetRoom[] = this.room ? [this.room] : [];
        for (const [conn, entry] of this.reports) {
            if (now - entry.at > ROOM_TTL_MS || !conn.open) this.reports.delete(conn);
            else rows.push(entry.room);
        }
        return this.cleanRows(rows);
    }

    private cleanRows(raw: unknown[]): InternetRoom[] {
        const seen = new Set<string>();
        const rows: InternetRoom[] = [];
        for (const r of raw) {
            const room = cleanRoom(r);
            if (!room || seen.has(room.roomCode)) continue;
            seen.add(room.roomCode);
            rows.push(room);
            if (rows.length >= MAX_ROOMS) break;
        }
        return rows;
    }

    private publish(rooms: InternetRoom[]): void {
        this.rooms = rooms;
        for (const cb of this.watchers) cb(rooms);
    }
}

const list = new RoomList();

/** Show this tab's room on the internet list (undefined takes it off). */
export function setListedRoom(room: InternetRoom | undefined): void {
    list.setRoom(room);
}

/** The rooms hosted over the internet, as they change; returns the unsubscribe. */
export function watchInternetRooms(cb: (rooms: InternetRoom[]) => void): () => void {
    return list.watch(cb);
}
