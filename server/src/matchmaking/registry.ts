// Matchmaking registry: which servers are up and which rooms they host, so a server browser can
// list rooms on other servers and a room code can be looked up wherever its room is.
//
// Every server keeps one in memory and registers itself in it (standalone: only its own room).
// With SINCLAIR_MATCHMAKING_URL set to another server's /matchmaking, a server also posts its
// heartbeat there and copies that registry's list, so every server agrees on one list.

import { logger } from "../utils/logger";

// ----------------------------------------------------------------------- types

/** A room as the browser shows it (never its password). */
export interface LobbyListing {
    roomCode: string;
    name: string;
    host: string;
    players: number;
    maxPlayers: number;
    locked: boolean;
    inGame: boolean;
}

/** A server that has registered with the registry. */
export interface ServerEntry {
    /** Unique id (the server's public address). */
    id: string;
    /** host:port for WebSocket connections. */
    address: string;
    name: string;
    /** Last heartbeat timestamp (ms). */
    lastHeartbeat: number;
    lobbies: LobbyListing[];
}

/** One browser row: a room and the server it's on. */
export interface RoomRow extends LobbyListing {
    address: string;
    serverName: string;
}

// ----------------------------------------------------------------------- Registry

const EXPIRE_MS = 30_000; // servers heartbeat every 10 s; gone after 30 s without one
const CLEANUP_INTERVAL_MS = 10_000;
const MAX_SERVERS = 500;
const MAX_LOBBIES = 8;

const text = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const count = (v: unknown) => Math.max(0, Math.min(99, Math.trunc(Number(v)) || 0));

/** A registration as sent over the network, cleaned up (undefined if it's unusable). */
export function sanitizeEntry(raw: unknown): Omit<ServerEntry, "lastHeartbeat"> | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const e = raw as Record<string, unknown>;
    const address = text(e.address, 255).trim();
    if (!address) return undefined;
    const lobbies = (Array.isArray(e.lobbies) ? e.lobbies : []).slice(0, MAX_LOBBIES).flatMap((l: Record<string, unknown>) => {
        const roomCode = text(l?.roomCode, 6).toUpperCase();
        return /^[A-Z0-9]{6}$/.test(roomCode)
            ? [{ roomCode, name: text(l.name, 24), host: text(l.host, 12), players: count(l.players), maxPlayers: count(l.maxPlayers), locked: !!l.locked, inGame: !!l.inGame }]
            : [];
    });
    return { id: text(e.id, 255).trim() || address, address, name: text(e.name, 40) || "Sinclair Server", lobbies };
}

export class MatchmakingRegistry {
    private readonly servers = new Map<string, ServerEntry>();
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(
        /** Another server's /matchmaking URL to sync with (empty: standalone). */
        private readonly centralUrl = "",
    ) {}

    start(): void {
        this.timer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
        this.timer.unref?.();
        logger.info(this.centralUrl ? `[matchmaking] syncing with ${this.centralUrl}` : "[matchmaking] standalone (this server's rooms only)");
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    /** Register or refresh a server. Its room list replaces the last one, so closed rooms drop off. */
    register(entry: Omit<ServerEntry, "lastHeartbeat">, at = Date.now()): void {
        if (!this.servers.has(entry.id) && this.servers.size >= MAX_SERVERS) return;
        this.servers.set(entry.id, { ...entry, lobbies: [...entry.lobbies], lastHeartbeat: at });
    }

    /** This server's own heartbeat: register here, and with the central registry if there is one. */
    async heartbeat(entry: Omit<ServerEntry, "lastHeartbeat">): Promise<void> {
        this.register(entry);
        if (!this.centralUrl) return;
        try {
            await fetch(`${this.centralUrl}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(entry),
                signal: AbortSignal.timeout(5000),
            });
            await this.syncFromCentral();
        } catch (err) {
            logger.warn(`[matchmaking] couldn't reach ${this.centralUrl}: ${(err as Error).message}`);
        }
    }

    /** Where the room with this code is (host:port). */
    resolveRoomCode(code: string): string | undefined {
        code = code.toUpperCase();
        return this.getAllServers().find((s) => s.lobbies.some((l) => l.roomCode === code))?.address;
    }

    /** Every room on every live server, by name. */
    getAllRooms(): RoomRow[] {
        return this.getAllServers()
            .flatMap((s) => s.lobbies.map((l) => ({ ...l, address: s.address, serverName: s.name })))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getAllServers(): ServerEntry[] {
        return [...this.servers.values()].filter((s) => !this.isExpired(s));
    }

    private cleanup(): void {
        for (const [id, server] of this.servers) if (this.isExpired(server)) this.servers.delete(id);
    }

    private isExpired(server: ServerEntry): boolean {
        return Date.now() - server.lastHeartbeat > EXPIRE_MS;
    }

    /** Copy the central registry's servers (as of now: they were live there). */
    private async syncFromCentral(): Promise<void> {
        const res = await fetch(`${this.centralUrl}/registry`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (!Array.isArray(data)) return;
        for (const raw of data) {
            const entry = sanitizeEntry(raw);
            if (entry) this.register(entry);
        }
    }
}

// ----------------------------------------------------------------------- singleton

let registry: MatchmakingRegistry | null = null;

export function getMatchmakingRegistry(): MatchmakingRegistry {
    if (!registry) {
        registry = new MatchmakingRegistry(process.env.SINCLAIR_MATCHMAKING_URL?.trim().replace(/\/+$/, "") ?? "");
        registry.start();
    }
    return registry;
}

export function resetMatchmakingRegistry(): void {
    registry?.stop();
    registry = null;
}
