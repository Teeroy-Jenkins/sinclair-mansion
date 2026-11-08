// Bot brains for the Sinclair family and servants. Bots act only through the same MurderGame
// commands humans trigger (useContainer, stash, give, plant, lift, report, vote) and the same
// clicks (walk, attack, wield, eat). What they say comes from what they actually did, saw and
// heard this round, so table talk is evidence, not noise; each bot says it in its own voice
// (botChat.ts).
//
// Who does what:
//  - The household does its chores, searches, reports what it finds, arms itself when it feels
//    in danger, defends others if it's brave enough and runs for the clock if it isn't.
//  - The Murderer picks a way to win at the start of the game. An ESCAPER hides the weapon early
//    (or, now and then, plants it on someone lost in a chore's black screen), does its chores and
//    works at a way out every round, blending in. A KILLER blends in too, but stalks people who are
//    alone and ambushes them with the dragon claws special; it sometimes keeps the murder weapon to
//    finish the job. A killer who gets nowhere starts working on the way out instead.
//  - The Detective watches everything in sight, studies the body, follows fingerprints, frisks the
//    likeliest suspect, patrols where people are, and steps in when someone is attacked.
//  - At the table, everyone votes within 4-16 seconds on what they know: no arrest, unless
//    something it saw, names accused in chat or the real players voting together point at someone.
//    After that it rarely changes its mind, and only for new evidence (the Detective naming
//    someone) or the real players voting together. Bots never follow each other's votes, and a
//    bot saying how it voted isn't an accusation. The Murderer frames someone.

import { DEMON_BUTLER, WARE_ITEM, warePrice, type Ware } from "./butler";
import { LINES, makePersona, pick, theRoom as roomName, listJoin, voice, type Persona } from "./botChat";
import { MURDER_CONFIG as C, secToTicks } from "./config";
import {
    type Container, type MurderGame, type Observation, type Participant, type Tile,
} from "./MurderGame";

/**
 * What a bot can do with its body. Bots are AI players (like 2009scape's AIPlayer): every one of
 * these goes through the same route a person's click takes, so they play by the same rules.
 */
export interface BotMover {
    approachContainer(p: Participant, c: Container): boolean;
    approachPerson(p: Participant, q: Participant): boolean;
    approachTile(p: Participant, tile: Tile): boolean;
    walkTo(p: Participant, tile: Tile): boolean;
    isMoving(p: Participant): boolean;
    randomTile(): Tile;
    /** Attack someone, person or bot, as clicking Attack on them would. */
    attack(p: Participant, target: Participant): boolean;
    hitpoints(p: Participant): { now: number; max: number };
    /** The living who have just swung at this bot (a hit or a miss, not only a click on Attack). */
    attackers(p: Participant): Participant[];
    /** Whom this participant has just swung at (a blow or a miss that reached them), if anyone. */
    struck(p: Participant): Participant | undefined;
    /** Who this participant (bot or person) is attacking, if anyone. */
    target(p: Participant): Participant | undefined;
    /** Wield a carried weapon (the inventory's Wield). */
    wield(p: Participant, itemId: number): boolean;
    /** Put the wielded weapon back in the pack. */
    unwield(p: Participant): void;
    /** How hard a weapon hits over time (its bonuses over its attack speed): higher is stronger. */
    weaponPower(itemId: number): number;
    /** An inventory option on a carried item: Eat, Drink... */
    use(p: Participant, itemId: number, option: string): boolean;
    /** Cast Bind on someone (needs the runes). */
    bind(p: Participant, target: Participant): boolean;
    /** Turn the special attack on for the next swing. */
    special(p: Participant): void;
    specialEnergy(p: Participant): number;
    run(p: Participant, on: boolean): void;
    /** Chore tokens carried. */
    tokens(p: Participant): number;
    /** Buy one of a ware from the Demon butler (standing by him), as his shop's Buy would. */
    buy(p: Participant, ware: Ware): boolean;
}

type Goal =
    | { kind: "container"; id: string; then: "use" | "stash" | "lift" | "chore"; item?: number }
    | { kind: "person"; key: string; then: "give" | "plant" | "pickpocket" | "lift" | "frisk" | "stalk" }
    | { kind: "scene"; body: number } // a body: report it, or (the Detective) study it
    | { kind: "kit" } // the dead Detective's things (whoever takes the flypaper is the Detective)
    | { kind: "clock" } // strike it to call everyone to the table
    | { kind: "butler"; ware: Ware } // spend chore tokens with the Demon butler
    | { kind: "pickup"; itemId: number; tile: Tile } // a chore tool lying on the floor
    | { kind: "weapon"; id: number } // a weapon from the pool lying on the floor
    | { kind: "escape"; id: string }; // the Murderer working at a way out

interface BotState {
    persona: Persona;
    goal?: Goal;
    goalSince: number;
    idleUntil: number;
    lifted: Set<string>;
    handTo?: string;
    weaponAt: number;
    dumpAt: number;
    lastPhase?: string;
    /** Set by the game: the tick someone handed this bot something / planted something on it. */
    received?: number;
    plantedAt?: number;
    /** Set by the game: the tick something planted on it was pickpocketed back out of its pack. */
    pickedAt?: number;
    /** Set by the game: it caught someone with a hand in its pocket. */
    caughtPicking?: { name: string; tick: number };
    // ---- memory for this round
    memRound?: number;
    rooms: string[];
    did: string[];
    seen: Observation[];
    sawClaws?: string;
    sawAttack?: { attacker: string; victim: string };
    sawEscape?: { who: string; what: string };
    sawWield: Map<string, string>;
    /** Someone it saw (or felt) picking a pocket. */
    sawPick?: { actor: string; target: string };
    /** A weapon turned up in its pack that it never picked up (someone's framing it). */
    plantedWith?: string;
    // ---- talking
    lastSaid: number;
    lastReply: number;
    outbox: Array<{ text: string; meant?: string; echo?: boolean; at: number; then?: () => void }>;
    tableLines: string[];
    nextLineAt: number;
    nextBanterAt: number;
    repliedTo: Map<string, number>;
    // ---- reacting
    clawsCalmAt: number;
    clawsReactAt?: number;
    fightReactAt?: number;
    handsFreeAt: number;
    /** A Wield it asked for lands on the next game tick: don't ask again before this tick. */
    wieldAt?: number;
    fleeing?: boolean;
    /** Feels in danger until this tick (someone died, claws, a fight): arms itself. */
    dangerUntil: number;
    calmSince: number;
    livingSeen: number;
    knownWeapons: Set<number>;
    pickedWeaponAt: number;
    wasFading: boolean;
    fightNear?: { attacker: string; victim: string; tick: number };
    defendedAt: number;
    // ---- the Murderer
    plan?: "escape" | "kill";
    keepWeapon?: boolean;
    plantIntent?: boolean;
    plantedOn?: string;
    strikeAt?: string;
    lastVictim?: string;
    killCount: number;
    killCalmUntil: number;
    nextStalkAt: number;
    stalk?: string;
    frameTarget?: string;
    pleaded?: boolean;
    // ---- the Detective
    friskedAt: number;
    eyed?: number;
    // ---- the table
    voteAt: number;
    voted: boolean;
    myVote?: string | null;
    voteChanges: number;
    nextEvalAt: number;
    prevLiving?: string[];
}

const rand = (n: number) => Math.floor(Math.random() * n);
const chance = (p: number) => Math.random() < p;
const cheb = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** A bot playing the Detective: it holds the flypaper and isn't the Murderer (who keeps to its own game). */
const sleuth = (game: MurderGame, p: Participant) => p.role !== "murderer" && game.isDetective(p);

/** The living in sight: same floor and zone (the engine's visibility zones). */
function inView(game: MurderGame, p: Participant): Participant[] {
    const at = game.io.pos(p);
    if (!at) return [];
    const zone = game.layout.zoneAt(at);
    return game.living().filter((q) => {
        if (q === p) return false;
        const qa = game.io.pos(q);
        return !!qa && qa.level === at.level && game.layout.zoneAt(qa) === zone;
    });
}

/** Anyone (human or bot) alone with the Murderer: same zone, and nobody else alive in it. */
function loneVictim(game: MurderGame, m: Participant): Participant | undefined {
    const here = inView(game, m);
    return here.length === 1 ? here[0] : undefined;
}

/**
 * Bots play like people at a keyboard: they notice things a moment late and type at a
 * human pace, so a line appears after the time it would take to type it.
 */
export const HUMAN = {
    /** Seconds to notice something and react (urgent: a shout; calm: a remark). */
    reactSec: { urgent: [0.5, 1.2], calm: [1.5, 4] } as Record<"urgent" | "calm", [number, number]>,
    /** Typing speed, characters a second (about 45-70 words a minute). */
    typeCps: [4, 6] as [number, number],
};
const between = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);
/** How long a person takes to start typing a line and send it. */
export function typingSec(text: string, urgent: boolean): number {
    return between(HUMAN.reactSec[urgent ? "urgent" : "calm"]) + text.length / between(HUMAN.typeCps);
}

// ---------------------------------------------------------------- what's been said
/** One line of public chat, read for names: who's being accused, who's being vouched for. */
interface ChatLine {
    tick: number;
    round: number;
    phase: string;
    speaker: string;
    speakerKey: string;
    fromDetective: boolean;
    fromBot: boolean;
    /** A bot saying how it voted: the others don't count it as one more accusation. */
    echo: boolean;
    accuse: Set<string>;
    defend: Set<string>;
    mentions: string[];
    question: boolean;
    skip: boolean;
}
const chats = new WeakMap<MurderGame, ChatLine[]>();
const ACCUSE = /\b(sus|suss|sussy|did it|murderer|killer|killed|kill|vote|voting|voted|arrest|guilty|it'?s|caught|saw|liar|lying|lied|claws|sketchy|weird|shifty|stab\w*|suspicious|fram\w+|prints|attack\w*|creeping|going for|jumped|slipp\w+|messing|explain|check)\b/i;
const SKIP = /\b(skip\w*|no arrest|no one|noone|nobody)\b/i;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseChat(game: MurderGame, speaker: Participant, text: string, echo = false): ChatLine {
    const mentions: string[] = [];
    const accuse = new Set<string>();
    const defend = new Set<string>();
    const words = text.trim().split(/\s+/).length;
    for (const q of game.participants.values()) {
        if (q === speaker) continue;
        const n = esc(q.name);
        if (!new RegExp(`\\b${n}\\b`, "i").test(text)) continue;
        mentions.push(q.name);
        const vouched = new RegExp(`\\b(not|innocent|clear(ed)?|trust|vouch(ing)? for|safe|with)\\s+${n}\\b|\\b${n}\\s*(is|was|'s|'?s been)\\s+(innocent|clear|safe|fine|with me|ok)`, "i").test(text);
        if (vouched) defend.add(q.name);
        else if (ACCUSE.test(text) || words <= 2) accuse.add(q.name);
    }
    return {
        tick: game.tick, round: game.round, phase: game.phase, speaker: speaker.name, speakerKey: speaker.key,
        fromDetective: game.isDetective(speaker), fromBot: speaker.isBot, echo, accuse, defend, mentions,
        question: /\?/.test(text) && /\b(where|what|why|who|how)\b/i.test(text),
        skip: SKIP.test(text) && !mentions.length,
    };
}

function state(p: Participant): BotState {
    if (!p.bot) p.bot = {};
    const b = p.bot as unknown as BotState;
    b.persona ??= makePersona();
    b.lifted ??= new Set();
    b.goalSince ??= 0;
    b.idleUntil ??= 0;
    b.weaponAt ??= 0;
    b.dumpAt ??= 0;
    b.rooms ??= [];
    b.did ??= [];
    b.seen ??= [];
    b.sawWield ??= new Map();
    b.lastSaid ??= -1000;
    b.lastReply ??= -1000;
    b.tableLines ??= [];
    b.nextLineAt ??= 0;
    b.nextBanterAt ??= 0;
    b.repliedTo ??= new Map();
    b.clawsCalmAt ??= 0;
    b.outbox ??= [];
    b.handsFreeAt ??= 0;
    b.dangerUntil ??= 0;
    b.calmSince ??= 0;
    b.livingSeen ??= 0;
    b.knownWeapons ??= new Set();
    b.pickedWeaponAt ??= -1000;
    b.wasFading ??= false;
    b.defendedAt ??= -1000;
    b.killCount ??= 0;
    b.killCalmUntil ??= 0;
    b.nextStalkAt ??= 0;
    b.friskedAt ??= -1000;
    b.voteAt ??= 0;
    b.voted ??= false;
    b.voteChanges ??= 0;
    b.nextEvalAt ??= 0;
    return b;
}

const BIND_RUNES = C.rewards.runes;
const CLAWS_SPEC = C.pvp.clawsSpecCost;
const hasBindRunes = (game: MurderGame, p: Participant) => BIND_RUNES.every(([id]) => game.io.hasItem(p, id));

/** Bots remember one round at a time. */
function memory(game: MurderGame, b: BotState): BotState {
    if (b.memRound !== game.round) {
        b.memRound = game.round;
        b.rooms = [];
        b.did = [];
        b.seen = [];
        b.sawClaws = undefined;
        b.sawAttack = undefined;
        b.sawEscape = undefined;
        b.sawWield = new Map();
        b.sawPick = undefined;
        b.plantedWith = undefined;
        b.eyed = undefined;
        b.pleaded = false;
    }
    return b;
}

/** Someone in the bot's zone with dragon claws in hand: only the Murderer starts with those. */
function clawsWielder(game: MurderGame, p: Participant): Participant | undefined {
    return inView(game, p).find((q) => game.io.wielding(q) === C.pvp.dragonClaws);
}

export function createBotBrain(mover: BotMover) {
    function think(game: MurderGame, p: Participant): void {
        const b = memory(game, state(p));
        if (!p.alive) {
            b.outbox = [];
            return;
        }
        sendTyped(game, p, b);
        if (b.lastPhase !== game.phase) onPhase(game, p, b);
        if (game.phase === "arrest") return arrestThink(game, p, b);
        if (game.phase !== "investigation") return;
        // In a chore's long moment a bot sees no more than a person would: nothing.
        if (game.fading(p)) {
            b.wasFading = true;
            return;
        }
        b.wasFading = false;
        const at = game.io.pos(p);
        if (at) {
            const room = game.io.roomAt(at);
            if (b.rooms[b.rooms.length - 1] !== room) b.rooms.push(room);
        }
        if (game.tick % 2 === 0) look(game, p, b);
        if (!p.heldBy && combatThink(game, p, b)) return;
        if (!p.heldBy && defendThink(game, p, b)) return;
        if (!p.heldBy && game.tick >= b.clawsCalmAt && game.tick % 2 === 0 && clawsThink(game, p, b)) return;
        if (p.action || p.heldBy) return;

        // The dead Detective's things lying in sight: anyone may take them, and the flypaper makes
        // its taker the Detective. The Murderer only does it with nobody watching.
        if (game.detectiveKit && b.goal?.kind !== "kit" && game.kitInView(p) && !game.isDetective(p)
            && (p.role !== "murderer" || !game.witnesses(p).some((q) => q.alive))) return go(game, p, b, { kind: "kit" });
        if (b.goal?.kind !== "scene") {
            const found = game.bodyInView(p);
            if (found && !(p.role === "murderer" && found.killer === p.key)) return go(game, p, b, { kind: "scene", body: found.id });
        }
        if (p.role === "murderer" && murdererReflex(game, p, b)) return;
        if (game.tick % 3 === 0) armThink(game, p, b);

        if (b.goal) {
            if (arrived(game, p, b.goal)) return perform(game, p, b);
            if (!mover.isMoving(p)) {
                // Re-path, or give up after ~15 s.
                if (game.tick - b.goalSince > secToTicks(15) || !repath(game, p, b.goal)) {
                    if (b.goal.kind === "person" && b.goal.then === "stalk") b.stalk = undefined;
                    b.goal = undefined;
                }
            }
            return;
        }
        if (game.tick < b.idleUntil) return;
        banter(game, p, b);
        if (pickUpWeaponThink(game, p, b)) return;

        // Whoever holds the flypaper investigates. The first Detective has no chores; someone of the
        // household who picked it up splits their time between the case and their chores.
        if (sleuth(game, p) && (p.role === "detective" || Math.random() < 0.5)) return detectiveThink(game, p, b);
        if (p.role === "murderer" && murdererThink(game, p, b)) return;
        if (p.role === "npc" && !game.isDetective(p) && npcWeaponThink(game, p, b)) return;
        // Enough tokens for something it lacks: off to the Demon butler.
        const ware = wantedWare(game, p);
        if (ware && Math.random() < 0.5) return go(game, p, b, { kind: "butler", ware });

        // Chores: find the tool lying around, then use it where it belongs (the Murderer does them too, as cover).
        const tk = p.tasks.find((t) => {
            const s = t.def.steps[t.step];
            if (!s) return false;
            if (s.fetch !== undefined) return !game.holdsTool(p, s.fetch) && !!game.nearestLying(p, s.fetch);
            if (s.mix !== undefined && !game.io.hasItem(p, s.mix)) return false;
            if (s.need?.some((id) => !game.io.hasItem(p, id))) return false;
            return s.use === undefined || game.io.hasItem(p, s.use);
        });
        if (tk && Math.random() < 0.85) {
            const step = tk.def.steps[tk.step];
            if (step.fetch !== undefined) return go(game, p, b, fetchGoal(game, p, step.fetch)!);
            if (step.mix !== undefined && step.use !== undefined) {
                game.mixChore(p, step.use, step.mix); // in the pack, wherever they are
                b.idleUntil = game.tick + 2;
                return;
            }
            if (step.c) {
                // The long moment ahead: a word to whoever's around before the screen goes black.
                if (step.fade && inView(game, p).length && chance(0.2 * b.persona.chatty)) say(game, p, b, LINES.goingAfk(), { joke: true });
                return go(game, p, b, { kind: "container", id: step.c, then: "chore", item: step.use });
            }
        }
        const searchable = [...game.containers.values()].filter((c) => c.searchable !== false);
        if (Math.random() < 0.35) return go(game, p, b, { kind: "container", id: pick(searchable).id, then: "use" });
        mover.walkTo(p, mover.randomTile());
        b.idleUntil = game.tick + 3 + rand(8);
    }

    // ------------------------------------------------------------ looking around
    /**
     * What a person would notice, a glance every other tick: who's holding a weapon, who's
     * fighting whom, the living count going down, and things turning up in its own pack.
     */
    function look(game: MurderGame, p: Participant, b: BotState): void {
        const here = inView(game, p);
        const innocent = p.role !== "murderer";
        for (const q of here) {
            const wid = game.io.wielding(q);
            const w = wid !== undefined ? game.weaponOf(wid) : undefined;
            if (w && !game.isDetective(q) && !b.sawWield.has(q.name)) {
                b.sawWield.set(q.name, w.name);
                if (innocent && chance(0.35 * b.persona.chatty)) say(game, p, b, LINES.sawWielding(q.name, w.name), { reply: true });
            }
            // Only a blow that lands (or misses) gives a fight away, not a click on Attack.
            const t = mover.struck(q);
            if (!t || t === q || !t.alive || t === p) continue;
            // The Detective breaking up a fight isn't the one to watch.
            if (game.isDetective(q) && mover.target(t)) continue;
            b.fightNear = { attacker: q.key, victim: t.key, tick: game.tick };
            b.dangerUntil = game.tick + secToTicks(40);
            if (b.sawAttack?.attacker !== q.name) {
                b.sawAttack = { attacker: q.name, victim: t.name };
                if (innocent) say(game, p, b, LINES.sawAttack(q.name, t.name), { urgent: true });
            }
        }
        const living = game.living().length;
        if (b.livingSeen && living < b.livingSeen) {
            b.dangerUntil = game.tick + secToTicks(40);
            // The killer plays dumb now and then.
            const odds = (innocent ? 0.4 : 0.25) * b.persona.chatty;
            if (chance(odds)) say(game, p, b, LINES.deathNoticed(), { reply: true, delaySec: 2 + Math.random() * 6 });
        }
        b.livingSeen = living;
        // A hand in its pocket: it felt that.
        if (b.caughtPicking && game.tick - b.caughtPicking.tick < secToTicks(10)) {
            const who = b.caughtPicking.name;
            b.caughtPicking = undefined;
            b.sawPick = { actor: who, target: p.name };
            b.dangerUntil = game.tick + secToTicks(40);
            if (innocent) say(game, p, b, LINES.caughtPicking(who), { urgent: true });
        }
        // Something it knew was in its pack is gone, and it didn't put it anywhere.
        const now = new Set(game.weaponsHeldBy(p).map((w) => w.id));
        if (b.pickedAt !== undefined && game.tick - b.pickedAt < secToTicks(60)) {
            const gone = game.weapons.find((w) => b.knownWeapons.has(w.id) && !now.has(w.id));
            b.pickedAt = undefined;
            if (gone && innocent && chance(0.8)) say(game, p, b, LINES.weaponGone(gone.name), { reply: true });
        }
        // Something new in the pack: picked up, found, handed over, confiscated... or planted.
        const mine = game.weaponsHeldBy(p);
        for (const w of mine) {
            if (b.knownWeapons.has(w.id)) continue;
            if (sleuth(game, p)) {
                if (game.tick - b.friskedAt < secToTicks(8)) say(game, p, b, LINES.detFriskFound(w.name), { reply: true });
            } else if (b.plantedAt !== undefined && game.tick - b.plantedAt < secToTicks(60)) {
                b.plantedAt = undefined;
                if (innocent) {
                    b.plantedWith = w.name;
                    if (chance(0.85)) say(game, p, b, LINES.planted(w.name), { urgent: true });
                    game.report(p); // straight to the Detective
                }
            } else if (b.received !== undefined && game.tick - b.received < secToTicks(20)) {
                const giver = here.find((q) => w.prints.has(q.name));
                if (giver && innocent && chance(0.7)) say(game, p, b, LINES.received(giver.name, w.name), { reply: true });
            } else if (game.tick - b.pickedWeaponAt > secToTicks(6) && innocent && chance(0.6 * b.persona.chatty)) {
                const c = p.openContainer ? game.containers.get(p.openContainer) : undefined;
                say(game, p, b, LINES.foundWeapon(w.name, c ? roomName(c.name) : "here"), { reply: true });
            }
        }
        b.knownWeapons = new Set(mine.map((w) => w.id));
        if (b.dangerUntil <= game.tick && !mover.attackers(p).length) b.calmSince ||= game.tick;
        else b.calmSince = 0;
    }

    /**
     * Dragon claws give the Murderer away. The Detective, or anyone armed and brave enough,
     * fights; everyone else runs for the grandfather clock to call the household to the table.
     */
    function clawsThink(game: MurderGame, p: Participant, b: BotState): boolean {
        if (p.role === "murderer") return false;
        const m = clawsWielder(game, p);
        if (!m) {
            b.clawsReactAt = undefined;
            return false;
        }
        // It takes a moment to notice and react, as it would anyone at a keyboard.
        b.clawsReactAt ??= game.tick + secToTicks(between(HUMAN.reactSec.urgent));
        if (game.tick < b.clawsReactAt) return false;
        b.clawsReactAt = undefined;
        b.sawClaws = m.name;
        b.clawsCalmAt = game.tick + secToTicks(10);
        b.dangerUntil = game.tick + secToTicks(60);
        game.cancel(p);
        const armed = gearUp(game, p, b);
        if (game.isDetective(p) || (armed && b.persona.brave > 0.3)) {
            say(game, p, b, LINES.clawsFight(m.name), { urgent: true });
            if (mover.attack(p, m)) {
                b.goal = undefined;
                return true;
            }
        }
        say(game, p, b, LINES.clawsRun(m.name), { urgent: true });
        if (!p.rangClock) go(game, p, b, { kind: "clock" });
        else mover.walkTo(p, mover.randomTile());
        return true;
    }

    // ------------------------------------------------------------ fighting
    /**
     * A bot in a fight plays it as a person would, one action at a time and a reaction time
     * late: eat when down to a third of its hitpoints (as 2009scape's combat bots do), drink the
     * prayer potion when someone comes at it, wield what it has, and fight back. The household,
     * caught with nothing to fight with, Binds the attacker if it has the runes and runs.
     * The Murderer opens with the dragon claws special, then switches to the murder weapon if it
     * kept it.
     */
    function combatThink(game: MurderGame, p: Participant, b: BotState): boolean {
        if (b.strikeAt) {
            if (game.tick < b.handsFreeAt) return true;
            const victim = game.participants.get(b.strikeAt);
            b.strikeAt = undefined;
            murdererArm(game, p, b);
            if (victim?.alive) {
                mover.run(p, true);
                mover.attack(p, victim);
                b.lastVictim = victim.key;
            }
            b.idleUntil = game.tick + secToTicks(8);
            return true;
        }
        const foes = mover.attackers(p);
        const target = mover.target(p);
        if (!foes.length && !target) {
            if (b.fightReactAt !== undefined) afterFight(game, p, b);
            return false;
        }
        b.fightReactAt ??= game.tick + secToTicks(between(HUMAN.reactSec.urgent));
        if (game.tick < b.fightReactAt || game.tick < b.handsFreeAt) return true;
        if (b.fightReactAt === game.tick && foes[0] && p.role !== "murderer" && !b.fleeing) {
            say(game, p, b, LINES.attacked(foes[0].name), { urgent: true });
        }
        b.dangerUntil = game.tick + secToTicks(60);
        game.cancel(p); // whatever it was doing, it's fighting now

        const hp = mover.hitpoints(p);
        if (hp.now * 3 <= hp.max && mover.use(p, C.rewards.shark, "eat")) {
            b.handsFreeAt = game.tick + 3; // eating holds the next swing back 3 ticks anyway
            return true;
        }
        const foe = foes[0];
        if (foe && game.io.hasItem(p, C.rewards.prayerPotion) && mover.use(p, C.rewards.prayerPotion, "drink")) {
            b.handsFreeAt = game.tick + 2;
            return true;
        }
        if (p.role === "murderer") {
            // Claws out for their special while there's energy for it, then the strongest it has.
            murdererArm(game, p, b);
        } else {
            const armed = gearUp(game, p, b);
            // Unarmed (or not brave enough to trade blows): Bind and run.
            if (p.role === "npc" && foe && (!armed || b.persona.brave < 0.15) && b.persona.brave < 0.9) return flee(game, p, b, foe);
        }
        if (!target && foe) mover.attack(p, foe);
        return true;
    }

    /**
     * Someone in sight is attacking someone else. The Detective steps in, and so does anyone armed
     * and brave enough; the rest raise the alarm and run for the clock.
     */
    function defendThink(game: MurderGame, p: Participant, b: BotState): boolean {
        const f = b.fightNear;
        if (!f || game.tick - f.tick > 4 || p.role === "murderer" || game.tick - b.defendedAt < secToTicks(6)) return false;
        const attacker = game.participants.get(f.attacker);
        const victim = game.participants.get(f.victim);
        if (!attacker?.alive || !victim?.alive || mover.target(attacker) !== victim) return false;
        b.defendedAt = game.tick;
        game.cancel(p);
        b.goal = undefined;
        const armed = gearUp(game, p);
        if (game.isDetective(p) || (armed && b.persona.brave > 0.35) || b.persona.brave > 0.92) {
            say(game, p, b, LINES.defendOther(attacker.name), { urgent: true });
            mover.run(p, true);
            if (mover.attack(p, attacker)) return true;
        }
        if (!p.rangClock && chance(0.6)) {
            go(game, p, b, { kind: "clock" });
            return true;
        }
        return false;
    }

    /** Unarmed and attacked: Bind them if it can, then run for the grandfather clock. */
    function flee(game: MurderGame, p: Participant, b: BotState, foe: Participant): boolean {
        if (b.fleeing && mover.isMoving(p)) return true;
        if (!b.fleeing && hasBindRunes(game, p) && mover.bind(p, foe)) {
            b.handsFreeAt = game.tick + 2;
            say(game, p, b, LINES.bindRun(foe.name), { urgent: true });
        }
        b.fleeing = true;
        mover.run(p, true);
        if (!p.rangClock) go(game, p, b, { kind: "clock" });
        else mover.walkTo(p, mover.randomTile());
        return true;
    }

    /** The fight's over: walk again, and the Murderer puts the claws (and weapon) away. */
    function afterFight(game: MurderGame, p: Participant, b: BotState): void {
        b.fightReactAt = undefined;
        b.fleeing = false;
        mover.run(p, false);
        if (p.role === "murderer" && game.io.wielding(p)) mover.unwield(p);
    }

    // ------------------------------------------------------------ weapons
    /**
     * Everything it could fight with, strongest first: the pool's weapons it carries or wields,
     * and the Murderer's dragon claws.
     */
    function arsenal(game: MurderGame, p: Participant): number[] {
        const ids = new Set(game.weaponsHeldBy(p).map((w) => w.itemId));
        if (p.role === "murderer" && game.io.hasItem(p, C.pvp.dragonClaws)) ids.add(C.pvp.dragonClaws);
        return [...ids].sort((a, c) => mover.weaponPower(c) - mover.weaponPower(a));
    }

    /** Wield this (unless it's in hand already, or a Wield is already on its way). */
    function wieldNow(game: MurderGame, p: Participant, b: BotState, itemId: number): boolean {
        if (game.io.wielding(p) === itemId) return true;
        if (b.wieldAt !== undefined && game.tick < b.wieldAt) return true;
        if (!mover.wield(p, itemId)) return false;
        b.wieldAt = game.tick + 2;
        return true;
    }

    /**
     * The Murderer's weapon in a fight: the dragon claws while there's energy for their special
     * (and the special turned on), then the strongest weapon it has.
     */
    function murdererArm(game: MurderGame, p: Participant, b: BotState): void {
        const claws = game.io.hasItem(p, C.pvp.dragonClaws);
        if (claws && mover.specialEnergy(p) >= CLAWS_SPEC) {
            wieldNow(game, p, b, C.pvp.dragonClaws);
            if (game.io.wielding(p) === C.pvp.dragonClaws) mover.special(p);
            return;
        }
        const best = arsenal(game, p)[0];
        if (best !== undefined) wieldNow(game, p, b, best);
    }

    /** Wield the strongest thing it carries (if not holding it already). Returns whether it's armed. */
    function gearUp(game: MurderGame, p: Participant, b?: BotState): boolean {
        const best = arsenal(game, p)[0];
        if (best === undefined) return !!game.io.wielding(p);
        if (game.io.wielding(p) === best) return true;
        if (b) return wieldNow(game, p, b, best);
        return mover.wield(p, best) || !!game.io.wielding(p);
    }

    /**
     * Thinking about its weapons, as a person glances at their pack: the household arms itself when
     * it feels in danger (or always, if it's the brave sort) and puts the weapon away again once
     * things are calm, since walking around with a mace out looks suspicious. The Murderer keeps the
     * claws out of sight unless it's about to use them.
     */
    function armThink(game: MurderGame, p: Participant, b: BotState): void {
        const wielding = game.io.wielding(p);
        const danger = b.dangerUntil > game.tick || mover.attackers(p).length > 0;
        if (p.role === "murderer") {
            if (wielding && !b.strikeAt && !mover.target(p) && !mover.attackers(p).length) mover.unwield(p);
            return;
        }
        if (game.isDetective(p)) {
            if (danger) gearUp(game, p, b);
            return;
        }
        const held = arsenal(game, p)[0];
        if (held !== undefined && wielding !== held && (danger || b.persona.brave > 0.8)) wieldNow(game, p, b, held);
        else if (wielding && !danger && b.persona.brave <= 0.8 && b.calmSince && game.tick - b.calmSince > secToTicks(30)) mover.unwield(p);
    }

    /**
     * A weapon from the pool lying in sight (dropped by the dead, or confiscated with no room):
     * the Detective bags it as evidence (no prints of theirs); the unarmed household picks a red
     * herring up to defend itself. Nobody innocent touches the revealed murder weapon (their prints
     * would go on it).
     */
    function pickUpWeaponThink(game: MurderGame, p: Participant, b: BotState): boolean {
        if (p.role === "murderer") return false;
        const at = game.io.pos(p);
        if (!at) return false;
        const zone = game.layout.zoneAt(at);
        const det = game.isDetective(p);
        const armed = game.weaponsHeldBy(p).length > 0;
        const w = game.weapons.find((x) => {
            if (x.at.kind !== "ground") return false;
            const t = x.at.tile;
            if (t.level !== at.level || game.layout.zoneAt(t) !== zone) return false;
            if (det) return true;
            return !x.real && !armed && (b.persona.brave > 0.4 || b.dangerUntil > game.tick);
        });
        if (!w) return false;
        go(game, p, b, { kind: "weapon", id: w.id });
        return !!b.goal;
    }

    /**
     * What a bot would buy from the Demon butler with the tokens it has. The household wants a
     * way out of a fight first (Bind runes), the armed want food; each buys only what it lacks.
     */
    function wantedWare(game: MurderGame, p: Participant): Ware | undefined {
        const tokens = mover.tokens(p);
        const has = (w: Ware) => (w === "runes" ? hasBindRunes(game, p) : game.io.hasItem(p, WARE_ITEM[w]));
        const order: Ware[] = p.role === "npc" && !game.weaponHeldBy(p) ? ["runes", "shark", "potion"] : ["shark", "potion", "runes"];
        return order.find((w) => !has(w) && tokens >= warePrice(w, game.playerCount()));
    }

    // ------------------------------------------------------------ memory hooks
    function observe(game: MurderGame, p: Participant, ev: Observation): void {
        if (!p.isBot) return;
        const b = memory(game, state(p));
        b.seen.push(ev);
        if (game.phase !== "investigation") return;
        const innocent = p.role !== "murderer";
        // Someone working at a way out: nobody innocent has a reason to.
        if (ev.kind === "rummage" && game.layout.escapes.some((e) => e.name === ev.container) && ev.actor !== p.name) {
            b.sawEscape = { who: ev.actor, what: ev.container };
            b.dangerUntil = game.tick + secToTicks(40);
            if (innocent) say(game, p, b, LINES.sawEscape(ev.actor, ev.container), { urgent: true });
            return;
        }
        if (ev.kind === "pickpocket" && ev.actor !== p.name && ev.target !== p.name) {
            b.sawPick = { actor: ev.actor, target: ev.target };
            if (innocent) say(game, p, b, LINES.sawPickpocket(ev.actor, ev.target), { urgent: true });
            return;
        }
        // React out loud to something genuinely suspicious.
        if (ev.kind === "handoff" && ev.actor !== p.name && innocent && Math.random() < 0.7) {
            say(game, p, b, LINES.sawHandoff(ev.actor, ev.target), { urgent: true });
        }
    }

    function activity(game: MurderGame, p: Participant, text: string): void {
        if (!p.isBot) return;
        const b = memory(game, state(p));
        b.did.push(text);
        if (game.phase === "investigation" && !text.startsWith("searched") && Math.random() < 0.15 * b.persona.chatty) {
            say(game, p, b, LINES.choreDone(text), { joke: true });
        }
    }

    /** Someone said something: everyone who could hear it takes note, and may answer. */
    function hear(game: MurderGame, speaker: Participant, text: string, echo = false): void {
        const line = parseChat(game, speaker, text, echo);
        const log = chats.get(game) ?? [];
        log.push(line);
        if (log.length > 300) log.splice(0, log.length - 300);
        chats.set(game, log);
        const sAt = game.io.pos(speaker);
        for (const q of game.participants.values()) {
            if (!q.isBot || !q.alive || q === speaker) continue;
            if (game.phase === "investigation") {
                const qa = game.io.pos(q);
                if (!sAt || !qa || game.fading(q) || qa.level !== sAt.level || game.layout.zoneAt(qa) !== game.layout.zoneAt(sAt)) continue;
            }
            react(game, q, memory(game, state(q)), line);
        }
    }

    /** Answer back: deny an accusation, answer a question, and rethink the vote. */
    function react(game: MurderGame, p: Participant, b: BotState, line: ChatLine): void {
        if (game.phase === "arrest" && b.voted) b.nextEvalAt = Math.min(b.nextEvalAt, game.tick + secToTicks(1.5 + Math.random() * 2.5));
        const last = b.repliedTo.get(line.speakerKey) ?? -1000;
        if (game.tick - last < secToTicks(12)) return;
        const alibi = alibiLine(game, p, b);
        if (line.accuse.has(p.name)) {
            if (!chance(0.55 + 0.3 * Math.min(1, b.persona.chatty))) return;
            b.repliedTo.set(line.speakerKey, game.tick);
            if (p.role === "murderer") {
                const other = b.frameTarget && b.frameTarget !== line.speaker ? b.frameTarget : otherName(game, p, [line.speaker]);
                say(game, p, b, other && chance(0.6) ? LINES.deflect(line.speaker, alibi, other) : LINES.defend(line.speaker, alibi), { reply: true });
            } else {
                say(game, p, b, LINES.defend(line.speaker, alibi), { reply: true });
            }
            return;
        }
        if (line.question && line.mentions.includes(p.name) && chance(0.7)) {
            b.repliedTo.set(line.speakerKey, game.tick);
            say(game, p, b, LINES.answer(alibi), { reply: true });
        }
    }

    function otherName(game: MurderGame, p: Participant, not: string[] = []): string | undefined {
        const det = game.detective();
        const pool = game.living().filter((q) => q !== p && q !== det && !not.includes(q.name));
        return pool.length ? pick(pool).name : undefined;
    }

    // ------------------------------------------------------------ talking
    /**
     * Start "typing" a line in this bot's own voice: it shows once a person could have typed it.
     * Remarks are spaced out (chattier bots talk more); shouts and replies go straight out.
     */
    function say(game: MurderGame, p: Participant, b: BotState, text: string, opts: { urgent?: boolean; reply?: boolean; then?: () => void; delaySec?: number; joke?: boolean; echo?: boolean } = {}): void {
        const { urgent = false, reply = false, then, delaySec = 0, joke = false, echo = false } = opts;
        if (!urgent && !reply && !then && game.tick - b.lastSaid < secToTicks(15 / b.persona.chatty)) return;
        if (reply && !then && game.tick - b.lastReply < secToTicks(4)) return;
        if (b.outbox.length > 3 && !then) return; // it's got enough to type already
        b.lastSaid = game.tick;
        if (reply) b.lastReply = game.tick;
        // A shout can't wait: whatever small talk it was typing goes (lines that do something stay).
        if (urgent) b.outbox = b.outbox.filter((l) => l.then);
        const lines = voice(text, b.persona, urgent);
        let after = (b.outbox.length ? b.outbox[b.outbox.length - 1].at : game.tick) + secToTicks(delaySec); // one line at a time
        lines.forEach((l, i) => {
            after += secToTicks(i === 0 ? typingSec(l, urgent) : 0.6 + l.length / 6);
            b.outbox.push({ text: l, meant: i === 0 && !joke ? text : undefined, echo, at: after, then: i === lines.length - 1 ? then : undefined });
        });
    }
    function sendTyped(game: MurderGame, p: Participant, b: BotState): void {
        while (b.outbox.length && game.tick >= b.outbox[0].at) {
            const line = b.outbox.shift()!;
            game.io.say(p, line.text);
            // The other bots hear it like anyone else (and read past the typos); a joke isn't evidence.
            if (line.meant !== undefined) hear(game, p, line.meant, line.echo);
            line.then?.();
        }
    }

    /** Small talk now and then, when there's someone around to hear it. */
    function banter(game: MurderGame, p: Participant, b: BotState): void {
        if (game.tick < b.nextBanterAt) return;
        const first = !b.nextBanterAt;
        b.nextBanterAt = game.tick + secToTicks((50 + Math.random() * 100) / b.persona.chatty);
        if (first || b.dangerUntil > game.tick) return;
        const here = inView(game, p);
        if (!here.length) return;
        say(game, p, b, LINES.banter(pick(here).name), { joke: true });
    }

    // ------------------------------------------------------------ movement
    function go(game: MurderGame, p: Participant, b: BotState, goal: Goal): void {
        b.goal = goal;
        b.goalSince = game.tick;
        if (!arrived(game, p, goal) && !repath(game, p, goal)) b.goal = undefined;
    }

    function goalTile(game: MurderGame, goal: Goal): Tile | undefined {
        if (goal.kind === "kit") return game.detectiveKit?.tile;
        if (goal.kind === "clock") return game.layout.clock;
        if (goal.kind === "butler") return DEMON_BUTLER.tile;
        if (goal.kind === "pickup") return goal.tile;
        if (goal.kind === "escape") return game.escapeAt(goal.id)?.tile;
        if (goal.kind === "weapon") {
            const w = game.weapons.find((x) => x.id === goal.id);
            return w?.at.kind === "ground" ? w.at.tile : undefined;
        }
        return undefined;
    }

    function repath(game: MurderGame, p: Participant, goal: Goal): boolean {
        if (goal.kind === "scene") {
            const body = game.bodies[goal.body];
            return !!body && mover.approachTile(p, body.tile);
        }
        if (goal.kind === "kit") return !!game.detectiveKit && mover.walkTo(p, game.detectiveKit.tile);
        if (goal.kind === "container") {
            const c = game.containers.get(goal.id);
            return !!c && mover.approachContainer(p, c);
        }
        if (goal.kind === "person") {
            const q = game.participants.get(goal.key);
            return !!q && q.alive && mover.approachPerson(p, q);
        }
        const t = goalTile(game, goal);
        return !!t && mover.approachTile(p, t); // it may be on a table
    }

    function arrived(game: MurderGame, p: Participant, goal: Goal): boolean {
        if (goal.kind === "scene") return game.nearBody(p, goal.body);
        if (goal.kind === "container") {
            const c = game.containers.get(goal.id);
            return !!c && game.nearContainer(p, c);
        }
        if (goal.kind === "person") {
            const q = game.participants.get(goal.key);
            return !!q && game.nearPerson(p, q);
        }
        const at = game.io.pos(p);
        const t = goalTile(game, goal);
        return !!at && !!t && at.level === t.level && cheb(at, t) <= 1;
    }

    function perform(game: MurderGame, p: Participant, b: BotState): void {
        const g = b.goal!;
        b.goal = undefined;
        b.idleUntil = game.tick + 1 + rand(4);
        if (g.kind === "scene") {
            game.useBody(p, g.body);
        } else if (g.kind === "kit") {
            // One piece at a time, as a person clicks each ground item (and no faster than one every
            // 2 ticks); it stays until the kit's all picked up.
            const wasDetective = game.isDetective(p);
            game.takeKitPiece(p);
            if (!wasDetective && game.isDetective(p) && p.role !== "murderer" && chance(0.4)) say(game, p, b, LINES.kitTaken(), { reply: true });
            if (game.detectiveKit) {
                b.goal = g;
                b.idleUntil = 0;
            }
        } else if (g.kind === "clock") {
            game.ringClock(p);
        } else if (g.kind === "butler") {
            mover.buy(p, g.ware);
        } else if (g.kind === "pickup") {
            // Too soon after the last pickup: wait a tick and take it then.
            if (!game.botPickupReady(p)) {
                b.goal = g;
                b.idleUntil = 0;
            } else game.botPickUp(p, g.itemId, g.tile);
        } else if (g.kind === "weapon") {
            const w = game.weapons.find((x) => x.id === g.id);
            if (!w || w.at.kind !== "ground") return;
            if (!game.botPickupReady(p)) {
                b.goal = g;
                b.idleUntil = 0;
                return;
            }
            if (game.takeFromGround(p, w.itemId)) b.pickedWeaponAt = game.tick;
        } else if (g.kind === "escape") {
            const e = game.escapeAt(g.id);
            // Only with nobody watching; otherwise come back later.
            if (e && !game.witnesses(p).some((q) => q.alive)) game.workEscape(p, e.id, e.tool);
            else b.idleUntil = game.tick + secToTicks(6);
        } else if (g.kind === "container") {
            if (g.then === "use") game.useContainer(p, g.id);
            else if (g.then === "chore") {
                if (g.item === undefined) game.useContainer(p, g.id); // fetch: the furniture hands it over
                else game.doChore(p, g.id, g.item);
            } else if (g.then === "stash") {
                const w = p.role === "murderer" ? game.murderWeaponHeldBy(p) : game.weaponHeldBy(p);
                // Somebody wandered in: not here, not now.
                if (w && p.role === "murderer" && game.witnesses(p).some((q) => q.alive)) {
                    b.weaponAt = game.tick + secToTicks(4 + Math.random() * 6);
                    mover.walkTo(p, mover.randomTile());
                } else if (w) game.stash(p, g.id, w.itemId);
            } else {
                const c = game.containers.get(g.id);
                if (c && chance(0.2 * b.persona.chatty)) say(game, p, b, LINES.detDust(roomName(c.name)));
                game.lift(p, "container", g.id);
            }
        } else if (g.then === "give") {
            const w = game.murderWeaponHeldBy(p);
            if (w) game.give(p, g.key, w.itemId);
        } else if (g.then === "plant") {
            const w = game.murderWeaponHeldBy(p);
            const q = game.participants.get(g.key);
            if (w && !game.plant(p, g.key, w.itemId)) b.plantedOn = q?.name;
            else b.weaponAt = game.tick + secToTicks(3); // missed the moment: hide it instead, soon
        } else if (g.then === "pickpocket") {
            // Only while they still can't see; awake, the game would have them catch it at it.
            const q = game.participants.get(g.key);
            if (q && game.fading(q)) game.pickpocket(p, g.key);
        } else if (g.then === "frisk") {
            const q = game.participants.get(g.key);
            if (q) say(game, p, b, LINES.detFrisk(q.name), { reply: true });
            b.friskedAt = game.tick;
            game.stopAndSearch(p, g.key);
        } else if (g.then === "stalk") {
            b.idleUntil = game.tick + 2 + rand(4); // lurk a moment; the strike comes when they're alone
        } else game.lift(p, "person", g.key);
    }

    function onPhase(game: MurderGame, p: Participant, b: BotState): void {
        const was = b.lastPhase;
        b.lastPhase = game.phase;
        b.goal = undefined;
        if (game.phase === "investigation") {
            // Whatever it hadn't got round to saying at the table is old news now.
            if (was === "result" || was === "arrest") b.outbox = [];
            b.lifted = new Set();
            b.idleUntil = game.tick + rand(4);
            b.dumpAt = 0;
            b.livingSeen = game.living().length;
            b.knownWeapons = new Set(game.weaponsHeldBy(p).map((w) => w.id));
            const len = game.phaseEnds - game.phaseStart;
            if (p.role === "murderer") {
                planMurder(game, p, b);
                // An escaper ditches the weapon early; a killer a little later, unless it keeps it.
                const [lo, hi] = b.plan === "escape" ? [0.03, 0.12] : [0.08, 0.3];
                b.weaponAt = game.tick + Math.floor(len * (lo + Math.random() * (hi - lo)));
                b.plantIntent = chance(C.bots.plantChance);
                b.nextStalkAt = game.tick + secToTicks(10 + Math.random() * 15);
            } else b.weaponAt = game.tick + Math.floor(len * (0.15 + Math.random() * 0.55));
            const someone = otherName(game, p) ?? "you";
            if (game.round === 1 && chance(0.35 * b.persona.chatty)) say(game, p, b, LINES.greet(someone), { delaySec: 2 + Math.random() * 10, joke: true });
            else if (game.round > 1 && chance(0.15 * b.persona.chatty)) say(game, p, b, LINES.roundStart(game.round, someone), { delaySec: 1 + Math.random() * 8, joke: true });
        }
        if (game.phase === "arrest") {
            const [lo, hi] = C.bots.voteDelaySec;
            // Everyone votes early (4-16 s), on what it knows by then; the Detective is quickest of them.
            b.voteAt = game.tick + secToTicks(sleuth(game, p) ? lo + Math.random() * (hi - lo) * 0.4 : lo + Math.random() * (hi - lo));
            b.voted = false;
            b.myVote = undefined;
            b.voteChanges = 0;
            b.nextEvalAt = 0;
            b.prevLiving = game.living().map((q) => q.key);
            if (p.role === "murderer") b.frameTarget = pickFrame(game, p, b);
            b.tableLines = tableTalk(game, p, b);
            const opener = chance(0.4 * b.persona.chatty);
            if (opener) b.tableLines.unshift(sleuth(game, p) ? LINES.detOpener() : LINES.opener());
            // Stagger speakers so the table reads like a conversation.
            b.nextLineAt = game.tick + secToTicks(opener ? 0.5 + Math.random() * 3 : 3 + Math.random() * 12);
        }
        if (game.phase === "result" && was === "arrest") {
            // The arrest cutscene plays first; its verdict comes at the end. Only an innocent's
            // arrest leaves a table to talk at (the Murderer's ends the game), so the line waits
            // until after the verdict and is only queued then.
            const scene = game.arrestScene;
            const gone = scene?.target;
            if (gone && gone !== p && gone.role !== "murderer" && chance(0.35 * b.persona.chatty)) {
                say(game, p, b, LINES.resultInnocent(gone.name, p.role === "murderer"), { reply: true, delaySec: C.arrestScene.sec + 1 + Math.random() * 2 });
            }
        }
    }

    // ------------------------------------------------------------ the household
    function npcWeaponThink(game: MurderGame, p: Participant, b: BotState): boolean {
        const held = game.weaponHeldBy(p);
        if (held) {
            // The timid get rid of a weapon someone pushed on them; the brave keep it to fight with.
            if (b.received && !b.dumpAt && b.persona.brave < 0.6) b.dumpAt = game.tick + secToTicks(3 + Math.random() * 6);
            if (!p.reported.has("held:" + held.id) && Math.random() < C.bots.reportChance) {
                game.report(p); // to the Detective, quietly
                return true;
            }
            if (b.dumpAt && game.tick >= b.dumpAt) {
                b.dumpAt = 0;
                b.received = undefined;
                if (game.io.wielding(p) === held.itemId) mover.unwield(p);
                go(game, p, b, { kind: "container", id: nearestContainer(game, p, true).id, then: "stash" });
                return true;
            }
            return false;
        }
        const c = p.openContainer ? game.containers.get(p.openContainer) : undefined;
        p.openContainer = undefined;
        if (c) {
            const w = game.weaponsIn(c.id)[0];
            if (w && !p.reported.has(c.id + ":" + w.id)) {
                if (Math.random() < C.bots.reportChance) {
                    p.openContainer = c.id; // report() checks the open container
                    game.report(p); // to the Detective, quietly
                    p.openContainer = undefined;
                } else p.reported.add(c.id + ":" + w.id);
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------ the Murderer
    /** Once a game: escape or kill (and whether a killer keeps the weapon to fight with). */
    function planMurder(game: MurderGame, p: Participant, b: BotState): void {
        if (b.plan) return;
        b.plan = chance(C.bots.murdererEscapeChance) ? "escape" : "kill";
        b.keepWeapon = b.plan === "kill" && chance(C.bots.killerKeepsWeaponChance);
    }

    /** The killer's eye: a chance to strike or to plant the weapon, the moment it comes. */
    function murdererReflex(game: MurderGame, p: Participant, b: BotState): boolean {
        planMurder(game, p, b);
        // The last strike: did it work?
        if (b.lastVictim) {
            const v = game.participants.get(b.lastVictim);
            if (!v?.alive) {
                b.killCount++;
                b.killCalmUntil = game.tick + secToTicks(45 + Math.random() * 45);
                b.lastVictim = undefined;
                b.stalk = undefined;
                // Get away from the body, and look busy.
                mover.walkTo(p, mover.randomTile());
                b.idleUntil = game.tick + secToTicks(4);
                return true;
            }
            if (!mover.target(p)) b.lastVictim = undefined;
        }
        const victim = loneVictim(game, p);
        if (victim) {
            const hp = mover.hitpoints(p);
            const elapsed = game.tick - game.phaseStart;
            let odds = 0;
            if (b.plan === "kill" && elapsed > secToTicks(12) && game.tick >= b.killCalmUntil && hp.now * 2 > hp.max) {
                odds = (b.stalk === victim.key ? 0.3 : 0.07) * (game.isDetective(victim) ? 0.3 : 1);
            } else if (b.plan === "escape" && game.fading(victim)) odds = 0.01; // too good to pass up, now and then
            if (game.fading(victim)) odds *= 3; // lost in a chore: they can't see it coming
            if (odds && Math.random() < odds) {
                murdererArm(game, p, b);
                b.strikeAt = victim.key;
                b.handsFreeAt = game.tick + 1;
                b.goal = undefined;
                return true;
            }
        }
        // The one it planted on is lost in a chore again, nobody else around: a killer wants its
        // weapon back to fight with (an escaper rarely bothers).
        const planted = game.plantedOnOthers(p).map((w) => game.participants.get(w.plantedBy!.on)!).find((q) => q && game.fading(q) && inView(game, p).includes(q));
        if (planted && b.goal?.kind !== "person" && !game.witnesses(p).some((q) => q.alive && q !== planted)
            && chance(b.plan === "kill" ? 0.3 : 0.03)) {
            go(game, p, b, { kind: "person", key: planted.key, then: "pickpocket" });
            if (b.goal) {
                b.keepWeapon = b.plan === "kill";
                return true;
            }
        }
        // Someone in a chore's black screen, nobody else around: slip the weapon into their pack.
        const real = game.murderWeaponHeldBy(p);
        if (real && !b.keepWeapon && b.plantIntent && game.tick >= b.weaponAt && b.goal?.kind !== "person") {
            const mark = inView(game, p).find((q) => game.fading(q) && !game.isDetective(q));
            if (mark && !game.witnesses(p).some((q) => q.alive && q !== mark)) {
                go(game, p, b, { kind: "person", key: mark.key, then: "plant" });
                return !!b.goal;
            }
        }
        return false;
    }

    function murdererThink(game: MurderGame, p: Participant, b: BotState): boolean {
        const held = game.murderWeaponHeldBy(p);
        // Ditch the evidence first (unless it's a killer keeping it).
        if (held && !b.keepWeapon && game.tick >= b.weaponAt) {
            // Wanted to plant it but nobody's been in a chore's long moment: give up on that after a while.
            if (b.plantIntent && game.tick < b.weaponAt + secToTicks(25)) return false;
            hideWeapon(game, p, b);
            return true;
        }
        // The Detective's about with a Stop and Search to spare: a killer keeping it thinks again.
        if (held && b.keepWeapon) {
            const det = game.detective();
            if (det && det !== p && inView(game, p).includes(det) && game.lastFrisk !== game.round && game.caseFile.clues > 0 && chance(0.2)) {
                b.keepWeapon = false;
                b.weaponAt = game.tick;
            }
        }
        if (escapeThink(game, p, b)) return true;
        if (b.plan === "kill" && stalkThink(game, p, b)) return true;
        return false;
    }

    /**
     * Hide the murder weapon where nobody will look: furniture in this room with no chore of its
     * own (a chore done there would turn it up), with nobody watching. Seen? Move on and try again.
     */
    function hideWeapon(game: MurderGame, p: Participant, b: BotState): void {
        if (game.witnesses(p).some((q) => q.alive)) {
            mover.walkTo(p, mover.randomTile());
            b.weaponAt = game.tick + secToTicks(5 + Math.random() * 5);
            b.idleUntil = game.tick + 4;
            return;
        }
        const at = game.io.pos(p);
        const room = at ? game.io.roomAt(at) : "";
        const choreSpots = new Set(game.layout.tasks.flatMap((t) => t.steps.map((s) => s.c)).filter(Boolean));
        const here = [...game.containers.values()].filter((c) => c.room === room && c.searchable !== false);
        const quiet = here.filter((c) => !choreSpots.has(c.id));
        const c = quiet.length ? pick(quiet) : here.length ? pick(here) : nearestContainer(game, p, true);
        go(game, p, b, { kind: "container", id: c.id, then: "stash" });
        b.weaponAt = game.tick + secToTicks(20 + Math.random() * 20);
    }

    /**
     * Every round, a go at the way out that's furthest along (fetching its tool first). The escaper
     * picks its moment in the round; the killer only falls back on it once killing isn't working.
     */
    function escapeThink(game: MurderGame, p: Participant, b: BotState): boolean {
        if (game.escape.lastRound === game.round) return false;
        const elapsed = (game.tick - game.phaseStart) / Math.max(1, game.phaseEnds - game.phaseStart);
        let odds: number;
        if (b.plan === "kill") odds = game.round >= 3 && b.killCount === 0 ? 0.2 : game.living().length <= 3 ? 0.1 : 0;
        else odds = elapsed < 0.12 ? 0.05 : elapsed > 0.6 ? 0.9 : 0.35;
        if (Math.random() > odds) return false;
        const routes = game.layout.escapes
            .map((e) => ({ e, have: game.escape.progress[e.id] ?? 0, tool: game.io.hasItem(p, e.tool) }))
            .sort((x, y) => Number(y.tool) - Number(x.tool) || y.have - x.have);
        const best = routes[0];
        if (!best) return false;
        if (best.tool) {
            go(game, p, b, { kind: "escape", id: best.e.id });
            return true;
        }
        const goal = fetchGoal(game, p, best.e.tool);
        if (!goal) return false;
        go(game, p, b, goal);
        return true;
    }

    /**
     * The killer picks someone on their own (lost in a chore is best, the Detective is a last
     * resort) and drifts over to them, as though passing by. The strike itself comes once they're
     * alone together (murdererReflex).
     */
    function stalkThink(game: MurderGame, p: Participant, b: BotState): boolean {
        if (game.tick < b.nextStalkAt || game.tick < b.killCalmUntil) return false;
        b.nextStalkAt = game.tick + secToTicks(10 + Math.random() * 15);
        if (Math.random() < 0.35) return false; // look busy for a bit first
        const zoneOf = (q: Participant) => {
            const at = game.io.pos(q);
            return at ? `${at.level}:${game.layout.zoneAt(at)}` : "";
        };
        const living = game.living().filter((q) => q !== p);
        const crowd = new Map<string, number>();
        for (const q of living) crowd.set(zoneOf(q), (crowd.get(zoneOf(q)) ?? 0) + 1);
        const alone = living.filter((q) => crowd.get(zoneOf(q)) === 1);
        if (!alone.length) return false;
        const weight = (q: Participant) => (game.fading(q) ? 3 : 1) * (game.isDetective(q) ? 0.3 : 1);
        const total = alone.reduce((n, q) => n + weight(q), 0);
        let r = Math.random() * total;
        const mark = alone.find((q) => (r -= weight(q)) <= 0) ?? alone[0];
        b.stalk = mark.key;
        go(game, p, b, { kind: "person", key: mark.key, then: "stalk" });
        return !!b.goal;
    }

    /** Who the Murderer points at: whoever it planted on or handed it to, someone it saw rummaging, or anyone. */
    function pickFrame(game: MurderGame, p: Participant, b: BotState): string | undefined {
        const living = new Set(game.living().filter((q) => q !== p).map((q) => q.name));
        if (b.plantedOn && living.has(b.plantedOn)) return b.plantedOn;
        if (b.handTo && living.has(b.handTo)) return b.handTo;
        const r = b.seen.filter((e): e is Extract<Observation, { kind: "rummage" }> => e.kind === "rummage" && living.has(e.actor));
        if (r.length && chance(0.7)) return pick(r).actor;
        return otherName(game, p);
    }

    /** Go and get a tool: pick it up where it lies, or search the furniture it's kept in. */
    function fetchGoal(game: MurderGame, p: Participant, itemId: number): Goal | undefined {
        const spot = game.nearestSpot(p, itemId);
        if (!spot) return undefined;
        return spot.in ? { kind: "container", id: spot.in, then: "use" } : { kind: "pickup", itemId, tile: spot.tile };
    }

    // ------------------------------------------------------------ the Detective
    /**
     * How suspicious each living person looks from what this bot saw itself (and, for the
     * Detective, its notebook): name -> score.
     */
    function evidence(game: MurderGame, p: Participant, b: BotState): Map<string, number> {
        const score = new Map<string, number>();
        const add = (name: string | undefined, n: number) => {
            if (!name || name === p.name) return;
            score.set(name, (score.get(name) ?? 0) + n);
        };
        add(b.sawClaws, 12);
        add(b.sawEscape?.who, 12);
        add(b.sawAttack?.attacker, 9);
        add(b.sawPick?.actor, 7);
        for (const e of b.seen) {
            if (e.kind === "handoff") {
                add(e.actor, 4);
                add(e.target, 1.5);
            }
        }
        for (const [name] of b.sawWield) add(name, 1.5);
        const report = game.lastReport?.round === game.round && game.lastReport.kind === "container" ? game.containers.get(game.lastReport.id) : undefined;
        if (report) for (const e of b.seen) if (e.kind === "rummage" && e.container === report.name) add(e.actor, 3);
        if (game.isDetective(p)) {
            // Prints on a weapon of the type the wound points to count; on any old weapon, much less.
            const set = knownWeaponPrints(game, p)?.prints ?? [];
            for (const n of set) add(n, p.knownCategory ? 4 : 1.5);
            for (const e of p.notebook) for (const n of e.prints ?? []) add(n, 0.4);
            for (const e of p.notebook) for (const w of e.weapons ?? []) if (!p.knownCategory || w.category === p.knownCategory) for (const n of w.prints) add(n, 1);
        }
        return score;
    }

    function detectiveThink(game: MurderGame, p: Participant, b: BotState): void {
        // First things first: study the body for a clue to what kind of weapon did it,
        // ...one clue a round, until the clues give the weapon type away.
        // A victim's body gives one more clue, once; Lord Sinclair's one a round. Only bodies someone has reported.
        const body = p.knownCategory ? undefined : game.bodies.find((x) => game.bodyHasClue(x) && !b.lifted.has("scene:" + x.id));
        if (body) {
            b.lifted.add("scene:" + body.id);
            if (chance(0.35 * b.persona.chatty)) say(game, p, b, LINES.detScene());
            return go(game, p, b, { kind: "scene", body: body.id });
        }
        const scores = evidence(game, p, b);
        const ranked = game.living().filter((q) => q !== p).sort((a, z) => (scores.get(z.name) ?? 0) - (scores.get(a.name) ?? 0));
        const top = ranked[0];
        const topScore = top ? scores.get(top.name) ?? 0 : 0;
        // A name on its mind: it lets them know.
        if (top && topScore >= 4 && b.eyed !== game.round && inView(game, p).includes(top)) {
            b.eyed = game.round;
            say(game, p, b, LINES.detEye(top.name));
        }
        const r = game.lastReport;
        // Once a round: Stop and Search the likeliest suspect, whoever was last heard to have found
        // a weapon, or now and then someone close by.
        if (game.canFrisk(p) && game.caseFile.clues > 0) {
            const finder = r && r.round === game.round && r.kind === "participant" ? game.participants.get(r.id) : undefined;
            const near = inView(game, p);
            const suspect = top && topScore >= 3 ? top
                : finder?.alive && finder !== p ? finder
                : near.length && Math.random() < 0.3 ? pick(near) : undefined;
            if (suspect) {
                if (r) b.lifted.add(r.kind + ":" + r.id);
                return go(game, p, b, { kind: "person", key: suspect.key, then: "frisk" });
            }
        }
        if (r && r.round === game.round) {
            const key = r.kind + ":" + r.id;
            if (!b.lifted.has(key)) {
                b.lifted.add(key); // (quietly: a report is between the finder and the Detective)
                if (r.kind === "container") return go(game, p, b, { kind: "container", id: r.id, then: "lift" });
                const q = game.participants.get(r.id);
                if (q && q.alive) return go(game, p, b, { kind: "person", key: q.key, then: "lift" });
            }
        }
        // Follow the prints: everyone whose prints are on a weapon of the right type gets dusted.
        const printed = (knownWeaponPrints(game, p)?.prints ?? [])
            .map((n) => game.byName(n))
            .filter((q): q is Participant => !!q && q.alive && q !== p && !b.lifted.has("person:" + q.key));
        if (printed.length && Math.random() < 0.6) {
            const q = pick(printed);
            b.lifted.add("person:" + q.key);
            return go(game, p, b, { kind: "person", key: q.key, then: "lift" });
        }
        const cands = [...game.disturbed].filter((id) => !b.lifted.has("container:" + id)).map((id) => game.containers.get(id)!).filter((c) => c.searchable !== false);
        const at = game.io.pos(p);
        const dist = (c: Container) => (at ? Math.abs(at.x - c.tile.x) + Math.abs(at.y - c.tile.y) : 0);
        if (cands.length && Math.random() < 0.65) {
            const c = cands.sort((a, z) => dist(a) - dist(z))[Math.random() < 0.7 ? 0 : rand(cands.length)];
            b.lifted.add("container:" + c.id);
            return go(game, p, b, { kind: "container", id: c.id, then: "lift" });
        }
        // Patrol: go where people are, and watch.
        const others = game.living().filter((q) => q !== p && !inView(game, p).includes(q));
        if (others.length && Math.random() < 0.6) {
            const q = pick(others);
            const qa = game.io.pos(q);
            if (qa && mover.walkTo(p, qa)) {
                b.idleUntil = game.tick + secToTicks(4 + Math.random() * 6);
                if (chance(0.1 * b.persona.chatty)) say(game, p, b, LINES.detPatrol());
                return;
            }
        }
        if (Math.random() < 0.4) {
            const c = pick([...game.containers.values()].filter((x) => x.searchable !== false));
            b.lifted.add("container:" + c.id);
            return go(game, p, b, { kind: "container", id: c.id, then: "lift" });
        }
        mover.walkTo(p, mover.randomTile());
        b.idleUntil = game.tick + 3 + rand(8);
    }

    // ------------------------------------------------------------ the dinner table
    function alibiLine(game: MurderGame, p: Participant, b: BotState): string {
        const rooms = [...new Set(b.rooms)].slice(-3).map(roomName);
        const chores = b.did.filter((d) => !d.startsWith("searched"));
        const searched = b.did.filter((d) => d.startsWith("searched")).map((d) => d.replace("searched ", ""));
        return LINES.alibi(listJoin(rooms), chores, searched);
    }

    /** Lines a bot will say at the table, built from its own memory. */
    function tableTalk(game: MurderGame, p: Participant, b: BotState): string[] {
        const lines: string[] = [];
        const living = new Set(game.living().filter((q) => q !== p).map((q) => q.name));
        if (sleuth(game, p)) {
            if (p.knownCategory) lines.push(LINES.detWound(p.knownCategory));
            else if (game.caseFile.clues > 0) lines.push(LINES.detMaybe(listJoin(game.caseFile.possible, "or")));
            const w = knownWeaponPrints(game, p);
            if (w) lines.push(LINES.detPrintsWeapon(w.name, listJoin(w.prints)));
            const last = p.notebook.filter((e) => e.round === game.round && e.prints?.length).slice(-1)[0];
            if (last) lines.push(LINES.detPrintsThing(last.target, listJoin(last.prints!)));
            if (!lines.length) lines.push(LINES.detNothing());
            if (chance(0.7)) lines.push(LINES.detAsk());
            return lines;
        }
        // The strongest thing it saw comes first: it's the reason it voted the way it did.
        const ev = strongestSighting(game, p, b, living);
        if (ev) lines.push(ev);
        // Alibi: true for the household; the Murderer tells the truth about rooms (it may have been
        // seen) but never mentions the weapon.
        lines.push(alibiLine(game, p, b));
        if (b.plantedWith) lines.push(LINES.plantedTable(b.plantedWith));
        if (p.role === "murderer" && b.frameTarget && chance(0.5)) {
            const r = b.seen.find((e): e is Extract<Observation, { kind: "rummage" }> => e.kind === "rummage" && e.actor === b.frameTarget);
            lines.push(LINES.frame(b.frameTarget, r?.container ?? "drawers"));
        }
        if (!ev && p.role !== "murderer" && chance(0.4)) lines.push(LINES.nothingSeen());
        return lines;
    }

    function strongestSighting(game: MurderGame, p: Participant, b: BotState, living: Set<string>): string | undefined {
        if (p.role === "murderer") return undefined;
        if (b.sawClaws && living.has(b.sawClaws)) return LINES.sawClawsTable(b.sawClaws);
        if (b.sawEscape && living.has(b.sawEscape.who)) return LINES.sawEscapeTable(b.sawEscape.who, b.sawEscape.what);
        if (b.sawAttack && living.has(b.sawAttack.attacker)) return LINES.sawAttackTable(b.sawAttack.attacker, b.sawAttack.victim);
        if (b.sawPick && living.has(b.sawPick.actor)) return LINES.sawPickTable(b.sawPick.actor, b.sawPick.target === p.name ? "me" : b.sawPick.target);
        const hand = b.seen.filter((e): e is Extract<Observation, { kind: "handoff" }> => e.kind === "handoff" && living.has(e.actor)).pop();
        if (hand) return LINES.sawHandoffTable(hand.actor, hand.target, roomName(hand.room));
        const report = game.lastReport?.round === game.round && game.lastReport.kind === "container" ? game.containers.get(game.lastReport.id) : undefined;
        if (report) {
            const r = b.seen.filter((e): e is Extract<Observation, { kind: "rummage" }> => e.kind === "rummage" && e.container === report.name && living.has(e.actor)).pop();
            if (r) return LINES.sawRummageTable(r.actor, report.name);
        }
        const wield = [...b.sawWield].find(([n]) => living.has(n));
        if (wield) return LINES.sawWieldTable(wield[0], wield[1]);
        return undefined;
    }

    /** Latest print set the Detective knows for a weapon of the type the wound points to. */
    function knownWeaponPrints(game: MurderGame, p: Participant): { name: string; prints: string[] } | undefined {
        let found: { name: string; prints: string[] } | undefined;
        for (const e of p.notebook) {
            for (const w of e.weapons ?? []) if (!p.knownCategory || w.category === p.knownCategory) found = { name: w.name, prints: w.prints };
        }
        for (const w of game.weapons) if (w.real && w.at.kind === "ground") found = { name: w.name, prints: w.prints.list() }; // public reveal
        return found;
    }

    /**
     * What the real players (not bots) are doing with their votes: how many of them have voted for
     * each person, and who they're voting for together, if anyone. Together means at least two of
     * them, more than half of the real players at the table; a lone real player counts only when
     * someone has also accused that person in chat this round.
     */
    function humanTrend(game: MurderGame, p: Participant): { counts: Map<string, number>; trend?: string } {
        const humans = game.living().filter((q) => !q.isBot && q !== p);
        const counts = new Map<string, number>();
        for (const h of humans) {
            const t = game.votes.get(h.key);
            if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        const top = [...counts].sort((a, z) => z[1] - a[1])[0];
        if (!top || top[0] === p.key) return { counts };
        const [key, n] = top;
        const name = game.participants.get(key)?.name;
        const accused = !!name && (chats.get(game) ?? []).some((l) => l.round === game.round && !l.echo && l.accuse.has(name));
        const together = (n >= 2 && n * 2 > humans.length) || (humans.length === 1 && n === 1 && accused);
        return { counts, trend: together ? key : undefined };
    }

    /**
     * Who to vote for, and how sure. No arrest unless something points at someone: what it saw
     * itself, names accused in chat (the Detective's word counts thrice, a name it's been vouched
     * for counts against, a bot repeating how it voted doesn't count) and the real players voting
     * together. Bots never follow each other's votes. The Murderer never votes for itself and leans
     * on whoever it's framing.
     */
    function decideVote(game: MurderGame, p: Participant, b: BotState, first = false): { key: string | null; score: Map<string, number>; trend?: string; reason?: "evidence" | "trend" } {
        const others = game.living().filter((q) => q !== p);
        const score = new Map<string, number>();
        const add = (name: string, n: number) => {
            const q = others.find((x) => x.name === name);
            if (q) score.set(q.key, (score.get(q.key) ?? 0) + n);
        };
        const detective = sleuth(game, p);
        const seen = evidence(game, p, b);
        for (const [name, n] of seen) add(name, detective ? 1.5 * n : n);
        let skips = 0;
        const speakers = new Map<string, Set<string>>();
        for (const line of chats.get(game) ?? []) {
            if (line.round !== game.round || line.speakerKey === p.key || line.echo) continue;
            const w = (line.phase === "arrest" ? 1 : 0.6) * (line.fromDetective ? 3 : 1) * (line.fromBot ? 0.8 : 1);
            for (const n of line.accuse) {
                if (n === p.name) {
                    // Someone accusing an innocent bot may be wrong or framing it: a little suspicious.
                    if (p.role !== "murderer") add(line.speaker, 0.4);
                    continue;
                }
                add(n, 1.5 * w);
                if (!speakers.has(n)) speakers.set(n, new Set());
                speakers.get(n)!.add(line.speaker);
            }
            for (const n of line.defend) add(n, -1.2 * w);
            if (line.skip && line.phase === "arrest") skips++;
        }
        // A name several people bring up independently is worth more than one person repeating it.
        for (const [n, s] of speakers) if (s.size > 1) add(n, s.size - 1);
        // The real players' votes sway it (the easily led most); other bots' votes don't.
        const { counts, trend } = humanTrend(game, p);
        const g = b.persona.gullible;
        for (const [key, n] of counts) {
            if (key === p.key || !others.some((q) => q.key === key)) continue;
            score.set(key, (score.get(key) ?? 0) + n * (p.role === "murderer" ? 2 : 1.2 * (0.5 + g)) + (key === trend ? 2 : 0));
        }
        if (p.role === "murderer") {
            const frame = others.find((q) => q.name === b.frameTarget);
            if (frame) score.set(frame.key, (score.get(frame.key) ?? 0) + 4);
        }
        // It takes something real to vote anyone out; a first vote, cast early, a little more.
        const threshold = (detective ? 2 : p.role === "murderer" ? 2 : 3.5 - 1.5 * g + Math.min(2, 0.4 * skips)) + (first ? 1 : 0);
        const best = [...score].sort((a, z) => z[1] - a[1])[0];
        const key = best && best[1] >= threshold ? best[0] : null;
        if (!key) return { key: null, score, trend };
        // Why, if it were to change its mind to them: the real players together, or evidence (its
        // own, or the Detective naming them since it voted).
        const name = game.participants.get(key)?.name ?? "";
        const named = (chats.get(game) ?? []).some((l) => l.round === game.round && l.fromDetective && l.speakerKey !== p.key && l.tick > b.voteAt && l.accuse.has(name));
        const reason = key === trend ? "trend" : (seen.get(name) ?? 0) >= 4 || named ? "evidence" : undefined;
        return { key, score, trend, reason };
    }

    function arrestThink(game: MurderGame, p: Participant, b: BotState): void {
        if (b.tableLines.length && game.tick >= b.nextLineAt && !b.outbox.length) {
            // Type the next line; after it's sent, a pause to read what others said.
            const line = b.tableLines.shift()!;
            say(game, p, b, line, {
                then: () => {
                    b.nextLineAt = game.tick + secToTicks(3 + Math.random() * 6);
                },
            });
            b.nextLineAt = Number.MAX_SAFE_INTEGER;
        }
        // The Murderer sees the pile turning on it: time to make a fuss.
        if (p.role === "murderer" && !b.pleaded && (game.voteTally().counts.get(p.key) ?? 0) >= game.votesNeeded() - 1) {
            b.pleaded = true;
            const other = b.frameTarget ?? otherName(game, p);
            if (other) say(game, p, b, LINES.pileOnMe(other), { urgent: true });
        }
        if (game.tick < b.voteAt) return;
        if (!b.voted) {
            b.voted = true;
            b.voteAt = game.tick;
            b.nextEvalAt = game.tick + secToTicks(2.5 + Math.random() * 3);
            const { key } = decideVote(game, p, b, true);
            castVote(game, p, b, key, "first");
            return;
        }
        if (game.tick < b.nextEvalAt) return;
        b.nextEvalAt = game.tick + secToTicks(2.5 + Math.random() * 3);
        if (b.voteChanges >= C.bots.maxVoteChanges || game.phaseEnds - game.tick < secToTicks(2)) return;
        // Its vote stands unless something new comes up: evidence, or the real players voting
        // together. Even then it doesn't always budge.
        const { key, score, reason } = decideVote(game, p, b);
        if (key === b.myVote || key === null || !reason) return;
        // Changing one's mind takes a clear lead over what it voted for.
        const now = b.myVote ? score.get(b.myVote) ?? 0 : 0;
        if ((score.get(key) ?? 0) < now + 2) return;
        // Late on, only the real players voting together moves it: no last-second pile-ons.
        if (reason !== "trend" && game.phaseEnds - game.tick < secToTicks(15)) return;
        if (!chance(C.bots.voteChangeChance)) return;
        b.voteChanges++;
        castVote(game, p, b, key, reason === "trend" ? "pile" : "change");
    }

    /** Put the vote in, and (often) say so. The Detective always explains itself. */
    function castVote(game: MurderGame, p: Participant, b: BotState, key: string | null, why: "first" | "change" | "pile"): void {
        if (game.phase !== "arrest") return;
        const prev = b.myVote;
        b.myVote = key;
        if (game.vote(p, key)) return; // it didn't count (they left the table): nothing to say
        const q = key ? game.participants.get(key) : undefined;
        if (sleuth(game, p) && q) {
            const said = new Set((chats.get(game) ?? []).filter((l) => l.round === game.round && !l.echo && l.accuse.has(q.name)).map((l) => l.speaker)).size;
            const set = knownWeaponPrints(game, p)?.prints;
            const reason = b.sawClaws === q.name ? "claws" : set?.includes(q.name) ? "prints" : said > 1 ? "many" : said === 1 ? "one" : "hunch";
            b.outbox = b.outbox.filter((l) => !l.then); // the case comes first
            say(game, p, b, `${LINES.detAccuse(q.name, reason, p.knownCategory)}. ${pick(["I vote to arrest you", "my vote's on you", "you're under arrest"])}`, { urgent: true });
            return;
        }
        // Saying how it voted is just that: the others don't take it as another accusation.
        if (why === "first") {
            if (q && chance(0.55)) say(game, p, b, LINES.vote(q.name), { reply: true, echo: true });
            else if (!q && chance(0.3)) say(game, p, b, LINES.voteSkip(), { reply: true, echo: true });
        } else if (q && prev !== key && chance(0.65)) {
            say(game, p, b, why === "pile" ? LINES.votePile(q.name) : LINES.voteChange(q.name), { reply: true, echo: true });
        }
    }

    function nearestContainer(game: MurderGame, p: Participant, searchableOnly = false): Container {
        const at = game.io.pos(p);
        const all = [...game.containers.values()].filter((c) => !searchableOnly || c.searchable !== false);
        if (!at) return all[0];
        return all.sort((a, z) => Math.abs(at.x - a.tile.x) + Math.abs(at.y - a.tile.y) - (Math.abs(at.x - z.tile.x) + Math.abs(at.y - z.tile.y)))[0];
    }

    return { think, observe, activity, hear, wantedWare };
}
