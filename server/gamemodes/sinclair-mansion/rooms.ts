// Rooms: the lobby a host opens and friends join with its 6-character room code. Modelled on
// Impostor's GameManager and Game (an Among Us server): rooms are found by code, a code is
// re-rolled if it's taken, each player is in at most one room, the host role passes on when the
// host leaves, and a room closes once its last person is gone, so the next player can host.
//
// A room is one MurderGame's lobby. A server has as many rooms as it has mansions to play in,
// and the gamemode gives it one: every game plays in the same Sinclair Mansion (the same NPCs,
// doors and ground items), so a second room would put two games on top of each other. More rooms
// means more servers, and room codes and the matchmaking registry find a room on any of them.
import type { LobbySettings, MurderGame } from "./MurderGame";

/** No I/1 or O/0, so a code read out loud or off a screen can't be mistyped. */
export const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
/** Impostor tries ten codes before giving up. */
const CODE_ATTEMPTS = 10;

export function generateRoomCode(random: () => number = Math.random): string {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_CHARS[Math.floor(random() * ROOM_CODE_CHARS.length)];
    return code;
}

/** A typed or pasted code, upper-cased and stripped; undefined unless it's a whole code. */
export function normalizeRoomCode(text: unknown): string | undefined {
    if (typeof text !== "string") return undefined;
    const code = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return code.length === ROOM_CODE_LENGTH ? code : undefined;
}

/** A room as the browser, LAN beacons and the matchmaking registry list it (never the password). */
export interface RoomListing {
    roomCode: string;
    name: string;
    host: string;
    players: number;
    maxPlayers: number;
    locked: boolean;
    inGame: boolean;
}

export type RoomResult = { game: MurderGame; error?: undefined } | { game?: undefined; error: string };

export class RoomManager {
    constructor(
        /** The games rooms are played in (one per mansion). */
        private readonly games: readonly MurderGame[],
        private readonly newCode: () => string = generateRoomCode,
    ) {}

    /** Every game, open room or not (they all tick). */
    all(): readonly MurderGame[] {
        return this.games;
    }

    /** The open rooms. */
    rooms(): MurderGame[] {
        return this.games.filter((g) => g.lobby);
    }

    find(code: string): MurderGame | undefined {
        const wanted = normalizeRoomCode(code);
        return wanted ? this.rooms().find((g) => g.lobby!.roomCode === wanted) : undefined;
    }

    /** The room this person is in (or dropped out of, during their reconnect grace). */
    roomOf(key: string): MurderGame | undefined {
        return this.games.find((g) => g.lobby && g.participants.has(key) && !g.participants.get(key)!.isBot);
    }

    /** Open a room on a free mansion, with a code no other room here has. */
    host(key: string, name: string, settings: Partial<Omit<LobbySettings, "roomCode">>): RoomResult {
        const mine = this.roomOf(key);
        if (mine) return { error: `You're already in "${mine.lobby!.name}". Leave it first.` };
        const free = this.games.find((g) => !g.lobby);
        if (!free) {
            const busy = this.rooms()[0]?.lobby;
            return { error: busy ? `This server is already hosting "${busy.name}" (room ${busy.roomCode}). Join it instead.` : "There's no room free on this server." };
        }
        let roomCode = this.newCode();
        for (let i = 1; i < CODE_ATTEMPTS && this.find(roomCode); i++) roomCode = this.newCode();
        if (this.find(roomCode)) return { error: "Couldn't make a room code. Try again." };
        const error = free.hostLobby(key, name, { ...settings, roomCode });
        return error ? { error } : { game: free };
    }

    /**
     * Join the room with this code. Without a code, the only room on this server (the browser's
     * "This server" row). Full rooms, wrong passwords and so on are the game's to refuse.
     */
    join(key: string, name: string, code: string | undefined, password = ""): RoomResult {
        const open = this.rooms();
        const game = code !== undefined ? this.find(code) : open.length === 1 ? open[0] : undefined;
        if (!game) return { error: code !== undefined ? `There's no game with room code ${code.toUpperCase()}.` : "Nobody is hosting a game yet." };
        const mine = this.roomOf(key);
        if (mine && mine !== game) return { error: `You're already in "${mine.lobby!.name}". Leave it first.` };
        const error = game.joinLobby(key, name, password);
        return error ? { error } : { game };
    }

    /** The Leave button (between games only). */
    leave(key: string): string | undefined {
        const game = this.roomOf(key);
        return game ? game.leaveLobby(key) : undefined;
    }

    /** Lost connection: mid-game they keep their seat for the reconnect grace; otherwise they're out. */
    disconnect(key: string): void {
        this.roomOf(key)?.leave(key);
    }

    /**
     * Impostor destroys a game once nobody's in it. Here that's a room whose people all left
     * (or dropped and never came back) by the time it's between games.
     */
    closeEmpty(): void {
        for (const game of this.rooms()) {
            if ((game.phase === "lobby" || game.phase === "gameover") && game.humans().length === 0) game.closeLobby();
        }
    }

    list(): RoomListing[] {
        return this.rooms().map((g) => {
            const v = g.lobbyView("")!;
            return { roomCode: g.lobby!.roomCode, name: v.name, host: v.host, players: v.players.length, maxPlayers: v.maxPlayers, locked: v.locked, inGame: v.inGame };
        });
    }
}
