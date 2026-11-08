// Murder at Sinclair Mansion: a social-deduction gamemode played in the real
// Sinclair Mansion. Rules live in MurderGame.ts; this file wires them to the engine.

import type {
    GamemodeDefinition,
    GamemodeInitContext,
    GamemodeServerServices,
    HandshakeBridge,
} from "../../src/game/gamemodes/GamemodeDefinition";
import { MUSIC_UNLOCK_VARPS, VARP_MASTER_VOLUME, VARP_SPECIAL_ATTACK } from "../../../client/common/vars";
import { PLAYER_BODY_RECOLOR_TO_1 } from "../../../client/rs/config/player/PlayerDesignColors";
import { getXpForLevel, SkillId } from "../../../client/rs/skill/skills";
import { RUN_ENERGY_MAX } from "../../src/game/actor";
import type { NpcState } from "../../src/game/npc";
import type { PlayerState } from "../../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../../src/game/scripts/types";
import { setActorVisibilityFilter, setDefaultSoundRadius, setSoundAudibilityFilter } from "../../src/game/visibility/ActorVisibility";
import { getSharedLocTileLookup } from "../../src/world/LocTileLookupService";
import { SinclairBase } from "./sinclair-base";
import os from "os";

import { config } from "../../src/config";
import { getAttackSpeed } from "../../src/game/combat/WeaponDataProvider";
import { getItemDefinition } from "../../src/data/items";
import { createBotBrain, type BotMover } from "./bots";
import { scheduleConsumableAction } from "../dev/scripts/utils/consumables";
import { CHORE_TOKEN, contentPacket, DEMON_BUTLER, UNEATABLE_FOODS, WARE_ITEM } from "./butler";
import { registerToyHandlers } from "./cosmetics";
import { applyProgress, bankItem, exportProgress, parseProgress, type ProgressIO } from "./progression";
import { isCosmetic, registerStoreHandlers, SinclairStore } from "./store";
import { botLook } from "./botLooks";
import { Discovery, publicAddress } from "./discovery";
import { isPrivateIp, PortMapper } from "./upnp";
import { getMatchmakingRegistry } from "../../src/matchmaking/registry";
import { normalizeRoomCode, RoomManager } from "./rooms";
import { MURDER_CONFIG as C, secToTicks } from "./config";
import { encodeHudPacket, HUD_REFRESH_TICKS, HUD_SNAPSHOT } from "./hud";
import {
    COINS, distToRect, MurderGame, type GameIO, type LobbyNotice, type MurderHud, type Participant,
    type RolePref, type Tile,
} from "./MurderGame";
import {
    BOUNDARY_GATES, CONTAINERS, CROP_REGROW_SEC, CROPS, CRUMBLING_WALL, DOOR_SWINGS, DOORS, ESCAPES, LOOSE_BRICKS, WALL_ESCAPES,
    HOUSEHOLD, INTRO_CAMERAS, ITEM_SPAWNS, ITEMS, LAYOUT, ORIGINAL_BLOOD, ROOMS,
    roomAt, SPAWN, STAIR_LANDING, TASKS, WEAPON_POOL, zoneAt,
} from "./mansion";

/** OSRS's "Quest complete!" scroll (interface 153) and its jingle. */
const QUEST_SCROLL = { group: 153, title: 3, subtitle: 4, item: 5, footer: 6, firstLine: 8, lines: 8, close: 16, jingle: 152 };
const PICK_SEQ = 827;
/** Worn-item slots in config.pvp.detectiveGear order (head, cape, neck, weapon, body, shield, legs, hands, feet). */
const GEAR_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const EQUIP_SLOTS = 14;

const BIND = 3283;
/** Lord Sinclair's body: the cache's "Corpse" NPC, which lies on the floor (an NPC, so it blocks nobody). */
const BODY_NPC = 3614;
/** The quest's own guard dog, back in its run east of the house. */
const GUARD_DOG = { npcId: 4228, tile: { x: 2750, y: 3580, level: 0 } };
const GRANDFATHER_CLOCK = 25731;
/** The mansion's own track in OSRS, played across the whole walled grounds. */
const MANSION_MUSIC = { trackId: 21, trackName: "Monarch Waltz" };
const GROUNDS = { x1: 2715, y1: 3550, x2: 2765, y2: 3595 };
/** The clock's chime: OSRS has no grandfather clock sound, so its bell peal stands in. */
const CHIME_SOUND = 932;

const SEARCH_SEQ = 832;
/**
 * How actions look, and how often (ticks) the animation is played again while they last, the way
 * 2009scape's skilling pulses keep animating (CookingPulse 883, DairyChurnPulse 2793,
 * CowMilkingPlugin 2305, farming's watering can 2293 / rake 2273 / bucket 2283, Dragon Slayer's
 * hammer 3676, leather crafting 1249, woodcutting 879, FireMakingPulse 733, ThievableChestPlugin's
 * lockpicking 536, The Golem's chisel 881, an altar's kneel 645).
 */
const ANIMS: Record<string, { seq: number; every: number }> = {
    reach: { seq: SEARCH_SEQ, every: 3 },
    cook: { seq: 883, every: 4 },
    churn: { seq: 2793, every: 2 },
    milk: { seq: 2305, every: 8 },
    water: { seq: 2293, every: 5 },
    rake: { seq: 2273, every: 2 },
    pour: { seq: 2283, every: 6 },
    hammer: { seq: 3676, every: 4 },
    sew: { seq: 1249, every: 4 },
    chop: { seq: 879, every: 2 },
    light: { seq: 733, every: 6 },
    lockpick: { seq: 536, every: 2 },
    chisel: { seq: 881, every: 3 },
    kneel: { seq: 645, every: 4 },
    frisk: { seq: 881, every: 2 }, // 2009scape's pickpocket (ThievingListeners.PICKPOCKET_ANIM)
};
/** An action's look when its step doesn't name one: studying the body is done kneeling, a Stop and Search going through pockets. */
const KIND_ANIM: Partial<Record<string, string>> = { inspect: "kneel", frisk: "frisk" };
/** One-off actions (a search, a stash, a hand-off) play their animation once. */
const ONE_OFF = new Set(["search", "stash", "give", "plant", "pickpocket"]);
/** The guard from Murder Mystery, whose chathead speaks in the opening cutscene. */
const GUARD_NPC = 4218;
/** Dinner is served: the narration box's picture in the opening cutscene. */
const STEW = 2003;

/** Characters a dialog line holds (2009scape's DialUtils.splitLines). */
const DIALOG_LINE_CHARS = 54;
/** Lines a titled sprite dialog has room for above "Click here to continue". */
const DIALOG_PAGE_LINES = 3;
/**
 * Paragraphs wrapped into dialog lines at word breaks and packed into pages: a paragraph stays
 * on one page when it fits, and only one too long for a page runs on to the next.
 */
export function dialogPages(paragraphs: string[], perLine = DIALOG_LINE_CHARS, perPage = DIALOG_PAGE_LINES): string[][] {
    const wrap = (text: string): string[] => {
        const out: string[] = [];
        let line = "";
        for (const word of text.split(/\s+/).filter(Boolean)) {
            if (line && line.length + 1 + word.length > perLine) {
                out.push(line);
                line = word;
            } else line = line ? `${line} ${word}` : word;
        }
        if (line) out.push(line);
        return out;
    };
    const pages: string[][] = [];
    let page: string[] = [];
    for (const para of paragraphs) {
        const lines = wrap(para);
        if (page.length && page.length + lines.length > perPage) {
            pages.push(page);
            page = [];
        }
        for (const line of lines) {
            if (page.length >= perPage) {
                pages.push(page);
                page = [];
            }
            page.push(line);
        }
    }
    if (page.length) pages.push(page);
    return pages.length ? pages : [[""]];
}
/** OSRS's "Player 'Attack' options" varp: 1 = always right-click, 2 = left-click where available. */
const VARP_PLAYER_ATTACK_OPTION = 1107;
const ATTACK_RIGHT_CLICK = 1;
const ATTACK_LEFT_CLICK = 2;
const INVENTORY_SLOTS = 28;
const WEAPON_SLOT = 3;
/** Drinking the reward prayer potion (one dose) puts Protect from Melee up for this long. */
const POTION_PRAYER = "protect_from_melee";
const DRINK_SEQ = 829;
/** The potion-drinking sound (the engine's consumables). */
const DRINK_SOUND = 2401;
/** 2009scape's Food: the eat animation and sound. */
const EAT_SEQ = 829;
const EAT_SOUND = 2393;
/**
 * What ghosts look like to each other: one picked at random when they die. The cache's Ghosts
 * (85-92, each a different model), the Ghoul (289) and an Aberrant spectre (3).
 */
/** Loc options a ghost may use on stairs and ladders (canInteractWithLoc). */
const GHOST_CLIMB_OPTIONS = new Set(["climb", "climb-up", "climb-down", "climb up", "climb down", "ascend", "descend", "top-floor", "top floor", "bottom-floor", "bottom floor"]);
const GHOST_LOOKS = [85, 86, 87, 88, 89, 90, 91, 92, 289, 3];
/** The dragon claws' special costs 70% of the bar here (OSRS: half). */
const CLAWS_SPEC_COST = C.pvp.clawsSpecCost;
const WORLD = { worldViewId: -1 }; // shared (top-level) world view for loc changes
const DEFAULT_MASTER_VOLUME = 20;
// Keyed by name, not session id, so logging back in after a drop finds your character again.
const playerKey = (player: PlayerState) => `h:${(player.name || `Player${player.id}`).toLowerCase()}`;
const ANNOUNCE = (text: string) => `<col=7f0000>${text}</col>`;
/** During the investigation the living see (and hear) only within this many tiles, on their own floor. */
const VIEW_DISTANCE = 7;
const withinView = (viewer: PlayerState, at: { x: number; y: number; level: number }) =>
    Math.max(Math.abs(viewer.tileX - at.x), Math.abs(viewer.tileY - at.y), Math.abs(viewer.level - at.level)) <= VIEW_DISTANCE;
const groundKey = (itemId: number, t: { x: number; y: number; level?: number }) => `${itemId}@${t.x},${t.y},${t.level ?? 0}`;

class SinclairMansionGamemode extends SinclairBase {
    override readonly id = "sinclair-mansion";
    override readonly name = "Murder at Sinclair Mansion";
    readonly passwordlessLogin = true; // pick a name and play

    /** Start the master volume at 20% (vanilla's 75% is loud, and the ambience hisses). Saved settings still win. */
    override getLoginVarps(player: PlayerState): Array<[number, number]> {
        // Every track in the music tab is unlocked: it's a party game, not a world to explore.
        const unlocked = MUSIC_UNLOCK_VARPS.map((id): [number, number] => [id, -1]);
        for (const [id, v] of unlocked) player.varps.setVarpValue(id, v);
        const base = super.getLoginVarps(player).filter(([id]) => !(MUSIC_UNLOCK_VARPS as readonly number[]).includes(id));
        return [
            ...base.map(([id, v]): [number, number] => [id, id === VARP_MASTER_VOLUME ? DEFAULT_MASTER_VOLUME : v]),
            ...unlocked,
            // Attacking someone is a right-click choice until you pick otherwise (Settings > Controls).
            [VARP_PLAYER_ATTACK_OPTION, ATTACK_RIGHT_CLICK],
        ];
    }

    /**
     * The house and grounds are one music area. The map splits them between two regions
     * (Monarch Waltz and, from the dog run east, Camelot), so walking about would keep swapping
     * and fading the song.
     */
    getMusicArea(player: PlayerState): { areaId: number; trackId: number; trackName: string } | undefined {
        const { x1, y1, x2, y2 } = GROUNDS;
        if (player.tileX < x1 || player.tileX > x2 || player.tileY < y1 || player.tileY > y2) return undefined;
        return { areaId: 1, ...MANSION_MUSIC };
    }

    /** Characters are designed on the login screen, so skip the in-game designer. */
    resolveAccountStage(player: PlayerState): void {
        player.account.accountStage = 2;
    }

    private services: ScriptServices | undefined;
    /** The mansion's game. Its lobby is this server's room (see rooms.ts). */
    private game: MurderGame | undefined;
    private rooms: RoomManager | undefined;
    /** Each player's latest Host/Join reply, shown in their lobby window for a few seconds. */
    private readonly notices = new Map<string, LobbyNotice & { until: number }>();
    private noticeId = 0;
    private readonly humans = new Map<string, PlayerState>();
    /** The household bots: AI players (like 2009scape's AIPlayer), keyed "b:<player id>". */
    private readonly bots = new Map<string, PlayerState>();
    /** Participant key of every player in the world, people and bots. */
    private readonly keyById = new Map<number, string>();
    /** Ground stacks the game placed, by "itemId@x,y,level" (weapons, the Detective's kit, items lying around). */
    private readonly ground = new Map<string, number>();
    private readonly hudSigs = new Map<string, string>();
    private hudServices: GamemodeServerServices | undefined;
    /** Players with the server browser open (they get the LAN games in their HUD). */
    private readonly browsing = new Set<string>();
    private discovery: Discovery | undefined;
    /** Opens the game port on the router once someone hosts (internet play). */
    private portMapper: PortMapper | undefined;
    /** Periodic matchmaking heartbeat (ms interval). */
    private matchmakingHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private doorsOpened = false;
    private body: NpcState | undefined;
    /** Ground stacks dropped by the dead this game (cleared when the next one starts). */
    private readonly dropStacks: Array<{ stackId: number; qty: number }> = [];
    /** Blood left where the Murderer killed someone this game. */
    private readonly killMarks: Tile[] = [];
    /** The Murderer's victims' bodies, lying in their blood (cleared with the kill marks). */
    private readonly victimBodies: NpcState[] = [];
    private bloodRemoved = false;
    /** The main menu's cosmetic store and bank. */
    private store: SinclairStore | undefined;
    /** Players whose session has taken their progression from the browser (or had none to give). */
    private readonly progressSynced = new Set<string>();
    /** Chore tokens of players who dropped mid-game, handed back when they log in again. */
    private readonly tokensAway = new Map<string, number>();
    /** The NPC each ghost appears as (GHOST_LOOKS), kept through a reconnect. */
    private readonly ghostLooks = new Map<string, number>();

    override shouldLoadDefaultNpcSpawns(): boolean {
        return false; // the household is spawned by the game
    }

    override getSpawnLocation(): { x: number; y: number; level: number } {
        return SPAWN;
    }

    override canInteract(player: PlayerState): boolean {
        const p = this.participant(player);
        if (!p) return false; // not in a room: just the lobby window
        if (!p.alive) return false; // ghosts only watch
        return !player.isMovementLocked(this.services?.system.getCurrentTick() ?? 0);
    }

    /** Ghosts can't touch anything, but they can still take the stairs and ladders. */
    canInteractWithLoc(player: PlayerState, locId: number, option: string): boolean {
        const p = this.participant(player);
        if (!p || p.alive || !GHOST_CLIMB_OPTIONS.has(option)) return false;
        if (player.isMovementLocked(this.services?.system.getCurrentTick() ?? 0)) return false;
        const name = String(this.services?.data.getLocDefinition(locId)?.name ?? "").toLowerCase();
        return name.includes("stair") || name.includes("ladder");
    }

    /** Ghosts can't touch anything but can walk about and watch; outside the lobby you stay put. */
    canMove(player: PlayerState): boolean | undefined {
        const p = this.participant(player);
        if (!p) return false; // not in a room: you stay put at the lobby window
        return !player.isMovementLocked(this.services?.system.getCurrentTick() ?? 0);
    }

    /** Find the MurderGame instance that a player (person or bot) belongs to (if any). */
    private getGameForPlayer(player: PlayerState): MurderGame | undefined {
        const key = this.keyOf(player);
        if (this.bots.has(key)) return this.game;
        return this.rooms?.roomOf(key);
    }

    /** A player's participant key: "h:<name>" for people, "b:<id>" for bots. */
    private keyOf(player: PlayerState): string {
        return this.keyById.get(player.id) ?? playerKey(player);
    }

    /** A person or bot in the world by player id (a right-click target). */
    private playerById(id: number): PlayerState | undefined {
        const key = this.keyById.get(id);
        return key ? this.actor(key) : undefined;
    }

    /** The player standing in for a participant, person or bot. */
    private actor(key: string): PlayerState | undefined {
        return this.humans.get(key) ?? this.bots.get(key);
    }

    // The engine calls onPlayerHandshake on every login (onPlayerLogin is never invoked).
    override onPlayerHandshake(player: PlayerState, bridge: HandshakeBridge): void {
        super.onPlayerHandshake(player, bridge);
        const key = playerKey(player);
        this.humans.set(key, player);
        this.keyById.set(player.id, key);
        const game = this.getGameForPlayer(player);
        const services = this.services;
        if (!game || !services) return;
        // Back after a dropped connection: straight back into your game. Anyone else starts at
        // the lobby window (host or join) and stays out of the world until they're in a lobby.
        const rejoining = !!game.participants.get(key)?.away;
        const p = rejoining ? game.join(key, player.name || `Player${player.id}`) : undefined;
        services.scheduler.after(2, () => {
            if (!rejoining) services.movement.teleportPlayer(player, SPAWN.x, SPAWN.y, SPAWN.level);
            if (p) this.help(p).forEach((line) => services.messaging.sendGameMessage(player, line));
            else services.messaging.sendGameMessage(player, "Welcome to Murder at Sinclair Mansion. Host a game, or join one, in the lobby window.");
        });
    }

    override onPlayerDisconnect(playerId: number): void {
        super.onPlayerDisconnect(playerId);
        const key = this.keyById.get(playerId);
        this.keyById.delete(playerId);
        if (!key || this.humans.get(key)?.id !== playerId) return; // already replaced by a newer login
        const player = this.humans.get(key)!;
        if (this.whyNotBrowse(player)) this.tokensAway.set(key, this.tokensOf(player)); // mid-game: kept for a reconnect
        // The session's player object is gone: don't keep it (or its potion's timer) alive.
        this.potionPrayerUntil.delete(player);
        // Mid-game they keep their seat for the reconnect grace; between games they're out.
        this.rooms?.disconnect(key);
        this.humans.delete(key);
        this.notices.delete(key);
        this.hudSigs.delete(key);
        this.browsing.delete(key);
        this.progressSynced.delete(key);
    }

    /** Why a player can't open the store or bank now: only between games, never while playing one. */
    private whyNotBrowse(player: PlayerState): string | undefined {
        const game = this.getGameForPlayer(player);
        const playing = !!game && !!this.participant(player) && game.phase !== "lobby" && game.phase !== "gameover";
        return playing ? "You can't do that during a game. The store and bank open between games." : undefined;
    }

    private tokensOf(player: PlayerState): number {
        return (this.services?.inventory.getInventoryItems(player) ?? []).reduce((n, e) => n + (e.itemId === CHORE_TOKEN ? e.quantity : 0), 0);
    }

    /** The Demon butler serves the living during the investigation (at the table everyone is seated). */
    private canShop(player: PlayerState): boolean {
        const p = this.participant(player);
        return !!p?.alive && this.getGameForPlayer(player)?.phase === "investigation";
    }

    private talkToButler(player: PlayerState): void {
        const services = this.services;
        const game = this.getGameForPlayer(player);
        if (!services || !game) return;
        const say = (text: string) => services.messaging.sendGameMessage(player, `Demon butler: ${text}`);
        if (game.phase === "lobby" || game.phase === "gameover") return say("Once the game begins, every chore earns the family's IOUs. Bring them to me.");
        if (!this.canShop(player)) return say("Not while the household is at table, if you please.");
        say("Fresh from the larder. What may I fetch for you?");
        this.store?.openButler(player, game.playerCount());
    }

    /** How progression reaches a player's pack, worn items and bank (progression.ts). */
    private readonly progressIO: ProgressIO = {
        pack: (player) => this.services?.inventory.getInventoryItems(player) ?? [],
        setPackSlot: (player, slot, itemId, quantity) => this.services?.inventory.setInventorySlot(player, slot, itemId, quantity),
        addToPack: (player, itemId, quantity) => (this.services?.inventory.addItemToInventory(player, itemId, quantity).added ?? 0) > 0,
        equip: (player) => ({ ids: this.hudServices?.getEquipArray(player) ?? [], qty: this.hudServices?.getEquipQtyArray(player) ?? [] }),
        refresh: (player) => {
            this.services?.inventory.snapshotInventory(player);
            this.refreshGear(player);
        },
    };

    /**
     * The browser's saved progression, sent once per session. Between games it replaces this
     * copy's coins, cosmetics and bank (so they follow you from server to server); mid-game (a
     * reconnect) the game's own state carries on and the browser saves that instead.
     */
    private receiveProgress(player: PlayerState, raw: unknown): void {
        const key = playerKey(player);
        if (this.progressSynced.has(key)) return;
        this.progressSynced.add(key);
        const save = parseProgress(raw);
        if (!save || this.whyNotBrowse(player)) return;
        this.store?.close(player);
        applyProgress(player, save, this.progressIO);
    }

    /**
     * The look you designed on the main menu, kept in your browser and sent after every login, so
     * a friend's game shows you as you made yourself (their copy has never seen you before). Only
     * the body changes: no teleport, and a ghost stays a ghost.
     */
    private receiveLook(player: PlayerState, raw: unknown): void {
        const r = raw as { gender?: unknown; kits?: unknown; colors?: unknown } | undefined;
        const ints = (v: unknown, n: number, min: number, max: number) =>
            Array.isArray(v) && v.length >= n && v.slice(0, n).every((x) => Number.isInteger(x) && x >= min && x <= max)
                ? (v.slice(0, n) as number[])
                : undefined;
        const kits = ints(r?.kits, 7, -1, 2047);
        const colors = ints(r?.colors, 5, 0, 255);
        if (!r || (r.gender !== 0 && r.gender !== 1) || !kits || !colors) return;
        if (!player.appearance || !this.services) return;
        // Everyone else's client draws this look, so only what the character designer offers is
        // taken: each body part one of that gender's selectable kits (or none), each colour one
        // of its palette's. Anything else (an id from another part or gender, a colour off the
        // end of the palette) could leave other players drawing a broken model.
        const offered = this.identityKits(r.gender);
        if (offered && kits.some((id, part) => id !== -1 && !offered[part]?.includes(id))) return;
        if (colors.some((c, i) => c >= (PLAYER_BODY_RECOLOR_TO_1[i]?.length ?? 0))) return;
        Object.assign(player.appearance, { gender: r.gender, kits, colors });
        this.refreshGear(player);
        this.services.appearance.savePlayerSnapshot(player);
    }

    /** The selectable identity kits per body part, per gender (from the cache, read once). */
    private readonly kitsByGender = new Map<number, number[][]>();
    private identityKits(gender: number): number[][] | undefined {
        let kits = this.kitsByGender.get(gender);
        if (!kits) {
            kits = this.hudServices?.getIdentityKits(gender);
            if (!kits?.some((part) => part.length)) return undefined; // cache not loaded: don't refuse anyone
            this.kitsByGender.set(gender, kits);
        }
        return kits;
    }

    /** PvP is on everywhere in the mansion, but only while the household is spread out. */
    canAttackPlayer(attacker: PlayerState, target: PlayerState): boolean {
        const game = this.getGameForPlayer(attacker);
        const a = game?.participants.get(this.keyOf(attacker));
        const t = game?.participants.get(this.keyOf(target));
        if (!game || !a || !t) return false;
        const why = game.canAttack(a, t);
        if (why) this.services?.messaging.sendGameMessage(attacker, why);
        return !why;
    }

    /** The grandfather clock has no options in the cache: op 1 strikes it (ends the round early). */
    resolveLocOption(player: PlayerState, locId: number, opNum: number): string | undefined {
        return locId === GRANDFATHER_CLOCK && opNum === 1 && this.participant(player) ? "Ring" : undefined;
    }

    /** Everyone can cast Bind (they carry runes for three), whatever this game's Magic level. */
    ignoresSpellLevel(player: PlayerState, spellId: number): boolean {
        return spellId === BIND && !!this.participant(player)?.alive;
    }

    /** A left-click on a body reports it (or, once reported, the Detective studies it); nobody attacks the Demon butler. */
    resolveNpcOption(_player: PlayerState, npc: NpcState, opNum: number): string | undefined {
        if (npc.typeId === BODY_NPC) return opNum === 1 ? "Investigate" : "refused";
        if (npc.typeId === DEMON_BUTLER.npcId && opNum !== 1) return "refused"; // he only serves
        return undefined;
    }

    /** Killed in a fight (people and bots alike): no Lumbridge, no loot pile. The game decides what happens. */
    onPlayerDeath(player: PlayerState, killer: PlayerState | undefined, at?: Tile): boolean {
        const game = this.getGameForPlayer(player);
        const p = game?.participants.get(this.keyOf(player));
        if (!game || !p) return true;
        if (game.phase === "lobby" || game.phase === "gameover") {
            game.onLobbyDeath(p);
            return true;
        }
        // Their things fall where they were killed (the engine's record of it), wherever they are now.
        game.onDeath(p, killer ? game.participants.get(this.keyOf(killer)) : undefined, at);
        return true;
    }

    onPublicChat(player: PlayerState, text: string): boolean {
        const game = this.getGameForPlayer(player);
        const p = game?.participants.get(this.keyOf(player));
        if (!p || !game || game.phase === "lobby") return false;
        if (p.alive) {
            game.heard(p, text); // the bots at the table (or in the room) are listening
            return false;
        }
        // Ghosts talk only to ghosts.
        for (const q of game.participants.values()) {
            const target = this.humans.get(q.key);
            if (target && !q.alive) this.services?.messaging.sendGameMessage(target, `<col=666666>[Ghost] ${p.name}: ${text}</col>`);
        }
        return true;
    }

    override registerHandlers(registry: IScriptRegistry, services: ScriptServices): void {
        super.registerHandlers(registry, services); // vanilla UI, doors, etc.
        this.services = services;

        // One mansion, so one game and one room (see rooms.ts). Its handlers are registered once.
        const game = this.createGame();
        const rooms = new RoomManager([game]);
        this.game = game;
        this.rooms = rooms;
        this.registerHouseRules(registry);
        this.registerGarden(registry, game);
        this.registerContainerHandlers(registry, game);
        this.registerItemHandlers(registry, game);
        this.registerCommands(registry, game);
        this.registerLobbyMessages(registry, rooms);
        registerStoreHandlers(registry, services, (player, screen) => this.store?.open(player, screen));
        registerToyHandlers(registry, (player, text) =>
            this.hudServices?.queueChatMessage({ messageType: "public", playerId: player.id, from: player.name, text }));
        registry.registerClientMessageHandler("sinclair_progress", ({ player, payload }) => this.receiveProgress(player, payload.progress));
        registry.registerClientMessageHandler("sinclair_look", ({ player, payload }) => this.receiveLook(player, payload));

        registry.registerTickHandler(() => {
            if (!this.doorsOpened) {
                this.setupDoorSwings();
                this.removeOriginalBlood();
                this.spawnGuardDog();
                this.spawnButler();
                this.markWallEscapes();
                this.doorsOpened = true;
            }
            for (const g of rooms.all()) g.update();
            this.expirePotionPrayers();
            rooms.closeEmpty();
            // A game starting shuts the store and bank of everyone playing in it.
            for (const player of this.humans.values()) {
                if (this.store?.openScreen(player) && this.whyNotBrowse(player)) this.store.close(player);
                // ...and the butler's pantry shuts when the clock strikes, the game ends or they die.
                if (this.store?.butlerOpen(player) && !this.canShop(player)) this.store.closeButler(player);
                // Ghosts never tire: their run energy stays full.
                if (this.participant(player)?.alive === false && player.energy.getRunEnergyUnits() !== RUN_ENERGY_MAX) {
                    player.energy.setRunEnergyUnits(RUN_ENERGY_MAX);
                }
            }
            for (const [key, player] of this.humans) this.syncAttackOption(key, player);
            this.pushHuds();
        });
        // Render distance: living players only see actors within 7 tiles (Chebyshev distance).
        // Runs for every viewer and actor pair each tick, so each lookup is done once.
        setActorVisibilityFilter((viewer, target) => {
            const viewerGame = this.getGameForPlayer(viewer);
            const me = viewerGame?.participants.get(this.keyOf(viewer));
            const key = target.kind === "player" ? this.keyById.get(target.id) : undefined;
            const them = key ? viewerGame?.participants.get(key) : undefined;
            if (key && viewerGame) {
                // People who haven't joined the lobby aren't in the mansion yet.
                if (!them && this.humans.has(key)) return false;
                // Ghosts walk among the living unseen (other ghosts see them).
                if (them?.alive === false && me?.alive) return false;
            }
            if (!viewerGame || viewerGame.phase !== "investigation") return true;
            if (!me || !me.alive) return true; // ghosts see everyone
            if (!them) return true; // the cow, etc.
            // 7-tile Chebyshev render distance replaces the old zone-based system.
            return withinView(viewer, target);
        });
        // Sounds carry no further than you can see: a fight out of view (its hits, the claws'
        // special) can't be heard, so it can't give the Murderer away. Ghosts hear everything.
        setSoundAudibilityFilter((listener, at) => {
            const game = this.getGameForPlayer(listener);
            if (!game || game.phase !== "investigation") return true;
            const me = this.participant(listener);
            if (!me || !me.alive) return true;
            return withinView(listener, at);
        });
        // ...and fade with distance: full volume beside you, quieter with each tile, nearly silent
        // at the edge of your view (combat hits and swings name no radius of their own).
        setDefaultSoundRadius(VIEW_DISTANCE);
    }

    private createGame(): MurderGame {
        const game = new MurderGame(this.io, LAYOUT);
        game.botNames = HOUSEHOLD.map((b) => b.name);
        game.spawnBot = (name, tile) => this.spawnBot(name, tile);
        game.despawnBot = (p) => this.removeBot(p);
        const brain = createBotBrain(this.mover);
        // A bot at 0 hitpoints is dying (the death animation plays before onPlayerDeath): it does
        // nothing more. It used to keep walking, and one killed at the top of the stairs would
        // take them (the landing teleports to the same tile a floor down) and drop its things there.
        game.botThink = (g, p) => {
            const bot = this.bots.get(p.key);
            if (bot && bot.skillSystem.getHitpointsCurrent() <= 0) return;
            brain.think(g, p);
        };
        game.onObserve = (q, ev) => brain.observe(game, q, ev);
        game.onActivity = (p, text) => brain.activity(game, p, text);
        game.onChat = (speaker, text) => brain.hear(game, speaker, text);
        return game;
    }

    // ------------------------------------------------------------ handlers
    private participant(player: PlayerState): Participant | undefined {
        return this.getGameForPlayer(player)?.participants.get(this.keyOf(player));
    }

    /** Same loc ids appear on both floors (e.g. drawers 25708), so match by floor and tile first. */
    private containerAt(locId: number, tile: { x: number; y: number }, level: number) {
        // The tile can be the cursor tile next to the furniture, so take the nearest match.
        const here = CONTAINERS.filter((c) => c.locIds.includes(locId) && c.tile.level === level);
        const dist = (c: (typeof here)[number]) => distToRect({ ...tile, level }, { ...c, locId });
        return here.sort((a, b) => dist(a) - dist(b))[0];
    }

    private registerContainerHandlers(registry: IScriptRegistry, game: MurderGame): void {
        registry.registerLocScript({
            locId: GRANDFATHER_CLOCK,
            action: "Ring",
            handler: ({ player }) => {
                const p = this.participant(player);
                if (p) game.ringClock(p);
            },
        });
        for (const c of CONTAINERS) {
            // The crops handle their own Pick (registerGarden); the cow's Milk does its chore.
            if (!c.action || c.locIds.some((id) => id in CROPS)) continue;
            for (const locId of c.locIds) {
                registry.registerLocScript({
                    locId,
                    action: c.action,
                    handler: ({ player, tile, level }) => {
                        const p = this.participant(player);
                        const target = this.containerAt(locId, tile, level);
                        if (p && target) game.useContainer(p, target.id);
                    },
                });
                for (const w of WEAPON_POOL) {
                    registry.registerItemOnLoc(w.itemId, locId, ({ player, source, target }) => {
                        const p = this.participant(player);
                        const ct = this.containerAt(locId, target.tile, target.level);
                        if (p && ct) game.stash(p, ct.id, source.itemId);
                    });
                }
                registry.registerItemOnLoc(ITEMS.flypaper, locId, ({ player, target }) => {
                    const p = this.participant(player);
                    const ct = this.containerAt(locId, target.tile, target.level);
                    if (p && ct) game.lift(p, "container", ct.id);
                });
            }
        }
        // Chores: "Use <item> -> <furniture>", which OSRS only offers while you hold the item.
        const done = new Set<string>();
        for (const task of TASKS) {
            for (const step of task.steps) {
                const use = step.use;
                if (use === undefined) continue; // fetch steps use the furniture's own option
                const target = CONTAINERS.find((c) => c.id === step.c);
                for (const locId of target?.locIds ?? []) {
                    const key = `${use}:${locId}`;
                    if (done.has(key)) continue;
                    done.add(key);
                    registry.registerItemOnLoc(use, locId, ({ player, source, target: t }) => {
                        const p = this.participant(player);
                        const ct = this.containerAt(locId, t.tile, t.level);
                        if (p && ct) game.doChore(p, ct.id, source.itemId);
                    });
                }
            }
        }
        // Chores that mix two items in the pack (water on flour), either way round.
        const mixed = new Set<string>();
        for (const step of TASKS.flatMap((t) => t.steps)) {
            if (step.mix === undefined || step.use === undefined) continue;
            for (const [a, b] of [[step.use, step.mix], [step.mix, step.use]]) {
                if (mixed.has(`${a}:${b}`)) continue;
                mixed.add(`${a}:${b}`);
                registry.registerItemOnItem(a, b, ({ player }) => {
                    const p = this.participant(player);
                    if (p) game.mixChore(p, a, b);
                });
            }
        }
        // The Detective studies the blood with their flypaper to learn the weapon type.
        registry.registerItemOnLoc(ITEMS.flypaper, ORIGINAL_BLOOD.locId, ({ player, target }) => {
            const p = this.participant(player);
            const b = game.bodyAt({ x: target.tile.x, y: target.tile.y, level: target.level });
            if (p && b) game.useBody(p, b.id);
        });
        // ...or on the body itself, or just its Investigate option.
        registry.registerItemOnNpc(ITEMS.flypaper, BODY_NPC, ({ player, target }) => {
            const p = this.participant(player);
            const b = game.bodyByNpc(target.id);
            if (p && b) game.useBody(p, b.id);
        });
        registry.registerNpcScript({
            npcId: BODY_NPC,
            option: "investigate",
            // Report it if nobody has yet (anyone alive); once reported, the Detective studies it.
            handler: ({ player, npc }) => {
                const p = this.participant(player);
                const b = game.bodyByNpc(npc.id);
                if (p && b) game.useBody(p, b.id);
            },
        });
        // The Demon butler's Talk-to opens his pantry: chore tokens for sharks, Bind runes and prayer potions.
        registry.registerNpcScript({
            npcId: DEMON_BUTLER.npcId,
            option: "talk-to",
            handler: ({ player }) => this.talkToButler(player),
        });
    }

    private registerItemHandlers(registry: IScriptRegistry, game: MurderGame): void {
        // Chore tools, the lockpick and the chisel lie around the property and come back after a while.
        for (const itemId of new Set(ITEM_SPAWNS.map((s) => s.itemId))) {
            registry.registerGroundItemInteraction(itemId, ({ player, target, services }) => {
                const p = this.participant(player);
                if (p && game.holdsTool(p, itemId)) return services.messaging.sendGameMessage(player, `You already have a ${this.io.itemName(itemId).toLowerCase()}. You can only carry one of each.`);
                if (!p) return services.messaging.sendGameMessage(player, "You can't take that now.");
                if (!game.pickUp(p, itemId, target.tile)) return; // it says why
                services.groundItems.remove(target.stackId, 1);
                this.ground.delete(groundKey(itemId, target.tile));
            }, "take");
        }
        // The Murderer's escape: pick the front gate's lock, or chisel bricks out of a garden wall.
        for (const gateId of BOUNDARY_GATES) {
            registry.registerItemOnLoc(ITEMS.lockpick, gateId, ({ player, source }) => {
                const p = this.participant(player);
                if (p) game.workEscape(p, "gate", source.itemId);
            });
        }
        const nearestWall = (tile: { x: number; y: number }) => {
            const walls = ESCAPES.filter((e) => e.id !== "gate");
            const d = (e: (typeof walls)[number]) => Math.abs(e.tile.x - tile.x) + Math.abs(e.tile.y - tile.y);
            return walls.sort((a, b) => d(a) - d(b))[0].id;
        };
        // The crumbling wall's own "Climb" tells you how far along it is (it isn't climbable yet).
        registry.registerLocScript({
            locId: CRUMBLING_WALL,
            action: "climb",
            handler: ({ player, tile }) => {
                const p = this.participant(player);
                if (p) game.inspectEscape(p, nearestWall(tile));
            },
        });
        registry.registerItemOnLoc(ITEMS.chisel, CRUMBLING_WALL, ({ player, source, target }) => {
            const p = this.participant(player);
            if (p) game.workEscape(p, nearestWall(target.tile), source.itemId);
        });
        for (const tool of game.toolIds) {
            registry.registerItemAction(tool, ({ player, services }) => {
                services.messaging.sendGameMessage(player, "Hang on to that, you need it for a chore.");
            }, "drop");
        }
        // A dead Detective's kit lies on the floor, free for anyone: whoever takes the flypaper is the
        // Detective. The same items dropped by anyone else (a whip someone picked up) are ordinary drops.
        const kitIds = new Set<number>([ITEMS.flypaper, ...C.pvp.detectiveGear.filter((id) => id > 0)]);
        for (const id of kitIds) {
            registry.registerGroundItemInteraction(id, ({ player, target, services }) => {
                const p = this.participant(player);
                if (!p || !p.alive) return services.messaging.sendGameMessage(player, "You can't take that.");
                if (game.takeKitItem(p, target.itemId)) return;
                if (!this.io.giveItem(p, target.itemId)) return services.messaging.sendGameMessage(player, "You don't have enough inventory space to hold that item.");
                services.groundItems.remove(target.stackId, 1);
                this.ground.delete(groundKey(target.itemId, target.tile));
                if (target.itemId === ITEMS.flypaper) game.tookFlypaper(p);
            }, "take");
        }
        // Weapons from the pool can be wielded: the red herrings are how the household fights back.
        for (const { itemId: weaponId } of WEAPON_POOL) {
            registry.registerItemOnPlayer(weaponId, ({ player, target, source }) => {
                const p = this.participant(player);
                if (p) game.give(p, this.keyOf(target), source.itemId);
            });
            registry.registerGroundItemInteraction(weaponId, ({ player, target, services }) => {
                const p = this.participant(player);
                if (!p || !game.takeFromGround(p, target.itemId)) {
                    services.messaging.sendGameMessage(player, "You can't take that.");
                }
            }, "take");
            registry.registerItemAction(weaponId, ({ player, services }) => {
                services.messaging.sendGameMessage(player, "Dropping it in plain sight? Stash it in some furniture or hand it to someone.");
            }, "drop");
        }
        registry.registerItemOnPlayer(ITEMS.flypaper, ({ player, target }) => {
            const p = this.participant(player);
            if (p) game.lift(p, "person", this.keyOf(target));
        });
        registry.registerItemAction(ITEMS.flypaper, ({ player, services }) => {
            services.messaging.sendGameMessage(player, "You'll need that flypaper to lift prints.");
        }, "drop");
        registry.registerItemAction(CHORE_TOKEN, ({ player, services }) => {
            services.messaging.sendGameMessage(player, "Hang on to your Sinclair Family IOUs: the Demon butler in the dining room takes them.");
        }, "drop");
        // The chore reward potion: one dose puts Protect from Melee up for a few ticks, at any Prayer level.
        registry.registerItemAction(C.rewards.prayerPotion, ({ player, services }) => {
            const slot = services.inventory.findInventorySlotWithItem(player, C.rewards.prayerPotion);
            if (slot === undefined || !this.participant(player)?.alive) return;
            services.inventory.setInventorySlot(player, slot, C.rewards.emptyVial, 1);
            services.inventory.snapshotInventory(player);
            services.animation.playPlayerSeq(player, DRINK_SEQ);
            player.prayer.setActivePrayers([...player.prayer.getActivePrayers(), POTION_PRAYER]);
            // A full block, players' hits included (the engine's default, as 2009scape, is 40% off).
            player.protectionBlocksPlayers = true;
            this.potionPrayerUntil.set(player, (services.system.getCurrentTick() ?? 0) + C.rewards.protectTicks);
            services.messaging.sendGameMessage(player, "You drink the prayer potion. You feel protected from melee.");
        }, "drink");
        // The butler's stamina potion (1 dose), as OSRS's: 20% run energy back, and run energy drains
        // 70% slower for 2 minutes (the engine's stamina effect, which the run orb shows). The dev
        // gamemode's potion scripts aren't loaded here (SinclairBase), so it's drunk here.
        registry.registerItemAction(C.rewards.staminaPotion, ({ player, source, tick, services }) => {
            if (!this.participant(player)?.alive) return;
            scheduleConsumableAction({
                player, slotIndex: source.slot, itemId: C.rewards.staminaPotion, option: "drink", tick, services, profile: "potion",
                loggerTag: "sinclair-stamina",
                onExecute: ({ tick: at }) => {
                    services.inventory.setInventorySlot(player, source.slot, C.rewards.emptyVial, 1);
                    services.inventory.snapshotInventory(player);
                    player.energy.adjustRunEnergyPercent(C.rewards.staminaRestorePercent);
                    player.energy.applyStaminaEffect(at, C.rewards.staminaTicks, C.rewards.staminaDrainMultiplier);
                    services.animation.playPlayerSeq(player, DRINK_SEQ);
                    services.sound.playAreaSound({ soundId: DRINK_SOUND, tile: { x: player.tileX, y: player.tileY }, level: player.level, radius: 1 });
                    services.messaging.sendGameMessage(player, "You drink some of your stamina potion.");
                    services.messaging.sendGameMessage(player, "You have finished your potion.");
                },
            });
        }, "drink");
        // The butler's shark, eaten as 2009scape's Food does: heals 20, the eat animation and sound,
        // and the 3-tick food delay. (SinclairBase skips the dev gamemode's consumable scripts, and the
        // engine's bare "consume" only took the shark away.)
        registry.registerItemAction(C.rewards.shark, ({ player, source, tick, services }) => {
            if (!this.participant(player)?.alive) return;
            scheduleConsumableAction({
                player, slotIndex: source.slot, itemId: C.rewards.shark, option: "eat", tick, services, profile: "food",
                loggerTag: "sinclair-shark",
                onExecute: () => {
                    player.skillSystem.applyHitpointsHeal(C.rewards.sharkHeal);
                    services.animation.playPlayerSeq(player, EAT_SEQ);
                    services.sound.playAreaSound({ soundId: EAT_SOUND, tile: { x: player.tileX, y: player.tileY }, level: player.level, radius: 1 });
                    services.messaging.sendGameMessage(player, "You eat the shark.");
                    services.messaging.sendGameMessage(player, "It heals some health.");
                },
            });
        }, "eat");
        // Food made for chores isn't for eating (its Eat is taken off the menu too: butler.ts).
        for (const food of UNEATABLE_FOODS) {
            registry.registerItemAction(food, ({ player, services }) => {
                services.messaging.sendGameMessage(player, "That's for a chore, not for eating.");
            }, "eat");
        }
    }

    /** Players whose potion-given Protect from Melee is up, and the tick it drops. */
    private readonly potionPrayerUntil = new Map<PlayerState, number>();

    private expirePotionPrayers(): void {
        const tick = this.services?.system.getCurrentTick() ?? 0;
        for (const [player, until] of this.potionPrayerUntil) {
            if (tick < until) continue;
            this.potionPrayerUntil.delete(player);
            player.protectionBlocksPlayers = false;
            player.prayer.setActivePrayers([...player.prayer.getActivePrayers()].filter((p) => p !== POTION_PRAYER));
        }
    }

    private registerCommands(registry: IScriptRegistry, game: MurderGame): void {
        const withP = (fn: (p: Participant, args: string[]) => string | void) =>
            ({ player, args }: { player: PlayerState; args: string[] }) => {
                const p = this.participant(player);
                return p ? fn(p, args) : "You're not in the game.";
            };
        registry.registerCommand("start", withP((p, args) => game.start(p.key, Number(args[0]) || undefined) ?? undefined));
        // Choosing a role is only for testing (SINCLAIR_ROLE_PICK=1); players get a random one.
        if (C.lobby.allowRolePick) {
            registry.registerCommand("role", withP((p, args) => {
                const r = (args[0] ?? "").toLowerCase();
                if (!["detective", "murderer", "npc", "random"].includes(r)) return "Usage: ::role detective|murderer|npc|random";
                return game.setRolePref(p, r as RolePref);
            }));
        }
        registry.registerCommand("notes", withP((p) => { game.notesFor(p).forEach((l) => game.io.message(p, l)); }));
        registry.registerCommand("tasks", withP((p) => { game.tasksFor(p).forEach((l) => game.io.message(p, l)); }));
        registry.registerCommand("report", withP((p) => { game.report(p); }));
        // Everyone alive votes on who to arrest at the dinner table (the overlay, or this dialog).
        const vote = withP((p) => {
            if (game.phase !== "arrest") return "Votes are cast at the dinner table, after the clock strikes.";
            if (!p.alive) return "Ghosts don't get a vote.";
            game.offerVote(p);
        });
        registry.registerCommand("vote", vote);
        registry.registerCommand("arrest", vote);
        registry.registerClientMessageHandler("sinclair_vote", ({ player, payload }) => {
            const p = this.participant(player);
            if (!p) return;
            const target = (payload as { target?: unknown } | undefined)?.target;
            const why = game.vote(p, typeof target === "string" ? target : null);
            if (why) this.services?.messaging.sendGameMessage(player, why);
        });
        // The right-click "Plant weapon" on a person: slip a carried weapon into the pack of someone
        // whose screen is black (a chore's long moment), with nobody else watching. Silent.
        registry.registerClientMessageHandler("sinclair_plant", ({ player, payload }) => {
            const p = this.participant(player);
            const id = (payload as { target?: unknown } | undefined)?.target;
            if (!p || typeof id !== "number") return;
            const target = this.playerById(id);
            const w = game.murderWeaponHeldBy(p) ?? game.weaponHeldBy(p);
            if (!target || !w) return void this.services?.messaging.sendGameMessage(player, "You have nothing to plant.");
            const why = game.plant(p, this.keyOf(target), w.itemId);
            this.services?.messaging.sendGameMessage(player, why
                ? (why === "They'd notice." ? "They'd notice. Wait until they're lost in a chore (their screen goes black)." : why)
                : `You quietly slip the ${w.name} towards ${target.name}'s pack...`);
        });
        // The right-click "Pickpocket" on a person: take back a weapon you planted on them. Unseen (their
        // screen black, nobody else watching) it's silent; on someone awake, they catch you at it.
        registry.registerClientMessageHandler("sinclair_pickpocket", ({ player, payload }) => {
            const p = this.participant(player);
            const id = (payload as { target?: unknown } | undefined)?.target;
            if (!p || typeof id !== "number") return;
            const target = this.playerById(id);
            if (!target) return;
            const why = game.pickpocket(p, this.keyOf(target));
            this.services?.messaging.sendGameMessage(player, why ?? `You reach quietly into ${target.name}'s pack...`);
        });
        // The Detective's right-click "Stop and Search" on a person (once a round).
        registry.registerClientMessageHandler("sinclair_search", ({ player, payload }) => {
            const p = this.participant(player);
            const id = (payload as { target?: unknown } | undefined)?.target;
            if (!p || typeof id !== "number") return;
            const target = this.playerById(id);
            if (target) game.stopAndSearch(p, this.keyOf(target));
        });
        registry.registerCommand("who", withP(() => {
            // Who the Detective is isn't public: whoever holds the flypaper.
            const list = [...game.participants.values()].map((q) => `${q.name}${q.alive ? "" : " (ghost)"}`);
            return `Phase: ${game.phase}, round ${game.round}. ${list.join(", ")}`;
        }));
        registry.registerCommand("murder", withP((p) => { this.help(p).forEach((l) => game.io.message(p, l)); }));
    }

    /**
     * The lobby window's buttons (a GAMEMODE_MESSAGE "sinclair_lobby", so a password never goes
     * through chat): host, join, change settings, leave, start, and the browser being open.
     * Host and Join answer with a notice in the lobby window (and chat): why it failed, or, for a
     * room code that belongs to another server, where to reconnect (Impostor's redirect).
     */
    private registerLobbyMessages(registry: IScriptRegistry, rooms: RoomManager): void {
        registry.registerClientMessageHandler("sinclair_lobby", ({ player, payload }) => {
            const key = playerKey(player);
            const name = player.name || `Player${player.id}`;
            const password = typeof payload.password === "string" ? payload.password : "";
            const settings = {
                name: typeof payload.name === "string" ? payload.name : undefined,
                password: typeof payload.password === "string" ? payload.password : undefined,
                maxPlayers: typeof payload.maxPlayers === "number" ? payload.maxPlayers : undefined,
                fillWithBots: typeof payload.fillWithBots === "boolean" ? payload.fillWithBots : undefined,
            };
            const defined = Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined));
            const mine = rooms.roomOf(key);
            let error: string | undefined;
            switch (payload.action) {
                case "host": {
                    const result = rooms.host(key, name, defined);
                    error = result.error;
                    if (!error) this.portMapper?.open();
                    break;
                }
                case "join": {
                    // A room code can be typed with spaces or dashes; one that isn't 6 characters is no code.
                    const typed = typeof payload.roomCode === "string" && payload.roomCode.trim() ? payload.roomCode : undefined;
                    const code = typed === undefined ? undefined : normalizeRoomCode(typed);
                    if (typed !== undefined && !code) {
                        error = "A room code is 6 letters and numbers.";
                        break;
                    }
                    if (code && !rooms.find(code)) {
                        // Not here: on the LAN (or in a matchmaking registry) it's a direct
                        // connection; otherwise the client looks for its host over PeerJS.
                        const address = this.resolveRoomCode(code);
                        if (address && address !== this.publicAddress()) this.notify(key, { redirect: { address, roomCode: code } });
                        else this.notify(key, { tryPeer: code });
                        break;
                    }
                    error = rooms.join(key, name, code, password).error;
                    break;
                }
                case "configure":
                    error = mine ? mine.configureLobby(key, defined) : "There's no game to change.";
                    break;
                case "leave":
                    error = rooms.leave(key);
                    // Out of the room, out of the mansion: back to the gate, standing still, until
                    // they host or join again (others in the room no longer see them).
                    if (!error && mine) {
                        player.clearInteraction();
                        player.setCombatTarget(null);
                        this.services?.movement.teleportPlayer(player, SPAWN.x, SPAWN.y, SPAWN.level);
                        this.services?.messaging.sendGameMessage(player, "You left the game. Host a game, or join one, in the lobby window.");
                    }
                    break;
                case "start":
                    error = mine ? mine.start(key) : "There's no game to start.";
                    break;
                case "browse":
                    // The server browser is open (true) or closed: send the LAN list meanwhile.
                    if (payload.open === false) this.browsing.delete(key);
                    else this.browsing.add(key);
                    break;
                default:
                    return;
            }
            if (error) {
                this.services?.messaging.sendGameMessage(player, error);
                if (payload.action === "host" || payload.action === "join") this.notify(key, { error });
            }
            const game = rooms.roomOf(key);
            const p = game?.participants.get(key);
            if (!error && p && (payload.action === "host" || payload.action === "join")) {
                this.browsing.delete(key);
                this.notices.delete(key);
                if (game!.phase === "lobby" || game!.phase === "gameover") this.io.restore(p);
                this.help(p).forEach((line) => this.services?.messaging.sendGameMessage(player, line));
            }
            this.hudSigs.delete(key); // send the new lobby state straight away
        });
    }

    /** A Host/Join reply for one player's lobby window (kept for 10 s, acted on once by its id). */
    private notify(key: string, notice: Omit<LobbyNotice, "id">): void {
        this.notices.set(key, { ...notice, id: ++this.noticeId, until: Date.now() + 10_000 });
        this.hudSigs.delete(key);
    }

    private help(p: Participant): string[] {
        const game = this.rooms?.roomOf(p.key);
        if (!game) return ["Welcome to Murder at Sinclair Mansion."];
        const lines = ["Welcome to Murder at Sinclair Mansion."];
        if (game.phase === "lobby" || game.phase === "gameover") {
            lines.push(game.hostKey === p.key
                ? "You're the host: press Start in the lobby window when everyone's in."
                : "Waiting for the host to start the game.");
        } else {
            lines.push(`A game is running (round ${game.round}).`);
        }
        lines.push("Commands: ::tasks ::notes ::report ::who ::vote ::murder");
        return lines;
    }

    // ------------------------------------------------------------ world glue
    /** Apply custom swing directions for doors that need non-default hinge orientation. */
    private setupDoorSwings(): void {
        const services = this.services;
        const doorManager = services?.location.doorManager;
        if (!services || !doorManager) return;
        for (const s of DOOR_SWINGS) doorManager.setSwingOverride(s.tile.x, s.tile.y, s.tile.level, s.swing);
    }

    private isDoorOpen(d: (typeof DOORS)[number]): boolean {
        return !!this.services?.location.doorManager?.isDoorOpenAt(d.tile.x, d.tile.y, d.tile.level);
    }

    private openDoor(d: (typeof DOORS)[number]): boolean {
        const services = this.services;
        const doorManager = services?.location.doorManager;
        if (!services || !doorManager || this.isDoorOpen(d)) return false;
        const result = doorManager.toggleDoor({
            x: d.tile.x, y: d.tile.y, level: d.tile.level, currentId: d.locId, action: "open",
            currentTick: services.system.getCurrentTick(),
        });
        if (!result?.success || result.newLocId === undefined) {
            services.system.logger.warn(`[sinclair] could not open door ${d.locId} at ${d.tile.x},${d.tile.y}`);
            return false;
        }
        services.location.emitLocChange(d.locId, result.newLocId, d.tile, d.tile.level, {
            oldTile: d.tile, newTile: result.newTile ?? d.tile, oldRotation: result.oldRotation, newRotation: result.newRotation,
        });
        if (result.partnerResult) {
            const pr = result.partnerResult;
            services.location.emitLocChange(pr.oldLocId, pr.newLocId, pr.oldTile, d.tile.level, {
                oldTile: pr.oldTile, newTile: pr.newTile, oldRotation: pr.oldRotation, newRotation: pr.newRotation,
            });
        }
        return true;
    }

    /** Each wall escape is a crumbling stretch of the garden wall, loose bricks lying below it. */
    private markWallEscapes(): void {
        const loc = this.services?.location;
        for (const e of ESCAPES) {
            const w = WALL_ESCAPES[e.id];
            if (!w || !loc) continue;
            loc.replaceTemporaryLoc(WORLD, w.wallId, CRUMBLING_WALL, e.tile, e.tile.level, { oldShape: 0, oldRotation: w.rotation, newShape: 0, newRotation: w.rotation });
            loc.replaceTemporaryLoc(WORLD, 0, LOOSE_BRICKS, w.rubble, w.rubble.level, { newShape: 10, newRotation: 0 });
        }
    }

    private spawnGuardDog(): void {
        const d = GUARD_DOG;
        const dog = this.services?.npc.spawnNpc({ id: d.npcId, x: d.tile.x, y: d.tile.y, level: d.tile.level, wanderRadius: 1 });
        if (!dog) this.services?.system.logger.warn("[sinclair] couldn't spawn the guard dog");
    }

    /** The Demon butler waits in the dining room's corner, between games and during them, standing at his post facing the room. */
    private spawnButler(): void {
        const { npcId, tile, wanderRadius, direction } = DEMON_BUTLER;
        const butler = this.services?.npc.spawnNpc({ id: npcId, x: tile.x, y: tile.y, level: tile.level, wanderRadius, direction });
        if (!butler) this.services?.system.logger.warn("[sinclair] couldn't spawn the Demon butler");
    }

    /** The study's blood stain is the quest's crime scene; ours moves each game, so remove the original. */
    private removeOriginalBlood(): void {
        if (this.bloodRemoved || !this.services) return;
        this.bloodRemoved = true;
        const b = ORIGINAL_BLOOD;
        this.services.location.removeTemporaryLoc(WORLD, b.locId, b.tile, b.tile.level, { oldShape: b.shape, oldRotation: b.rotation });
    }

    /** The walled garden is the edge of the play area. */
    private registerHouseRules(registry: IScriptRegistry): void {
        for (const locId of BOUNDARY_GATES) {
            registry.registerLocScript({
                locId,
                action: "open",
                handler: ({ player, services }) => services.messaging.sendGameMessage(player, "The guards won't let anyone leave the grounds."),
            });
        }
    }

    /** Walk a bot toward `goal`; if it's on the other floor, go via the stair landing and take the stairs there. */
    private routeBot(bot: PlayerState, goal: Tile, tryTiles: Tile[]): boolean {
        if (bot.level !== goal.level) {
            const atLanding = Math.max(Math.abs(bot.tileX - STAIR_LANDING.x), Math.abs(bot.tileY - STAIR_LANDING.y)) <= 1;
            if (atLanding) {
                this.services?.movement.teleportPlayer(bot, STAIR_LANDING.x, STAIR_LANDING.y, goal.level);
                return true;
            }
            return this.pathOrDoor(bot, [{ x: STAIR_LANDING.x, y: STAIR_LANDING.y, level: bot.level }]);
        }
        return this.pathOrDoor(bot, tryTiles);
    }

    /**
     * Path toward one of `tiles`. Bots open any closed door they're standing at; if a closed door
     * cuts them off (the route stops short), they head for the nearest closed door instead.
     */
    private pathOrDoor(bot: PlayerState, tiles: Tile[]): boolean {
        const near = (a: { x: number; y: number }, b: { x: number; y: number }, r: number) =>
            Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= r;
        const here = { x: bot.tileX, y: bot.tileY };
        for (const d of DOORS) if (d.tile.level === bot.level && near(here, d.tile, 1)) this.openDoor(d);
        // Each pathTo is a full pathfinder search, so remember the first tile that had a route
        // (the fallback) instead of searching every tile again at the end.
        let reachable: Tile | undefined;
        for (const t of tiles) {
            if (!bot.pathTo(t.x, t.y)) continue;
            reachable ??= t;
            const q = bot.getPathQueue();
            const end = q[q.length - 1];
            if (!end || near(end, t, 1)) return true;
        }
        const closed = DOORS.filter((d) => d.tile.level === bot.level && !this.isDoorOpen(d)).sort(
            (a, b) => Math.hypot(a.tile.x - here.x, a.tile.y - here.y) - Math.hypot(b.tile.x - here.x, b.tile.y - here.y),
        );
        for (const d of closed.slice(0, 3)) if (bot.pathTo(d.tile.x, d.tile.y)) return true;
        return !!reachable && bot.pathTo(reachable.x, reachable.y);
    }

    /** A household member joins as an AI player, dressed as themselves. */
    private spawnBot(name: string, tile: Tile): string | undefined {
        const ss = this.hudServices;
        const member = HOUSEHOLD.find((b) => b.name === name);
        if (!ss || !member) return undefined;
        const look = botLook(name, member.female, ss.getIdentityKits(member.female ? 1 : 0));
        const bot = ss.addPlayerBot({ name, x: tile.x, y: tile.y, level: tile.level, ...look });
        if (!bot) return undefined;
        bot.combat.autoRetaliate = true; // like anyone left on the default, a bot fights back
        const key = `b:${bot.id}`;
        this.bots.set(key, bot);
        this.keyById.set(bot.id, key);
        return key;
    }

    private removeBot(p: Participant): void {
        const bot = this.bots.get(p.key);
        if (!bot) return;
        this.potionPrayerUntil.delete(bot);
        bot.protectionBlocksPlayers = false;
        this.hudServices?.removePlayerBot(bot);
        this.bots.delete(p.key);
        this.keyById.delete(bot.id);
    }

    /** A bot's inventory slot holding an item, if it carries one. */
    private slotOf(bot: PlayerState, itemId: number): number | undefined {
        return this.services?.inventory.findInventorySlotWithItem(bot, itemId);
    }

    /**
     * What a bot can do, through the same routes a person's clicks take (2009scape's AIPlayers
     * work the same way): walk, attack, wield, eat, drink, cast and use the special attack.
     */
    private readonly mover: BotMover = {
        approachContainer: (p, c) => {
            const bot = this.bots.get(p.key);
            if (!bot) return false;
            const tiles: Tile[] = [];
            for (let x = c.tile.x - 1; x <= c.tile.x + c.w; x++) {
                for (let y = c.tile.y - 1; y <= c.tile.y + c.h; y++) {
                    if (distToRect({ x, y, level: c.tile.level }, c) === 1) tiles.push({ x, y, level: c.tile.level });
                }
            }
            tiles.sort(() => Math.random() - 0.5);
            return this.routeBot(bot, c.tile, tiles);
        },
        approachPerson: (p, q) => {
            const bot = this.bots.get(p.key);
            const at = this.io.pos(q);
            if (!bot || !at) return false;
            const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
            return this.routeBot(bot, at, around.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy, level: at.level })));
        },
        approachTile: (p, tile) => {
            const bot = this.bots.get(p.key);
            if (!bot) return false;
            const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].sort(() => Math.random() - 0.5);
            return this.routeBot(bot, tile, around.map(([dx, dy]) => ({ x: tile.x + dx, y: tile.y + dy, level: tile.level })));
        },
        walkTo: (p, tile) => {
            const bot = this.bots.get(p.key);
            return bot ? this.routeBot(bot, tile, [tile]) : false;
        },
        isMoving: (p) => this.bots.get(p.key)?.hasPath() ?? false,
        randomTile: () => {
            const r = ROOMS[Math.floor(Math.random() * ROOMS.length)];
            return { x: r.x1 + Math.floor(Math.random() * (r.x2 - r.x1 + 1)), y: r.y1 + Math.floor(Math.random() * (r.y2 - r.y1 + 1)), level: r.level };
        },
        attack: (p, target) => {
            const bot = this.bots.get(p.key);
            const victim = this.actor(target.key);
            return !!bot && !!victim && !!this.hudServices?.attackPlayer(bot, victim);
        },
        hitpoints: (p) => {
            const a = this.actor(p.key);
            if (!a) return { now: 0, max: 1 };
            return { now: a.skillSystem.getHitpointsCurrent(), max: a.skillSystem.getSkill(SkillId.Hitpoints).baseLevel };
        },
        attackers: (p) => {
            const me = this.actor(p.key);
            const game = this.game;
            if (!me || !game) return [];
            return game.living().filter((q) => {
                const t = this.actor(q.key)?.getCombatTarget();
                return q !== p && t?.type === "player" && t.id === me.id;
            });
        },
        target: (p) => {
            const t = this.actor(p.key)?.getCombatTarget();
            const key = t?.type === "player" ? this.keyById.get(t.id) : undefined;
            return key ? this.game?.participants.get(key) : undefined;
        },
        wield: (p, itemId) => {
            const bot = this.bots.get(p.key);
            const slot = bot && this.slotOf(bot, itemId);
            if (!bot || slot === undefined) return false;
            this.hudServices?.useInventoryItem(bot, slot, "wield");
            return true;
        },
        unwield: (p) => {
            const bot = this.bots.get(p.key);
            const equip = bot && this.hudServices?.getEquipArray(bot);
            const id = equip?.[WEAPON_SLOT] ?? -1;
            if (!bot || !equip || id <= 0 || !this.services?.inventory.addItemToInventory(bot, id, 1).added) return;
            equip[WEAPON_SLOT] = -1;
            this.hudServices!.getEquipQtyArray(bot)[WEAPON_SLOT] = 0;
            this.refreshGear(bot);
        },
        weaponPower: (itemId) => {
            // Its best melee attack bonus and its strength bonus, per tick between swings.
            const b = getItemDefinition(itemId)?.bonuses;
            if (!b) return 0;
            const attack = Math.max(b[0], b[1], b[2]);
            return ((attack + 64) * (b[10] + 64)) / Math.max(1, getAttackSpeed(itemId) || 4);
        },
        use: (p, itemId, option) => {
            const bot = this.bots.get(p.key);
            const slot = bot && this.slotOf(bot, itemId);
            if (!bot || slot === undefined) return false;
            this.hudServices?.useInventoryItem(bot, slot, option);
            return true;
        },
        bind: (p, target) => {
            const bot = this.bots.get(p.key);
            const victim = this.actor(target.key);
            if (!bot || !victim) return false;
            this.hudServices?.castSpellOnPlayer(bot, victim, BIND);
            return true;
        },
        special: (p) => this.bots.get(p.key)?.specEnergy.setActivated(true),
        specialEnergy: (p) => this.bots.get(p.key)?.specEnergy.getPercent() ?? 0,
        run: (p, on) => this.bots.get(p.key)?.setRunToggle(on),
        tokens: (p) => {
            const bot = this.bots.get(p.key);
            return bot ? this.tokensOf(bot) : 0;
        },
        buy: (p, ware) => {
            const bot = this.bots.get(p.key);
            const game = bot && this.getGameForPlayer(bot);
            return !!bot && !!game && !!this.store?.botBuy(bot, WARE_ITEM[ware], game.playerCount());
        },
    };

    private readonly io: GameIO = {
        pos: (p) => {
            const a = this.actor(p.key);
            return a ? { x: a.tileX, y: a.tileY, level: a.level } : undefined;
        },
        roomAt,
        message: (p, text) => {
            const player = this.humans.get(p.key);
            if (player) this.services?.messaging.sendGameMessage(player, text);
        },
        announce: (text) => {
            for (const player of this.humans.values()) this.services?.messaging.sendGameMessage(player, ANNOUNCE(text));
        },
        say: (p, text) => {
            // Bots talk like people: public chat, overhead and in the chatbox of everyone nearby.
            const bot = this.bots.get(p.key);
            if (bot) this.hudServices?.queueChatMessage({ messageType: "public", playerId: bot.id, from: p.name, text });
        },
        giveItem: (p, itemId, quantity = 1) => {
            const player = this.actor(p.key);
            if (!player) return false;
            const inv = this.services!.inventory;
            const res = inv.addItemToInventory(player, itemId, quantity);
            inv.snapshotInventory(player);
            return res.added > 0;
        },
        takeCoins: (p, amount) => {
            const player = this.actor(p.key);
            if (!player || !(amount > 0)) return 0;
            let left = amount;
            const inv = this.services!.inventory;
            inv.getInventoryItems(player).forEach((e, slot) => {
                if (e.itemId !== COINS || left <= 0) return;
                const take = Math.min(left, e.quantity);
                left -= take;
                inv.setInventorySlot(player, slot, e.quantity > take ? COINS : -1, e.quantity - take);
            });
            inv.snapshotInventory(player);
            if (left > 0) {
                const bank = player.bank.exportBankSnapshot();
                for (const e of bank) {
                    if (e.itemId !== COINS || left <= 0) continue;
                    const take = Math.min(left, e.quantity);
                    left -= take;
                    e.quantity -= take;
                }
                player.bank.loadBankSnapshot(bank.filter((e) => e.itemId !== COINS || e.quantity > 0 || e.placeholder));
            }
            return amount - left;
        },
        // Weapons can be wielded, so items count whether carried or worn.
        removeItem: (p, itemId) => {
            const player = this.actor(p.key);
            if (!player) return false;
            const inv = this.services!.inventory;
            const slot = inv.findInventorySlotWithItem(player, itemId);
            if (slot !== undefined) {
                inv.setInventorySlot(player, slot, -1, 0);
                inv.snapshotInventory(player);
                return true;
            }
            const equip = this.hudServices?.getEquipArray(player);
            const worn = equip?.indexOf(itemId) ?? -1;
            if (!equip || worn < 0) return false;
            equip[worn] = -1;
            this.hudServices!.getEquipQtyArray(player)[worn] = 0;
            this.refreshGear(player);
            return true;
        },
        hasItem: (p, itemId) => {
            const player = this.actor(p.key);
            if (!player) return false;
            return this.services!.inventory.playerHasItem(player, itemId) || !!this.hudServices?.getEquipArray(player).includes(itemId);
        },
        listItems: (p) => {
            const player = this.actor(p.key);
            if (!player) return [];
            const carried = this.services!.inventory.getInventoryItems(player).filter((e) => e.itemId > 0 && e.quantity > 0).map((e) => e.itemId);
            const worn = (this.hudServices?.getEquipArray(player) ?? []).filter((id) => id > 0);
            return [...carried, ...worn].filter((id) => id !== COINS && id !== CHORE_TOKEN && !isCosmetic(id));
        },
        wielding: (p) => {
            const player = this.actor(p.key);
            const id = player ? this.hudServices?.getEquipArray(player)[WEAPON_SLOT] : undefined;
            return id !== undefined && id > 0 ? id : undefined;
        },
        itemName: (itemId) => String(this.services?.data.getObjType(itemId)?.name ?? `item ${itemId}`),
        spawnGround: (itemId, tile, quantity = 1) => {
            const stack = this.services?.groundItems.spawn(itemId, quantity, tile, { durationTicks: 1_000_000 });
            if (stack) this.ground.set(groundKey(itemId, tile), stack.stackId);
        },
        removeGround: (itemId, tile) => {
            const key = groundKey(itemId, tile);
            const stackId = this.ground.get(key);
            if (stackId !== undefined) this.services?.groundItems.remove(stackId, 1);
            this.ground.delete(key);
        },
        dropAll: (p, tile) => {
            const dropped: number[] = [];
            const player = this.actor(p.key);
            if (!player) return dropped;
            // Coins and cosmetics are yours for good, and chore tokens are yours for the game: they stay with you.
            const kept = (id: number) => id === COINS || id === CHORE_TOKEN || isCosmetic(id);
            const drop = (id: number, qty: number) => {
                if (!(id > 0) || kept(id)) return;
                // Free for anyone: an ordinary ground stack (the engine's own Take picks it up).
                const stack = this.services?.groundItems.spawn(id, qty, tile, { durationTicks: 1_000_000 });
                if (stack) this.dropStacks.push({ stackId: stack.stackId, qty });
                dropped.push(id);
            };
            const inv = this.services!.inventory;
            inv.getInventoryItems(player).forEach((e, slot) => {
                if (e.itemId > 0 && !kept(e.itemId)) {
                    drop(e.itemId, e.quantity);
                    inv.setInventorySlot(player, slot, -1, 0);
                }
            });
            inv.snapshotInventory(player);
            const equip = this.hudServices?.getEquipArray(player) ?? [];
            const qty = this.hudServices?.getEquipQtyArray(player) ?? [];
            equip.forEach((id, slot) => {
                if (id > 0 && !kept(id)) {
                    drop(id, qty[slot] || 1);
                    equip[slot] = -1;
                    qty[slot] = 0;
                }
            });
            this.refreshGear(player);
            return dropped;
        },
        teleport: (p, tile) => {
            const player = this.actor(p.key);
            if (player) this.services?.movement.teleportPlayer(player, tile.x, tile.y, tile.level);
        },
        setFrozen: (p, frozen) => {
            const player = this.actor(p.key);
            if (!player) return;
            if (frozen) {
                player.clearPath();
                player.holdMovementUntil((this.services?.system.getCurrentTick() ?? 0) + 100_000);
            } else {
                player.releaseMovementHold();
                player.clearForcedOrientation(); // never leave anyone locked facing one way
            }
        },
        makeGhost: (p) => {
            const player = this.humans.get(p.key);
            if (player) {
                // Unseen by the living (the visibility filter), free to walk about and watch.
                player.setHidden(false);
                this.io.setFrozen(p, false);
                // ...and to the other ghosts, they look the part: a ghost, a ghoul or a spectre.
                const look = GHOST_LOOKS[Math.floor(Math.random() * GHOST_LOOKS.length)];
                this.ghostLooks.set(p.key, look);
                this.setNpcLook(player, look);
                this.io.message(p, "You are now a ghost. Walk about and watch: the living can't see or hear you, only other ghosts can.");
            }
            if (this.bots.has(p.key)) this.removeBot(p);
        },
        restore: (p) => {
            const player = this.actor(p.key);
            if (!player || !this.services) return;
            player.setHidden(false);
            player.releaseMovementHold();
            this.ghostLooks.delete(p.key);
            if (player.appearance) player.appearance.npcId = undefined; // clearGear re-dresses them
            // Empty the pack and take off any gear: only coins and cosmetics are yours to keep between games.
            const inv = this.services.inventory;
            const items = inv.getInventoryItems(player);
            for (let slot = 0; slot < INVENTORY_SLOTS; slot++) {
                const id = items[slot]?.itemId ?? -1;
                if (id !== COINS && !isCosmetic(id)) inv.setInventorySlot(player, slot, -1, 0);
            }
            inv.snapshotInventory(player);
            this.clearGear(player);
            // Full health, prayer, special attack and run energy, and nothing still fighting them.
            player.skillSystem.setHitpointsCurrent(player.skillSystem.getSkill(SkillId.Hitpoints).baseLevel);
            player.skillSystem.setSkillBoost(SkillId.Prayer, player.skillSystem.getSkill(SkillId.Prayer).baseLevel);
            player.prayer.clearActivePrayers();
            this.potionPrayerUntil.delete(player);
            player.protectionBlocksPlayers = false;
            player.specEnergy.setPercent(100);
            player.energy.setRunEnergyUnits(RUN_ENERGY_MAX);
            player.clearInteraction();
            player.setCombatTarget(null);
        },
        rejoin: (p, at) => {
            const services = this.services;
            const game = this.game;
            if (!services || !game) return;
            // Wait for the new session to finish loading before refilling it.
            services.scheduler.after(3, () => {
                const player = this.humans.get(p.key);
                if (!player) return;
                const ghostLook = this.ghostLooks.get(p.key);
                this.io.restore(p);
                // A ghost who reconnects is still the same ghost.
                if (!p.alive && ghostLook !== undefined) {
                    this.ghostLooks.set(p.key, ghostLook);
                    this.setNpcLook(player, ghostLook);
                }
                // Left mid-game (or was already dead): back as a ghost, with nothing.
                const items = !p.alive ? [] : [
                    ...(p.carriedFlypaper ? [ITEMS.flypaper] : []),
                    // Worn gear survives the reconnect; the Murderer's claws in the pack don't.
                    ...(p.role === "murderer" && this.io.wielding(p) !== C.pvp.dragonClaws ? [C.pvp.dragonClaws] : []),
                    ...game.weaponsHeldBy(p).map((w) => w.itemId),
                    ...p.tasks.map((t) => t.def.steps[t.step]?.use).filter((id): id is number => id !== undefined),
                ];
                for (const itemId of items) services.inventory.addItemToInventory(player, itemId, 1);
                const tokens = this.tokensAway.get(p.key) ?? 0;
                this.tokensAway.delete(p.key);
                if (tokens > 0) services.inventory.addItemToInventory(player, CHORE_TOKEN, tokens);
                services.inventory.snapshotInventory(player);
                if (at) services.movement.teleportPlayer(player, at.x, at.y, at.level);
                if (!p.alive) {
                    // restore() cleared the ghost; make sure they're one again (with the same look if they had one).
                    if (ghostLook === undefined) this.io.makeGhost(p);
                    p.carriedFlypaper = false;
                    this.io.message(p, "You left during the game, so you count as dead. You are a ghost until this game ends.");
                    return;
                }
                if (game.phase !== "investigation") player.holdMovementUntil(services.system.getCurrentTick() + 100_000);
                p.carriedFlypaper = false;
                this.io.message(p, `Welcome back. You are still the ${p.role === "npc" ? "household (NPC)" : p.role}.`);
            });
        },
        animate: (p, kind, anim, elapsed = 0) => {
            const player = this.actor(p.key);
            const look = ANIMS[anim ?? KIND_ANIM[kind] ?? "reach"] ?? ANIMS.reach;
            if (elapsed > 0 && (ONE_OFF.has(kind) || elapsed % look.every !== 0)) return;
            if (player) this.services?.animation.playPlayerSeq(player, look.seq);
        },
        cutscene: (p, shot) => {
            const player = this.humans.get(p.key);
            const services = this.services;
            if (!player || !services) return;
            const cam = INTRO_CAMERAS[shot.camera] ?? INTRO_CAMERAS[0];
            // The first shot cuts in (under the fade); the camera then glides from shot to shot.
            const cut = shot.camera === 0;
            services.camera.move(player, cam.from, cam.height, cut);
            services.camera.lookAt(player, cam.at, cam.lookHeight, cut);
            if (shot.speaker === "guard") {
                services.dialog.openDialog(player, {
                    kind: "npc", id: "sinclair_intro", npcId: GUARD_NPC, npcName: "Guard",
                    lines: shot.lines.slice(0, 4), clickToContinue: true, closeOnContinue: true,
                });
            } else {
                services.dialog.openDialog(player, {
                    kind: "sprite", id: "sinclair_intro", itemId: STEW, title: "Sinclair Mansion",
                    lines: shot.lines.slice(0, 3), clickToContinue: true, closeOnContinue: true,
                });
            }
        },
        endCutscene: (p) => {
            const player = this.humans.get(p.key);
            if (!player || !this.services) return;
            this.services.dialog.closeDialog(player);
            this.services.camera.reset(player);
        },
        dialog: (p, lines) => {
            const player = this.humans.get(p.key);
            if (!player || !this.services) return;
            for (const line of lines) this.services.messaging.sendGameMessage(player, ANNOUNCE(line));
            const game = this.game;
            const icon = p.role === "detective" ? ITEMS.flypaper : p.role === "murderer" ? (game?.murderWeaponHeldBy(p)?.itemId ?? WEAPON_POOL[0].itemId) : ITEMS.bucket;
            // Wrapped as 2009scape does and paged: 3 lines a page + "Click here to continue".
            const pages = dialogPages(lines);
            const dialog = this.services.dialog;
            const show = (i: number): void => {
                const last = i >= pages.length - 1;
                dialog.openDialog(player, {
                    kind: "sprite", id: "sinclair_role", itemId: icon, title: "Murder at Sinclair Mansion",
                    lines: pages[i], clickToContinue: true, closeOnContinue: last,
                    onContinue: last ? undefined : () => show(i + 1),
                });
            };
            show(0);
        },
        choose: (p, title, options, onPick) => {
            const player = this.humans.get(p.key);
            if (!player || !this.services) return;
            this.services.dialog.openDialogOptions(player, { id: "sinclair_choice", title, options, onSelect: onPick });
        },
        closeDialog: (p) => {
            const player = this.humans.get(p.key);
            if (player) this.services?.dialog.closeDialog(player);
        },
        // The quest-style fade is drawn by the client overlay from the phase in the HUD data
        // (OSRS's own fade, interface 174 + script 948, relies on CS2 timers the engine doesn't run).
        // Here we only close any open dialog so the fade isn't hidden behind it.
        fadeOut: (p) => {
            const player = this.humans.get(p.key);
            if (player) this.services?.dialog.closeDialog(player);
        },
        fadeIn: () => {},
        setCrimeScene: (tile, present) => {
            const loc = this.services?.location;
            if (!loc) return undefined;
            const b = ORIGINAL_BLOOD;
            if (present) loc.replaceTemporaryLoc(WORLD, 0, b.locId, tile, tile.level, { oldShape: b.shape, newShape: b.shape, newRotation: b.rotation });
            else loc.clearTemporaryLoc(WORLD, 0, tile, tile.level, b.shape);
            // Lord Sinclair lies in his blood.
            if (this.body) this.services?.npc.removeNpc(this.body.id);
            this.body = undefined;
            if (present) {
                const body = this.services?.npc.spawnNpc({ id: BODY_NPC, x: tile.x, y: tile.y, level: tile.level, wanderRadius: 0 });
                if (body) {
                    body.scriptControlled = true; // never gets up and wanders off
                    this.body = body;
                }
            }
            return this.body?.id;
        },
        markKill: (tile) => {
            const loc = this.services?.location;
            if (!loc) return undefined;
            const b = ORIGINAL_BLOOD;
            loc.replaceTemporaryLoc(WORLD, 0, b.locId, tile, tile.level, { oldShape: b.shape, newShape: b.shape, newRotation: Math.floor(Math.random() * 4) });
            this.killMarks.push({ ...tile });
            // The victim's body lies in the blood (the same Corpse NPC as Lord Sinclair's).
            const body = this.services?.npc.spawnNpc({ id: BODY_NPC, x: tile.x, y: tile.y, level: tile.level, wanderRadius: 0 });
            if (!body) return undefined;
            body.scriptControlled = true;
            this.victimBodies.push(body);
            return body.id;
        },
        clearDrops: () => {
            // Whatever the dead left lying around last game (taken stacks are already gone).
            for (const d of this.dropStacks.splice(0)) this.services?.groundItems.remove(d.stackId, d.qty);
        },
        clearGroundItems: () => {
            // Remove all ground items the game placed (weapons, Detective's kit, chore items).
            for (const stackId of this.ground.values()) this.services?.groundItems.remove(stackId, 1);
            this.ground.clear();
            // Also remove the drop stacks (items the dead dropped during the game).
            for (const d of this.dropStacks.splice(0)) this.services?.groundItems.remove(d.stackId, d.qty);
        },
        clearKillMarks: () => {
            const loc = this.services?.location;
            for (const t of this.killMarks.splice(0)) loc?.clearTemporaryLoc(WORLD, 0, t, t.level, ORIGINAL_BLOOD.shape);
            for (const body of this.victimBodies.splice(0)) this.services?.npc.removeNpc(body.id);
        },
        face: (p, tile) => {
            // A one-off turn (the location service's faceTile forces the facing until cleared,
            // which left players walking around stuck facing the dinner table).
            this.actor(p.key)?.faceTile(tile.x, tile.y);
        },
        setupCombat: (p, stats, wear, carry) => {
            const player = this.actor(p.key);
            if (!player || !this.hudServices) return;
            const levels: Array<[SkillId, number]> = [
                [SkillId.Attack, stats.attack], [SkillId.Strength, stats.strength], [SkillId.Defence, stats.defence],
                [SkillId.Hitpoints, stats.hitpoints], [SkillId.Prayer, C.pvp.prayer], [SkillId.Ranged, 1], [SkillId.Magic, stats.magic],
            ];
            for (const [id, level] of levels) {
                player.skillSystem.setSkillXp(id, getXpForLevel(level));
                player.skillSystem.setSkillBoost(id, level);
            }
            player.skillSystem.setHitpointsCurrent(stats.hitpoints);
            // A fresh start: no prayers on, full special attack and run energy.
            player.prayer.clearActivePrayers();
            player.specEnergy.setPercent(100);
            player.energy.setRunEnergyUnits(RUN_ENERGY_MAX);
            this.clearGear(player, GEAR_SLOTS.filter((_, i) => wear[i] > 0));
            const equip = this.hudServices.getEquipArray(player);
            const qty = this.hudServices.getEquipQtyArray(player);
            wear.forEach((id, i) => {
                if (id > 0) {
                    equip[GEAR_SLOTS[i]] = id;
                    qty[GEAR_SLOTS[i]] = 1;
                }
            });
            this.refreshGear(player);
            for (const id of carry) this.services?.inventory.addItemToInventory(player, id, 1);
            this.services?.inventory.snapshotInventory(player);
        },
        restoreRun: (p) => {
            this.actor(p.key)?.energy.setRunEnergyUnits(RUN_ENERGY_MAX);
        },
        chime: () => {
            // Three strikes. The peal has no loop section in the cache, so loops would only play it once.
            for (const player of this.humans.values()) {
                for (let i = 0; i < 3; i++) this.services?.sound.sendSound(player, CHIME_SOUND, { delayMs: i * 1700 });
            }
        },
        heal: (p) => {
            const player = this.actor(p.key);
            if (!player) return;
            player.skillSystem.setHitpointsCurrent(player.skillSystem.getSkill(SkillId.Hitpoints).baseLevel);
            player.skillSystem.setSkillBoost(SkillId.Prayer, player.skillSystem.getSkill(SkillId.Prayer).baseLevel);
        },
        stopCombat: (p) => {
            const player = this.actor(p.key);
            if (!player) return;
            player.clearInteraction();
            player.setCombatTarget(null);
        },
        takeKit: (p) => {
            const game = this.game;
            const player = this.actor(p.key);
            if (!game || !player) return [];
            // The Detective's own gear and flypaper; tokens, what they buy and other finds are anyone's
            // (and a Murderer who held the flypaper drops their claws as an ordinary drop).
            const rewards = new Set<number>([CHORE_TOKEN, C.rewards.shark, C.rewards.prayerPotion, C.rewards.staminaPotion, C.pvp.dragonClaws, ...C.rewards.runes.map(([id]) => id)]);
            const isKit = (id: number) => id > 0 && id !== COINS && !isCosmetic(id) && !game.toolIds.has(id) && !game.weaponOf(id) && !rewards.has(id);
            const taken: number[] = [];
            const inv = this.services!.inventory;
            inv.getInventoryItems(player).forEach((e, slot) => {
                if (isKit(e.itemId)) {
                    taken.push(e.itemId);
                    inv.setInventorySlot(player, slot, -1, 0);
                }
            });
            inv.snapshotInventory(player);
            const equip = this.hudServices?.getEquipArray(player) ?? [];
            const qty = this.hudServices?.getEquipQtyArray(player) ?? [];
            equip.forEach((id, slot) => {
                if (isKit(id)) {
                    taken.push(id);
                    equip[slot] = -1;
                    qty[slot] = 0;
                }
            });
            this.refreshGear(player);
            return taken;
        },
        giveKit: (p, items) => {
            const player = this.actor(p.key);
            if (!player) return;
            for (const id of items) this.services?.inventory.addItemToInventory(player, id, 1);
            this.services?.inventory.snapshotInventory(player);
            // A bot taking over the case puts the gear on, as a person would.
            if (this.bots.has(p.key)) for (const id of items) if (id !== ITEMS.flypaper) this.mover.wield(p, id);
        },
        questScroll: (p, scroll) => {
            const player = this.humans.get(p.key);
            const services = this.services;
            if (!player || !services) return;
            const q = QUEST_SCROLL;
            services.dialog.closeDialog(player);
            services.dialog.openSubInterface(player, services.viewport.getMainmodalUid(player.displayMode ?? 1), q.group, 0);
            const uid = (child: number) => (q.group << 16) | child;
            services.dialog.queueWidgetEvent(player.id, { action: "set_flags_range", uid: uid(q.close), fromSlot: -1, toSlot: -1, flags: 1 << 1 });
            const text = (child: number, value: string) => services.dialog.queueWidgetEvent(player.id, { action: "set_text", uid: uid(child), text: value });
            text(q.title, scroll.title);
            text(q.subtitle, scroll.subtitle);
            if (scroll.itemId !== undefined) {
                services.dialog.queueWidgetEvent(player.id, { action: "set_item", uid: uid(q.item), itemId: scroll.itemId, quantity: 1 });
            }
            for (let i = 0; i < q.lines; i++) text(q.firstLine + i, scroll.lines[i] ?? "");
            const coins = services.inventory.getInventoryItems(player).find((e) => e.itemId === COINS)?.quantity ?? 0;
            text(q.footer, `Total coins: ${coins.toLocaleString()}`);
            services.sound.sendJingle(player, q.jingle);
        },
    };

    /**
     * Take off everything worn (between games, and before a game's own kit goes on). Cosmetics
     * stay on, unless the kit needs their slot (`kitSlots`): then they go to the pack, or the
     * bank when the pack is full.
     */
    private clearGear(player: PlayerState, kitSlots: readonly number[] = []): void {
        const ss = this.hudServices;
        if (!ss) return;
        const equip = ss.getEquipArray(player);
        const qty = ss.getEquipQtyArray(player);
        for (let i = 0; i < Math.min(EQUIP_SLOTS, equip.length); i++) {
            const id = equip[i];
            if (isCosmetic(id)) {
                if (!kitSlots.includes(i)) continue;
                const packed = (this.services?.inventory.addItemToInventory(player, id, 1).added ?? 0) > 0;
                if (!packed) bankItem(player, id, 1);
            }
            equip[i] = -1;
            qty[i] = 0;
        }
        this.refreshGear(player);
    }

    /**
     * Wielding the dragon claws turns their special attack on, ready for the first swing (the
     * special attack bar lit, as clicking it would; 2009scape's toggle is varp 301 too).
     */
    private armClawsSpecial(player: PlayerState): void {
        if (player.specEnergy.getUnits() < CLAWS_SPEC_COST) return;
        player.specEnergy.setActivated(true);
        player.varps.setVarpValue(VARP_SPECIAL_ATTACK, 1);
        this.services?.variables.queueVarp(player.id, VARP_SPECIAL_ATTACK, 1);
    }

    /** Show a player as an NPC (OSRS's transform): its model and its stand and walk animations. */
    private setNpcLook(player: PlayerState, npcId: number | undefined): void {
        if (!player.appearance) return;
        player.appearance.npcId = npcId;
        this.refreshGear(player);
    }

    /** Re-dress a player after changing their worn items directly. */
    private refreshGear(player: PlayerState): void {
        const ss = this.hudServices;
        if (!ss) return;
        ss.refreshAppearance(player);
        ss.refreshCombatWeapon(player);
        ss.sendAppearanceUpdate(player.id);
        ss.sendInventorySnapshot(player.id);
        ss.queueCombatSnapshot(
            player.id, player.combat.weaponCategory, player.combat.weaponItemId, !!player.combat.autoRetaliate,
            player.combat.styleSlot, Array.from(player.prayer.activePrayers ?? []),
        );
    }

    /** The walled garden works as in OSRS: Pick the cabbages, wheat and potatoes; they grow back. */
    private registerGarden(registry: IScriptRegistry, game: MurderGame): void {
        const picked = new Set<string>();
        for (const [locIdText, itemId] of Object.entries(CROPS)) {
            const locId = Number(locIdText);
            registry.registerLocScript({
                locId,
                action: "pick",
                handler: ({ player, tile, level, services }) => {
                    const p = this.participant(player);
                    const key = `${tile.x},${tile.y},${level}`;
                    if (picked.has(key)) return;
                    // One of each chore item: holding a potato, you leave the rest in the ground.
                    if (p && game.holdsTool(p, itemId)) {
                        return services.messaging.sendGameMessage(player, `You already have a ${this.io.itemName(itemId).toLowerCase()}. You can only carry one of each.`);
                    }
                    // Picking a potato is the first step of the potato chore.
                    if (p && itemId === ITEMS.potato && game.choreAt(p, "veg_patch")) game.useContainer(p, "veg_patch");
                    else if (services.inventory.addItemToInventory(player, itemId, 1).added > 0) {
                        services.inventory.snapshotInventory(player);
                        services.messaging.sendGameMessage(player, `You pick ${itemId === 1947 ? "some grain" : `a ${this.io.itemName(itemId).toLowerCase()}`}.`);
                    } else {
                        services.messaging.sendGameMessage(player, "You don't have room to carry any more.");
                        return;
                    }
                    services.animation.playPlayerSeq(player, PICK_SEQ);
                    const placed = getSharedLocTileLookup()?.getLocAt(level, tile.x, tile.y, locId);
                    picked.add(key);
                    services.location.removeTemporaryLoc(WORLD, locId, tile, level, { oldShape: placed?.type ?? 10, oldRotation: placed?.rotation ?? 0 });
                    services.scheduler.after(secToTicks(CROP_REGROW_SEC), () => {
                        services.location.clearTemporaryLoc(WORLD, locId, tile, level, placed?.type ?? 10);
                        picked.delete(key);
                    });
                },
            });
        }
    }

    // ------------------------------------------------------------ overlay data
    override initialize(context: GamemodeInitContext): void {
        // Vanilla drops static ground items around the world, including the Murder Mystery
        // quest's "Criminal's dagger" and "Pungent pot" in this very mansion. Skip them all.
        super.initialize({
            ...context,
            serverServices: { ...context.serverServices, registerStaticGroundItem: () => {} },
        });
        this.hudServices = context.serverServices;
        this.store = new SinclairStore(context.serverServices, (player) => this.whyNotBrowse(player));
        context.serverServices.eventBus.on("equipment:equip", ({ player, itemId }) => {
            if (itemId === C.pvp.dragonClaws) this.armClawsSpecial(player);
        });
        if (process.env.SINCLAIR_DISCOVERY !== "0") {
            // The LAN beacon advertises this server's open room.
            this.discovery = new Discovery(config.port, () => this.rooms?.list()[0]);
            this.discovery.start((msg) => context.serverServices?.logger.info(msg) ?? {});
        }
        // Friends over the internet come in through PeerJS (the host's browser), so opening the
        // router port is only for direct connections: SINCLAIR_UPNP=1 turns it on.
        if (process.env.SINCLAIR_UPNP === "1") this.portMapper =new PortMapper(config.port, (msg) => context.serverServices?.logger.info(msg) ?? {});

        // Tell the matchmaking registry (this server's own, or SINCLAIR_MATCHMAKING_URL's) what
        // this server is hosting, every 10 s and once straight away.
        this.matchmakingHeartbeat();
        this.matchmakingHeartbeatTimer = setInterval(() => this.matchmakingHeartbeat(), 10_000);
        this.matchmakingHeartbeatTimer.unref?.();
    }

    /** The store's and bank's services for the OSRS interfaces' buttons (store.ts). */
    contributeScriptServices(services: ScriptServices): void {
        this.store?.contributeScriptServices(services);
    }

    /** host:port other machines use to reach this server (the registry and room-code redirects). */
    private publicAddress(): string {
        return publicAddress(config.port);
    }

    private matchmakingHeartbeat(): void {
        const address = this.publicAddress();
        void getMatchmakingRegistry().heartbeat({ id: address, address, name: config.serverName, lobbies: this.rooms?.list() ?? [] });
    }

    /** Called after WSServer is constructed; registers the HUD snapshot encoder. */
    registerOverlayEncoder(registerSnapshotEncoder: GamemodeServerServices["registerSnapshotEncoder"]): void {
        registerSnapshotEncoder(HUD_SNAPSHOT, (_playerId, payload) => {
            try {
                return { message: encodeHudPacket(payload as MurderHud), context: HUD_SNAPSHOT };
            } catch (err) {
                // One oversized HUD is skipped (the next one replaces it); it mustn't stop the broadcast.
                this.hudServices?.logger.warn(`[sinclair] HUD not sent: ${(err as Error).message}`);
                return undefined;
            }
        });
    }

    /** Sent to each client at login: the renamed chore token (butler.ts). */
    getContentDataPacket(): Uint8Array {
        return contentPacket();
    }

    /** The /status reply's game info, for server browsers that saved this address. */
    getStatusInfo(): Record<string, unknown> {
        return { game: "sinclair-mansion", lobby: this.rooms?.list()[0] ?? null };
    }

    /** Where the room with this code is (host:port): here, in the matchmaking registry, or on the LAN. */
    resolveRoomCode(code: string): string | undefined {
        const wanted = normalizeRoomCode(code);
        if (!wanted) return undefined;
        if (this.rooms?.find(wanted)) return this.publicAddress();
        return getMatchmakingRegistry().resolveRoomCode(wanted) ?? this.discovery?.list().find((e) => e.roomCode === wanted)?.address;
    }

    /**
     * The settings' "Player 'Attack' options", as in OSRS. Everyone starts on "Always right-click"
     * (getLoginVarps), so a click aimed at someone never starts a fight by accident. While you're
     * the Murderer it's "Left-click where available": your choice from before goes back once
     * you're not the Murderer any more, unless you changed it yourself in the meantime.
     */
    private readonly attackOptionBefore = new Map<string, number>();
    private syncAttackOption(key: string, player: PlayerState): void {
        const game = this.rooms?.roomOf(key);
        const p = game?.participants.get(key);
        const running = !!game && game.phase !== "lobby" && game.phase !== "gameover";
        const murderer = running && !!p?.alive && p.role === "murderer";
        const now = player.varps.getVarpValue(VARP_PLAYER_ATTACK_OPTION);
        const set = (value: number) => {
            player.varps.setVarpValue(VARP_PLAYER_ATTACK_OPTION, value);
            this.services?.variables.sendVarp?.(player, VARP_PLAYER_ATTACK_OPTION, value);
        };
        if (murderer) {
            if (!this.attackOptionBefore.has(key)) {
                this.attackOptionBefore.set(key, now);
                if (now !== ATTACK_LEFT_CLICK) set(ATTACK_LEFT_CLICK);
            } else if (now !== ATTACK_LEFT_CLICK) {
                this.attackOptionBefore.set(key, now); // they picked their own: it stays
            }
            return;
        }
        const before = this.attackOptionBefore.get(key);
        if (before === undefined) return;
        this.attackOptionBefore.delete(key);
        if (now === ATTACK_LEFT_CLICK && before !== now) set(before);
    }

    /** Sends each human their overlay data when it changes, plus a timer refresh every few seconds. */
    private pushHuds(): void {
        const rooms = this.rooms;
        const ss = this.hudServices;
        if (!ss || !rooms) return;
        const refresh = rooms.all().some((g) => g.tick % HUD_REFRESH_TICKS === 0);
        const now = Date.now();
        for (const [key, player] of this.humans) {
            const game = rooms.roomOf(key);
            const p = game?.participants.get(key);
            // At the lobby window, this server's open room is the browser's first row (hud.lobby).
            const hud = game && p ? game.hudFor(p) : (rooms.rooms()[0] ?? rooms.all()[0]).visitorHud(key);
            if (!p && this.browsing.has(key)) hud.servers = this.discovery?.list() ?? [];
            const notice = this.notices.get(key);
            if (notice && notice.until < now) this.notices.delete(key);
            else if (notice) hud.notice = { id: notice.id, error: notice.error, redirect: notice.redirect, tryPeer: notice.tryPeer };
            hud.browsing = this.store?.openScreen(player);
            // Progression lives in the browser: ask for it once, then send every change back to save.
            const name = key.slice(2);
            if (!this.progressSynced.has(key)) hud.progressWanted = name;
            else hud.progress = exportProgress(name, player, this.progressIO);
            const { secondsLeft: _timer, ...rest } = hud;
            const sig = JSON.stringify(rest);
            if (!refresh && this.hudSigs.get(key) === sig) continue;
            this.hudSigs.set(key, sig);
            ss.queueGamemodeSnapshot(HUD_SNAPSHOT, player.id, hud);
        }
    }

    /** Clean up resources (matchmaking heartbeat timer, LAN discovery, UPnP). */
    dispose(): void {
        if (this.matchmakingHeartbeatTimer) {
            clearInterval(this.matchmakingHeartbeatTimer);
            this.matchmakingHeartbeatTimer = null;
        }
        this.discovery?.stop();
        this.portMapper?.close();
    }
}

export function createGamemode(): GamemodeDefinition {
    return new SinclairMansionGamemode();
}
