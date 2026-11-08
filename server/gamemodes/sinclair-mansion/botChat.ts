// What the bots say, and how they say it. Every bot has a persona: a way of typing (proper,
// casual, loud or dry), how chatty, brave and easily led it is, and how often it fat-fingers a
// word (and then corrects itself with "*word", as people do). The lines themselves are pools
// to pick from, filled in with names, rooms and things the bot actually did or saw, so table
// talk is still evidence: just evidence with a sense of humour.

export type Style = "proper" | "casual" | "loud" | "dry";

export interface Persona {
    style: Style;
    /** 0.5 (quiet) .. 1.5 (never shuts up): scales how often it talks for no reason. */
    chatty: number;
    /** 0 (runs from everything) .. 1 (picks up a mace and charges). */
    brave: number;
    /** 0 (needs proof) .. 1 (joins any bandwagon). */
    gullible: number;
    /** Chance a line goes out with a typo in it. */
    typos: number;
}

const rand = (n: number) => Math.floor(Math.random() * n);
export const pick = <T>(a: readonly T[]): T => a[rand(a.length)];
const chance = (p: number) => Math.random() < p;

export function makePersona(): Persona {
    const style = pick<Style>(["proper", "casual", "casual", "loud", "dry"]);
    return {
        style,
        chatty: 0.5 + Math.random(),
        brave: Math.random(),
        gullible: Math.random(),
        typos: style === "proper" ? 0.02 : style === "casual" ? 0.1 : 0.06,
    };
}

/** "Anna and Bob", "Anna, Bob and Carol". */
export const listJoin = (a: string[], last = "and") => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} ${last} ${a[a.length - 1]}`);
/** "the kitchen", but "David's Room" without the article. */
export const theRoom = (room: string) =>
    room.includes("'s ") ? room : `the ${room.toLowerCase()}`;
const lower = (s: string) => s.toLowerCase();

// ---------------------------------------------------------------- how it's typed

const KEY_WORDS = /claw|murder|kill|vote|voting|skip|arrest|prints|detective/i;

function typo(word: string): string {
    const i = 1 + rand(word.length - 2);
    return word.slice(0, i - 1) + word[i] + word[i - 1] + word.slice(i + 1);
}

/**
 * Say a line the way this persona types it. Returns the line(s) to send: sometimes a second,
 * "*word", correcting a typo in the first.
 */
export function voice(text: string, persona: Persona, urgent = false): string[] {
    let t = text.trim();
    switch (persona.style) {
        case "proper":
            t = t[0].toUpperCase() + t.slice(1);
            if (!/[.!?)]$/.test(t)) t += urgent ? "!" : ".";
            break;
        case "casual":
            t = t.toLowerCase().replace(/\.$/, "");
            if (chance(0.25)) t = t.replace(/\byou\b/g, "u").replace(/\bare\b/g, "r");
            if (chance(0.15)) t = t.replace(/\bbecause\b/g, "cuz").replace(/\bprobably\b/g, "prob");
            if (!urgent && chance(0.12) && !/lol|lmao|\?$/.test(t)) t += pick([" lol", " lmao", " tbh", " ngl"]);
            break;
        case "loud":
            t = t[0].toUpperCase() + t.slice(1);
            if (urgent) t = t.toUpperCase().replace(/[.!]*$/, pick(["!!", "!!!", "!"]));
            else if (/[.]$/.test(t) && chance(0.4)) t = t.replace(/\.$/, "!");
            break;
        case "dry":
            t = t.toLowerCase().replace(/[.!]+$/, "");
            break;
    }
    // Nobody fumbles a shout for help, and the words that matter (names, claws, votes) come out right.
    if (urgent || !chance(persona.typos)) return [t];
    const words = t.split(" ");
    const original = text.split(/\s+/);
    const idx = words
        .map((w, i) => (/^[a-z]{4,}$/i.test(w) && !KEY_WORDS.test(w) && !original.some((o) => /^[A-Z]/.test(o) && o.toLowerCase().startsWith(w.toLowerCase())) ? i : -1))
        .filter((i) => i >= 0);
    if (!idx.length) return [t];
    const i = pick(idx);
    const fixed = words[i];
    words[i] = typo(fixed);
    if (words[i] === fixed) return [t];
    return chance(0.6) ? [words.join(" "), `*${lower(fixed)}`] : [words.join(" ")];
}

// ---------------------------------------------------------------- the lines

/** Every line takes what it needs and picks one way to say it. */
export const LINES = {
    greet: (someone: string) => pick([
        "gl everyone. except the murderer",
        "ok whoever did it just say so, saves us all time",
        "right. nobody touch anything",
        "poor Lord Sinclair. anyway, chores",
        `if I die, it was ${someone}`,
        "I have a very bad feeling about this house",
        "rip Lord Sinclair, he still owed me money",
        "who even murders someone before dinner",
        "not me. just putting that out there",
        "everyone stay in pairs please",
        "I knew we should've eaten at the pub",
        "stay away from me, all of you. nothing personal",
        `${someone}, you look guilty. just saying`,
        "the guard said the killer's at this table. awkward",
    ]),
    roundStart: (n: number, someone: string) => pick([
        `round ${n}. still alive, somehow`,
        "ok this round we actually find them",
        "stick together this time",
        "I'm watching all of you",
        "back to the chores I suppose",
        `${someone}, I've got my eye on you`,
        "if anyone needs me I'll be hiding behind the cow",
        "fresh round, fresh suspicion",
    ]),
    banter: (someone: string) => pick([
        "why does a mansion this big only own one bucket",
        "the butler keeps staring at me",
        "anyone else think the cow knows something",
        "if I get murdered, tell the cow I loved her",
        "these chores were not in my contract",
        "this house has far too many drawers",
        "has anyone checked the cellar? not volunteering, just asking",
        "I swear this house is haunted. well. it will be",
        "Lord Sinclair would have wanted us to keep sweeping. probably",
        `${someone}, you're being very quiet`,
        `${someone}, what are you up to`,
        `${someone}, stop following me`,
        "I trust nobody. except maybe the dog",
        "does anyone actually know how to churn butter",
        "a demon butler. in this economy",
        "I've done more chores today than in my whole life",
        `${someone} has the shifty eyes. I'm just saying`,
        "honestly the real crime is the state of this kitchen",
        "if the murderer could do the dishes that'd be great",
        "anyone else's legs tired? no? just me",
        `nice outfit ${someone}. very murderer chic`,
        "I'm not scared. you're scared",
    ]),
    choreDone: (did: string) => pick([
        `just ${did}. riveting stuff`,
        `${did}. the glamour of aristocracy`,
        `done: ${did}. someone pay me`,
        `${did}, if anyone needs an alibi`,
        `there, I've ${did}`,
        `${did}. I deserve a medal`,
        `${did}. what a time to be alive`,
    ]),
    goingAfk: () => pick([
        "brb, this takes a while",
        "going afk for a sec, guard me",
        "don't murder me while I do this pls",
        "this'll take a bit. if I die, avenge me",
        "back in a moment, nobody steal my stuff",
    ]),
    foundWeapon: (weapon: string, where: string) => pick([
        `uh. found a ${lower(weapon)} in ${where}`,
        `why was there a ${lower(weapon)} in ${where}??`,
        `ok who put a ${lower(weapon)} in ${where}`,
        `well that's not supposed to be in ${where}. a ${lower(weapon)}`,
        `${where} had a ${lower(weapon)} in it. totally normal house`,
    ]),
    planted: (weapon: string) => pick([
        `wait... why is there a ${lower(weapon)} in my bag`,
        `uh guys. I did not pick up this ${lower(weapon)}`,
        `someone put a ${lower(weapon)} in my pack while I wasn't looking`,
        `I'm being framed. there's a ${lower(weapon)} in my inventory and it's not mine`,
        `where did this ${lower(weapon)} come from?? I was busy`,
    ]),
    received: (giver: string, weapon: string) => pick([
        `${giver} why did you give me a ${lower(weapon)}`,
        `uh thanks ${giver}? what am I meant to do with this`,
        `${giver} just handed me a ${lower(weapon)}. noted`,
        `${giver}, I don't want your ${lower(weapon)}`,
    ]),
    sawHandoff: (actor: string, target: string) => pick([
        `did ${actor} just hand something to ${target}?`,
        `${target}, what did ${actor} just give you`,
        `uhh ${actor}, what was that you gave ${target}`,
        `${actor} slipping ${target} something. very subtle`,
    ]),
    sawWielding: (who: string, weapon: string) => pick([
        `${who}, why are you holding a ${lower(weapon)}`,
        `${who} put the ${lower(weapon)} down please`,
        `nice ${lower(weapon)} ${who}. totally normal`,
        `${who} walking around with a ${lower(weapon)}. cool cool cool`,
    ]),
    caughtPicking: (who: string) => pick([
        `oi! ${who}, get your hand out of my pocket`,
        `${who} just tried to pickpocket me!`,
        `hey! hands off, ${who}`,
        `${who} what are you doing in my bag??`,
    ]),
    sawPickpocket: (actor: string, target: string) => pick([
        `${actor} just went through ${target}'s pockets!`,
        `${target}, check your pack. ${actor} was in it`,
        `did ${actor} just pickpocket ${target}?`,
    ]),
    weaponGone: (weapon: string) => pick([
        `wait. where did that ${weapon.toLowerCase()} go? it was in my bag`,
        `ok the ${weapon.toLowerCase()} in my pack is GONE now. this house is cursed`,
        `someone took the ${weapon.toLowerCase()} back out of my bag while I was busy`,
    ]),
    sawPickTable: (actor: string, target: string) => pick([
        `${actor} tried to pick ${target === "me" ? "my" : target + "'s"} pocket. explain that`,
        `I caught ${actor} with a hand in ${target === "me" ? "my" : target + "'s"} pack`,
    ]),
    sawEscape: (who: string, what: string) => pick([
        `${who} is messing with the ${lower(what)}!`,
        `uh, ${who}? why are you breaking the ${lower(what)}`,
        `${who} is trying to get out through the ${lower(what)}!!`,
    ]),
    // Shouts are short: nobody types a paragraph with claws coming at them.
    clawsFight: (who: string) => pick([
        `${who} has claws! get them!`,
        `claws! it's ${who}!`,
        `${who} has claws, get em`,
        `it's ${who}! claws!`,
    ]),
    clawsRun: (who: string) => pick([
        `run! ${who} has claws`,
        `${who} has claws!! help`,
        `help! claws! ${who}!`,
        `${who} = claws. RUN`,
        `nope. ${who} has claws`,
    ]),
    sawAttack: (attacker: string, victim: string) => pick([
        `${attacker} is attacking ${victim}!`,
        `${attacker} stop!! leave ${victim} alone`,
        `help ${victim}, ${attacker} is going for them`,
        `${attacker} just jumped ${victim}!`,
    ]),
    attacked: (who: string) => pick([
        `help! ${who} is attacking me`,
        `${who} what are you doing`,
        `get off me ${who}!`,
        `ow. ${who}. why`,
        `${who} is trying to kill me!!`,
    ]),
    bindRun: (who: string) => pick([
        `bound you ${who}. bye`,
        "nope. bind and run",
        `stay there ${who}!`,
        `get away from me ${who}!`,
    ]),
    defendOther: (who: string) => pick([
        `unhand them, ${who}!`,
        `back off ${who}!`,
        `${who}, you'll answer for that`,
        `oi ${who}! pick on someone your own size`,
    ]),
    deathNoticed: () => pick([
        "uh... did someone just die?",
        "we're one short. that's not good",
        "someone's dead, aren't they",
        "anyone else see the count go down??",
        "oh no. who was that",
        "that's another one gone. great",
    ]),
    kitTaken: () => pick([
        "the detective's dead. I've got the flypaper now",
        "I'll take it from here. detective's down",
        "found the detective's things. guess I'm the detective now",
    ]),
    // ------------------------------------------- the Detective
    detFrisk: (who: string) => pick([
        `hold still ${who}. routine search`,
        `pockets, ${who}. now`,
        `${who}, empty your pockets please`,
        `just a quick search ${who}. nothing personal`,
    ]),
    detFriskFound: (weapon: string) => pick([
        `well well well. a ${lower(weapon)}`,
        `and what's this? a ${lower(weapon)}`,
        `confiscated: one ${lower(weapon)}. interesting`,
    ]),
    detFriskClean: (who: string) => pick([
        `${who}'s clean. for now`,
        `nothing on ${who}`,
        `clean. carry on ${who}`,
    ]),
    detScene: () => pick([
        "studying the body. nobody touch it",
        "let's see what the wound tells us",
        "back to the body. there's always more",
    ]),
    detDust: (what: string) => pick([
        `dusting ${what} for prints. stand back`,
        `let's see who's been at ${what}`,
        `prints on ${what}, please be interesting`,
    ]),
    detPatrol: () => pick([
        "carry on. I'm just watching",
        "don't mind me. just detecting",
        "everyone act natural",
        "I see everything. mostly",
    ]),
    detEye: (who: string) => pick([
        `keeping an eye on you, ${who}`,
        `${who}, I'll want a word at dinner`,
        `${who}... interesting`,
    ]),
    // ------------------------------------------- answering back
    defend: (accuser: string, alibi: string) => pick([
        "wasn't me!",
        `me?? ${alibi}`,
        `bold of you, ${accuser}`,
        `${accuser}, that's exactly what the murderer would say`,
        "I'm innocent, I swear on the cow",
        "nope. check my prints, detective",
        "ok but why would I",
        `no u ${accuser}`,
        `${alibi} so no`,
        `${accuser} you've been weird all game`,
    ]),
    deflect: (accuser: string, alibi: string, other: string) => pick([
        `me? ${alibi} ask ${other}`,
        `I've been doing chores all round. ${other} on the other hand...`,
        `funny, ${accuser} is very quick to blame people`,
        `classic murderer move, accusing first. right ${accuser}?`,
        `it's not me. watch ${other}`,
        `${alibi} meanwhile where was ${other}?`,
    ]),
    answer: (alibi: string) => pick([
        alibi,
        `${alibi} why?`,
        `me? ${alibi}`,
    ]),
    // ------------------------------------------- the dinner table
    opener: () => pick([
        "ok",
        "right, so",
        "well that was a round",
        "nobody panic",
        "so who's lying",
        "I have thoughts",
        "ok who wants to start",
        "dinner and a murder. lovely",
        "everyone sit, let's sort this",
    ]),
    detOpener: () => pick([
        "alright, listen up",
        "settle down. I've got notes",
        "I've been busy. let's talk",
    ]),
    vote: (who: string) => pick([
        `voting ${who}`,
        `${who}. final answer`,
        `I'm going ${who}`,
        `my vote's on ${who}`,
        `${who}, sorry not sorry`,
    ]),
    voteSkip: () => pick([
        "skipping for now",
        "no idea yet, skip",
        "not voting anyone without evidence",
        "skip till someone says something useful",
    ]),
    voteChange: (who: string) => pick([
        `changed to ${who}`,
        `ok fine, switching to ${who}`,
        `you've convinced me. ${who}`,
        `${who}'s looking worse by the second. switched`,
    ]),
    votePile: (who: string) => pick([
        `everyone's on ${who}... I'll go with it`,
        `ok the table has spoken. ${who}`,
        `bandwagon time. ${who}`,
        `fine, ${who}. if we're wrong I'm blaming all of you`,
    ]),
    pileOnMe: (other: string) => pick([
        `guys it's NOT me. it's ${other}`,
        `you're about to arrest an innocent person. look at ${other}`,
        `seriously? me? ${other} has been sketchy all game`,
        "this is a mistake and you'll all feel terrible",
    ]),
    alibi: (rooms: string, chores: string[], searched: string[]) => {
        const did = chores.length ? listJoin(chores.slice(-2)) : searched.length ? `went through ${listJoin(searched.slice(-2))}` : "";
        if (!rooms && !did) return pick(["I barely moved all round", "honestly I mostly stood around", "I was just wandering, sorry"]);
        if (!did) return pick([`I was in ${rooms}`, `${rooms} mostly`, `spent the round in ${rooms}`]);
        if (!rooms) return pick([`I ${did}`, `I ${did}, riveting stuff`]);
        return pick([
            `I was in ${rooms}. I ${did}`,
            `${rooms} mostly. ${did}`,
            `I ${did}. riveting stuff. was in ${rooms}`,
            `spent the round in ${rooms}, ${did}`,
            `I ${did} in ${rooms}. ask anyone`,
        ]);
    },
    nothingSeen: () => pick([
        "didn't see anything weird",
        "nothing to report. boring round",
        "saw nothing, heard nothing",
        "I've got nothing, sorry",
    ]),
    resultInnocent: (who: string, murderer: boolean) => murderer
        ? pick([`oh no. anyway`, `rip ${who}, gone but not forgotten`, `well that's a shame. moving on`, `sorry ${who} :(`])
        : pick([`rip ${who}`, "oops.", `sorry ${who} :(`, "well. that was wrong", `that's on us. sorry ${who}`, "great job everyone. really"]),
    // ------------------------------------------- accusations (evidence)
    sawClawsTable: (who: string) => pick([
        `I saw ${who} with dragon claws. only the murderer has those`,
        `${who} had claws out. it's ${who}, it's obvious`,
        `I literally saw ${who} with claws. vote ${who}`,
    ]),
    sawAttackTable: (attacker: string, victim: string) => pick([
        `${attacker} attacked ${victim}, I saw it`,
        `I watched ${attacker} go for ${victim}. explain that`,
        `${attacker} jumped ${victim} in front of me`,
    ]),
    sawEscapeTable: (who: string, what: string) => pick([
        `${who} was messing with the ${lower(what)}. who does that`,
        `I caught ${who} at the ${lower(what)}. trying to get out?`,
    ]),
    sawHandoffTable: (actor: string, target: string, room: string) => pick([
        `I saw ${actor} hand something to ${target} in ${room}`,
        `${actor} slipped something to ${target} in ${room}. what was it?`,
        `${target}, what did ${actor} give you in ${room}? I saw that`,
    ]),
    sawRummageTable: (who: string, what: string) => pick([
        `${who} was at the ${lower(what)} right before the weapon turned up there`,
        `I saw ${who} at the ${lower(what)}. that's where it was found`,
    ]),
    sawWieldTable: (who: string, weapon: string) => pick([
        `${who} was walking around with a ${lower(weapon)}`,
        `why did ${who} have a ${lower(weapon)} out?`,
    ]),
    plantedTable: (weapon: string) => pick([
        `someone planted a ${lower(weapon)} on me during my chore. I'm being framed`,
        `I found a ${lower(weapon)} in my bag I never picked up. the murderer's framing me`,
    ]),
    frame: (who: string, what: string) => pick([
        `I saw ${who} creeping around with something. check them`,
        `${who} was going through the ${lower(what)} for ages`,
        `${who} has been acting really weird`,
        `my gut says ${who}. they keep sneaking off alone`,
        `${who} was alone a lot this round. just saying`,
    ]),
    // ------------------------------------------- the Detective at the table
    detWound: (category: string) => pick([
        `the wound says ${category}. who's been carrying one?`,
        `it was a ${category}. I'd stake my badge on it`,
        `we're looking for a ${category}`,
    ]),
    detMaybe: (types: string) => pick([
        `the body says ${types}. I need more time with it`,
        `could be ${types}. not sure yet`,
    ]),
    detPrintsWeapon: (weapon: string, names: string) => pick([
        `prints on the ${lower(weapon)}: ${names}`,
        `the ${lower(weapon)} has ${names}'s prints on it`,
    ]),
    detPrintsThing: (thing: string, names: string) => pick([
        `dusted the ${lower(thing)}: ${names} touched it`,
        `${names} had their hands on the ${lower(thing)}`,
    ]),
    detNothing: () => pick([
        "no hard evidence yet. convince me",
        "nothing solid. tell me what you saw",
        "my notebook's thin this round. talk",
    ]),
    detAsk: () => pick([
        "where was everyone? speak up",
        "alibis, people",
        "who saw what?",
    ]),
    detAccuse: (who: string, why: "prints" | "many" | "one" | "claws" | "hunch", category?: string) => {
        if (why === "prints") return pick([`your prints are on a ${category ?? "weapon"} like the one that did this, ${who}`, `${who}, the prints don't lie`]);
        if (why === "claws") return pick([`${who} had dragon claws. case closed`, `claws, ${who}. you're done`]);
        if (why === "many") return pick([`too many of you saw ${who} up to something`, `everyone's pointing at ${who}. so am I`]);
        if (why === "one") return pick([`somebody saw you up to something, ${who}`, `${who}, you were seen`]);
        return pick([`call it a hunch, ${who}`, `${who}. detective's instinct`]);
    },
};
