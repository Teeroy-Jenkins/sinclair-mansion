// All Murder at Sinclair Mansion tunables. Times are in seconds unless noted;
// the game converts them to 600 ms ticks.
export const MURDER_CONFIG = {
    lobby: {
        minPlayers: 4,
        /** The most a host can set their lobby to (humans and bots together). */
        maxPlayers: 10,
        /** A new lobby's player cap, before the host changes it. */
        defaultTotalPlayers: 8,
        /** Players don't choose roles. Tests (and SINCLAIR_ROLE_PICK=1) can, to force a setup. */
        allowRolePick: process.env.SINCLAIR_ROLE_PICK === "1",
        lobbyNameMax: 24,
        passwordMax: 20,
        /** A player who drops mid-game keeps their role this long; log back in with the same name. */
        reconnectGraceSec: 90,
    },
    roles: {
        playersPerMurderer: 9, // 1 murderer per ~8-10 players, minimum 1
    },
    round: {
        /** The opening cutscene: the household at the dinner table, the murder and the Detective announced. */
        introSec: 20,
        investigationSec: 180,
        freezeSec: 5,
        arrestSec: 60, // seated around the dining table: time to talk it over
        resultSec: 8,
        // No round limit: the Murderer wins by escaping (see murderer.escape*) or by being the last
        // one alive; the household wins by arresting or killing them.
    },
    /**
     * The opening cutscene's timeline, in seconds from its start. The client (MurderFade.tsx) fades
     * to black (1.4 s), shows the title, and fades in on the first shot at 4.2 s (clear by 5.6 s).
     * The household is seated and the first shot's camera cut in at `seatSec`, under the black.
     * Each shot lasts until its entry in `shotEndsSec`; the last one until `round.introSec`.
     */
    intro: {
        seatSec: 2.4,
        shotEndsSec: [10, 15],
    },
    detective: {
        liftSec: 30, // ~40 s with walking => ~4 lifts per round
        /** Stop and Search (once a round): a quick frisk that confiscates any weapon from the pool. */
        stopSearchSec: 3,
        /**
         * Studying the crime scene takes a while and yields one clue per round. Clues rule out
         * weapon types until one is left: one clue per this many players (min 2, max 4).
         */
        inspectSec: 25,
        playersPerClue: 3,
        minClues: 2,
        maxClues: 4,
    },
    murderer: {
        handoffSec: 3,
        /** Slipping the weapon into the pack of someone whose screen is black (a chore's long moment). */
        plantSec: 1.8,
        /**
         * Escaping: work at a way out (front gate with a lockpick, a garden wall with a chisel) once
         * a round. It takes this many times the Detective's clue count (rounded up) to get through.
         */
        escapeRoundsPerClue: 1.5,
        escapeSec: 12,
    },
    weapons: {
        /** Red herrings hidden in furniture: this many per member of the household (at least 1). */
        redHerringsPerHousehold: 0.5,
    },
    items: {
        /** A chore tool (or lockpick, or chisel) picked up off the floor reappears there after this long. */
        respawnSec: 8,
    },
    interact: {
        searchSec: 1.8,
        stashSec: 1.2,
    },
    tasks: {
        /** Chores on the go at once; finishing one deals another, so there's no limit per round or game. */
        atOnce: 3,
        /**
         * Every chore has one long step (watering the plants, waiting for the bread to bake) where
         * the screen fades to black with a caption for this long. The chore-doer can't see or move,
         * and dying doesn't cut it short: it's the Murderer's moment.
         */
        fadeSec: 12,
    },
    /** Rewards, paid in gold coins into your inventory. Coins stay with you from game to game. */
    coins: {
        /** A finished chore pays this per step it had, rounded (a 2-step chore 15, a 4-step one 30). */
        chorePerStep: 25,
        findWeapon: 10,
        reportWeapon: 20,
        /** Finding a body (Lord Sinclair's or a victim's) and reporting it. */
        reportBody: 20,
        inspectScene: 40,
        liftPrints: 15,
        stashWeapon: 50,
        handOff: 100,
        surviveRound: 25,
        murdererKill: 80,
        killMurderer: 150,
        /** Paid to each player who voted to arrest the Murderer. */
        correctArrest: 200,
        detectiveWins: 100,
        householdWins: 100,
        murdererWins: 200,
    },
    /** Coins taken away (from the pack, then the bank; never below none). */
    penalties: {
        /** The Detective or a household member kills someone who wasn't the Murderer. */
        killInnocent: 150,
    },
    /**
     * PvP. Everyone always has the same mid-level combat stats, every game and every round. Only
     * the Detective wears gear; the Murderer has the murder weapon and dragon claws; everyone else
     * has to find a red herring weapon to fight back.
     */
    pvp: {
        /**
         * Hitpoints are set so the Murderer's opening (a dragon claws special, then one hit with
         * the murder weapon) kills an unarmed household member most of the time, about 4 in 5
         * (tests/sinclair-mansion-balance.test.ts; --search recomputes it). Prayer 22 tops out at
         * Rapid Heal (no protection prayers).
         */
        stats: { attack: 70, strength: 75, defence: 70, magic: 70, hitpoints: 40 },
        /** Helm, cape, amulet, weapon, body, shield, legs, gloves, boots (0 = empty): all wearable at 70. */
        // No helmet, gloves, boots, off-hand or ring (-1 leaves the slot empty): fire cape, fury, whip, torso, dragon legs
        detectiveGear: [-1, 6570, 6585, 4151, 10551, -1, 4087, -1, -1],
        prayer: 22,
        dragonClaws: 13652,
        /** Special attack energy (percent) the dragon claws special costs. */
        clawsSpecCost: 70,
        /** Chance per second that a bot Murderer goes for someone alone with them. */
        botMurderChance: 0.04,
    },
    /**
     * Chore tokens: a finished chore pays `perStep` for each of its steps, to spend with the Demon
     * butler in the dining room (butler.ts). They stay with you when you die and are gone when the
     * game ends.
     */
    tokens: {
        itemId: 8851, // the cache's stackable "Warrior guild token", renamed (butler.ts)
        name: "Sinclair Family IOU",
        examine: "The family promises to pay. The Demon butler honours it.",
        perStep: 1,
        /** The butler's base prices; each goes up by one per three members of the household (butler.ts). */
        basePrice: { stamina: 1, runes: 3, shark: 6, potion: 10 },
    },
    /**
     * Nobody starts with food or runes. The Demon butler sells these for chore tokens, so the
     * household earns its way to fighting back.
     */
    rewards: {
        shark: 385,
        /** A shark heals 20, as in OSRS (2009scape's Consumables). */
        sharkHeal: 20,
        /** The "rune pouch": runes for one Bind (earth, water, nature). */
        runes: [[557, 3], [555, 3], [561, 2]] as Array<[number, number]>,
        /** Prayer potion (1): drinking it puts Protect from Melee up for `protectTicks`, at any Prayer level. */
        prayerPotion: 143,
        emptyVial: 229,
        /** Stamina potion (1), as in OSRS: +20% run energy, and run energy drains 70% slower for 2 minutes. */
        staminaPotion: 12631,
        staminaRestorePercent: 20,
        staminaDrainMultiplier: 0.3,
        staminaTicks: 200, // 2 minutes
        protectTicks: 6, // 3.6 s
    },
    /** Tiles within which (and in the same room) people notice a hand-off or a lift. */
    witnessRadius: 10,
    bots: {
        reportChance: 0.85,
        /** Bots pick up items off the floor at most once every this many ticks (a person's click rate). */
        pickupEveryTicks: 2,
        /** Every bot waits this many seconds (min..max) after sitting down at the table before its first vote. */
        voteDelaySec: [12, 20] as [number, number],
        /** A bot changes its vote at most this many times a table. */
        maxVoteChanges: 2,
        /** Murderer bots: chance they plan to escape (the rest plan to kill). */
        murdererEscapeChance: 0.5,
        /** Killer Murderer bots that keep the murder weapon on them to fight with. */
        killerKeepsWeaponChance: 0.3,
        /** Chance a Murderer bot plants the weapon on someone (in their chore's black screen) rather than hiding it. */
        plantChance: 0.15,
    },
};

// SINCLAIR_FAST=1 shortens rounds for quick local testing (this file stays the source of truth).
if (process.env.SINCLAIR_FAST === "1") {
    Object.assign(MURDER_CONFIG.round, { investigationSec: 60, arrestSec: 40, resultSec: 5 });
    Object.assign(MURDER_CONFIG.tasks, { fadeSec: 6 });
}

export type MurderConfig = typeof MURDER_CONFIG;

export const secToTicks = (sec: number): number => Math.max(1, Math.round((sec * 1000) / 600));
