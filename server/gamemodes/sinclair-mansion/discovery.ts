// LAN discovery for the server browser. Every server hosting a lobby shouts a small UDP beacon
// to its local networks every couple of seconds; every server listens and remembers the beacons
// it heard, so the lobby browser can list the games nearby. Works on a home network and on
// virtual LANs (Radmin VPN, ZeroTier, Tailscale). Over the internet, room codes go through PeerJS
// (client/network/peer/PeerLink.ts).
import dgram from "dgram";
import os from "os";

export const DISCOVERY_PORT = Number(process.env.SINCLAIR_DISCOVERY_PORT) || 43595;
const BEACON_MS = 2000;
const FORGET_MS = 7000;

/** A game the browser can show. `address` is host:port for the client to connect to. */
export interface ServerEntry {
    address: string;
    name: string;
    host: string;
    players: number;
    maxPlayers: number;
    locked: boolean;
    inGame: boolean;
    roomCode?: string;
}

interface Beacon extends Omit<ServerEntry, "address"> {
    t: "sinclair";
    v: 1;
    id: string;
    port: number;
}

/** Directed broadcast addresses of this machine's IPv4 networks, plus the global one. */
function broadcastAddresses(): string[] {
    const out = new Set(["255.255.255.255"]);
    for (const nets of Object.values(os.networkInterfaces())) {
        for (const n of nets ?? []) {
            if (n.family !== "IPv4" || n.internal) continue;
            const ip = n.address.split(".").map(Number);
            const mask = n.netmask.split(".").map(Number);
            out.add(ip.map((b, i) => (b | (~mask[i] & 255)) & 255).join("."));
        }
    }
    return [...out];
}

/**
 * Where other machines reach this server, for the matchmaking registry and room-code lookups:
 * SINCLAIR_PUBLIC_ADDRESS (host:port) if set, else this machine's first LAN address.
 */
export function publicAddress(gamePort: number): string {
    const set = process.env.SINCLAIR_PUBLIC_ADDRESS?.trim();
    if (set) return set;
    for (const nets of Object.values(os.networkInterfaces())) {
        for (const n of nets ?? []) {
            if (n.family === "IPv4" && !n.internal) return `${n.address}:${gamePort}`;
        }
    }
    return `127.0.0.1:${gamePort}`;
}

export class Discovery {
    private readonly id = Math.random().toString(36).slice(2);
    private socket?: dgram.Socket;
    private timer?: NodeJS.Timeout;
    private readonly seen = new Map<string, { entry: ServerEntry; at: number }>();

    /** `advert` says what this server is hosting right now (undefined: nothing to advertise). */
    constructor(private readonly gamePort: number, private readonly advert: () => Omit<ServerEntry, "address"> | undefined) {}

    start(log: (msg: string) => void): void {
        const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
        socket.on("error", (err) => {
            log(`[sinclair] LAN discovery off: ${err.message}`);
            this.stop();
        });
        socket.on("message", (buf, rinfo) => {
            try {
                const b = JSON.parse(buf.toString("utf-8")) as Beacon;
                if (b.t !== "sinclair" || b.v !== 1 || b.id === this.id) return;
                const address = `${rinfo.address}:${b.port | 0}`;
                // A machine on several networks (LAN + VPN) is heard on each; keep the first.
                const known = this.seen.get(b.id);
                if (known && known.entry.address !== address && Date.now() - known.at < BEACON_MS) return;
                this.seen.set(b.id, {
                    at: Date.now(),
                    entry: {
                        address,
                        name: String(b.name).slice(0, 24),
                        host: String(b.host).slice(0, 12),
                        players: b.players | 0,
                        maxPlayers: b.maxPlayers | 0,
                        locked: !!b.locked,
                        inGame: !!b.inGame,
                        roomCode: b.roomCode,
                    },
                });
            } catch {}
        });
        socket.bind(DISCOVERY_PORT, () => {
            socket.setBroadcast(true);
            log(`[sinclair] LAN discovery on UDP ${DISCOVERY_PORT}`);
        });
        this.socket = socket;
        this.timer = setInterval(() => this.beacon(), BEACON_MS);
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        try {
            this.socket?.close();
        } catch {}
        this.socket = undefined;
    }

    /** The games heard from in the last few seconds, by name. */
    list(): ServerEntry[] {
        const now = Date.now();
        for (const [k, v] of this.seen) if (now - v.at > FORGET_MS) this.seen.delete(k);
        return [...this.seen.values()].map((v) => v.entry).sort((a, b) => a.name.localeCompare(b.name));
    }

    private beacon(): void {
        const ad = this.advert();
        if (!ad || !this.socket) return;
        const msg = Buffer.from(JSON.stringify({ t: "sinclair", v: 1, id: this.id, port: this.gamePort, ...ad } satisfies Beacon));
        for (const addr of broadcastAddresses()) {
            this.socket.send(msg, DISCOVERY_PORT, addr, () => {});
        }
    }
}
