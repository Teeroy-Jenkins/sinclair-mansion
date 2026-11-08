// Latest Murder at Sinclair Mansion overlay data from the server
// (sent as a GAMEMODE_DATA packet with a `hud` key).

export type MurderRole = "detective" | "murderer" | "npc";

export interface MurderHud {
    phase: "lobby" | "intro" | "investigation" | "freeze" | "arrest" | "result" | "gameover";
    round: number;
    maxRounds: number;
    secondsLeft?: number;
    role?: MurderRole;
    rolePref: MurderRole | "random";
    alive: boolean;
    isHost: boolean;
    players: number;
    living: number;
    /** You hold the flypaper, so you're the Detective (even as the Murderer). Never told about anyone else. */
    hasFlypaper?: boolean;
    /** You can still Stop and Search someone this round (a right-click option on people). */
    stopSearch?: boolean;
    /** You carry a weapon from the pool: right-click "Plant weapon" on someone busy with a chore. */
    plant?: boolean;
    /** You planted a weapon on someone who still has it: right-click "Pickpocket" to take it back. */
    pickpocket?: boolean;
    /** Where Lord Sinclair's body was found, once someone has reported it. */
    crimeScene?: string;
    /** Bodies nobody has reported yet (NPC server ids): left-click Report on one to make it known. */
    unreported?: number[];
    weaponType?: string;
    /** The Detective's clues toward the weapon type (one a round from the body). */
    clues?: { have: number; need: number; possible: string[]; ready: boolean };
    tasks: Array<{ name: string; done: boolean; next?: string; where?: string }>;
    notes: string[];
    disturbed?: number;
    winner?: "detective" | "murderer";
    /**
     * Where your current chore step happens. With locIds, that furniture (or the stairs) is
     * outlined, Quest Helper style; without, the tiles are marked (an item on the floor).
     */
    marker?: { x: number; y: number; level: number; w: number; h: number; label: string; locIds?: number[] };
    /**
     * What furniture's own menu option reads for you: the chore step it does now ("Fill Jug"),
     * or "Search" in place of the cache's "Investigate" (only the Detective investigates).
     * `action` is the cache option (lowercase) being relabelled; the server still gets its index.
     */
    locLabels?: Array<{ locIds: number[]; x: number; y: number; level: number; w: number; h: number; action: string; label: string }>;
    /** Coins earned this game. */
    points: number;
    /** Your screen is black for a chore's long moment ("You water the plants for some time..."). */
    fade?: { id: number; caption: string };
    /** PvP is on: players (and the household NPCs) can be attacked outside the Wilderness. */
    pvp: boolean;
    /** You can still strike the grandfather clock (ends the round early, once a game). */
    clock?: boolean;
    /** Murderer only: escape routes (progress, tool needed, whether you hold it). */
    escapes?: Array<{ name: string; have: number; need: number; tool: string; hasTool: boolean }>;
    /** Murderer only: you can still work on an escape this round. */
    escapeReady?: boolean;
    /**
     * At the dinner table: everyone alive votes on who to arrest; more than half (`needed`)
     * arrests them. Only totals are shown, never who voted for whom. `mine` is your own vote
     * (a key, null for no arrest, or unset).
     */
    vote?: {
        needed: number;
        voters: number;
        voted: number;
        none: number;
        tally: Array<{ key: string; name: string; votes: number; you: boolean }>;
        mine?: string | null;
        /** The vote is settled: seconds until the table acts on it (votes can still be changed). */
        graceLeft?: number;
    };
    /** The hosted lobby, if anyone's hosting (never includes the password). */
    lobby?: LobbyView;
    /** You're in the lobby or its game; otherwise you're at the lobby browser. */
    joined: boolean;
    /** While the server browser is open: games other servers on the network are hosting. */
    servers?: ServerEntry[];
    /** The server's answer to your last Host or Join: why it failed, or where the room is. */
    notice?: LobbyNotice;
    /** The cosmetic store or bank is open (the lobby window steps aside). */
    browsing?: "store" | "bank";
    /** This session wants your saved progression from the browser (your lowercase name). */
    progressWanted?: string;
    /** Your progression (coins, cosmetics, bank) to save in the browser. */
    progress?: { name: string } & Record<string, unknown>;
}

/** A one-off lobby reply; act on each `id` once. */
export interface LobbyNotice {
    id: number;
    error?: string;
    /** The room code belongs to a game on another server: reconnect there and join it. */
    redirect?: { address: string; roomCode: string };
    /** Nobody nearby has this room code: look for its host over the internet (PeerJS). */
    tryPeer?: string;
}

/** A game another server is hosting; `address` is its host:port. */
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

export interface LobbyView {
    name: string;
    host: string;
    players: string[];
    maxPlayers: number;
    fillWithBots: boolean;
    locked: boolean;
    joined: boolean;
    isHost: boolean;
    inGame: boolean;
    canStart: boolean;
    /** Unique code friends use to find and join your game. */
    roomCode?: string;
}

export interface MurderHudState {
    hud: MurderHud;
    receivedAt: number; // performance.now() when it arrived, for the local countdown
}

let current: MurderHudState | undefined;
const listeners = new Set<(state: MurderHudState | undefined) => void>();
/** Set by the overlay so the lobby window can trigger a server switch. */
let switchServerCallback: ((address: string, onLoggedIn?: () => void) => void) | undefined;

export function setMurderHud(hud: MurderHud | undefined): void {
    current = hud ? { hud, receivedAt: performance.now() } : undefined;
    for (const cb of listeners) cb(current);
}

/** Called by the lobby window to switch to another server (e.g. after room code resolution). */
export function setSwitchServer(cb: (address: string, onLoggedIn?: () => void) => void): void {
    switchServerCallback = cb;
}

/** Triggers a server switch from anywhere that has access to the store. */
export function triggerSwitchServer(address: string, onLoggedIn?: () => void): void {
    switchServerCallback?.(address, onLoggedIn);
}

export function getMurderHud(): MurderHudState | undefined {
    return current;
}

export function subscribeMurderHud(cb: (state: MurderHudState | undefined) => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
