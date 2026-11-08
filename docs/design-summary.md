# Murder at Sinclair Mansion: Design Summary

A short overview of how the game plays. The complete rules, with every number and the files
behind them, are in [`server/gamemodes/sinclair-mansion/README.md`](https://github.com/Teeroy-Jenkins/sinclair-mansion/blob/main/server/gamemodes/sinclair-mansion/README.md).
Tunables live in `server/gamemodes/sinclair-mansion/config.ts`.

## Overview

A multiplayer hidden-role deduction game (think *Among Us* or *Town of Salem*) built as a
gamemode on the XRSPS OSRS-style engine. It plays in OSRS's real Sinclair Mansion north of
Camelot, both floors and the walled grounds, with OSRS models, menus, combat and chat.

Lord Sinclair has been murdered, and one of the household did it. Everyone else does their
chores, gathers clues and argues it out at the dinner table. Nothing from the original Murder
Mystery quest's fixed solution is used: the killer, the weapon and the crime scene change every
game.

## Roles

Roles are dealt at random; nobody picks one. A game has 4–10 players (people and bots together).

| Role | Who | Goal |
|---|---|---|
| **Household** | Everyone else | Arrest or kill the Murderer. Do chores, watch each other, give alibis, vote. |
| **Murderer** | One player, secret | Be the last one alive, or escape the grounds. Does chores too, as cover. |
| **Detective** | One player, never announced | Part of the household. Whoever holds the **flypaper** is the Detective. |

## A round

1. **Opening cutscene** (first round only, 20 s): everyone is seated at the dinner table, the
   Murder Mystery guard bursts in with the news of the murder and warns there's a detective among
   them, without saying who. He doesn't say where the body is.
2. **The body** lies somewhere different each game (kitchen, drawing room, entrance hall, West
   Yard, garden, library or David's room). Nobody knows where until someone finds it and
   **reports** it (a one-time left-click); then the whole house is told who found it and where.
3. **Investigation** (3 min): chores, clue gathering, fights and kills. Each player may **Ring**
   the grandfather clock once per game to end it early.
4. **The clock strikes**: the screen fades to black and everyone is seated at the dining table.
5. **The dinner table** (60 s): talk in chat, then everyone alive votes from the overlay's vote
   panel. Once more than half of the living's votes are on one person, or everyone has voted, the
   table waits 20 s (votes can still be changed), then arrests whoever has more than half;
   otherwise nobody is arrested. The panel shows the running totals, never who voted for whom.
   An arrest plays a short cutscene: the Detective (or, with no Detective, someone who voted for
   them) walks over and takes them away, and only then is it said whether they did it.
   Run energy is not topped up between rounds.

There is no round limit. Rounds repeat until the Murderer is arrested or killed (the household
wins), or the Murderer escapes or is the last one alive (the Murderer wins). Kills are never
announced: the victim is told, everyone else only sees the living count drop.

## The Murderer

- Starts with the **murder weapon** (picked at random each game from a pool of rune and dragon
  daggers, scimitars, longswords, battleaxes, maces and the granite maul), with their prints on
  it for good, and **dragon claws**.
- **Stash it**: Use the weapon on furniture with a search-type option. Whoever searches there
  later takes it, and the whole house is told who found what, and where. Red herrings (one per
  two household members) are hidden the same way.
- **Hand it over**: Use it on a person (3 s). People nearby see a hand-off, not what was handed.
- **Plant it**: on someone lost in a chore's black screen, with nobody else watching. It slips
  into their pack unseen and their name joins the prints. **Pickpocket** takes it back the same
  way; tried on someone awake, it fails and they see who tried.
- **Ambush**: the claws' special attack, then a hit with the murder weapon, kills an unarmed
  person about 4 times in 5.
- **Escape**: work at one way out once a round, 12 s a go, visible to anyone in the zone. Use a
  **lockpick** on the front gate, or a **chisel** on the crumbling north-west or north-east
  garden wall. It takes 1.5 times as many rounds as the Detective needs clues (3 rounds in a
  6-player game). The overlay shows each route's progress.

## The Detective

- **Never announced** (not by the guard, the overlay or `::who`), though their gear gives them
  away: fire cape, amulet of fury, abyssal whip, fighter torso and dragon platelegs.
- **Studies the body** (25 s, one clue a round) once it has been reported. Each clue rules out
  wrong weapon types; the last names the type. It takes one clue per 3 players (2 to 4).
- **Studies the victims.** Everyone the Murderer kills leaves a body in their blood, which anyone
  can report. Each victim's body gives the Detective one extra clue, once.
- **Lifts prints** with the flypaper from weapons, furniture and people (30 s).
- **Stop and Search**, once a round and only after the Detective has found at least one clue: holds someone for 3 s and confiscates every pool weapon they
  carry. The dragon claws are hidden too well to be found.
- Handles evidence with care: no prints of theirs go on what they take, and the prints already
  on it go into their notebook.
- **The flypaper makes the Detective.** When the Detective dies, their kit drops for anyone.
  Whoever picks up the flypaper is the Detective from then on, quietly, and that can be the
  Murderer. The case file carries over.

## Chores

15 household jobs, each at least five steps, done the RuneScape way: find the tool where it
belongs (on a surface, by its job, or in furniture), then use it on the right thing. Milk the cow
and churn cheese, bake bread, cook stew, water the vegetables, rake the compost, collect beeswax,
chop willow logs for the study fire, fix the library shelves, mend clothes, and more.

- Everyone but the Detective dealt at the start has **3 chores** on the go, the Murderer
  included. Finishing one deals another.
- You carry one of each chore item. A taken tool is back where it lay after 8 s.
- Chores and the tools you hold carry over from round to round and reset between games.
- Food made along the way can't be eaten, so chores aren't free healing.
- **Every chore has one long moment** (12 s): the screen fades to black with a caption, you can't
  see, move or click, and dying doesn't cut it short. That's the Murderer's moment. Long actions
  keep animating, so everyone can see what you're busy with.

## Tokens and the Demon butler

Nobody starts with food or runes. Each chore step pays coins and one **Sinclair Family IOU**
token. The Demon butler in the dining room sells, for tokens, during the investigation only:

| Item | Price (tokens) | Effect |
|---|---|---|
| Stamina potion | 1 | 20% run energy, drains 70% slower for 2 min |
| Bind runes (rune pouch) | 3 | One cast of Bind |
| Shark | 6 | Heals 20 |
| Prayer potion | 10 | Protect from Melee for 3.6 s, blocking melee fully |

Each price goes up by one for every three players in the game. Tokens belong to the game: they
aren't dropped on death and are gone when it ends.

## Combat

- Everyone has the same stats every game: 70 Attack, 75 Strength, 70 Defence, 70 Magic,
  40 Hitpoints, 22 Prayer.
- Only the Detective is geared. The Murderer's dragon claws are stronger than in OSRS: the
  special hits twice as hard, costs 70% energy and drains 40 run energy, and the claws never deal
  less than half their potential.
- Red herrings are real weapons anyone can wield to fight back.
- Fighting is allowed only during the investigation. Dinner heals everyone.
- Killing someone who isn't the Murderer costs the killer 150 coins.
- The dead drop everything but coins and cosmetics where they fell.

## Ghosts

The dead, the wrongly arrested and anyone who joins mid-game are **ghosts**: unseen by the
living, free to walk, watch and use the stairs, and chatting only with other ghosts. To each
other they look like OSRS ghosts (a Ghost, the Ghoul or an Aberrant spectre). Ghosts don't vote.

## Vision and sound

While the household is spread out, the living see only people in their own zone (Dining Room,
Entrance Hall, West Wing, East Wing, Library, Upstairs Hall, Upstairs West, Upstairs East, West
Grounds, East Grounds), within 7 tiles on their floor. Sounds carry no further, so a fight out of
view isn't heard. Everyone sees everyone at the table.

## Bots

Bots fill empty seats as AI players, not NPCs, and play every role through the same actions a
person's clicks take, at a human pace (reaction delays, typing speed). Each has a personality.

- **Household bots** do chores, give their real alibi at the table, report what they saw, pick
  up red herrings, fight back or run for the clock, and buy what they lack from the butler.
- **The bot Murderer** plans to escape (hide or plant the weapon, then work a way out) or to kill
  (stalk people who are alone, ambush with the claws). It frames someone at the table.
- **The Detective bot** watches everything in sight, studies the body, follows prints, searches
  the likeliest suspect and defends anyone attacked.
- At the table every bot votes within 4–16 s. It votes for no arrest unless something points at
  someone: what it saw, accusations in chat (the Detective's word counts most) or the real players
  voting together. Bots never follow each other's votes. After that it rarely changes its vote
  (once at most), and only for new evidence or the real players voting together; in the last 15 s
  only the real players voting together can move it.

## Coins, Store and Bank

Coins pay for chores, finds, surviving rounds, voting for the right arrest, winning and more.
They buy **cosmetics** from the Store (40 items: party hats, santa hats, h'ween masks, skeleton,
chicken and mime outfits, bunny ears, toys...). The Bank keeps coins and cosmetics. Both open only
between games.

Cosmetics are kept for good and can be worn into a game; the Detective's gear leaves hats, gloves
and boots on. Progression (coins, cosmetics, bank) and your character's look are saved in your
browser, one save per name, and follow you to any copy of the game you play on.

## Rooms and multiplayer

- The game ships as a Windows zip with its own Node.js runtime. **`Murder at Sinclair Mansion.exe`**
  starts the player's own game server and opens the game in the browser. There is no central
  server: the host's copy is the server.
- **Host** opens a room on your own copy (one room per copy) with a name, optional password,
  player count and "fill empty seats with bots" (off unless ticked). It gets a 6-character room code.
- **Join with a room code**: your copy looks in its own room, then on the LAN (direct connection),
  then over the internet with PeerJS. **Join** also lists rooms from all three.
- **Internet play** goes through PeerJS's relay (TURN only), so nobody forwards ports and players
  never see each other's IP addresses. The host keeps their game tab open while friends play.
- Failed joins say why (wrong password, room full, already in a room, no game with that code).
- If the host leaves, the next player becomes host. A room closes when its last person leaves.
- Leaving mid-game counts as dying. A Murderer who leaves is caught, and the game ends with no
  win rewards. A dropped player who logs back in with the same name within 90 s gets their role,
  items and spot back.
- The game checks GitHub for updates and can install a new version from the main menu, keeping
  your progression.

## Overlay and controls

- A RuneLite-style overlay shows your role, the round timer, the living count, where the body
  was found (once someone has reported it) and your current chore step. The Murderer sees escape progress; the Detective sees
  clues, their notebook and disturbed furniture.
- RuneScape's flashing yellow hint arrow points at your next chore step, or at the stairs when
  it's on the other floor.
- Mouse tooltips show each thing's left-click option.
- Player **Attack** follows OSRS's Player 'Attack' options setting. Everyone starts on "Always
  right-click"; the Murderer gets "Left-click where available" while they're the Murderer.

## Design principles

1. **Hidden roles, fresh every game**: random Murderer, weapon, crime scene and red herrings.
2. **The chores are the cover**: everyone has work to do, and its black-screen moment is when
   the Murderer acts.
3. **Evidence from play**: prints, weapon finds, hand-offs, sightings and the body's clues come
   from what players actually did, not from a script.
4. **The Detective is a role anyone can inherit**, even the Murderer.
5. **Solo or with friends**: bots play every role; room codes connect friends without hosting a
   server or opening ports.
6. **Progression that travels**: coins, cosmetics and the bank live on the player's machine.
