// Engine-agnostic rules for Murder at Sinclair Mansion.
// Everything that touches the engine goes through the GameIO interface, so this
// file can be unit-tested with a fake IO (see tests/sinclair-mansion.test.ts).

import { MURDER_CONFIG as C, secToTicks } from "./config";
import { generateRoomCode } from "./rooms";

/**
 * Unordered set of names. Stored in alphabetical order so neither memory nor
 * any message encodes who touched something first. No timestamps are kept.
 */
export class PrintSet {
    private names: string[] = [];
    add(name: string): void {
        if (this.names.includes(name)) return;
        this.names.push(name);
        this.names.sort((a, b) => a.localeCompare(b));
    }
    clear(): void {
        this.names = [];
    }
    has(name: string): boolean {
        return this.names.includes(name);
    }
    list(): string[] {
        return this.names.slice();
    }
    get size(): number {
        return this.names.length;
    }
}

export type Role = "detective" | "murderer" | "npc";
export type RolePref = Role | "random";

/** A hosted lobby. The password is empty for an open game. */
export interface LobbySettings {
    name: string;
    password: string;
    /** Seats in the game, 4 to 12 (humans and bots together). */
    maxPlayers: number;
    /** Bots take the seats nobody joined. */
    fillWithBots: boolean;
    /** Short code the host shares so friends can find this lobby. */
    roomCode: string;
}

/** The lobby as the lobby browser shows it to one player. */
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
    /** Enough players (or bots) to start. */
    canStart: boolean;
    /** Short code the host shares so friends can find this lobby. */
    roomCode?: string;
}
export type Phase = "lobby" | "intro" | "investigation" | "freeze" | "arrest" | "result" | "gameover";

/**
 * One shot of the opening cutscene (a RuneScape quest cutscene, as 2009scape's Cutscene runs
 * them): where the camera stands (an index into the gamemode's camera list), who speaks, and what.
 */
export interface CutsceneShot {
    camera: number;
    /** "guard" speaks with his chathead; without a speaker the lines are narration. */
    speaker?: "guard";
    lines: string[];
}

export interface Tile {
    x: number;
    y: number;
    level: number;
}

export interface ContainerDef {
    id: string;
    name: string;
    locId: number;
    /** Every loc id that makes up this furniture (the chore marker outlines them all). */
    locIds?: number[];
    tile: Tile;
    w: number;
    h: number;
    /** false for chore-only spots (e.g. the dairy cow): can't be searched or used as a hiding place. */
    searchable?: boolean;
    /** The furniture's own menu option (lowercase, as the cache has it), for its menu label (locLabels). */
    action?: string;
}

/**
 * One chore step. With `fetch`, you find that item lying around the property (it respawns where it
 * was) and the step is done as soon as you hold it. Otherwise it happens at container/spot `c`:
 * with `use`, you Use that item on the spot (used up unless `keep`); without, the spot's own option
 * (Pick...) hands you `give`. Any step can hand back `give` (the bucket becomes a bucket of milk).
 * With `mix`, there's no spot: you Use `use` on the `mix` item in your pack (water on flour makes
 * dough), both are used up, and `returns` (the empty bucket and pot) come back, as in OSRS.
 */
export interface TaskStep {
    c?: string;
    fetch?: number;
    verb: string;
    sec: number;
    use?: number;
    give?: number;
    keep?: boolean;
    mix?: number;
    returns?: number[];
    /** Tools that must be held but aren't used up (the hammer when nailing a plank). */
    need?: number[];
    /**
     * The chore's long moment: the screen fades to black with this caption for
     * config.tasks.fadeSec ("You water the plants for some time..."). The chore-doer can't see or
     * move, and dying doesn't cut it short.
     */
    fade?: string;
    /** How the step looks while it's done (the gamemode maps it to an animation): "cook", "chop"... */
    anim?: string;
    /**
     * What the furniture's own menu option reads while this step is due there ("Fill Jug",
     * "Flush Drain"). Without one, it's made from the verb.
     */
    op?: string;
}
/** Where a tool turns up. One kept in furniture (`in`) is found by searching it; `tile` is that furniture's. */
export interface SpawnPoint {
    itemId: number;
    tile: Tile;
    in?: string;
    present: boolean;
    respawnAt: number;
}
export interface TaskDef {
    id: string;
    name: string;
    /** Past tense for talk and alibis, e.g. "baked the bread". */
    past?: string;
    steps: TaskStep[];
}

/** One reward: coins earned for something. */
export interface Earning {
    amount: number;
    reason: string;
}

/** Everyone's combat stats (config.pvp.stats): the same every game. */
export type CombatStats = typeof C.pvp.stats;

export interface Container extends ContainerDef {
    room: string;
    prints: PrintSet;
}

/** A blade or club from the pool. One is the murder weapon; the rest are decoys hidden around the house. */
export interface WeaponDef {
    itemId: number;
    name: string;
    category: string; // e.g. "dagger": what the wound at the crime scene reveals
}

export interface LiftEntry {
    round: number;
    target: string;
    room: string;
    prints?: string[];
    items?: string[];
    weapons?: Array<{ name: string; category: string; prints: string[] }>;
    wound?: string; // crime-scene inspection
}

export type ActionKind = "search" | "stash" | "give" | "plant" | "pickpocket" | "lift-container" | "lift-person" | "task" | "inspect" | "escape" | "frisk";

/** One of the Murderer's ways out: work at it with `tool`, once a round, until it gives. */
export interface EscapeDef {
    id: string;
    name: string;
    /** Where to stand next to (within 1 tile). */
    tile: Tile;
    tool: number;
    /** "Pick the lock" / "Chisel out a brick". */
    verb: string;
    /** What onlookers see, e.g. "picking the lock of the front gate". */
    seen: string;
    /** How working at it looks, repeated until the go is over (see TaskStep.anim). */
    anim?: string;
}
interface PendingAction {
    kind: ActionKind;
    target: string; // container id, participant key or "scene"
    item?: number; // weapon or chore tool involved
    left: number;
    total: number;
    from: Tile;
    /** The chore step's own look (TaskStep.anim). */
    anim?: string;
}

export interface Participant {
    key: string; // "h:<lowercased name>" for people, "b:<player id>" for bots
    name: string;
    isBot: boolean;
    role: Role;
    alive: boolean;
    rolePref: RolePref;
    tasks: Array<{ def: TaskDef; step: number }>;
    reported: Set<string>;
    notebook: LiftEntry[];
    /** Weapon type the Detective learned from the crime scene. */
    knownCategory?: string;
    action?: PendingAction;
    heldBy?: string;
    arrested?: boolean;
    openContainer?: string;
    bot?: Record<string, unknown>;
    /** Dropped mid-game: when, and where they stood. Cleared if they log back in within the grace period. */
    away?: { tick: number; at?: Tile };
    /** They had the Detective's flypaper when their connection dropped (it comes back with them). */
    carriedFlypaper?: boolean;
    /** Coins earned this game, and what for. */
    points: number;
    earned: Earning[];
    /** How they died, if they did (killed in a fight rather than arrested). */
    killedBy?: string;
    /** They've used their one strike of the grandfather clock this game. */
    rangClock?: boolean;
    /** Their screen is black for a chore's long moment, until this tick (it outlasts their death). */
    fade?: { id: number; caption: string; until: number };
}

export type WeaponAt =
    | { kind: "participant"; key: string }
    | { kind: "container"; id: string }
    | { kind: "ground"; tile: Tile }
    | { kind: "gone" };

export interface Weapon extends WeaponDef {
    /** Who slipped it into whose pack (unseen), so they can pickpocket it back. */
    plantedBy?: { by: string; on: string };
    id: number;
    real: boolean; // the murder weapon
    prints: PrintSet; // weapons keep their prints across rounds
    at: WeaponAt;
}

export interface GameIO {
    pos(p: Participant): Tile | undefined;
    roomAt(tile: Tile): string;
    message(p: Participant, text: string): void;
    announce(text: string): void;
    say(p: Participant, text: string): void;
    giveItem(p: Participant, itemId: number, quantity?: number): boolean;
    removeItem(p: Participant, itemId: number): boolean;
    /** Take up to `amount` coins (from the pack, then the bank). Returns how many were taken. */
    takeCoins(p: Participant, amount: number): number;
    hasItem(p: Participant, itemId: number): boolean;
    itemName(itemId: number): string;
    listItems(p: Participant): number[];
    /** The item in their weapon slot, if any. */
    wielding(p: Participant): number | undefined;
    spawnGround(itemId: number, tile: Tile, quantity?: number): void;
    removeGround(itemId: number, tile: Tile): void;
    teleport(p: Participant, tile: Tile): void;
    setFrozen(p: Participant, frozen: boolean): void;
    makeGhost(p: Participant): void;
    restore(p: Participant): void;
    /** Put a reconnected player back where they stood, with what they were carrying. */
    rejoin(p: Participant, at?: Tile): void;
    /**
     * Show what they're doing. Called when an action starts (`elapsed` 0) and every tick while it
     * lasts, so the gamemode can repeat the animation the way RuneScape repeats a skilling one.
     */
    animate(p: Participant, kind: ActionKind, anim?: string, elapsed?: number): void;
    /** Play one shot of the opening cutscene (camera and dialogue); bots ignore it. */
    cutscene(p: Participant, shot: CutsceneShot): void;
    /** The cutscene is over: the camera goes back to following them. */
    endCutscene(p: Participant): void;
    dialog(p: Participant, lines: string[]): void;
    choose(p: Participant, title: string, options: string[], onPick: (index: number) => void): void;
    /** Close any open dialog or choice (e.g. the arrest choice when time runs out). */
    closeDialog(p: Participant): void;
    /** Quest-style fade to black with an optional caption, and back. */
    fadeOut(p: Participant, caption?: string): void;
    fadeIn(p: Participant): void;
    face(p: Participant, tile: Tile): void;
    /** Show or clear Lord Sinclair's body and blood at the crime scene. Returns the body's NPC id, if shown. */
    setCrimeScene(tile: Tile, present: boolean): number | undefined;
    /**
     * Drop everything they carry and wear on the floor for anyone to take (coins stay: they're
     * the player's own). Returns what was dropped.
     */
    dropAll(p: Participant, tile: Tile): number[];
    /** Remove what the dead dropped last game. */
    clearDrops(): void;
    /** Remove all ground items left by the dead (called when the game ends, before the lobby). */
    clearGroundItems(): void;
    /**
     * A pool of blood where the Murderer killed someone, with the victim's body lying in it
     * (both cleared by clearKillMarks). Returns the body's NPC id.
     */
    markKill(tile: Tile): number | undefined;
    clearKillMarks(): void;
    /**
     * Give this game's combat stats, take away any combat gear, then wear `wear` (equipment slot
     * order) and carry `carry`. Bots get the same stats as NPC combat levels.
     */
    setupCombat(p: Participant, stats: CombatStats, wear: number[], carry: number[]): void;
    /** Back to full hitpoints (and prayer). */
    heal(p: Participant): void;
    /** Refill run energy (every round). */
    restoreRun(p: Participant): void;
    /** The grandfather clock in the dining room chimes for everyone. */
    chime(): void;
    /** Break off any fight they're in. */
    stopCombat(p: Participant): void;
    /** Take everything worn and carried except coins, chore tools and weapons from the pool. */
    takeKit(p: Participant): number[];
    /** Put kit items on (worn items go back on, the rest into the inventory). */
    giveKit(p: Participant, items: number[]): void;
    /** OSRS's "Quest complete!" scroll. */
    questScroll(p: Participant, scroll: QuestScroll): void;
}

export interface QuestScroll {
    title: string;
    subtitle: string;
    itemId?: number;
    lines: string[];
    footer: string;
}

/** Something a participant noticed happening near them (used by bots to talk sense). */
export type Observation =
    | { kind: "rummage"; actor: string; container: string; room: string; tick: number }
    | { kind: "handoff"; actor: string; target: string; room: string; tick: number }
    | { kind: "dust"; target: string; room: string; tick: number }
    | { kind: "pickpocket"; actor: string; target: string; room: string; tick: number };

export interface MurderHud {
    phase: Phase;
    round: number;
    maxRounds: number;
    secondsLeft?: number;
    role?: Role;
    rolePref: RolePref;
    alive: boolean;
    isHost: boolean;
    players: number;
    living: number;
    /**
     * You hold the flypaper, so you're the Detective (whatever role you were dealt: the Murderer
     * can be the Detective too). Who the Detective is is never sent to anyone else.
     */
    hasFlypaper?: boolean;
    /** The Detective can still Stop and Search someone this round. */
    stopSearch?: boolean;
    /**
     * You carry a weapon from the pool: a right-click "Plant weapon" on people slips it, unseen,
     * into the pack of someone whose screen is black (busy with a chore's long moment).
     */
    plant?: boolean;
    /** You planted a weapon on someone who still has it: right-click "Pickpocket" to take it back. */
    pickpocket?: boolean;
    /** Where Lord Sinclair's body was found, once someone has reported it. */
    crimeScene?: string;
    /** Bodies nobody has reported yet (NPC ids): the client offers Report on them. */
    unreported?: number[];
    weaponType?: string;
    /** The Detective's progress on the weapon type: clues so far, clues needed, types left, and whether the body has a clue this round. */
    clues?: { have: number; need: number; possible: string[]; ready: boolean };
    tasks: Array<{ name: string; done: boolean; next?: string; where?: string }>;
    notes: string[];
    disturbed?: number;
    winner?: "detective" | "murderer";
    /**
     * What furniture's own menu option reads for you (the client swaps the cache's label at that
     * option, `action`): the chore step it does now ("Fill Jug"), or "Search" where the cache
     * says "Investigate" or "Open". Only the Detective sees "Investigate".
     */
    locLabels?: Array<{ locIds: number[]; x: number; y: number; level: number; w: number; h: number; action: string; label: string }>;
    /**
     * Where your next chore step happens. With locIds, the client outlines that furniture (or the
     * stairs); without, it marks the tiles (an item lying on the floor).
     */
    marker?: { x: number; y: number; level: number; w: number; h: number; label: string; locIds?: number[] };
    /** Coins earned this game. */
    points: number;
    /** Your screen is black for a chore's long moment (a new `id` each time). */
    fade?: { id: number; caption: string };
    /** Players may attack each other (the client shows "Attack" outside the Wilderness). */
    pvp: boolean;
    /** You may still strike the grandfather clock to end this round early (once a game). */
    clock: boolean;
    /** The Murderer's escape routes: progress, what it takes, and whether they hold the tool. */
    escapes?: Array<{ name: string; have: number; need: number; tool: string; hasTool: boolean }>;
    /** The Murderer can still work on an escape this round. */
    escapeReady?: boolean;
    /**
     * At the dinner table: the vote so far. Only the totals for each person (and for no arrest),
     * never who voted for whom; `mine` is your own vote (a key, null for no arrest, or unset).
     */
    vote?: {
        needed: number;
        voters: number;
        voted: number;
        none: number;
        tally: Array<{ key: string; name: string; votes: number; you: boolean }>;
        mine?: string | null;
    };
    /** The hosted lobby, if any (the lobby browser and the host's settings). */
    lobby?: LobbyView;
    /** You're in the lobby (or its game); otherwise you're just browsing. */
    joined: boolean;
    /** The server browser: games other servers on the network are hosting (while you look). */
    servers?: Array<{ address: string; name: string; host: string; players: number; maxPlayers: number; locked: boolean; inGame: boolean; roomCode?: string }>;
    /** The answer to your last Host or Join (Impostor's join result): why it failed, or where the room is. */
    notice?: LobbyNotice;
    /** The cosmetic store or bank is open (the lobby window steps aside). */
    browsing?: "store" | "bank";
    /** This session still wants your saved progression from the browser (your lowercase name). */
    progressWanted?: string;
    /** Your progression (coins, cosmetics, bank) for the browser to save. */
    progress?: unknown;
}

/** A one-off lobby reply; the client acts on each `id` once. */
export interface LobbyNotice {
    id: number;
    /** Hosting or joining failed. */
    error?: string;
    /** The room code belongs to a game on another server: reconnect there and join it. */
    redirect?: { address: string; roomCode: string };
    /** Nobody nearby has this room code: the client looks for its host over the internet (PeerJS). */
    tryPeer?: string;
}

export interface MansionLayout {
    containers: ContainerDef[];
    tasks: TaskDef[];
    weaponPool: WeaponDef[];
    /** How a wound from each weapon category reads at the crime scene. */
    wounds: Record<string, string>;

    crimeScenes: Tile[];
    detectiveItemId: number; // the Detective's print-lifting kit
    /** Seats around the dining table, used when the clock strikes. */
    seats: Tile[];
    detectiveSpot: Tile; // head of the table
    /** Visibility zone of a tile: living players only see people in the same zone. */
    zoneAt(tile: Tile): string;
    tableCenter: Tile;
    weaponDrop: Tile;
    /** Where someone killed in a lobby brawl gets back up (inside the front gate). */
    lobbyRespawn: Tile;
    /** The grandfather clock in the dining room. */
    clock: Tile;
    /** The staircase footprint on each floor (the marker points here when your chore is on the other floor). */
    stairs: Array<{ tile: Tile; w: number; h: number; locIds?: number[] }>;
    /** Chore tools (and the Murderer's lockpick and chisel) lying around; each spot respawns its item. */
    /** Where each tool turns up: on the floor or a tabletop (`tiles`), or kept in furniture (`in`, container ids). */
    itemSpawns: Array<{ itemId: number; tiles?: Tile[]; in?: string[] }>;
    /** The Murderer's escape routes. */
    escapes: EscapeDef[];
}

/** Gold coins: the reward currency. */
export const COINS = 995;

const ARREST_REMINDER_SEC = 15; // those who haven't voted are reminded this long before time runs out

const shuffle = <T>(a: T[]): T[] => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};
const pickOne = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const cheb = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const distToRect = (p: Tile, c: ContainerDef): number => {
    const dx = Math.max(0, c.tile.x - p.x, p.x - (c.tile.x + c.w - 1));
    const dy = Math.max(0, c.tile.y - p.y, p.y - (c.tile.y + c.h - 1));
    return Math.max(dx, dy);
};
/** "the Kitchen", but "David's Room" without the article. */
export const theRoom = (room: string, lower = false): string =>
    room.includes("'s ") ? room : `the ${lower ? room.toLowerCase() : room}`;
/** A chore step's menu option: its `op`, or its verb without the little words ("Fill the jug" -> "Fill Jug"). */
export const stepOp = (s: TaskStep): string =>
    s.op ??
    s.verb
        .split(" ")
        .filter((w) => !/^(the|a|an|some|at|in|into|onto|on|from|with|of|to|out|back|again|together)$/i.test(w))
        .slice(0, 3)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(" ");

/** A body lying in its blood: Lord Sinclair's, or one of the Murderer's victims. */
export interface Body {
    /** Its index in MurderGame.bodies (0: Lord Sinclair). */
    id: number;
    tile: Tile;
    room: string;
    /** The victim's name (none: Lord Sinclair). */
    victim?: string;
    /** Who killed them (a participant key). */
    killer?: string;
    /** Someone has found it and reported it: everyone knows where it is. */
    reported: boolean;
    /** A victim's body has given the Detective its clue. */
    studied: boolean;
    /** The body's NPC in the world, if the engine spawned one. */
    npc?: number;
}

export class MurderGame {
    readonly participants = new Map<string, Participant>();
    readonly containers = new Map<string, Container>();
    weapons: Weapon[] = [];
    crimeScene: { tile: Tile; room: string } | undefined;
    /**
     * The bodies: Lord Sinclair's (id 0, at the crime scene) and one for everyone the Murderer
     * kills, lying in their blood. Nobody knows where a body is until someone reports it.
     */
    bodies: Body[] = [];
    phase: Phase = "lobby";
    round = 0;
    tick = 0;
    phaseStart = 0;
    phaseEnds = 0;
    hostKey: string | undefined;
    /** How many people (and bots) sat down when this game started. Leaving and rejoining mid-game
     *  (or a newcomer watching as a ghost) never changes it, so the HUD and prices stay steady. */
    private rosterSize = 0;
    disturbed = new Set<string>();
    lastReport: { kind: "container" | "participant"; id: string; round: number } | undefined;
    winner: "detective" | "murderer" | undefined;
    private endReason: string | undefined;
    /**
     * What the crime scene has given up: the weapon types still possible, clues found so far, how
     * many it takes (more players, more clues) and the round of the last one (one per round). It
     * belongs to the case, so a new Detective carries on from it.
     */
    caseFile = { possible: [] as string[], clues: 0, needed: 2, lastRound: 0 };
    /** The dead Detective's things (the flypaper among them), on the floor for anyone to take. */
    detectiveKit: { tile: Tile; items: number[] } | undefined;
    /** The round the Detective last used their Stop and Search (once a round, whoever holds the flypaper). */
    lastFrisk = 0;
    /** At the dinner table: each voter's choice, a participant key or null for no arrest (secret). */
    readonly votes = new Map<string, string | null>();
    /** Item ids handed out for chores (removed again at the end of each round). */
    readonly toolIds: Set<number>;
    /** The Murderer's escape tools (lockpick, chisel): kept from round to round. */
    readonly escapeTools: Set<number>;
    /** Where items lie around the property; a picked-up one comes back after a while. */
    readonly spawnPoints: SpawnPoint[];
    /** The Murderer's escape: progress per route, the last round worked, and how much it takes. */
    escape = { progress: {} as Record<string, number>, lastRound: 0, needed: 3 };
    /** Bot brain hook, called for every bot each tick (set by the gamemode). */
    botThink: ((game: MurderGame, p: Participant) => void) | undefined;
    /** Called for every participant who witnesses something (bots remember it). */
    onObserve: ((observer: Participant, ev: Observation) => void) | undefined;
    /** Called when a participant finishes something themselves (bots remember it for alibis). */
    onActivity: ((p: Participant, text: string) => void) | undefined;
    /** Called when a living participant says something in public chat (bots listen). */
    onChat: ((speaker: Participant, text: string) => void) | undefined;
    /** The last tick each bot picked something up off the floor (bots: one pickup every 2 ticks). */
    private readonly botPickTick = new Map<string, number>();
    botNames: string[] = [];
    /** Creates a bot participant in the world; returns its key. */
    spawnBot: ((name: string, tile: Tile) => string | undefined) | undefined;
    despawnBot: ((p: Participant) => void) | undefined;

    constructor(
        readonly io: GameIO,
        readonly layout: MansionLayout,
    ) {
        for (const def of layout.containers) {
            this.containers.set(def.id, { ...def, room: io.roomAt(def.tile), prints: new PrintSet() });
        }
        this.toolIds = new Set(
            layout.tasks.flatMap((t) => t.steps.flatMap((s) => [s.use, s.give, s.fetch])).filter((id): id is number => id !== undefined),
        );
        this.escapeTools = new Set(layout.escapes.map((e) => e.tool));
        this.spawnPoints = layout.itemSpawns.flatMap((s) => [
            ...(s.tiles ?? []).map((tile) => ({ itemId: s.itemId, tile, present: false, respawnAt: 0 })),
            ...(s.in ?? []).map((id) => ({ itemId: s.itemId, tile: this.containers.get(id)!.tile, in: id, present: false, respawnAt: 0 })),
        ]);
    }

    // ---------------------------------------------------------------- lobby
    /**
     * The lobby (a room, see rooms.ts): someone hosts it (name, optional password, player cap,
     * bots or not) and others join it. Only lobby members are participants; anyone else
     * connected is just looking at the lobby browser. One lobby per game: the game is the mansion.
     */
    lobby: LobbySettings | undefined;

    /** Host a new lobby (when there isn't one). Returns an error message, or undefined. */
    hostLobby(key: string, name: string, settings: Partial<LobbySettings>): string | undefined {
        if (this.lobby) return "There's already a game here. Join it instead.";
        if (this.phase !== "lobby" && this.phase !== "gameover") return "A game is already running.";
        this.lobby = this.cleanLobby({ name: `${name}'s game`, password: "", maxPlayers: C.lobby.defaultTotalPlayers, fillWithBots: true, ...settings });
        this.join(key, name);
        this.hostKey = key;
        return undefined;
    }

    /** Join the lobby. While a game runs, you watch it as a ghost and play in the next one. */
    joinLobby(key: string, name: string, password = ""): string | undefined {
        const lobby = this.lobby;
        if (!lobby) return "Nobody is hosting a game yet.";
        if (this.participants.get(key) && !this.participants.get(key)!.isBot) return undefined;
        if (lobby.password && password !== lobby.password) return "Wrong password.";
        if (this.humans().length >= lobby.maxPlayers) return "That game is full.";
        this.join(key, name);
        this.announce(`${name} joined the game.`);
        return undefined;
    }

    /** The host changes their lobby (between games). */
    configureLobby(byKey: string, settings: Partial<LobbySettings>): string | undefined {
        if (!this.lobby) return "There's no game to change.";
        if (byKey !== this.hostKey) return "Only the host can change the game.";
        if (this.phase !== "lobby" && this.phase !== "gameover") return "Wait until this game is over.";
        const next = this.cleanLobby({ ...this.lobby, ...settings });
        if (next.maxPlayers < this.humans().length) return `There are already ${this.humans().length} players.`;
        this.lobby = next;
        return undefined;
    }

    /**
     * Leave the lobby (the lobby window's Leave, or the logout tab's Leave Lobby). During a game
     * it counts as dying, as a dropped connection does (a Murderer who leaves is caught), and
     * they're out of the room: joining again before the game ends makes them a ghost.
     */
    leaveLobby(key: string): string | undefined {
        const p = this.participants.get(key);
        if (!p) return undefined;
        const running = this.phase !== "lobby" && this.phase !== "gameover";
        this.leave(key);
        if (running) {
            this.io.restore(p); // no longer a ghost: they're out of the mansion
            this.participants.delete(key);
            if ((this.phase === "lobby" || this.phase === "gameover") && this.humans().length === 0) this.closeLobby();
        } else {
            this.announce(`${p.name} left the game.`);
        }
        return undefined;
    }

    /** Players in this game: everyone who sat down when it started (while it runs), else everyone in the room. */
    playerCount(): number {
        const running = this.phase !== "lobby" && this.phase !== "gameover";
        return running && this.rosterSize > 0 ? this.rosterSize : this.participants.size;
    }

    /** The people (not bots) in the lobby or game. */
    public humans(): Participant[] {
        return [...this.participants.values()].filter((p) => !p.isBot);
    }

    /**
     * Nobody's left: close the room. The last game's bots go home and the mansion is free for
     * the next host.
     */
    closeLobby(): void {
        if (this.phase !== "lobby" && this.phase !== "gameover") return;
        for (const p of [...this.participants.values()]) {
            if (p.isBot) this.despawnBot?.(p);
            this.participants.delete(p.key);
        }
        this.lobby = undefined;
        this.hostKey = undefined;
        this.phase = "lobby";
        this.winner = undefined;
    }

    private cleanLobby(s: Omit<LobbySettings, "roomCode"> & { roomCode?: string }): LobbySettings {
        const name = String(s.name ?? "").replace(/\s+/g, " ").trim().slice(0, C.lobby.lobbyNameMax);
        return {
            name: name || "Murder at Sinclair Mansion",
            password: String(s.password ?? "").slice(0, C.lobby.passwordMax),
            maxPlayers: Math.max(C.lobby.minPlayers, Math.min(C.lobby.maxPlayers, Math.trunc(Number(s.maxPlayers)) || C.lobby.defaultTotalPlayers)),
            fillWithBots: s.fillWithBots !== false,
            roomCode: s.roomCode || generateRoomCode(),
        };
    }

    /** What the lobby browser shows (never the password itself). */
    lobbyView(key: string): LobbyView | undefined {
        const lobby = this.lobby;
        if (!lobby) return undefined;
        const humans = this.humans();
        const me = this.participants.get(key);
        const host = this.hostKey ? this.participants.get(this.hostKey) : undefined;
        return {
            name: lobby.name,
            host: host?.name ?? "",
            players: humans.map((p) => p.name),
            maxPlayers: lobby.maxPlayers,
            fillWithBots: lobby.fillWithBots,
            locked: !!lobby.password,
            joined: !!me && !me.isBot,
            isHost: this.hostKey === key,
            inGame: this.phase !== "lobby" && this.phase !== "gameover",
            canStart: humans.length >= C.lobby.minPlayers || (lobby.fillWithBots && lobby.maxPlayers >= C.lobby.minPlayers),
            roomCode: lobby.roomCode,
        };
    }

    join(key: string, name: string, isBot = false): Participant {
        const existing = this.participants.get(key);
        if (existing?.away) {
            const at = existing.away.at;
            existing.away = undefined;
            this.announce(`${existing.name} is back.`);
            this.io.rejoin(existing, at);
            return existing;
        }
        if (existing) return existing;
        // Between games (the lobby, or the end screen) newcomers are simply in the next game.
        const running = this.phase !== "lobby" && this.phase !== "gameover";
        const p: Participant = {
            key, name, isBot, role: "npc", alive: !running, rolePref: "random",
            tasks: [], reported: new Set(), notebook: [], points: 0, earned: [],
        };
        this.participants.set(key, p);
        if (!isBot && !this.hostKey) this.hostKey = key;
        if (running && !isBot) {
            this.io.makeGhost(p);
            this.io.message(p, "A game is in progress. You are watching as a ghost until it ends.");
        }
        return p;
    }

    leave(key: string): void {
        const p = this.participants.get(key);
        if (!p) return;
        if (this.phase === "lobby" || this.phase === "gameover") {
            this.participants.delete(key);
        } else if (!p.away) {
            // Leaving during a game counts as dying: the living drop everything they carry (a
            // Murderer who runs is caught). Their seat is kept, so if they come back before this
            // game is over they're a ghost; it's let go when the game ends.
            const wasDetective = this.isDetective(p);
            this.cancel(p);
            p.carriedFlypaper = false;
            p.away = { tick: this.tick, at: this.io.pos(p) };
            if (p.alive) this.forfeit(p, wasDetective);
        }
        if (this.hostKey === key) {
            this.hostKey = [...this.participants.values()].find((q) => !q.isBot && q.key !== key && !q.away)?.key;
            const next = this.hostKey ? this.participants.get(this.hostKey) : undefined;
            if (next) this.announce(`${next.name} is now the host.`);
        }
        // Between games, the last person out closes the lobby.
        if ((this.phase === "lobby" || this.phase === "gameover") && this.humans().length === 0) this.closeLobby();
    }

    /** A living player left mid-game: they count as dead, and drop all they had where they stood. */
    private forfeit(p: Participant, wasDetective: boolean): void {
        const at = p.away?.at ?? this.io.pos(p) ?? this.layout.weaponDrop;
        if (p.role === "murderer" && !this.living().some((q) => q !== p && q.role === "murderer")) {
            // The Murderer running off is the Murderer caught: the game is over, and nobody is rewarded.
            this.io.stopCombat(p);
            p.alive = false;
            p.arrested = true;
            this.endGame("detective", `${p.name} was the Murderer, and was caught fleeing the mansion! The game is over, with no rewards.`, true);
            return;
        }
        this.announce(`${p.name} has left the mansion.`);
        p.killedBy = "leaving";
        // Weapons fall where they stood, prints and all.
        for (const w of this.weaponsHeldBy(p)) {
            this.io.removeItem(p, w.itemId);
            w.at = { kind: "ground", tile: { ...at } };
            this.io.spawnGround(w.itemId, at);
        }
        // The Detective's flypaper and gear too: whoever picks up the flypaper is the Detective.
        if (wasDetective) this.dropKit(at, this.io.takeKit(p));
        // And everything else (chore tools, role items, gear); coins and cosmetics stay theirs.
        this.io.dropAll(p, at);
        this.eliminate(p, false);
        if (this.murdererAlone()) this.endGame("murderer", "Nobody is left but the Murderer. The Murderer gets away with it!");
    }

    setRolePref(p: Participant, pref: RolePref): string {
        if (!C.lobby.allowRolePick) return "Role requests are disabled.";
        if (this.phase !== "lobby" && this.phase !== "gameover") return "You can only pick a role in the lobby.";
        p.rolePref = pref;
        return `You will ${pref === "random" ? "get a random role" : `be the ${pref === "npc" ? "household (NPC)" : pref}`} next game. Only you can see this.`;
    }

    /**
     * The host starts the game. With "fill with bots" on, bots take the empty seats up to the
     * lobby's player cap; otherwise only the people who joined play. (`totalPlayers` overrides
     * the cap, for tests and the ::start command.)
     */
    start(byKey: string, totalPlayers?: number): string | undefined {
        if (this.phase !== "lobby" && this.phase !== "gameover") return "A game is already running.";
        if (byKey !== this.hostKey) return "Only the host can start the game.";
        if (!this.lobby) this.lobby = this.cleanLobby({ name: "", password: "", maxPlayers: totalPlayers ?? C.lobby.defaultTotalPlayers, fillWithBots: true });
        totalPlayers ??= this.lobby.fillWithBots ? this.lobby.maxPlayers : 0;
        // Clear the previous game's bots and ghosts.
        for (const p of [...this.participants.values()]) {
            if (p.isBot) {
                this.despawnBot?.(p);
                this.participants.delete(p.key);
            }
        }
        const humans = [...this.participants.values()];
        if (totalPlayers <= humans.length && humans.length < C.lobby.minPlayers) {
            return `Need at least ${C.lobby.minPlayers} players (or turn on bots to fill the empty seats).`;
        }
        const total = Math.min(C.lobby.maxPlayers, Math.max(humans.length, totalPlayers));
        const used = new Set(humans.map((h) => h.name.toLowerCase()));
        const names = shuffle(this.botNames.filter((n) => !used.has(n.toLowerCase())));
        while (this.participants.size < total && names.length) {
            const name = names.pop()!;
            const key = this.spawnBot?.(name, this.layout.seats[this.participants.size % this.layout.seats.length]);
            if (key) this.join(key, name, true);
            else break;
        }
        if (this.participants.size < C.lobby.minPlayers) return `Need at least ${C.lobby.minPlayers} players.`;

        // Reset the world.
        for (const w of this.weapons) this.clearWeaponFromWorld(w);
        this.weapons = [];
        this.winner = undefined;
        for (const c of this.containers.values()) c.prints.clear();
        this.io.clearKillMarks();
        this.io.clearDrops();
        this.bodies = [];
        const all = [...this.participants.values()];
        this.rosterSize = all.length;
        for (const p of all) {
            Object.assign(p, { alive: true, role: "npc", tasks: [], notebook: [], knownCategory: undefined, action: undefined, heldBy: undefined, arrested: false, openContainer: undefined, fade: undefined, carriedFlypaper: false });
            p.reported = new Set();
            this.io.restore(p);
        }
        for (const p of all) {
            p.points = 0;
            p.earned = [];
            p.killedBy = undefined;
            p.rangClock = false;
        }
        this.detectiveKit = undefined;
        this.lastFrisk = 0;
        const d = C.detective;
        this.caseFile = {
            possible: shuffle([...new Set(this.layout.weaponPool.map((w) => w.category))]),
            clues: 0,
            needed: Math.max(d.minClues, Math.min(d.maxClues, Math.round(all.length / d.playersPerClue))),
            lastRound: 0,
        };
        // The Murderer needs half again as many rounds to get out as the Detective needs clues.
        this.escape = { progress: {}, lastRound: 0, needed: Math.ceil(this.caseFile.needed * C.murderer.escapeRoundsPerClue) };
        this.assignRoles(all);
        this.placeDecoys();
        this.resetSpawns();
        this.placeCrimeScene();
        // Same combat stats for everyone, always; only the Detective is dressed for a fight.
        for (const p of all) {
            const wear = p.role === "detective" ? C.pvp.detectiveGear.slice() : [];
            this.io.setupCombat(p, C.pvp.stats, wear, p.role === "murderer" ? [C.pvp.dragonClaws] : []);
        }
        // The flypaper makes the Detective: whoever holds it from now on is the Detective.
        const det = all.find((p) => p.role === "detective");
        if (det) this.io.giveItem(det, this.layout.detectiveItemId);
        this.round = 1;
        this.startIntro(); // seats everyone once the screen is black
        return undefined;
    }

    // ---------------------------------------------------------------- the opening cutscene
    /**
     * Before the first round, a short quest-style cutscene (2009scape's Cutscene: fade, camera
     * shots, chathead dialogue on a timer): the household at the dinner table, the guard bursting
     * in with the news of the murder, and the camera down the table. Who the Detective is is never
     * said: the guard only warns there's one among them.
     */
    private introShots(): CutsceneShot[] {
        // Where the body lies is for the household to find: whoever comes across it reports it.
        return [
            { camera: 0, lines: ["Evening at Sinclair Mansion.", "The household sits down to dinner..."] },
            { camera: 1, speaker: "guard", lines: ["Nobody move! Lord Sinclair has been murdered!", "His body is somewhere on the grounds. Whoever finds it, report it!", "And the killer is sitting at this table."] },
            { camera: 2, speaker: "guard", lines: ["There's a detective among you, and they will find the killer.", "The rest of you, get on with your chores.", "Nobody leaves this house!"] },
        ];
    }
    private introShot = -1;
    private introSeated = false;
    /**
     * The timeline (`C.intro`): the client fades to black and shows the title; only once the screen
     * is black are the household seated and the first shot's camera cut in, so nothing changes in
     * view. The client then fades in on that shot, the camera glides through the rest, and at the
     * end it glides back to each player's own view (MurderFade.tsx, the camera reset's hand-back).
     */
    private startIntro(): void {
        this.setPhase("intro", C.round.introSec);
        this.introShot = -1;
        this.introSeated = false;
        for (const p of this.participants.values()) if (p.alive) this.io.setFrozen(p, true);
    }
    private updateIntro(): void {
        const t = this.tick - this.phaseStart;
        if (t < secToTicks(C.intro.seatSec)) return; // still fading to black
        if (!this.introSeated) {
            this.introSeated = true;
            this.lineUp();
            for (const p of this.living()) this.io.face(p, this.layout.tableCenter);
        }
        const shots = this.introShots();
        const next = C.intro.shotEndsSec.findIndex((sec) => t < secToTicks(sec));
        const shot = Math.min(shots.length - 1, next < 0 ? shots.length - 1 : next);
        if (shot === this.introShot) return;
        this.introShot = shot;
        for (const p of this.participants.values()) this.io.cutscene(p, shots[shot]);
    }
    private endIntro(): void {
        for (const p of this.participants.values()) {
            this.io.endCutscene(p);
            this.io.dialog(p, this.roleBlurb(p));
        }
        this.startInvestigation();
        this.announce("Lord Sinclair has been murdered! Find his body and report it (left-click it).");
    }

    private assignRoles(all: Participant[]): void {
        const nMurder = Math.max(1, Math.round(all.length / C.roles.playersPerMurderer));
        const wants = (r: Role) => shuffle(all.filter((p) => !p.isBot && C.lobby.allowRolePick && p.rolePref === r));
        const pool = shuffle(all.filter((p) => !(C.lobby.allowRolePick && !p.isBot && p.rolePref === "npc")));
        const picked = new Set<string>();
        const take = (list: Participant[], k: number, role: Role) => {
            let n = 0;
            for (const p of list) {
                if (n >= k) break;
                if (picked.has(p.key)) continue;
                p.role = role;
                picked.add(p.key);
                n++;
            }
            return n;
        };
        if (!take(wants("detective"), 1, "detective")) take(pool.filter((p) => p.isBot || p.rolePref !== "murderer"), 1, "detective");
        const m = take(wants("murderer"), nMurder, "murderer");
        if (m < nMurder) take(pool.filter((p) => p.isBot || p.rolePref !== "detective"), nMurder - m, "murderer");
        // Each Murderer starts holding a random weapon from the pool, so they're always in its print set.
        const pool2 = shuffle(this.layout.weaponPool.slice());
        all.filter((p) => p.role === "murderer").forEach((p) => {
            const def = pool2.pop() ?? this.layout.weaponPool[0];
            const w = this.addWeapon(def, true, { kind: "participant", key: p.key });
            w.prints.add(p.name);
            this.io.giveItem(p, w.itemId);
        });
    }

    private addWeapon(def: WeaponDef, real: boolean, at: WeaponAt): Weapon {
        const w: Weapon = { ...def, id: this.weapons.length, real, prints: new PrintSet(), at };
        this.weapons.push(w);
        return w;
    }

    /** Red herrings: one per two members of the household, hidden in furniture (one per piece), clean of prints. */
    redHerringCount(): number {
        const household = [...this.participants.values()].filter((p) => p.role === "npc").length;
        return Math.max(1, Math.floor(household * C.weapons.redHerringsPerHousehold));
    }
    private placeDecoys(): void {
        const used = new Set(this.weapons.map((w) => w.itemId));
        const defs = shuffle(this.layout.weaponPool.filter((d) => !used.has(d.itemId))).slice(0, this.redHerringCount());
        const spots = shuffle([...this.containers.values()].filter((c) => c.searchable !== false));
        defs.forEach((d, i) => this.addWeapon(d, false, { kind: "container", id: spots[i % spots.length].id }));
    }

    private placeCrimeScene(): void {
        if (this.crimeScene) this.io.setCrimeScene(this.crimeScene.tile, false);
        const tile = pickOne(this.layout.crimeScenes);
        this.crimeScene = { tile, room: this.io.roomAt(tile) };
        const npc = this.io.setCrimeScene(tile, true);
        this.bodies.push({ id: this.bodies.length, tile: { ...tile }, room: this.crimeScene.room, reported: false, studied: false, npc });
    }

    roleBlurb(p: Participant): string[] {
        if (p.role === "detective") {
            return [
                "You are the DETECTIVE. Nobody was told, but your gear gives you away.",
                "Use flypaper on the body for a clue, and on furniture or people to lift prints. Once a round, right-click someone to Stop and Search them.",
                "Whoever holds your flypaper is the Detective: if you die, anyone can pick it up.",
            ];
        }
        if (p.role === "murderer") {
            const w = this.weaponsHeldBy(p).find((x) => x.real);
            return [
                `You are the MURDERER. You did it with the ${w?.name ?? "weapon"}.`,
                "Your prints are on it forever. Stash it in furniture, Use it on someone to hand it over, or right-click Plant weapon on someone busy with a chore (screen black) to frame them unseen.",
                "Do your chores like everyone else: they're your alibi.",
            ];
        }
        return [
            "You are a member of the Sinclair household.",
            "Do your chores: fetch the tools and follow the yellow arrow.",
            "Search furniture, report weapons you find, and help the Detective.",
        ];
    }

    // ---------------------------------------------------------------- round loop
    private setPhase(phase: Phase, sec: number): void {
        this.phase = phase;
        this.phaseStart = this.tick;
        this.phaseEnds = this.tick + secToTicks(sec);
    }

    private startInvestigation(): void {
        this.setPhase("investigation", C.round.investigationSec);
        // Prints on furniture reset every round; weapons keep theirs.
        for (const c of this.containers.values()) c.prints.clear();
        this.disturbed.clear();
        this.lastReport = undefined;
        for (const p of this.participants.values()) {
            p.reported = new Set();
            this.io.setFrozen(p, false);
            // Everyone but the Detective gets chores, the Murderer included (they're the alibi).
            // Chores start empty-handed: fetching the tools is part of the job. Chores and the tools
            // you hold carry on from round to round (only a new game starts them afresh).
            if (!p.alive || p.role === "detective") p.tasks = [];
            else this.dealChores(p);
        }
        for (const p of this.living()) {
            this.io.restoreRun(p);
            this.checkFetch(p); // already holding the first thing they need
        }
        this.announce(`Round ${this.round} begins. The grandfather clock strikes in ${C.round.investigationSec} seconds.`);
        for (const p of this.living()) {
            const open = p.tasks.filter((t) => t.def.steps[t.step]);
            if (open.length) this.io.message(p, `Your chores: ${open.map((t) => t.def.name).join(", ")}. Follow the overlay and the arrow.`);
        }
    }

    /** Chore tools go back when you're out of the game or it ends (the Murderer hangs on to an escape tool). */
    private clearTools(p: Participant): void {
        for (const id of this.toolIds) {
            if (p.role === "murderer" && this.escapeTools.has(id)) continue;
            while (this.io.hasItem(p, id) && this.io.removeItem(p, id));
        }
    }

    // ---------------------------------------------------------------- items lying around
    private resetSpawns(): void {
        for (const s of this.spawnPoints) {
            if (s.present && !s.in) this.io.removeGround(s.itemId, s.tile);
            if (!s.in) this.io.spawnGround(s.itemId, s.tile);
            s.present = true;
            s.respawnAt = 0;
        }
    }
    private respawnItems(): void {
        for (const s of this.spawnPoints) {
            if (s.present || this.tick < s.respawnAt) continue;
            if (!s.in) this.io.spawnGround(s.itemId, s.tile);
            s.present = true;
        }
    }
    /** Spawn points with this item there right now (lying out, or in furniture). */
    private spotsWith(itemId: number): SpawnPoint[] {
        return this.spawnPoints.filter((s) => s.present && s.itemId === itemId);
    }
    /** Where this item can be had right now: lying out, or kept in a piece of furniture. */
    itemsLying(itemId: number): Tile[] {
        return this.spotsWith(itemId).map((s) => s.tile);
    }
    /**
     * Nobody carries two of the same chore item: with one bucket in your pack you can't take
     * another (a second chore needing one waits until the first bucket is used up).
     */
    holdsTool(p: Participant, itemId: number): boolean {
        return this.toolIds.has(itemId) && this.io.hasItem(p, itemId);
    }
    /** Does this participant want this tool: a chore step fetching it, or the Murderer's way out? */
    private wantsTool(p: Participant, itemId: number): boolean {
        if (this.holdsTool(p, itemId)) return false;
        if (p.tasks.some((t) => t.def.steps[t.step]?.fetch === itemId)) return true;
        return p.role === "murderer" && this.escapeTools.has(itemId) && !this.io.hasItem(p, itemId);
    }
    /** Searching furniture turns up the tools kept in it; whoever needs one takes it. */
    private takeTools(p: Participant, c: Container): boolean {
        const here = this.spawnPoints.filter((s) => s.present && s.in === c.id);
        if (!here.length) return false;
        const wanted: SpawnPoint[] = [];
        for (const s of here) {
            if (this.wantsTool(p, s.itemId) && !wanted.some((q) => q.itemId === s.itemId)) wanted.push(s);
        }
        // Only what fits in the pack is taken; the rest stays in the furniture.
        const taken = wanted.filter((s) => this.io.giveItem(p, s.itemId));
        for (const s of taken) {
            s.present = false;
            s.respawnAt = this.tick + secToTicks(C.items.respawnSec);
        }
        if (taken.length < wanted.length) this.io.message(p, "You don't have enough inventory space to carry everything you need.");
        const names = (list: SpawnPoint[]) => list.map((s) => this.io.itemName(s.itemId)).join(", ");
        if (taken.length) this.io.message(p, `You search ${theRoom(c.name)} and find: ${names(taken)}.`);
        const left = here.filter((s) => !wanted.includes(s));
        const spare = left.filter((s) => this.holdsTool(p, s.itemId));
        const unwanted = left.filter((s) => !spare.includes(s));
        if (spare.length) this.io.message(p, `There's ${names(spare)} in ${theRoom(c.name)}, but you already have one.`);
        if (unwanted.length) this.io.message(p, `There's ${names(unwanted)} in ${theRoom(c.name)}, but you've no use for it.`);
        if (taken.length) this.checkFetch(p);
        return true;
    }
    /**
     * Someone picks up an item from the floor (the caller removes the ground stack). Returns false
     * if they can't. A spawn point at that tile starts counting down to its respawn.
     */
    pickUp(p: Participant, itemId: number, tile: Tile): boolean {
        if (!p.alive || this.phase === "lobby" || this.phase === "gameover" || this.fading(p) || this.holdsTool(p, itemId)) {
            this.io.message(p, "You can't take that now.");
            return false;
        }
        // A full pack leaves it where it lies (it used to vanish: taken off the floor, never given).
        if (!this.io.giveItem(p, itemId)) {
            this.io.message(p, "You don't have enough inventory space to hold that item.");
            return false;
        }
        const s = this.spawnPoints.find((q) => q.present && !q.in && q.itemId === itemId && q.tile.x === tile.x && q.tile.y === tile.y && q.tile.level === tile.level);
        if (s) {
            s.present = false;
            s.respawnAt = this.tick + secToTicks(C.items.respawnSec);
        }
        this.checkFetch(p);
        return true;
    }
    /**
     * Bots pick things up off the floor no faster than a person clicking: once every
     * `C.bots.pickupEveryTicks` ticks. Returns false (and takes nothing) when it's too soon.
     */
    botMayPickUp(p: Participant): boolean {
        if (!p.isBot) return true;
        const last = this.botPickTick.get(p.key);
        if (last !== undefined && this.tick - last < C.bots.pickupEveryTicks && this.tick >= last) return false;
        this.botPickTick.set(p.key, this.tick);
        return true;
    }
    /** Whether a bot could pick something up this tick (without using up its turn). */
    botPickupReady(p: Participant): boolean {
        const last = this.botPickTick.get(p.key);
        return !p.isBot || last === undefined || this.tick - last >= C.bots.pickupEveryTicks || this.tick < last;
    }
    /** Bots take an item off the floor themselves. */
    botPickUp(p: Participant, itemId: number, tile: Tile): boolean {
        const s = this.spawnPoints.find((q) => q.present && !q.in && q.itemId === itemId && q.tile.x === tile.x && q.tile.y === tile.y && q.tile.level === tile.level);
        if (!s || !this.botMayPickUp(p)) return false;
        // Off the floor only once it's in the bot's pack (a full pack leaves it lying there).
        if (!this.pickUp(p, itemId, tile)) return false;
        this.io.removeGround(itemId, tile);
        return true;
    }
    /**
     * Two chores can share a tool: one bucket ticks off "Find a bucket" for both, then filling it
     * with milk leaves the other chore wanting a bucket you no longer have. Send that chore back
     * to the step that gets the item (find another bucket).
     */
    private rewindChores(p: Participant): void {
        for (const t of p.tasks) {
            const s = t.def.steps[t.step];
            if (!s || s.use === undefined || this.io.hasItem(p, s.use)) continue;
            for (let i = t.step - 1; i >= 0; i--) {
                const back = t.def.steps[i];
                if (back.fetch !== s.use && back.give !== s.use) continue;
                t.step = i;
                this.io.message(p, `You'll need another ${this.io.itemName(s.use).toLowerCase()} for "${t.def.name}". Next: ${this.describeStep(back)}.`);
                break;
            }
        }
    }
    /** A "find the X" step is done as soon as they hold an X (one each, when two chores need one). */
    private checkFetch(p: Participant): void {
        if (!this.canAct(p)) return;
        const held = (id: number) => this.io.listItems(p).filter((x) => x === id).length;
        const claimed = (id: number) => p.tasks.filter((t) => t.def.steps[t.step]?.use === id).length;
        for (const t of p.tasks) {
            const s = t.def.steps[t.step];
            if (!s || s.fetch === undefined || claimed(s.fetch) >= held(s.fetch)) continue;
            t.step++;
            const next = t.def.steps[t.step];
            if (next) this.io.message(p, `${s.verb}: done. Next: ${this.describeStep(next)}.`);
            else this.completeChore(p, t.def);
        }
    }

    /**
     * A finished chore pays coins and chore tokens for each of its steps. The tokens buy a shark,
     * Bind runes or a prayer potion from the Demon butler in the dining room.
     */
    private completeChore(p: Participant, def: TaskDef): void {
        this.activity(p, def.past ?? def.name.toLowerCase());
        this.award(p, C.coins.chorePerStep * def.steps.length, def.name);
        const tokens = C.tokens.perStep * def.steps.length;
        this.io.giveItem(p, C.tokens.itemId, tokens);
        this.io.message(p, `Chore complete: ${def.name}. You earn ${tokens === 1 ? "1 Sinclair Family IOU" : `${tokens} Sinclair Family IOUs`}: spend them with the Demon butler in the dining room.`);
        // There's always more to do: a new chore takes its place, until the game ends.
        const dealt = this.dealChores(p);
        if (dealt.length) this.io.message(p, `New chore: ${dealt.map((t) => t.def.name).join(", ")}.`);
    }

    /**
     * Tops a player's chores up to `tasks.atOnce` on the go. A new one is one they aren't doing now,
     * preferring one they haven't done yet this game (once they've done them all, any will do).
     * Finished chores stay on the list for the overlay's done count.
     */
    private dealChores(p: Participant): Array<{ def: TaskDef; step: number }> {
        const dealt: Array<{ def: TaskDef; step: number }> = [];
        const open = () => p.tasks.filter((t) => t.def.steps[t.step]);
        while (open().length < C.tasks.atOnce) {
            const busy = new Set(open().map((t) => t.def.id));
            const done = new Set(p.tasks.map((t) => t.def.id));
            const free = this.layout.tasks.filter((d) => !busy.has(d.id));
            const fresh = free.filter((d) => !done.has(d.id));
            const def = pickOne(fresh.length ? fresh : free);
            if (!def) break;
            const task = { def, step: 0 };
            p.tasks.push(task);
            dealt.push(task);
        }
        return dealt;
    }

    private startFreeze(): void {
        this.setPhase("freeze", C.round.freezeSec);
        for (const p of this.participants.values()) {
            p.fade = undefined; // the clock's own fade takes over
            this.cancel(p);
            this.io.stopCombat(p);
            if (p.alive) this.io.setFrozen(p, true);
            this.io.fadeOut(p, "*DONG* ... *DONG* ... The grandfather clock strikes.");
        }
        this.io.chime();
        this.announce("*DONG* The grandfather clock strikes! Everybody freeze.");
    }

    /** Anyone may strike the grandfather clock once a game to call everyone to dinner early. */
    ringClock(p: Participant): void {
        if (this.phase === "lobby" || this.phase === "gameover") return this.io.message(p, "It's a fine old grandfather clock.");
        if (!p.alive) return this.io.message(p, "Ghosts can't move the hands.");
        if (this.phase !== "investigation") return this.io.message(p, "The clock has already struck.");
        if (p.rangClock) return this.io.message(p, "You've already struck the clock this game.");
        if (p.heldBy) return this.io.message(p, "Hold still - the Detective is dusting your belongings.");
        const at = this.io.pos(p);
        if (!at || at.level !== this.layout.clock.level || cheb(at, this.layout.clock) > 1) return this.io.message(p, "You need to be next to it.");
        p.rangClock = true;
        this.announce(`${p.name} moves the hands of the grandfather clock on to the hour!`);
        this.startFreeze();
    }

    private startArrest(): void {
        this.setPhase("arrest", C.round.arrestSec);
        this.lineUp(); // everyone is seated around the dining table
        for (const p of this.participants.values()) {
            if (p.alive) {
                this.io.face(p, this.layout.tableCenter);
                this.io.heal(p); // dinner patches everyone up
            }
            this.io.fadeIn(p);
        }
        this.votes.clear();
        this.announce(
            `The household gathers around the dining table. Talk it over, then vote on who to arrest: ` +
            `it takes ${this.votesNeeded()} of the ${this.living().length} votes (more than half) within ${C.round.arrestSec} seconds.`,
        );
        // A voting dialog would cover the chatbox, so votes go in from the overlay (or ::vote).
        for (const p of this.living()) {
            if (!p.isBot) this.io.message(p, "Listen to the table, then vote on your overlay (or type ::vote). Nobody sees who you voted for.");
        }
    }

    /** More than half of everyone still alive. */
    votesNeeded(): number {
        return Math.floor(this.living().length / 2) + 1;
    }

    /** Votes so far for each person (who cast them stays secret), and for no arrest. */
    voteTally(): { counts: Map<string, number>; none: number } {
        const counts = new Map<string, number>();
        let none = 0;
        for (const [voter, target] of this.votes) {
            if (!this.participants.get(voter)?.alive) continue;
            if (target === null) none++;
            else counts.set(target, (counts.get(target) ?? 0) + 1);
        }
        return { counts, none };
    }

    /** The ::vote dialog, three suspects a page. */
    offerVote(p: Participant, page = 0): void {
        if (this.phase !== "arrest" || !p.alive) return;
        const suspects = this.living().filter((q) => q !== p);
        const perPage = 3;
        const slice = suspects.slice(page * perPage, page * perPage + perPage);
        const options = slice.map((s) => `Vote to arrest ${s.name}`);
        const more = suspects.length > (page + 1) * perPage;
        if (more) options.push("More suspects...");
        options.push("Vote for no arrest");
        this.io.choose(p, "Who should be arrested?", options, (i) => {
            if (this.phase !== "arrest") return; // picked after the table broke up
            if (i < slice.length) return void this.vote(p, slice[i].key);
            if (more && i === slice.length) return this.offerVote(p, page + 1);
            this.vote(p, null);
        });
    }

    /**
     * Cast (or change) a vote: someone to arrest, or null for no arrest. Whoever gets more than
     * half of the living's votes is arrested at once. Returns why not, if the vote can't count.
     */
    vote(p: Participant, targetKey: string | null): string | undefined {
        if (this.phase !== "arrest") return "Votes are cast at the dinner table, after the clock strikes.";
        if (!p.alive) return "Ghosts don't get a vote.";
        const target = targetKey !== null ? this.participants.get(targetKey) : undefined;
        if (targetKey !== null && (!target || !target.alive)) return "They aren't at the table.";
        if (target === p) return "You can't vote to arrest yourself.";
        this.votes.set(p.key, targetKey);
        this.io.message(p, target ? `You vote to arrest ${target.name}.` : "You vote for no arrest.");
        this.countVotes();
        return undefined;
    }

    /**
     * A majority arrests at once; once everyone has voted without one, nobody is arrested. A table
     * of bots alone (everyone left is a bot) talks it over until halfway through its time first:
     * bots vote early and may change their minds, so their quick first votes don't end it.
     */
    private countVotes(): void {
        const { counts } = this.voteTally();
        const needed = this.votesNeeded();
        for (const [key, n] of counts) {
            const target = this.participants.get(key);
            if (n >= needed && target) return this.resolveArrest(target, n);
        }
        const living = this.living();
        const talkedEnough = living.some((q) => !q.isBot) || this.tick - this.phaseStart >= secToTicks(C.round.arrestSec / 2);
        if (talkedEnough && living.every((q) => this.votes.has(q.key))) {
            this.announce("Everyone has voted, but nobody has more than half the votes.");
            this.resolveArrest(undefined);
        }
    }

    /** The table ran out of time without a majority. */
    private arrestTimeUp(): void {
        for (const p of this.living()) {
            if (p.isBot) continue;
            this.io.closeDialog(p); // don't leave the voting dialog on screen into the next round
        }
        this.announce("Time's up! Nobody got more than half the votes.");
        this.resolveArrest(undefined);
    }

    private resolveArrest(target: Participant | undefined, votes = 0): void {
        const votedFor = (q: Participant) => target !== undefined && this.votes.get(q.key) === target.key;
        const voters = [...this.participants.values()].filter(votedFor);
        this.votes.clear();
        if (!target) {
            this.announce("Nobody is arrested this round.");
            this.setPhase("result", C.round.resultSec);
            return;
        }
        const carried = this.weaponsHeldBy(target);
        // Chore tokens and what they buy (sharks, Bind runes, prayer potions) aren't worth mentioning.
        const standard = new Set([C.tokens.itemId, C.rewards.shark, C.rewards.prayerPotion, C.rewards.staminaPotion, C.rewards.emptyVial, ...C.rewards.runes.map(([id]) => id)]);
        const items = this.io.listItems(target).filter((id) => !this.toolIds.has(id) && !standard.has(id)).map((id) => this.io.itemName(id));
        this.announce(`The table votes to arrest ${target.name} (${votes} of ${this.living().length} votes). The Detective searches them: ${items.length ? items.join(", ") : "nothing"}.`);
        const guilty = target.role === "murderer";
        this.announce(guilty ? `${target.name} WAS THE MURDERER!` : `${target.name} was innocent. They are thrown out and wander as a ghost.`);
        // Everything they carried is put on the floor. The murder weapon on an innocent
        // is revealed publicly with its print set.
        carried.forEach((w, i) => {
            this.io.removeItem(target, w.itemId);
            if (w.real && guilty) {
                w.at = { kind: "gone" };
                return;
            }
            const drop = { ...this.layout.weaponDrop, x: this.layout.weaponDrop.x + i };
            w.at = { kind: "ground", tile: drop };
            this.io.spawnGround(w.itemId, drop);
            if (w.real) {
                this.announce(`The ${w.name} on ${target.name} matches the wound: it's the murder weapon! It's on the floor. Prints on it: ${w.prints.list().join(", ")}.`);
            }
        });
        this.eliminate(target, true);
        if (guilty) for (const q of voters) this.awardKind(q, "correctArrest", `Voted to arrest ${target.name}`);
        if (guilty && !this.living().some((p) => p.role === "murderer")) {
            this.endGame("detective", `${target.name} was the Murderer. The household votes them out and solves the case!`);
            return;
        }
        this.setPhase("result", C.round.resultSec);
    }

    private eliminate(p: Participant, arrested: boolean): void {
        this.io.stopCombat(p);
        p.alive = false;
        p.arrested = arrested;
        p.tasks = [];
        this.clearTools(p);
        this.cancel(p);
        this.io.setFrozen(p, false);
        this.io.makeGhost(p);
    }

    private nextRoundOrEnd(): void {
        const living = this.living().length;
        if (this.murdererAlone()) {
            this.endGame("murderer", "Nobody is left but the Murderer. The Murderer gets away with it!");
            return;
        }
        for (const p of this.living()) this.awardKind(p, "surviveRound", `Survived round ${this.round}`);
        this.round++;
        this.lineUp();
        this.startInvestigation();
    }

    private endGame(winner: "detective" | "murderer", reason: string, noRewards = false): void {
        this.phase = "gameover";
        this.winner = winner;
        for (const p of this.participants.values()) {
            p.fade = undefined;
            this.io.setFrozen(p, false);
            this.clearTools(p);
        }
        for (const p of noRewards ? [] : this.participants.values()) {
            // The Detective's reward goes to whoever held the case: the first Detective, or whoever
            // has the flypaper now (unless that's the Murderer).
            const sleuth = p.role === "detective" || (p.role === "npc" && this.isDetective(p));
            if (winner === "murderer" && p.role === "murderer") this.awardKind(p, "murdererWins", "Got away with murder");
            if (winner === "detective" && sleuth) this.awardKind(p, "detectiveWins", "Solved the case");
            else if (winner === "detective" && p.role === "npc") this.awardKind(p, "householdWins", "Justice for Lord Sinclair");
        }
        this.endReason = reason;
        this.announce(reason);
        const roles = [...this.participants.values()].map((p) => `${p.name}: ${p.role === "npc" ? "household" : p.role}`);
        this.announce(`Roles - ${roles.join("; ")}.`);
        for (const w of this.weapons.filter((x) => x.real)) this.announce(`The murder weapon was the ${w.name}. Final prints: ${w.prints.list().join(", ")}.`);
        this.announce("The host can start another game from the lobby.");
        // Those who left mid-game are let go now: their seat was only kept for this game.
        for (const p of [...this.participants.values()]) if (p.away) this.participants.delete(p.key);
        for (const p of this.participants.values()) {
            this.io.stopCombat(p);
            if (!p.isBot) this.io.questScroll(p, this.scrollFor(p));
        }
        // Back to the lobby: the dead are back on their feet, everyone at full health and run
        // energy, holding only their coins.
        for (const p of this.participants.values()) {
            if (p.isBot) continue;
            p.alive = true;
            this.io.restore(p);
        }
        // Clear ground items and blood from the previous game so the lobby is clean.
        this.io.clearGroundItems();
    }

    /** Killed in a lobby brawl: back on your feet by the front gate, nothing lost. */
    onLobbyDeath(p: Participant): void {
        this.io.restore(p);
        this.io.teleport(p, this.layout.lobbyRespawn);
        this.io.message(p, "Oh dear, you are dead! (Only in the lobby: you're back by the front gate, nothing lost.)");
    }

    // ---------------------------------------------------------------- PvP
    /** Fights only happen while the household is spread around the house. */
    canAttack(attacker: Participant, target: Participant): string | undefined {
        // Between games the people in the lobby can brawl for fun (a death there costs nothing).
        if (this.phase === "lobby" || this.phase === "gameover") {
            return attacker.isBot || target.isBot ? "Save it for the game." : undefined;
        }
        if (this.phase !== "investigation") return "Not now: everyone is watching.";
        if (!attacker.alive) return "Ghosts can't fight.";
        if (!target.alive) return "They are already gone.";
        if (attacker.heldBy || target.heldBy) return "The Detective is dusting someone for prints.";
        return undefined;
    }

    /** Someone was killed in a fight (by `killer`, if known), at `where` (the engine's death tile). */
    onDeath(p: Participant, killer?: Participant, where?: Tile): void {
        if (!p.alive || this.phase === "lobby" || this.phase === "gameover") return;
        const at = where ? { ...where } : this.io.pos(p) ?? this.layout.weaponDrop;
        p.killedBy = killer?.name ?? "someone";
        // Never announced: who died, and who did it, is for the household to work out.
        this.io.message(p, "You have been killed.");
        // Weapons they carried fall where they died, prints and all.
        this.weaponsHeldBy(p).forEach((w) => {
            this.io.removeItem(p, w.itemId);
            w.at = { kind: "ground", tile: { ...at } };
            this.io.spawnGround(w.itemId, at);
        });
        if (this.isDetective(p)) {
            // The Detective's things (the flypaper and gear) fall where they died, free for anyone:
            // whoever picks up the flypaper is the new Detective. Nobody is told.
            this.dropKit(at, this.io.takeKit(p));
        }
        // Everything else they had falls where they died, free for anyone (coins are theirs to keep).
        this.io.dropAll(p, at);
        this.eliminate(p, false);
        if (killer && killer.role === "murderer" && p.role !== "murderer") {
            // The Murderer's work leaves blood on the floor, and the body lying in it.
            const npc = this.io.markKill(at);
            this.bodies.push({ id: this.bodies.length, tile: { ...at }, room: this.io.roomAt(at), victim: p.name, killer: killer.key, reported: false, studied: false, npc });
            this.awardKind(killer, "murdererKill", `Killed ${p.name}`);
        }
        // The Detective or the household killing someone who wasn't the Murderer pays for it.
        if (killer && killer !== p && killer.role !== "murderer" && p.role !== "murderer") {
            this.fine(killer, C.penalties.killInnocent, `Killed ${p.name}, who wasn't the Murderer`);
        }
        if (p.role === "murderer") {
            if (killer) this.awardKind(killer, "killMurderer", `Killed the Murderer, ${p.name}`);
            if (!this.living().some((q) => q.role === "murderer")) {
                this.endGame("detective", `${p.name} was the Murderer${killer ? `, and ${killer.name} has put an end to it` : ""}!`);
                return;
            }
        }
        if (this.murdererAlone()) {
            this.endGame("murderer", "Nobody is left but the Murderer. The Murderer gets away with it!");
            return;
        }
    }

    /** The Detective's things go on the floor, free for anyone (the flypaper makes its taker the Detective). */
    private dropKit(at: Tile, items: number[]): void {
        if (!items.length) return;
        // Two Detectives can die in one game: the latest kit is the one tracked (and the one bots go
        // looking for); what's left of an older one is an ordinary drop, still free to take.
        this.detectiveKit = { tile: { ...at }, items: items.slice() };
        for (const id of items) this.io.spawnGround(id, at);
    }

    /** Ground items from the dead Detective's kit (anyone may take them). */
    isKitItem(itemId: number): boolean {
        return !!this.detectiveKit?.items.includes(itemId);
    }
    /**
     * Someone takes an item from the dead Detective's kit. Anyone alive can, and whoever takes the
     * flypaper is the Detective from then on. Returns false if it isn't a kit item (an ordinary drop).
     */
    takeKitItem(p: Participant, itemId: number): boolean {
        const kit = this.detectiveKit;
        if (!kit || !kit.items.includes(itemId)) return false;
        if (!p.alive || this.phase === "lobby" || this.phase === "gameover") {
            this.io.message(p, "You can't take that now.");
            return true;
        }
        if (!this.io.giveItem(p, itemId)) {
            this.io.message(p, "You don't have enough inventory space to hold that item.");
            return true;
        }
        this.io.removeGround(itemId, kit.tile);
        kit.items.splice(kit.items.indexOf(itemId), 1);
        if (!kit.items.length) this.detectiveKit = undefined;
        if (itemId === this.layout.detectiveItemId) this.tookFlypaper(p);
        return true;
    }
    /** Take the whole kit at once (tests and tools; bots take it piece by piece, see takeKitPiece). */
    takeWholeKit(p: Participant): void {
        while (this.detectiveKit && p.alive && this.takeKitPiece(p, true)) { /* one by one */ }
    }
    /**
     * Bots pick the dead Detective's things up one at a time, as a person clicks each ground item
     * (no faster than one every 2 ticks), putting the gear on as they go. The flypaper comes first.
     * Returns whether a piece was taken.
     */
    takeKitPiece(p: Participant, ignoreThrottle = false): boolean {
        const kit = this.detectiveKit;
        if (!kit || !p.alive || !kit.items.length) return false;
        if (!ignoreThrottle && !this.botMayPickUp(p)) return false;
        const id = kit.items.includes(this.layout.detectiveItemId) ? this.layout.detectiveItemId : kit.items[0];
        this.io.removeGround(id, kit.tile);
        kit.items.splice(kit.items.indexOf(id), 1);
        this.io.giveKit(p, [id]);
        if (!kit.items.length) this.detectiveKit = undefined;
        if (id === this.layout.detectiveItemId) this.tookFlypaper(p);
        return true;
    }
    /** The dead Detective's things lie in this participant's zone, on their floor (they can see them). */
    kitInView(p: Participant): boolean {
        const kit = this.detectiveKit;
        const at = this.io.pos(p);
        return !!kit && !!at && at.level === kit.tile.level && this.layout.zoneAt(at) === this.layout.zoneAt(kit.tile);
    }
    /**
     * They picked up the flypaper: they're the Detective now (quietly: nobody else is told). The case
     * file carries over; their chores, if they had any, carry on as before. The Murderer can be the
     * Detective too.
     */
    tookFlypaper(p: Participant): void {
        p.knownCategory = this.solvedCategory();
        this.io.message(p, "You pick up the Detective's flypaper. You are the DETECTIVE now: use it on the body for clues and on furniture or people to lift prints, and once a round you can Stop and Search someone. Nobody else has been told.");
    }

    private lineUp(): void {
        // Everyone takes a seat; the head of the table is just another chair, so seating never
        // gives away who has the flypaper.
        const seats = [...this.layout.seats, this.layout.detectiveSpot];
        let i = 0;
        for (const p of this.participants.values()) {
            this.cancel(p);
            if (!p.alive) continue;
            this.io.teleport(p, seats[i++ % seats.length]);
        }
    }

    update(): void {
        this.tick++;
        if (this.phase === "lobby" || this.phase === "gameover") return;
        this.respawnItems();
        if (this.phase === "intro") {
            if (this.tick >= this.phaseEnds) this.endIntro();
            else this.updateIntro();
            return;
        }
        if (this.botThink) for (const p of this.participants.values()) if (p.isBot) this.botThink(this, p);
        if (this.phase === "investigation") {
            for (const p of this.participants.values()) if (p.action) this.progress(p);
            for (const p of this.participants.values()) if (p.fade && this.tick >= p.fade.until) this.endFade(p);
            const left = this.phaseEnds - this.tick;
            if (left === secToTicks(60) || left === secToTicks(30) || left === secToTicks(10)) {
                this.announce(`The grandfather clock strikes in ${Math.round((left * 600) / 1000)} seconds.`);
            }
        }
        // A table of bots that has all voted without a majority breaks up halfway through.
        if (this.phase === "arrest" && this.tick - this.phaseStart === secToTicks(C.round.arrestSec / 2)) this.countVotes();
        if (this.phase === "arrest" && this.phaseEnds - this.tick === secToTicks(ARREST_REMINDER_SEC)) {
            for (const p of this.living()) {
                if (!p.isBot && !this.votes.has(p.key)) this.io.message(p, `${ARREST_REMINDER_SEC} seconds left to vote!`);
            }
        }
        if (this.tick >= this.phaseEnds) {
            if (this.phase === "investigation") this.startFreeze();
            else if (this.phase === "freeze") this.startArrest();
            else if (this.phase === "arrest") this.arrestTimeUp();
            else if (this.phase === "result") this.nextRoundOrEnd();
        }
    }

    // ---------------------------------------------------------------- the Murderer's escape
    /** The Murderer's first win: everyone else is dead or thrown out. */
    private murdererAlone(): boolean {
        const living = this.living();
        return living.length > 0 && living.every((p) => p.role === "murderer");
    }
    escapeAt(id: string): EscapeDef | undefined {
        return this.layout.escapes.find((e) => e.id === id);
    }
    /**
     * The Murderer's second win: work at one way out (pick the front gate's lock, or chisel bricks
     * out of the north-west or north-east wall), once a round, until it gives.
     */
    workEscape(p: Participant, escapeId: string, itemId: number): void {
        const e = this.escapeAt(escapeId);
        if (!e) return;
        if (p.role !== "murderer") {
            return this.io.message(p, e.tool === itemId ? "You've no reason to leave. Lord Sinclair's killer is still in the house." : "Nothing interesting happens.");
        }
        if (itemId !== e.tool || !this.io.hasItem(p, e.tool)) return this.io.message(p, `You'll need a ${this.io.itemName(e.tool).toLowerCase()} for that.`);
        if (this.escape.lastRound === this.round) return this.io.message(p, "You've pushed your luck enough for one round. Someone might notice.");
        this.begin(p, "escape", e.id, C.murderer.escapeSec, itemId, { anim: e.anim });
    }
    /** "Inspect" on an escape point: the Murderer learns how far along it is. */
    inspectEscape(p: Participant, escapeId: string): void {
        const e = this.escapeAt(escapeId);
        if (!e) return;
        if (p.role !== "murderer") return this.io.message(p, e.id === "gate" ? "The gate is locked tight." : "The mortar here is old and crumbling.");
        const tool = this.io.itemName(e.tool).toLowerCase();
        this.io.message(p, `${e.name}: ${this.escapeProgress(e.id)}/${this.escape.needed}. With a ${tool} you could work at it, once a round, while nobody's looking.`);
    }
    private escapeProgress(id: string): number {
        return this.escape.progress[id] ?? 0;
    }

    // ---------------------------------------------------------------- helpers
    living(): Participant[] {
        return [...this.participants.values()].filter((p) => p.alive);
    }
    /**
     * Whoever holds the flypaper is the Detective, whatever role they were dealt (the first
     * Detective, a member of the household who picked it up, or even the Murderer).
     */
    isDetective(p: Participant): boolean {
        return p.alive && !p.away && this.io.hasItem(p, this.layout.detectiveItemId);
    }
    /** The current Detective: the living one holding the flypaper, if anyone is. */
    detective(): Participant | undefined {
        return this.living().find((p) => this.isDetective(p));
    }
    /** The Detective may Stop and Search someone: once a round, during the investigation. */
    canFrisk(p: Participant): boolean {
        return this.phase === "investigation" && this.lastFrisk !== this.round && this.isDetective(p);
    }
    byName(name: string): Participant | undefined {
        const n = name.toLowerCase();
        return [...this.participants.values()].find((p) => p.name.toLowerCase() === n);
    }
    announce(text: string): void {
        this.io.announce(text);
    }
    canAct(p: Participant): boolean {
        return this.phase === "investigation" && p.alive;
    }
    /** Their screen is black for a chore's long moment. */
    fading(p: Participant): boolean {
        return !!p.fade && this.tick < p.fade.until;
    }
    private fadeId = 0;
    private startFade(p: Participant, caption: string, ticks: number): void {
        p.fade = { id: ++this.fadeId, caption, until: this.tick + ticks };
        this.io.setFrozen(p, true);
    }
    /** The long moment is over (whether or not they lived through it): the screen comes back. */
    private endFade(p: Participant): void {
        p.fade = undefined;
        if (p.alive && this.phase === "investigation" && !p.heldBy) this.io.setFrozen(p, false);
    }
    isWeaponItem(itemId: number): boolean {
        return this.layout.weaponPool.some((w) => w.itemId === itemId);
    }
    weaponOf(itemId: number): Weapon | undefined {
        return this.weapons.find((w) => w.itemId === itemId);
    }
    weaponsHeldBy(p: Participant): Weapon[] {
        return this.weapons.filter((w) => w.at.kind === "participant" && w.at.key === p.key);
    }
    /** First weapon this participant carries (bots and reports use this). */
    weaponHeldBy(p: Participant): Weapon | undefined {
        return this.weaponsHeldBy(p)[0];
    }
    murderWeaponHeldBy(p: Participant): Weapon | undefined {
        return this.weaponsHeldBy(p).find((w) => w.real);
    }
    weaponsIn(containerId: string): Weapon[] {
        return this.weapons.filter((w) => w.at.kind === "container" && w.at.id === containerId);
    }
    /** People who can see `actor`: living humans in the same room within the witness radius. */
    witnesses(actor: Participant): Participant[] {
        const at = this.io.pos(actor);
        if (!at) return [];
        return [...this.participants.values()].filter((q) => {
            if (q === actor) return false;
            const qa = this.io.pos(q);
            if (!qa || qa.level !== at.level) return false;
            if (!q.alive) return true; // ghosts see everything
            return cheb(qa, at) <= C.witnessRadius && this.layout.zoneAt(qa) === this.layout.zoneAt(at);
        });
    }
    private tellWitnesses(actor: Participant, text: string, exclude?: Participant): void {
        for (const q of this.witnesses(actor)) if (q !== exclude) this.io.message(q, text);
    }
    nearContainer(p: Participant, c: ContainerDef): boolean {
        const at = this.io.pos(p);
        // 2, not 1: some furniture sits behind a counter, and the engine lets you reach it from 2 tiles.
        return !!at && at.level === c.tile.level && distToRect(at, c) <= 2;
    }
    nearPerson(p: Participant, q: Participant): boolean {
        const a = this.io.pos(p), b = this.io.pos(q);
        return !!a && !!b && a.level === b.level && cheb(a, b) <= 1;
    }
    /** Next to a body (Lord Sinclair's by default). */
    nearBody(p: Participant, id = 0): boolean {
        const at = this.io.pos(p);
        const s = this.bodies[id]?.tile;
        return !!at && !!s && at.level === s.level && cheb(at, s) <= 1;
    }
    nearScene(p: Participant): boolean {
        return this.nearBody(p, 0);
    }
    /** The body (if any) with this NPC id. */
    bodyByNpc(npcId: number): Body | undefined {
        return this.bodies.find((b) => b.npc === npcId);
    }
    /** The body lying on this tile (the blood under it), if any. */
    bodyAt(tile: Tile): Body | undefined {
        return this.bodies.find((b) => b.tile.level === tile.level && b.tile.x === tile.x && b.tile.y === tile.y);
    }
    /** An unreported body in sight: same floor and zone (what a bot would notice walking in). */
    bodyInView(p: Participant): Body | undefined {
        const at = this.io.pos(p);
        if (!at) return undefined;
        const zone = this.layout.zoneAt(at);
        return this.bodies.find((b) => !b.reported && b.tile.level === at.level && this.layout.zoneAt(b.tile) === zone);
    }
    /** Whose body it is, for messages. */
    bodyName(b: Body): string {
        return b.victim ? `${b.victim}'s body` : "Lord Sinclair's body";
    }
    /** A body the Detective can learn something from now (Lord Sinclair's once a round, each victim's once). */
    bodyHasClue(b: Body): boolean {
        if (!b.reported) return false;
        return b.victim ? !b.studied : this.caseFile.lastRound !== this.round;
    }
    /** The chore step this participant should do here with this item, if any. */
    /** Without an item: the fetch step due here (one that needs no item), if any. */
    choreAt(p: Participant, containerId: string, itemId?: number) {
        for (const t of p.tasks) {
            const s = t.def.steps[t.step];
            if (s && s.c === containerId && s.use === itemId) return { task: t, step: s };
        }
        return undefined;
    }
    /**
     * The step the quest arrow points at: the first unfinished chore's next step, passing over
     * finding something you already carry one of (it waits until that one is used up).
     */
    currentStep(p: Participant): { task: { def: TaskDef; step: number }; step: TaskStep; container?: Container } | undefined {
        const open = p.tasks.filter((t) => t.def.steps[t.step]);
        const t = open.find((q) => !this.holdsTool(p, q.def.steps[q.step].fetch ?? -1)) ?? open[0];
        if (!t) return undefined;
        const s = t.def.steps[t.step];
        return { task: t, step: s, container: s.c ? this.containers.get(s.c) : undefined };
    }
    /** "Use Bucket on the Dairy cow", "Find a bucket (lying around)" or "Pick a potato from the Vegetable patch". */
    describeStep(s: TaskStep): string {
        if (s.fetch !== undefined) return `${s.verb} (look on tables and in drawers)`;
        if (s.mix !== undefined && s.use !== undefined) return `Use ${this.io.itemName(s.use)} on ${this.io.itemName(s.mix)}`;
        const c = s.c ? this.containers.get(s.c) : undefined;
        const where = theRoom(c?.name ?? "");
        const need = s.need?.length ? ` (with ${s.need.map((id) => this.io.itemName(id)).join(" and ")})` : "";
        return s.use !== undefined ? `Use ${this.io.itemName(s.use)} on ${where}${need}` : `${s.verb} from ${where}`;
    }
    /** The nearest copy of an item lying around (same floor first), for the marker and bots. */
    nearestLying(p: Participant, itemId: number): Tile | undefined {
        return this.nearestSpot(p, itemId)?.tile;
    }
    /** The nearest place to get an item (same floor first): a tile, or furniture to search (`in`). */
    nearestSpot(p: Participant, itemId: number): SpawnPoint | undefined {
        const at = this.io.pos(p);
        const spots = this.spotsWith(itemId);
        if (!at) return spots[0];
        const d = ({ tile: t }: SpawnPoint) => (t.level === at.level ? 0 : 1000) + Math.abs(t.x - at.x) + Math.abs(t.y - at.y);
        return spots.sort((a, b) => d(a) - d(b))[0];
    }
    /** Where a step happens: its furniture, or the nearest place its item lies. */
    private stepRoom(p: Participant, s: TaskStep): string | undefined {
        if (s.fetch !== undefined) {
            const t = this.nearestLying(p, s.fetch);
            return t ? this.io.roomAt(t) : "being respawned";
        }
        return s.c ? this.containers.get(s.c)?.room : undefined;
    }
    private touch(p: Participant, c: Container): void {
        c.prints.add(p.name);
        this.disturbed.add(c.id);
        // Onlookers see someone rummaging; they can't tell a search from a stash.
        this.observe(p, { kind: "rummage", actor: p.name, container: c.name, room: c.room, tick: this.tick });
    }
    private observe(actor: Participant, ev: Observation, exclude?: Participant): void {
        if (!this.onObserve) return;
        for (const q of this.witnesses(actor)) if (q !== exclude && q.alive) this.onObserve(q, ev);
    }
    private activity(p: Participant, text: string): void {
        this.onActivity?.(p, text);
    }

    // ---------------------------------------------------------------- commands
    /** The furniture's own menu option: search it. */
    useContainer(p: Participant, containerId: string): void {
        const c = this.containers.get(containerId);
        const fetch = this.choreAt(p, containerId);
        if (fetch) return this.begin(p, "task", containerId, fetch.step.sec, undefined, fetch.step);
        // Holding what a chore here needs? The furniture's own option does it too (Milk the cow
        // with a bucket, Churn with the milk), not just "Use item on it".
        const held = p.tasks.map((t) => t.def.steps[t.step]).find((s) => s?.c === containerId && s.use !== undefined && this.io.hasItem(p, s.use));
        if (held) return this.doChore(p, containerId, held.use!);
        if (c?.searchable === false) return this.io.message(p, `You can't search ${theRoom(c.name)}.`);
        this.begin(p, "search", containerId, C.interact.searchSec);
    }
    search(p: Participant, containerId: string): void {
        this.useContainer(p, containerId);
    }
    /** Use one chore item on another in your pack (water on flour). Done at once, as in OSRS. */
    mixChore(p: Participant, a: number, b: number): void {
        if (!this.canAct(p) || this.fading(p)) return;
        const hit = p.tasks.find((t) => {
            const s = t.def.steps[t.step];
            return s?.mix !== undefined && ((s.use === a && s.mix === b) || (s.use === b && s.mix === a));
        });
        const step = hit?.def.steps[hit.step];
        if (!hit || !step || step.use === undefined || step.mix === undefined) return this.io.message(p, "Nothing interesting happens.");
        if (!this.io.hasItem(p, step.use) || !this.io.hasItem(p, step.mix)) return this.io.message(p, `You need: ${this.io.itemName(step.use)} and ${this.io.itemName(step.mix)}.`);
        this.io.removeItem(p, step.use);
        this.io.removeItem(p, step.mix);
        if (step.give !== undefined) this.io.giveItem(p, step.give);
        for (const id of step.returns ?? []) this.io.giveItem(p, id);
        this.io.animate(p, "task", step.anim, 0);
        hit.step++;
        this.rewindChores(p);
        const next = hit.def.steps[hit.step];
        if (next) this.io.message(p, `${step.verb}: done. Next: ${this.describeStep(next)}.`);
        else this.completeChore(p, hit.def);
        this.checkFetch(p); // a pot or bucket handed back may be what another chore is fetching
    }

    /** Use a chore item on furniture (e.g. a bucket on the dairy cow). */
    doChore(p: Participant, containerId: string, itemId: number): void {
        const hit = this.choreAt(p, containerId, itemId);
        if (!hit) return this.io.message(p, "Nothing interesting happens.");
        const missing = [itemId, ...(hit.step.need ?? [])].filter((id) => !this.io.hasItem(p, id));
        if (missing.length) return this.io.message(p, `You need: ${missing.map((id) => this.io.itemName(id)).join(" and ")}.`);
        this.begin(p, "task", containerId, hit.step.sec, itemId, hit.step);
    }
    stash(p: Participant, containerId: string, itemId: number): void {
        const w = this.weaponOf(itemId);
        const c = this.containers.get(containerId);
        if (!w || !this.weaponsHeldBy(p).includes(w)) return this.io.message(p, "Nothing interesting happens.");
        if (c?.searchable === false) return this.io.message(p, "There's nowhere to hide it there.");
        this.begin(p, "stash", containerId, C.interact.stashSec, itemId);
    }
    give(p: Participant, targetKey: string, itemId: number): void {
        const t = this.participants.get(targetKey);
        const w = this.weaponOf(itemId);
        if (!t || !w || !this.weaponsHeldBy(p).includes(w)) return this.io.message(p, "Nothing interesting happens.");
        if (!t.alive) return this.io.message(p, "You can't give that to them.");
        if (this.isDetective(t)) return this.io.message(p, "The Detective refuses to touch the evidence.");
        // Their screen is black (a chore's long moment) and nobody else is looking: it goes in
        // their pack quietly, a plant rather than a hand-off.
        if (this.fading(t) && !this.plant(p, targetKey, itemId)) return this.io.message(p, `You quietly slip the ${w.name} towards ${t.name}'s pack...`);
        this.begin(p, "give", targetKey, C.murderer.handoffSec, itemId);
    }
    /**
     * The Murderer slips a weapon into the pack of someone lost in a chore's long moment (their
     * screen is black). Quiet by design: nobody is told, not even the one it's planted on, and it
     * only works with no one else alive watching. Their name joins the weapon's prints (it's in
     * their things now). Returns why not, if it can't be done.
     */
    plant(p: Participant, targetKey: string, itemId: number): string | undefined {
        const t = this.participants.get(targetKey);
        const w = this.weaponOf(itemId);
        if (!t || !w || !this.weaponsHeldBy(p).includes(w) || t === p) return "Nothing interesting happens.";
        if (!t.alive || !this.fading(t)) return "They'd notice.";
        if (this.isDetective(t)) return "The Detective would notice.";
        if (this.witnesses(p).some((q) => q.alive && q !== t)) return "Someone's watching.";
        if (!this.canAct(p) || this.fading(p) || p.heldBy) return "Not now.";
        const at = this.io.pos(p);
        if (!at || !this.nearPerson(p, t)) return "You need to be next to them.";
        this.cancel(p);
        const total = secToTicks(C.murderer.plantSec);
        p.action = { kind: "plant", target: targetKey, item: itemId, left: total, total, from: { ...at } };
        return undefined;
    }

    /** Weapons this participant planted that are still in the pack of the living person they planted them on. */
    plantedOnOthers(p: Participant): Weapon[] {
        return this.weapons.filter((w) => {
            const on = w.plantedBy?.by === p.key ? this.participants.get(w.plantedBy.on) : undefined;
            return !!on?.alive && w.at.kind === "participant" && w.at.key === on.key;
        });
    }

    /**
     * Pickpocket a planted weapon back out of someone's pack. Done unseen (their screen black, in a
     * chore's long moment, nobody else alive watching), it's quiet: nobody is told. Tried on someone
     * awake, they feel it, and so does anyone looking: it fails, and everyone who saw is told.
     * Returns why not, if nothing happens.
     */
    pickpocket(p: Participant, targetKey: string): string | undefined {
        const t = this.participants.get(targetKey);
        if (!t || t === p || !t.alive) return "You can't do that.";
        const w = this.plantedOnOthers(p).find((x) => x.plantedBy!.on === t.key);
        if (!w) return `${t.name} has nothing of yours.`;
        if (!this.canAct(p) || this.fading(p) || p.heldBy) return "Not now.";
        const at = this.io.pos(p);
        if (!at || !this.nearPerson(p, t)) return "You need to be next to them.";
        if (this.witnesses(p).some((q) => q.alive && q !== t)) return "Someone's watching.";
        if (!this.fading(t)) {
            // Awake: they catch the hand in their pocket.
            this.cancel(p);
            this.io.message(t, `You catch ${p.name} with a hand in your pocket!`);
            this.tellWitnesses(p, `You see ${p.name} trying to pick ${t.name}'s pocket!`, t);
            this.observe(p, { kind: "pickpocket", actor: p.name, target: t.name, room: this.io.roomAt(at), tick: this.tick });
            if (t.bot) t.bot.caughtPicking = { name: p.name, tick: this.tick };
            return `${t.name} feels your hand in their pocket and pulls away!`;
        }
        this.cancel(p);
        const total = secToTicks(C.murderer.plantSec);
        p.action = { kind: "pickpocket", target: targetKey, item: w.itemId, left: total, total, from: { ...at } };
        return undefined;
    }

    /** Someone alive said something in public chat: bots hear it. */
    heard(speaker: Participant, text: string): void {
        if (speaker.alive && this.phase !== "lobby" && this.phase !== "gameover") this.onChat?.(speaker, text);
    }

    /**
     * Stop and Search: once a round the Detective stops someone and goes through their pockets,
     * confiscating any weapon from the pool they carry or wield. The Murderer's dragon claws are
     * hidden too well to be found (they aren't from the pool).
     */
    stopAndSearch(p: Participant, targetKey: string): void {
        if (!this.isDetective(p)) return this.io.message(p, "Only the Detective can do that.");
        if (this.phase !== "investigation") return this.io.message(p, "Not now: wait for the investigation.");
        if (this.lastFrisk === this.round) return this.io.message(p, "You've already stopped and searched someone this round.");
        const t = this.participants.get(targetKey);
        if (!t || !t.alive || t === p) return this.io.message(p, "You can't search them.");
        if (t.heldBy) return this.io.message(p, "Someone is already searching them.");
        this.begin(p, "frisk", targetKey, C.detective.stopSearchSec);
    }
    lift(p: Participant, kind: "container" | "person", id: string): void {
        if (!this.isDetective(p)) return this.io.message(p, "Only the Detective knows how to lift prints.");
        if (kind === "person") {
            const t = this.participants.get(id);
            if (!t || !t.alive || t === p) return this.io.message(p, "You can't dust them.");
        }
        this.begin(p, kind === "container" ? "lift-container" : "lift-person", id, C.detective.liftSec);
    }
    /**
     * Someone came across a body nobody had reported, and reports it (a left-click): now everyone
     * knows where it is, and the Detective can study it.
     */
    reportBody(p: Participant, id: number): void {
        const b = this.bodies[id];
        if (!b || b.reported) return;
        if (this.phase !== "investigation" || !p.alive) return this.io.message(p, "You can't do that now.");
        if (this.fading(p)) return;
        const at = this.io.pos(p);
        // 2, not 1: the engine lets you click it from a tile away.
        if (!at || at.level !== b.tile.level || cheb(at, b.tile) > 2) return this.io.message(p, "You need to be next to it.");
        b.reported = true;
        this.awardKind(p, "reportBody", `Reported ${this.bodyName(b)}`);
        const where = theRoom(b.room);
        if (b.victim) this.announce(`${p.name} has found ${b.victim}'s body in ${where}! They were murdered.`);
        else this.announce(`${p.name} has found Lord Sinclair's body in ${where}! The blood is still on the floor.`);
        if (this.isDetective(p)) this.io.message(p, `Investigate ${this.bodyName(b)} (left-click it) for a clue to the murder weapon.`);
    }
    /** A left-click on a body (or the flypaper used on it): report it if nobody has, else study it. */
    useBody(p: Participant, id: number): void {
        const b = this.bodies[id];
        if (!b) return;
        if (!b.reported) return this.reportBody(p, id);
        this.inspectScene(p, id);
    }
    /**
     * The Detective studies a body for a clue to the weapon type: Lord Sinclair's gives one clue a
     * round, and each of the Murderer's victims one more, once. Without a body named: Lord Sinclair's.
     */
    inspectScene(p: Participant, id = 0): void {
        const b = this.bodies[id];
        if (!b) return;
        if (!b.reported) return this.reportBody(p, id);
        if (!this.isDetective(p)) return this.io.message(p, `${this.bodyName(b)}. You'd better leave this to the Detective.`);
        const solved = this.solvedCategory();
        if (solved) return this.io.message(p, `You already know the killer used a ${solved}.`);
        if (b.victim && b.studied) return this.io.message(p, `You've learned all you can from ${b.victim}'s body.`);
        if (!b.victim && this.caseFile.lastRound === this.round) return this.io.message(p, "You've learned all you can from the body this round. Look again next round.");
        this.begin(p, "inspect", String(id), C.detective.inspectSec);
    }
    /** The weapon type, once the clues leave only one. */
    solvedCategory(): string | undefined {
        return this.caseFile.possible.length === 1 && this.caseFile.clues > 0 ? this.caseFile.possible[0] : undefined;
    }
    takeFromGround(p: Participant, itemId: number): boolean {
        if (!this.canAct(p)) return false;
        const w = this.weaponOf(itemId);
        if (!w || w.at.kind !== "ground") return false;
        if (!this.botMayPickUp(p)) return false;
        if (!this.io.giveItem(p, w.itemId)) {
            this.io.message(p, "You don't have enough inventory space to hold that item.");
            return true;
        }
        this.io.removeGround(w.itemId, w.at.tile);
        this.pocket(p, w);
        this.io.message(p, `You pick up the ${w.name}.`);
        return true;
    }
    /**
     * A weapon is now theirs (already in their pack). Their prints go on it, except the
     * Detective's: they handle evidence with care, and note the prints already on it.
     */
    private pocket(p: Participant, w: Weapon): void {
        w.at = { kind: "participant", key: p.key };
        if (!this.isDetective(p)) return void w.prints.add(p.name);
        const at = this.io.pos(p);
        this.recordLift(p, {
            round: this.round, target: w.name, room: at ? this.io.roomAt(at) : "",
            weapons: [{ name: w.name, category: w.category, prints: w.prints.list() }],
        });
    }
    report(p: Participant): void {
        if (!this.canAct(p)) return;
        const held = this.weaponHeldBy(p);
        if (held) {
            const key = "held:" + held.id;
            if (p.reported.has(key)) return;
            p.reported.add(key);
            this.lastReport = { kind: "participant", id: p.key, round: this.round };
            const at = this.io.pos(p);
            if (p.role !== "murderer") this.awardKind(p, "reportWeapon", "Reported a weapon");
            this.tellDetective(p, `${p.name} reports that they've got a ${held.name}${at ? ` in ${theRoom(this.io.roomAt(at))}` : ""}.`);
            return;
        }
        const c = p.openContainer ? this.containers.get(p.openContainer) : undefined;
        if (c && this.nearContainer(p, c)) {
            const w = this.weaponsIn(c.id)[0];
            if (!w) return this.io.message(p, "There is no weapon here to report.");
            const key = c.id + ":" + w.id;
            if (p.reported.has(key)) return;
            p.reported.add(key);
            this.lastReport = { kind: "container", id: c.id, round: this.round };
            if (p.role !== "murderer") this.awardKind(p, "reportWeapon", "Reported a weapon");
            this.tellDetective(p, `${p.name} reports finding a ${w.name} in ${theRoom(c.name)} (${c.room}).`);
            return;
        }
        this.io.message(p, "You have nothing to report.");
    }
    /** A report goes to the Detective alone, never to the whole house: a find shouldn't tip anyone off. */
    private tellDetective(from: Participant, text: string): void {
        const det = this.detective();
        if (det && det.alive && det !== from) this.io.message(det, text);
        this.io.message(from, det && det !== from ? `You quietly tell the Detective, ${det.name}.` : "There's no Detective to tell.");
    }

    private begin(p: Participant, kind: ActionKind, target: string, sec: number, item?: number, step?: Pick<TaskStep, "fade" | "anim">): void {
        if (!this.canAct(p)) {
            if (this.phase === "lobby") this.io.message(p, "The game hasn't started yet.");
            return;
        }
        if (this.fading(p)) return; // busy with a chore, and can't see a thing
        if (p.heldBy) return this.io.message(p, "Hold still - the Detective is dusting your belongings.");
        const at = this.io.pos(p);
        if (!at) return;
        this.cancel(p);
        // A chore's long moment takes as long as the fade, whatever the step's own time.
        const total = secToTicks(step?.fade ? C.tasks.fadeSec : sec);
        p.action = { kind, target, item, left: total, total, from: { ...at }, anim: step?.anim };
        if (!this.inRange(p, p.action)) {
            p.action = undefined;
            return this.io.message(p, "You need to be next to it.");
        }
        this.io.animate(p, kind, step?.anim, 0);
        if (step?.fade) this.startFade(p, step.fade, total);
        if (kind === "lift-container" || kind === "lift-person") {
            const name = kind === "lift-container" ? this.containers.get(target)?.name : this.participants.get(target)?.name;
            if (kind === "lift-person") {
                const t = this.participants.get(target)!;
                t.heldBy = p.key;
                this.io.setFrozen(t, true);
                this.io.message(t, "The Detective asks you to hold still while they dust your belongings.");
            }
            this.io.message(p, `You begin dusting the ${name} for prints...`);
            this.tellWitnesses(p, `The Detective begins dusting the ${name} for prints.`);
        }
        if (kind === "inspect") {
            const b = this.bodies[Number(target)];
            this.io.message(p, `You kneel and study ${b?.victim ? `${b.victim}'s body` : "the body"}. This will take a while (${C.detective.inspectSec} s)...`);
            this.tellWitnesses(p, "The Detective kneels to study the blood.");
        }
        if (kind === "give") {
            const t = this.participants.get(target)!;
            this.tellWitnesses(p, `${p.name} starts handing something to ${t.name}.`);
        }
        if (kind === "frisk") {
            // The Detective stops them where they stand: whatever they were doing, they hold still.
            const t = this.participants.get(target)!;
            this.cancel(t);
            this.io.stopCombat(t);
            t.heldBy = p.key;
            this.io.setFrozen(t, true);
            if (at) this.io.face(t, at);
            const ta = this.io.pos(t);
            if (ta) this.io.face(p, ta);
            this.io.message(t, `${p.name} stops you and searches your pockets. Hold still...`);
            this.io.message(p, `You stop ${t.name} and search them...`);
            this.tellWitnesses(p, `${p.name} stops ${t.name} and searches them.`, t);
        }
        if (kind === "escape") {
            const e = this.escapeAt(target)!;
            this.io.message(p, `You start to ${e.verb.toLowerCase()}...`);
            // Anyone in sight sees it, and nobody innocent has a reason to be doing it.
            this.tellWitnesses(p, `You see ${p.name} ${e.seen}!`);
            const at = this.io.pos(p);
            this.observe(p, { kind: "rummage", actor: p.name, container: e.name, room: at ? this.io.roomAt(at) : "", tick: this.tick });
        }
    }

    private inRange(p: Participant, a: PendingAction): boolean {
        if (a.kind === "give" || a.kind === "plant" || a.kind === "pickpocket" || a.kind === "lift-person" || a.kind === "frisk") {
            const t = this.participants.get(a.target);
            return !!t && t.alive && this.nearPerson(p, t);
        }
        if (a.kind === "inspect") return this.nearBody(p, Number(a.target));
        if (a.kind === "escape") {
            const e = this.escapeAt(a.target);
            const at = this.io.pos(p);
            // Within 2: a wall is used from the tile inside it (the item-on-loc reach allows 2).
            return !!e && !!at && at.level === e.tile.level && cheb(at, e.tile) <= 2;
        }
        const c = this.containers.get(a.target);
        return !!c && this.nearContainer(p, c);
    }

    private progress(p: Participant): void {
        const a = p.action!;
        const at = this.io.pos(p);
        // Interactions need you to stay put and next to the target.
        if (!at || at.x !== a.from.x || at.y !== a.from.y || !this.inRange(p, a)) {
            this.cancel(p);
            return this.io.message(p, "You stop what you were doing.");
        }
        // Long actions keep animating, as RuneScape's skilling pulses do (the gamemode picks how often).
        if (a.total - a.left > 0) this.io.animate(p, a.kind, a.anim, a.total - a.left);
        if (--a.left > 0) return;
        p.action = undefined;
        this.complete(p, a);
    }

    /**
     * Anyone rummaging in furniture (a search, or a chore done there) finds what's hidden in it.
     * Returns false when there's nothing there.
     */
    private revealHidden(p: Participant, c: Container): boolean {
        const found = this.weaponsIn(c.id);
        if (!found.length) return false;
        p.openContainer = c.id;
        if (p.role !== "murderer" && !p.reported.has("found:" + c.id)) {
            p.reported.add("found:" + c.id);
            this.awardKind(p, "findWeapon", "Found a hidden weapon");
        }
        // Whoever finds a weapon takes it (if they have room), and the whole house hears who found
        // what, where: a red herring and the stashed murder weapon alike.
        for (const w of found) {
            const where = `${theRoom(c.name)} (${c.room})`;
            if (this.io.giveItem(p, w.itemId)) {
                this.pocket(p, w);
                this.lastReport = { kind: "participant", id: p.key, round: this.round };
                this.io.message(p, `You find a ${w.name} hidden in ${theRoom(c.name)} and take it.${this.isDetective(p) ? "" : " Your prints are on it now."}`);
                this.announce(`${p.name} found a ${w.name} hidden in ${where}!`);
            } else {
                this.lastReport = { kind: "container", id: c.id, round: this.round };
                this.io.message(p, `You find a ${w.name} hidden in ${theRoom(c.name)}, but you have no room to carry it.`);
                this.announce(`${p.name} found a ${w.name} hidden in ${where}, but had no room to take it.`);
            }
        }
        return true;
    }

    cancel(p: Participant): void {
        const a = p.action;
        if (a && (a.kind === "lift-person" || a.kind === "frisk")) {
            const t = this.participants.get(a.target);
            if (t && t.heldBy === p.key) {
                t.heldBy = undefined;
                if (this.phase === "investigation" && !this.fading(t)) this.io.setFrozen(t, false);
            }
        }
        p.action = undefined;
    }

    private complete(p: Participant, a: PendingAction): void {
        switch (a.kind) {
            case "search": {
                const c = this.containers.get(a.target)!;
                this.touch(p, c);
                p.openContainer = c.id;
                this.activity(p, `searched ${theRoom(c.name, true)}`);
                const tools = this.takeTools(p, c);
                if (!this.revealHidden(p, c) && !tools) this.io.message(p, `You search ${theRoom(c.name)}. You find nothing of interest.`);
                return;
            }
            case "stash": {
                const c = this.containers.get(a.target)!;
                const w = this.weaponsHeldBy(p).find((x) => x.itemId === a.item);
                if (!w) return;
                this.io.removeItem(p, w.itemId);
                w.prints.add(p.name);
                w.at = { kind: "container", id: c.id };
                this.touch(p, c);
                this.io.message(p, `You stash the ${w.name} in ${theRoom(c.name)}.`);
                if (p.role === "murderer" && w.real) this.awardKind(p, "stashWeapon", "Hid the evidence");
                return;
            }
            case "give": {
                const t = this.participants.get(a.target)!;
                const w = this.weaponsHeldBy(p).find((x) => x.itemId === a.item);
                if (!w) return;
                this.io.removeItem(p, w.itemId);
                w.prints.add(p.name);
                w.prints.add(t.name); // the recipient's name joins the print set
                w.at = { kind: "participant", key: t.key };
                this.io.giveItem(t, w.itemId);
                this.io.message(t, `${p.name} hands you: ${w.name}.`);
                this.io.message(p, `You hand the ${w.name} to ${t.name}.`);
                if (p.role === "murderer" && w.real) this.awardKind(p, "handOff", "Passed on the evidence");
                this.tellWitnesses(p, `${p.name} hands something to ${t.name}.`, t);
                const at = this.io.pos(p);
                this.observe(p, { kind: "handoff", actor: p.name, target: t.name, room: at ? this.io.roomAt(at) : "", tick: this.tick }, t);
                if (t.bot) t.bot.received = this.tick;
                return;
            }
            case "pickpocket": {
                // Quiet, like the plant: it only works while they still can't see, with nobody watching.
                const t = this.participants.get(a.target);
                const w = t && this.plantedOnOthers(p).find((x) => x.plantedBy!.on === t.key && x.itemId === a.item);
                if (!t || !w || !t.alive || !this.fading(t) || this.witnesses(p).some((q) => q.alive && q !== t)) return;
                if (!this.io.giveItem(p, w.itemId)) return this.io.message(p, "You don't have room to take it back.");
                this.io.removeItem(t, w.itemId);
                w.prints.add(p.name);
                w.at = { kind: "participant", key: p.key };
                w.plantedBy = undefined;
                if (t.bot) t.bot.pickedAt = this.tick; // a bot that knew it was there misses it later
                this.io.message(p, `You lift the ${w.name} back out of ${t.name}'s pack. They didn't feel a thing.`);
                return;
            }
            case "plant": {
                // Quiet: no message to anyone, no onlookers told. It only lands while they still can't see.
                const t = this.participants.get(a.target);
                const w = this.weaponsHeldBy(p).find((x) => x.itemId === a.item);
                if (!t || !w || !t.alive || !this.fading(t) || this.witnesses(p).some((q) => q.alive && q !== t)) return;
                if (!this.io.giveItem(t, w.itemId)) return;
                this.io.removeItem(p, w.itemId);
                w.prints.add(p.name);
                w.prints.add(t.name);
                w.at = { kind: "participant", key: t.key };
                w.plantedBy = { by: p.key, on: t.key };
                if (t.bot) t.bot.plantedAt = this.tick; // a bot finds it in its pack once its screen comes back
                this.io.message(p, `You slip the ${w.name} into ${t.name}'s pack. They didn't notice a thing.`);
                if (p.role === "murderer" && w.real) this.awardKind(p, "handOff", "Planted the evidence");
                return;
            }
            case "task": {
                const c = this.containers.get(a.target)!;
                const hit = this.choreAt(p, c.id, a.item);
                if (!hit || [hit.step.use, ...(hit.step.need ?? [])].some((id) => id !== undefined && !this.io.hasItem(p, id))) return;
                const { task, step } = hit;
                this.touch(p, c);
                if (step.use !== undefined && !step.keep) this.io.removeItem(p, step.use);
                if (step.give !== undefined) this.io.giveItem(p, step.give); // e.g. the bucket becomes a bucket of milk
                for (const id of step.returns ?? []) this.io.giveItem(p, id); // the churn hands the bucket back
                task.step++;
                this.rewindChores(p);
                const next = task.def.steps[task.step];
                if (next) this.io.message(p, `${step.verb}: done. Next: ${this.describeStep(next)}.`);
                else this.completeChore(p, task.def);
                // A tool kept (the tinderbox) or handed back (the bucket) may be what another chore is
                // fetching: it was spoken for until now.
                this.checkFetch(p);
                // Doing a chore in furniture means rummaging in it: a weapon stashed there turns up.
                if (c.searchable !== false) this.revealHidden(p, c);
                return;
            }
            case "escape": {
                const e = this.escapeAt(a.target);
                if (!e || this.escape.lastRound === this.round || !this.io.hasItem(p, e.tool)) return;
                this.escape.lastRound = this.round;
                const have = (this.escape.progress[e.id] = this.escapeProgress(e.id) + 1);
                if (have >= this.escape.needed) {
                    this.endGame("murderer", `${p.name} was the Murderer, and has escaped through the ${e.name.toLowerCase()}! The Murderer gets away with it!`);
                    return;
                }
                this.io.message(p, `${e.verb}: ${have}/${this.escape.needed}. Come back next round to keep at it.`);
                return;
            }
            case "inspect": {
                const real = this.weapons.find((w) => w.real);
                const cf = this.caseFile;
                const body = this.bodies[Number(a.target)];
                if (!real || !body || !this.bodyHasClue(body) || this.solvedCategory()) return;
                // Lord Sinclair's body gives a clue a round; a victim's body one more, once.
                if (body.victim) body.studied = true;
                else cf.lastRound = this.round;
                cf.clues++;
                this.awardKind(p, "inspectScene", `Found a clue on ${this.bodyName(body)}`);
                // Each clue rules out a share of the wrong types; the last one leaves only the right one.
                const wrong = cf.possible.filter((c) => c !== real.category);
                const left = Math.max(0, cf.needed - cf.clues);
                const ruled = wrong.slice(0, left === 0 ? wrong.length : Math.ceil(wrong.length / (left + 1)));
                cf.possible = cf.possible.filter((c) => !ruled.includes(c));
                const solved = this.solvedCategory();
                if (solved) p.knownCategory = solved;
                const list = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} or ${a[a.length - 1]}`);
                const wound = solved
                    ? `Clue ${cf.clues}/${cf.needed}: ${this.layout.wounds[solved] ?? solved}`
                    : `Clue ${cf.clues}/${cf.needed}: it wasn't a ${list(ruled)}. Still possible: ${list(cf.possible)}.`;
                this.recordLift(p, { round: this.round, target: body.victim ? `${body.victim}'s body` : "Crime scene", room: body.room, wound });
                return;
            }
            case "lift-container": {
                const c = this.containers.get(a.target)!;
                const entry: LiftEntry = {
                    round: this.round, target: c.name, room: c.room, prints: c.prints.list(),
                    weapons: this.weaponsIn(c.id).map((w) => ({ name: w.name, category: w.category, prints: w.prints.list() })),
                };
                this.recordLift(p, entry);
                this.awardKind(p, "liftPrints", "Lifted prints");
                this.tellWitnesses(p, `The Detective finishes dusting ${theRoom(c.name)}.`);
                this.observe(p, { kind: "dust", target: c.name, room: c.room, tick: this.tick });
                return;
            }
            case "lift-person": {
                const t = this.participants.get(a.target)!;
                t.heldBy = undefined;
                if (!this.fading(t)) this.io.setFrozen(t, false);
                const at = this.io.pos(t);
                const entry: LiftEntry = {
                    round: this.round, target: t.name, room: at ? this.io.roomAt(at) : "",
                    items: this.io.listItems(t).filter((id) => !this.toolIds.has(id)).map((id) => this.io.itemName(id)),
                    weapons: this.weaponsHeldBy(t).map((w) => ({ name: w.name, category: w.category, prints: w.prints.list() })),
                };
                this.recordLift(p, entry);
                this.awardKind(p, "liftPrints", "Lifted prints");
                this.io.message(t, "The Detective has finished dusting your belongings.");
                this.tellWitnesses(p, `The Detective finishes dusting ${t.name}.`, t);
                this.observe(p, { kind: "dust", target: t.name, room: entry.room, tick: this.tick });
                return;
            }
            case "frisk": {
                const t = this.participants.get(a.target)!;
                t.heldBy = undefined;
                if (!this.fading(t)) this.io.setFrozen(t, false);
                this.lastFrisk = this.round;
                // Weapons from the pool, carried or wielded; the dragon claws aren't, so they stay hidden.
                const taken = this.weaponsHeldBy(t);
                const at = this.io.pos(p) ?? this.layout.weaponDrop;
                for (const w of taken) {
                    this.io.removeItem(t, w.itemId);
                    if (this.io.giveItem(p, w.itemId)) this.pocket(p, w);
                    else {
                        // No room in the Detective's pack: it goes on the floor at their feet.
                        w.at = { kind: "ground", tile: { ...at } };
                        this.io.spawnGround(w.itemId, at);
                    }
                }
                const names = taken.map((w) => `a ${w.name}`).join(" and ");
                if (taken.length) {
                    this.io.message(p, `You search ${t.name} and confiscate ${names}.`);
                    this.io.message(t, `${p.name} searches you and confiscates ${names}.`);
                    this.tellWitnesses(p, `${p.name} searches ${t.name} and confiscates ${names}!`, t);
                    if (t.bot) t.bot.received = undefined;
                } else {
                    this.io.message(p, `You search ${t.name}. No weapons on them.`);
                    this.io.message(t, `${p.name} searches you and finds nothing.`);
                    this.tellWitnesses(p, `${p.name} searches ${t.name} and finds nothing.`, t);
                }
                return;
            }
        }
    }

    /** Pay coins into their inventory for something done. */
    award(p: Participant, amount: number, reason: string): void {
        amount = Math.round(amount);
        if (!(amount > 0)) return;
        p.points += amount;
        p.earned.push({ amount, reason });
        this.io.giveItem(p, COINS, amount);
        this.io.message(p, `<col=ffff00>+${amount} coins</col> (${reason})`);
    }
    private awardKind(p: Participant, kind: keyof typeof C.coins, reason: string): void {
        this.award(p, C.coins[kind], reason);
    }
    /** Take coins away for something done (as many as they have, up to `amount`). */
    fine(p: Participant, amount: number, reason: string): void {
        const taken = this.io.takeCoins(p, amount);
        p.points -= taken;
        p.earned.push({ amount: -taken, reason });
        this.io.message(p, `<col=ff0000>-${amount} coins</col> (${reason})${taken < amount ? `: you only had ${taken}` : ""}`);
    }

    private recordLift(p: Participant, e: LiftEntry): void {
        p.notebook.push(e);
        this.io.message(p, this.formatLift(e));
    }

    formatLift(e: LiftEntry): string {
        let s = `[R${e.round}] ${e.target} (${e.room}): `;
        if (e.wound) return s + e.wound;
        if (e.prints) s += `prints: ${e.prints.join(", ") || "none"}`;
        if (e.items) s += `carrying: ${e.items.join(", ") || "nothing"}`;
        for (const w of e.weapons ?? []) s += ` | ${w.name.toUpperCase()} prints: ${w.prints.join(", ") || "none"}`;
        return s;
    }

    notesFor(p: Participant): string[] {
        const out: string[] = [];
        if (this.phase !== "lobby") {
            for (const b of this.bodies) {
                if (!b.reported) continue;
                out.push(b.victim ? `${b.victim}'s body: in ${theRoom(b.room)}.` : `Crime scene: blood in ${theRoom(b.room)}.`);
            }
        }
        if (this.isDetective(p)) {
            const names = [...this.disturbed].map((id) => this.containers.get(id)?.name).filter(Boolean);
            out.push(`Disturbed this round: ${names.length ? names.join(", ") : "nothing yet"}.`);
            for (const e of p.notebook) out.push(this.formatLift(e));
        }
        for (const w of this.weapons) {
            if (w.at.kind === "ground" && w.real) out.push(`Public evidence - ${w.name} prints: ${w.prints.list().join(", ")}.`);
        }
        return out;
    }

    /** What this participant's RuneLite-style overlay shows. Only their own secrets. */
    hudFor(p: Participant): MurderHud {
        const running = this.phase !== "lobby" && this.phase !== "gameover";
        // Whoever holds the flypaper sees the Detective's side of the overlay (the Murderer too).
        const sleuth = running && this.isDetective(p);
        const disturbed = sleuth ? this.disturbed.size : undefined;
        // A member of the household who picked up the flypaper is the Detective now.
        const role = p.role === "npc" && sleuth ? "detective" : p.role;
        return {
            phase: this.phase,
            round: this.round,
            maxRounds: 0, // no round limit: the Murderer wins by escaping or by being the last one standing
            secondsLeft: running ? Math.max(0, Math.ceil(((this.phaseEnds - this.tick) * 600) / 1000)) : undefined,
            role: running || this.phase === "gameover" ? role : undefined,
            rolePref: p.rolePref,
            alive: p.alive,
            isHost: this.hostKey === p.key,
            players: this.playerCount(),
            living: this.living().length,
            hasFlypaper: sleuth || undefined,
            stopSearch: this.canFrisk(p) || undefined,
            plant: (this.phase === "investigation" && p.alive && this.weaponsHeldBy(p).length > 0) || undefined,
            pickpocket: (this.phase === "investigation" && p.alive && this.plantedOnOthers(p).length > 0) || undefined,
            crimeScene: running && this.bodies[0]?.reported ? this.crimeScene?.room : undefined,
            unreported: this.phase === "investigation" && p.alive
                ? this.bodies.filter((b) => !b.reported && b.npc !== undefined).map((b) => b.npc!)
                : undefined,
            weaponType: sleuth ? p.knownCategory : undefined,
            clues: sleuth && !p.knownCategory
                ? { have: this.caseFile.clues, need: this.caseFile.needed, possible: this.caseFile.possible.slice().sort(), ready: this.bodies.some((b) => this.bodyHasClue(b)) }
                : undefined,
            // Chores belong to a running game: none in the lobby or on the end screen.
            tasks: !running ? [] : p.tasks.map((t) => {
                const s = t.def.steps[t.step];
                return { name: t.def.name, done: !s, next: s ? this.describeStep(s) : undefined, where: s ? this.stepRoom(p, s) : undefined };
            }),
            notes: sleuth || p.role === "detective" ? p.notebook.slice(-4).map((e) => this.formatLift(e)) : [],
            disturbed,
            winner: this.phase === "gameover" ? this.winner : undefined,
            marker: this.fading(p) ? undefined : this.markerFor(p),
            locLabels: running ? this.locLabelsFor(p) : undefined,
            points: p.points,
            fade: p.fade && this.fading(p) ? { id: p.fade.id, caption: p.fade.caption } : undefined,
            pvp: (this.phase === "investigation" && p.alive) || this.phase === "lobby" || this.phase === "gameover",
            clock: this.phase === "investigation" && p.alive && !p.rangClock,
            escapes: p.role === "murderer" && running
                ? this.layout.escapes.map((e) => ({
                    name: e.name, have: this.escapeProgress(e.id), need: this.escape.needed,
                    tool: this.io.itemName(e.tool), hasTool: this.io.hasItem(p, e.tool),
                }))
                : undefined,
            escapeReady: p.role === "murderer" && running ? this.escape.lastRound !== this.round : undefined,
            vote: this.phase === "arrest" ? this.voteView(p) : undefined,
            lobby: this.lobbyView(p.key),
            joined: true,
        };
    }

    private voteView(p: Participant): MurderHud["vote"] {
        const { counts, none } = this.voteTally();
        const living = this.living();
        return {
            needed: this.votesNeeded(),
            voters: living.length,
            voted: living.filter((q) => this.votes.has(q.key)).length,
            none,
            tally: living.map((q) => ({ key: q.key, name: q.name, votes: counts.get(q.key) ?? 0, you: q === p })),
            mine: p.alive ? this.votes.get(p.key) : undefined,
        };
    }

    /** Someone connected who isn't in the lobby: they only see the lobby browser. */
    visitorHud(key: string): MurderHud {
        return {
            phase: this.phase, round: this.round, maxRounds: 0, rolePref: "random", alive: true, isHost: false,
            players: this.humans().length, living: this.living().length, tasks: [], notes: [], points: 0, pvp: false, clock: false,
            lobby: this.lobbyView(key), joined: false,
        };
    }

    /**
     * The chore step this furniture's own option does for you right now, as useContainer decides:
     * a step that needs no item there (pick a potato), else one whose item you're holding.
     */
    dueStepAt(p: Participant, containerId: string): TaskStep | undefined {
        const free = this.choreAt(p, containerId);
        if (free) return free.step;
        return p.tasks.map((t) => t.def.steps[t.step]).find((s) => s?.c === containerId && s.use !== undefined && this.io.hasItem(p, s.use));
    }

    /** Menu labels for the furniture (MurderHud.locLabels): your chore there, or "Search". */
    private locLabelsFor(p: Participant): MurderHud["locLabels"] {
        const sleuth = this.isDetective(p);
        const out: NonNullable<MurderHud["locLabels"]> = [];
        for (const c of this.containers.values()) {
            // The crops' Pick is their own (index.ts registerGarden).
            if (!c.action || c.action === "pick") continue;
            // The Detective investigates: "Investigate" is theirs alone.
            if (sleuth && c.action === "investigate") continue;
            const step = p.alive ? this.dueStepAt(p, c.id) : undefined;
            const label = step ? stepOp(step) : c.action === "investigate" || c.action === "open" ? "Search" : undefined;
            if (!label) continue;
            out.push({ locIds: c.locIds ?? [c.locId], x: c.tile.x, y: c.tile.y, level: c.tile.level, w: c.w, h: c.h, action: c.action, label });
        }
        return out;
    }

    private markerFor(p: Participant): MurderHud["marker"] {
        if (this.phase !== "investigation" || !p.alive) return undefined;
        const cur = this.currentStep(p);
        if (cur?.step.fetch !== undefined) {
            // Point at the nearest one (via the stairs if it's on the other floor).
            const spot = this.nearestSpot(p, cur.step.fetch);
            if (!spot) return undefined;
            const t = spot.tile;
            const at = this.io.pos(p);
            const stairs = at && at.level !== t.level ? this.layout.stairs.find((s) => s.tile.level === at.level) : undefined;
            if (stairs) {
                const label = t.level > at!.level ? "Climb up the stairs" : "Climb down the stairs";
                return { x: stairs.tile.x, y: stairs.tile.y, level: stairs.tile.level, w: stairs.w, h: stairs.h, label, locIds: stairs.locIds };
            }
            const box = spot.in ? this.containers.get(spot.in) : undefined;
            if (box) return { x: t.x, y: t.y, level: t.level, w: box.w, h: box.h, label: `${cur.step.verb}: search ${theRoom(box.name)} (${box.room})`, locIds: box.locIds ?? [box.locId] };
            return { x: t.x, y: t.y, level: t.level, w: 1, h: 1, label: `${cur.step.verb} (${this.io.roomAt(t)})` };
        }
        const c = cur?.container;
        if (!cur || !c) return undefined;
        // On the other floor, point at the stairs instead.
        const at = this.io.pos(p);
        const stairs = at && at.level !== c.tile.level ? this.layout.stairs.find((s) => s.tile.level === at.level) : undefined;
        if (stairs) {
            const label = c.tile.level > at!.level ? "Climb up the stairs" : "Climb down the stairs";
            return { x: stairs.tile.x, y: stairs.tile.y, level: stairs.tile.level, w: stairs.w, h: stairs.h, label, locIds: stairs.locIds };
        }
        return { x: c.tile.x, y: c.tile.y, level: c.tile.level, w: c.w, h: c.h, label: `${cur.step.verb} (${c.room})`, locIds: c.locIds ?? [c.locId] };
    }

    /** The end-of-game "Quest complete!" scroll for one player. */
    scrollFor(p: Participant): QuestScroll {
        const real = this.weapons.find((w) => w.real);
        const murderer = [...this.participants.values()].find((q) => q.role === "murderer");
        const solved = this.winner === "detective";
        const won = solved ? p.role !== "murderer" : p.role === "murderer";
        const role = p.role === "detective" || (p.role === "npc" && this.isDetective(p)) ? "Detective" : p.role === "npc" ? "Household" : this.isDetective(p) ? "Murderer (and Detective)" : "Murderer";
        const best = [...this.participants.values()].sort((a, b) => b.points - a.points)[0];
        return {
            title: won ? "Congratulations!" : "Case closed!",
            subtitle: solved
                ? won ? "You have solved Murder at Sinclair Mansion!" : "You have been caught!"
                : won ? "You got away with Murder at Sinclair Mansion!" : "The Murderer got away!",
            itemId: real?.itemId,
            lines: [
                `${p.points} Coins`,
                `Murderer: ${murderer?.name ?? "?"}`,
                `Weapon: ${real?.name ?? "?"}`,
                `You were: ${role}${p.alive ? "" : p.killedBy ? " (killed)" : " (arrested)"}`,
                best && best.points > 0 ? `Richest: ${best.name} (${best.points})` : "",
            ].filter(Boolean),
            footer: `Rounds: ${this.round}`,
        };
    }
    tasksFor(p: Participant): string[] {
        if (!p.tasks.length) return [p.role === "detective" ? "The Detective has no chores." : "You have no chores right now."];
        return p.tasks.map((t) => {
            const s = t.def.steps[t.step];
            return s ? `${t.def.name} - next: ${this.describeStep(s)} (${this.stepRoom(p, s)})` : `${t.def.name} - done`;
        });
    }

    private clearWeaponFromWorld(w: Weapon): void {
        if (w.at.kind === "ground") this.io.removeGround(w.itemId, w.at.tile);
        if (w.at.kind === "participant") {
            const p = this.participants.get(w.at.key);
            if (p) this.io.removeItem(p, w.itemId);
        }
        w.at = { kind: "gone" };
    }
}
