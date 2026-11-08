MURDER AT SINCLAIR MANSION — DESIGN SUMMARY
=============================================

GAME OVERVIEW
-------------
A multiplayer hidden-role deduction game built as a custom gamemode on top of
an Old School RuneScape-style engine. Players gather at Sinclair Mansion to
investigate a murder — but some players are secretly the killer trying to escape.


TWO PHASES OF PLAY
------------------

Phase 1: Investigation (Detectives)
  The majority of players play as Detectives who investigate Lord Sinclair's
  murder.

Phase 2: Freeze & Arrest (Murderer)
  After time expires or a trigger fires, the Murderer must escape while
  Detectives try to identify and arrest them.


DETECTIVE INVESTIGATION MECHANICS
---------------------------------

1. Starting the Quest
  - Talk to a guard outside the mansion to begin.
  - The murder is randomly assigned to one of 6 family members:
    Anna, Bob, Carol, David, Elizabeth, or Frank.


2. Three Independent Evidence Threads (all must be solved)

   Thread A — Colored Thread (Smashed Window)
  - Investigate the smashed window in the garden.
  - A colored thread is found on a nail:
      Green thread = Anna or David
      Red thread   = Bob or Carol
      Blue thread  = Elizabeth or Frank
  - This narrows down the murderer to 2 suspects.

   Thread B — Fingerprints (Crafting mini-game)
  - Take flour from a flour barrel (using an empty pot).
  - Take sticky flypaper from sacks.
  - DUSTING: Use pot of flour on a shiny object
    (the murder weapon dagger or any suspect's silver belonging)
    → produces a "dusted" version.
  - LIFTING: Use flypaper on the dusted object
    → produces a fingerprint item.
  - COMPARING: Use the "unknown print" on each suspect's print
    → if it matches, it becomes the "killer's print"
      (and sets the fingerprint evidence flag).
    → if it doesn't match, it clears that suspect.

   Thread C — Poison Lie (Alibi Verification)
  - Question the Poison Salesman → reveals all 6 family members bought poison.
  - Question each suspect → each claims they used poison at a specific location:
      Anna   → compost heap
      Bob    → beehive
      Carol  → drain
      David  → spiders' nest
      Elizabeth → fountain
      Frank  → family crest
  - Visit each location → if it is NOT the murderer, the location shows poison
    traces (confirming they honestly used poison there).
    If it IS the murderer, the location is untouched — proving they lied.


3. Supporting Clues
  - Servant interviews (Donovan, Pierre, Hobbes, Louisa, Mary, Stanford):
    Each provides contextual clues, e.g.
    "the guard dog did not bark, so an intruder seems unlikely."
  - Gossip NPC: Hints at the fingerprint technique (powder + sticky paper)
    and that all children had motive.
  - Guard dog at gates: Confirms no intruder could have passed unnoticed.


4. Completion
  - Report to the guard with all 3 evidence flags set.
  - The guard arrests the murderer.
  - Rewards: 3 quest points, 1,406 Crafting XP, 2,000 coins.


MURDERER MECHANICS
------------------
Each player is randomly assigned as the Murderer (hidden from others).
The murderer must:

Escape Routes
  - The HUD shows escape routes with progress bars
    (e.g., "have 2/3 tools needed").
  - Each escape requires specific tools/items to complete.
  - Can only work on one escape per round.

Hiding Evidence
  - The murderer starts holding the murder weapon, with their prints on it
    for good.
  - Stash it: right-click the weapon, Use, then click any furniture with a
    search-type option (drawers, bookcases, barrels...). It takes a few
    seconds and pays coins. Whoever searches that furniture later finds it
    and takes it at once (if they have room), and the whole house is told
    who found which weapon, and where. The same goes for red herrings.
  - Or hand it over: Use it on a person (3 s; people nearby see the hand-off,
    not what was handed).
  - Or plant it: right-click someone busy with a chore (screen black) and
    Plant weapon (or Use it on them), with nobody else watching. It slips into
    their pack unseen and nobody is told; their name joins the prints.
  - Then take it back: right-click them and Pickpocket, the same way (their
    screen black, nobody watching), silently. On someone awake it fails and
    they (and anyone looking) see who tried.

Kills aren't announced (the victim is told; everyone else sees only the
living count drop), and reports to the Detective stay quiet. Weapon finds
in furniture are always announced.


THE DETECTIVE (WHOEVER HOLDS THE FLYPAPER)
------------------------------------------
  - Never announced: not by the guard, the overlay or ::who, and they sit in
    an ordinary chair at dinner. Their gear gives them away anyway.
  - The flypaper makes the Detective. When the Detective dies, their gear
    and flypaper drop for anyone to take; whoever picks up the flypaper is
    the Detective from then on, quietly. That can be the Murderer (social
    chaos). A household member who becomes Detective keeps their chores.
  - Stop and Search, once a round: right-click a person. They're held still
    for a brief search (the pickpocket animation) and every weapon from the
    pool they carry or wield is confiscated. The dragon claws are hidden too
    well to be found.
  - The Detective handles evidence with care: no prints of theirs on what
    they take, and the prints already on it go into their notebook.


CHORES
------
Household jobs done the way RuneScape does them, each at least five steps
long: find the tools lying around, then use them where they belong (milk the
cow, churn butter then cheese, fill a watering can at the fountain and water
each crop, rake weeds into the compost, collect beeswax after spraying the
hive, nail a plank with a hammer and nails, mend with a needle and thread).
Tools stay in your pack; food made along the way is used up or put away, and
none of it can be eaten, so chores aren't free healing. You carry at most one
of each chore item. Chores and the tools you hold carry on from round to
round and only reset between games; a taken tool is back where it lay after
8 seconds. Tools are where they belong, never dropped at
random: on a surface (the kettle on the range, the pot on the dining table,
the watering can on the garden bench), set down by their job (the rake by
the compost), or kept in furniture (the needle in Carol's drawers, the raw
beef in the larder), where searching it hands the tool to whoever needs it. 15 chores (including
chopping willow logs to light the study fire, and OSRS's stew); everyone but the Detective gets 3 a
round, the Murderer included (they're the alibi).

Every chore has one long moment: watering the plants, waiting by the range
while the bread bakes. The chore-doer's screen fades to black with a caption
("You water the plants for some time...") for 12 seconds; they can't see,
move or click, and dying doesn't cut it short. It gives the Murderer room to
act. Long actions (chores, the Murderer's lockpicking and chiselling, the
Detective studying the body) keep animating the whole time, as RuneScape's
skilling actions do, so everyone can see what someone is busy with.


CHORE REWARDS: SINCLAIR FAMILY IOUs AND THE DEMON BUTLER
--------------------------------------------------------
Nobody starts with food or runes. Finishing a chore pays coins and chore
tokens, one per step: "Sinclair Family IOU"s (OSRS's Warrior guild token
under the family's name), which stack in one pack slot. The Demon butler
(OSRS's house servant) stands in the dining room; his Talk-to opens an OSRS
shop that takes them (cheapest first):
  - A stamina potion (1 dose), as in RuneScape: 20% run energy back and
    run energy drains 70% slower for 2 minutes.
  - A shark.
  - A rune pouch: the runes to cast Bind once.
  - A prayer potion (1 dose): Protect from Melee for 6 ticks (3.6 s), at any
    Prayer level, blocking melee fully (players' hits too, not RuneScape's 40%).
Prices: the stamina potion 1 token, the runes 3, a shark 6, the prayer potion 10, each plus one for
every three players in the game (rounded down). The shark heals 20.
He serves only during the investigation and buys nothing back.
Tokens belong to the game: nobody starts with any, death doesn't drop them,
and they're gone when the game ends (never saved with coins and cosmetics).
So the household earns its way to fighting back, and doing chores is worth
more than cover. Bots spend their tokens on what they lack, walking to the
butler like anyone else.


COSMETIC STORE AND BANK
-----------------------
The main menu (the character designer) has two buttons beside Play, and
the lobby window has them too:
  - Store: OSRS's own shop interface ("Sinclair Family Costumes") with your
    pack beside it. 40 cosmetics bought with the gold earned in games:
    popular fashionscape and holiday items from RuneScape (party hats,
    santa hats, h'ween masks, skeleton / chicken / mime outfits, bunny
    ears) and toys (yo-yo, rubber chicken, marionette, toy horsey; the
    toys play as in 2009scape). Fixed prices, 10 of each in stock,
    restocking one a minute.
  - Bank: OSRS's bank interface with your pack beside it, for your coins
    and cosmetics only (game items stay in the game).
Both are the engine's OSRS shop and bank (as 2009scape runs them: buy and
sell rules, the "Value" check, deposit and withdraw), and both open only
between games; a game starting shuts them.

Cosmetics are kept like coins: through the end of a game, death, and the
Detective's kit changing hands. They can be worn into a game. The
Detective's gear (cape, amulet, whip, torso, legs; no helmet, gloves,
boots, off-hand or ring) leaves hats, gloves and boots on, and moves a
cosmetic shirt or legs it replaces to the pack (or the bank).

Progression lives on the player's machine: coins, the cosmetics carried
and worn, and the bank are saved in the browser, one save per name. So is
the look designed on the main menu, which is sent to every server after
each login (a friend's game shows you as you made yourself). Every
server asks for it at login and adopts it (between games), then sends each
change back to be saved, so progression is the same on every server and in
every room a player joins.


BOTS
----
Bots fill empty seats as AI players (like 2009scape's AIPlayer), not NPCs:
they look, dress and fight like people (any style the character designer
offers renders, including its newer kits), wear and wield their gear (the
Detective bot wears the Detective set), chat in public chat, and act only
through the same routes a person's clicks take. They play fairly: a reaction
time late, one action at a time, one floor pickup every 2 ticks. They eat at
a third of their hitpoints, drink the prayer potion when attacked, Bind and
run for the clock when unarmed, and arm themselves when they feel in danger.
Each has a personality (how it types, how chatty, brave and easily led it is)
and talks like a player: greetings, banter, answering accusations, typos and
"*corrections".
  - The bot Murderer plans to ESCAPE (hide the weapon early or plant it, do
    chores, work a way out every round) or to KILL (blend in, stalk the lone,
    ambush with the claws special, sometimes keeping the weapon to fight).
  - The Detective bot watches every interaction in sight, studies the body,
    follows fingerprints, frisks the likeliest suspect, patrols and defends
    anyone attacked.
  - At the table every bot waits 12-20 seconds, then votes on evidence of its own,
    then may change its vote on the names that keep coming up in chat, the
    Detective's word and where the votes are piling up. The bot Murderer
    frames someone.


COMBAT STATS AND THE MURDERER'S CLAWS
-------------------------------------
Everyone always has the same mid-level stats, every game and every round:
70 Attack, 70 Strength, 70 Defence, 70 Magic, 39 Hitpoints, 22 Prayer.

The Murderer's opening (a dragon claws special, then one hit with the
murder weapon) kills an unarmed household member most of the time, about
4 in 5. To get there at mid-level stats, the claws are stronger than in
OSRS:
  - The four-hit special hits twice as hard, costs 70% special energy (OSRS:
    50%), and a special that lands drains 40 of the target's run energy.
  - Dragon claws never deal less than half their potential (a miss
    included): a normal swing hits at least half its max hit, the special
    at least half its best total.
Other weapons hit and miss as usual. The odd survivor has a few ticks to
Bind, run, eat or pray. Wielding the claws turns their special attack on
straight away (when there's energy for it), ready for the first swing.

Killing someone who isn't the Murderer costs the Detective or household
member who did it 1,000 coins (never below none).


GHOSTS
------
The dead (killed or wrongly arrested) and anyone who joins mid-game are
ghosts: unseen by the living, free to walk and watch, chatting only with
other ghosts, and using the stairs and ladders, with run energy that never
runs out. To each other they look the part: each is shown as a random
ghost from RuneScape (a Ghost, the Ghoul or an Aberrant spectre), using
OSRS's player-to-NPC transform, with that NPC's own stand and walk.


GAME FLOW & LOBBY
-----------------

Distribution: a zip, peer-to-peer, no hosting
  - The game ships as a zip (yarn build:zip) with its own Node.js runtime.
    "Murder at Sinclair Mansion.exe" starts the player's own game server
    (no console window; a small taskbar window with a loading bar, then
    reopen/quit) and opens the game in the
    browser. Nobody hosts a central server: the host's copy IS the server.

Multiplayer Structure (rooms, modelled on the Impostor Among Us server)
  - 4–12 players per game (configurable).
  - Can fill empty seats with bots for solo play.
  - A host opens a ROOM on their own copy. Pressing Host while visiting a
    friend's game reconnects to your own copy first and hosts there.
  - One room per copy: every game uses the one Sinclair Mansion world, and
    every player has their own copy. Each player is in at most one room.
  - One 6-character room code (no I/1/O/0) per room, shown in the room
    panel with a copy button.
  - Joining with the code: your own copy looks in its own room, then on the
    LAN (UDP beacons: direct connection), then over the internet with
    PeerJS. The client checks the host answers before leaving your own
    game, so a dead code just shows an error.
  - Internet play without port forwarding (like PeerJS games): the host's
    browser registers the room code with the free PeerJS cloud and relays
    each friend's WebRTC data channel into its own game server. STUN finds
    a direct path through most routers; PeerJS's free TURN relays the rest.
    The host keeps their game tab open while friends play.
  - Browser: the room on the copy you're connected to, rooms hosted over the
    internet, rooms on the LAN and saved addresses (probed via /status). The
    internet list is kept by the hosts themselves over PeerJS: one hosting
    tab holds a well-known PeerJS id, the others report to it, and when it
    closes the next host takes over.
  - Join results are explicit (like Impostor's GameJoinError): wrong
    password, room full, already in a room, no game with that code online.
    They show in the lobby window.
  - Leave (or the logout tab's Leave Lobby) puts you back at the gate, standing
    still, until you host or join. The logout tab's Exit Game stops your own copy
    (and its launcher) and closes the tab.
  - Leaving mid-game counts as dying: the leaver drops all chore, role and gear
    items where they stood. A Murderer who leaves is caught: the game ends with
    no win rewards. Coming back during that game makes them a ghost.
  - Host migration: if the host leaves, the next player becomes host.
  - A room closes when its last person is gone (between games); its bots
    despawn and anyone can host again. Mid-game, a dropped player counts as dead
    (their seat is kept, as a ghost, until the game ends).

Game Phases
  1. Lobby       — The host opens a room; players join by room code or browser;
                    the host configures settings (password, player count,
                    bots) and presses Start.
  2. Opening cutscene — (first round) quest-style: the household at the
                    dinner table, the guard announcing the murder and
                    warning of a detective (never named), camera shots and
                    chathead dialogue.
     Investigation — Detectives search, collect evidence, craft fingerprint
                    proofs.
  3. Freeze       — Time stops; the murderer works on escape routes.
  4. Arrest       — Seated at the dinner table, everyone alive votes on who
                    to arrest (or no arrest). More than half the votes for
                    one person arrests them; the running totals are shown,
                    but never who voted for whom.
  5. Result       — Winner announced: either the Detectives (arrest successful)
                    or the Murderer (escaped).

HUD Features
  - Real-time phase indicator with countdown timer.
  - RuneScape-style flashing yellow hint arrow (pinned to the screen edge when off-view) for
    current task.
  - Task list with done/next/where tracking.
  - Murderer-specific escape progress bars.
  - At the dinner table: the vote panel (each person's votes so far, a
    Vote button per person and for no arrest).
  - Mouse tooltips showing left-click options with color-coded targets.
  - Player 'Attack' options (Settings > Controls), as in OSRS: everyone
    starts on "Always right-click"; the Murderer gets "Left-click where
    available" while they're the Murderer, unless they choose otherwise.


KEY DESIGN PRINCIPLES
---------------------
1. Non-linear investigation — Detectives can solve evidence threads in any
   order.
2. Crafting-integrated forensics — Fingerprinting uses the game's item-use
   system (flour → dust → lift → compare), making players feel like real
   detectives.
3. Elimination logic — Each clue narrows the suspect pool; the poison lie is
   the decisive evidence.
4. Hidden role randomness — Each game randomly assigns the murderer, providing
   replayability.
5. Solo + multiplayer — Bots enable single-player; room codes let friends
   play together over the internet without anyone hosting a server or
   opening router ports.
6. Rooms like Among Us — host, share a code, friends join; every failed
   join is explained instead of failing silently.
7. Progression that travels — gold, cosmetics and the bank are saved on
   the player's machine and follow them to any server or room.
