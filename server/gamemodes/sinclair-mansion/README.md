# Murder at Sinclair Mansion

The complete rules of Murder at Sinclair Mansion, a social-deduction game built as an XRSPS
gamemode (a short overview is in `docs/design-summary.md`). It runs in the real Sinclair Mansion
north of Camelot, with real OSRS models, menus, chat and interfaces. The play area is
the whole mansion (both floors) and its walled grounds.

## Run

From the repository root, after `yarn setup`:

```bash
# Build the client
yarn --cwd client build

# Copy build to server/web/
node tools/package/build-web.js

# Start the server (with web client serving enabled)
SINCLAIR_ALLOW_REMOTE_CLIENT=1 npx tsx server/src/index.ts
```

Then open **http://localhost:43594/** in your browser.

`SINCLAIR_FAST=1` gives 60-second rounds.
`server/config.json` already selects this gamemode (`"gamemode": "sinclair-mansion"`).

The login screen is a character designer: pick your
style and colours (with a turning preview), type a name and press **Play**. There
is no password (`passwordlessLogin` in `index.ts`), and your look and name are
remembered in the browser.

* **The lobby window** opens as you log in: **Join**, **Host** and **Join with a room code**.
  Until you've joined a game you're not in the mansion: others can't see you and you can't
  move (and **Leave** puts you back at the gate like that). The lobby is a **room** (`rooms.ts`,
  modelled on the Impostor Among Us server's GameManager). The game is shared as a zip
  (`yarn build:zip`, see `docs/developers.md`): every player runs their own copy, and a host's copy
  is the server their friends connect to.
  * **Host**: game name, optional password, players (4 to 10, people and bots together),
    **Fill empty seats with bots**, then **Host**. You always host on your own copy: pressed
    while visiting a friend's game, Host reconnects to your copy first. The room panel shows
    the 6-character **room code** and whether friends can reach it over the internet.
  * **Join with a room code**: your own copy looks in its own room, then on the LAN (UDP beacons
    on port 43595, `discovery.ts`: a direct connection), and otherwise answers `tryPeer` so the
    client finds the host over the internet with **PeerJS** (WebRTC, no port forwarding): the
    host's browser registers the room code with PeerJS and relays each friend into its own game
    server (`client/network/peer/PeerLink.ts`, started by `client/game/murder/PeerHosting.ts`).
    The client checks the host answers before leaving your own game.
  * **Join**: a scrolling server browser. It lists the room on the copy you're connected to,
    rooms hosted over the internet (the PeerJS room list, see `docs/developers.md`), rooms other
    copies on your network are hosting, and servers saved by older versions (each
    checked every 4 s through that server's `/status`, so it shows the game's name, host,
    players and lock, or "Not reachable"). There is no address box: players join by room code.
  * Joining a room on another copy logs you out here and back in there with the same name,
    then joins it (password included). If that login fails, or the host doesn't answer
    within 30 s, the login screen points back at your own copy.
  * Every failed Host or Join (wrong password, full, already in a room, no game with that code
    online) shows in the lobby window.
* **In the lobby** the window shrinks to a panel in the top-left corner so you can walk
  about. Everyone starts with full health, run energy and prayer, and only their coins and
  cosmetics (no gear). You can fight each other there: whoever dies is back by the front gate with
  nothing lost. The host has **Start game**, **Change settings** (password or "Remove
  password", players, bots; not the name) and the **room code**. Everyone has
  **Leave**. With bots on, the Sinclair family and servants (Anna, Bob, Carol, David,
  Elizabeth, Frank, Donovan, Pierre, Hobbes, Louisa, Mary, Stanford, Gossip) take the
  empty seats; with bots off, you need 4 people. If the host leaves, the next person is
  host. When the last one leaves (or nobody who dropped mid-game comes back), the room
  closes once the game is over, its bots go home, and anyone can host again.
* **Nobody picks a role**: they're dealt at random. (For testing, `SINCLAIR_ROLE_PICK=1`
  brings back `::role detective|murderer|npc|random`.)
* After a game, the "Quest complete!" scroll shows first; the overlay's **Lobby** button
  opens the lobby window for the next game. Joining while a game runs, you watch as a
  ghost and play in the next one.
* The buttons send a `sinclair_lobby` gamemode message (a new `GAMEMODE_MESSAGE` client
  packet routed to the gamemode's registered handlers), not chat, so a password never shows
  up in chat or the server log. The client never receives the password, only whether
  there is one.
* One room per copy, on purpose: every game plays in the same mansion (the gamemode's NPCs,
  doors and ground items are shared), so `RoomManager` gets one `MurderGame`, and every player
  has their own copy to host on. The game's handlers are registered once, at startup.
* For more humans, open more browser tabs (or other PCs on your network) and log in
  with different names.
* Dropped connection or reloaded the page? Log back in with the **same name** within 90 s
  (`lobby.reconnectGraceSec`): you get your role, items and spot back. After that you
  count as having left, and anything you carried drops where you stood.

## How a round plays

0. **The opening cutscene** (first round only, `config.round.introSec`, 20 s; timeline in
   `config.intro`): the screen fades to black, the title fades in and out on the black, and only
   then (`intro.seatSec`) is everyone seated and the first shot's camera cut in, so nothing moves in
   view; the screen fades in on the table, and at the end the camera glides back to your own view
   instead of cutting (`cameraHandBack`, drawn in `client/render/render/frame/render.ts`). A RuneScape quest
   cutscene the way 2009scape's `Cutscene` runs one: everyone is seated at the dinner table and held
   still; the screen opens on black ("Murder at Sinclair Mansion") and fades in on the table. The
   camera cuts to the household from the dining room's corner, glides round to the other side as
   the Murder Mystery guard (his chathead) bursts in ("Nobody move! Lord Sinclair has been
   murdered! His body is lying in ..."), then down the table as he warns there's a detective
   among them (never saying who).
   Then the camera goes back to you (with your own angle), your role box opens and round 1 starts.
   The shots are `INTRO_CAMERAS` in `mansion.ts`; the timeline is `introShots` in `MurderGame.ts`.
   Nobody can fight, do chores or ring the clock during it.
1. **The body.** Lord Sinclair is found dead somewhere different each game (kitchen,
   drawing room, entrance hall, the walled West Yard outside, garden, library or David's room).
   His body lies in a pool of blood (the cache's "Corpse" NPC, so it never blocks anyone's way).
2. **Investigation** (3 min). The RuneLite-style overlay shows your role, the round timer,
   how many players are alive, where the body was found, and the chore you're
   on now (its name, then its next step and where). Run energy is topped up at the start of
   every round.
3. **The grandfather clock strikes.** The dining room's grandfather clock chimes, the screen
   fades to black ("*DONG* ... The grandfather clock strikes.") and everyone freezes. Each
   player may **Ring** the clock once per game to end the investigation early (bots do it when
   they see dragon claws and have nothing to fight with). OSRS has no grandfather clock sound,
   so its bell peal (sound 932) stands in.
4. **The dinner table.** The screen fades back in with everyone seated around the dining
   table. You have 60 s to talk it over in chat. Bots give their real alibi (rooms they were
   in, chores they did) and say what they saw (hand-offs, who was rummaging where). Then
   **everyone alive votes** on who to arrest, from the overlay's vote panel (or `::vote`, a
   dialog; `::arrest` does the same). The panel shows each living person with the votes
   against them so far, and "No arrest"; it never shows who voted for whom. A vote can be
   changed. **More than half** of the living's votes for one person arrests them at once; if
   everyone has voted, or time runs out, without that, nobody is arrested (a table of bots alone
   talks until halfway through its time first). Ghosts don't vote. Everyone who voted for the
   Murderer is paid. Bots vote too, each 12-20 s after sitting down (`C.bots.voteDelaySec`): a
   first vote needs real evidence of their own (claws, an attack, an escape attempt, a hand-off
   they saw; the Detective's notebook), otherwise they skip. Then they listen: names that keep
   coming up in chat (from people and bots alike, and from several people more than one person
   repeating it), names someone vouched for, what the Detective says (it counts three times) and
   where the votes are piling up (the easily led follow the pile). After 15 s they may change their
   vote, up to twice (`C.bots.maxVoteChanges`). The bot Murderer frames someone (whoever it planted on or handed the weapon
   to, someone it saw rummaging, or anyone), joins any pile that isn't on itself, and makes a fuss
   when the votes turn its way.

**How it ends.** There is no round limit. The household wins by arresting or killing the
Murderer. The Murderer wins by being the last one alive, or by **escaping**: working at one way
out once a round until it gives (see below).

## The Murderer's escape

There are three ways out, and the Murderer picks one and keeps at it:

* the **front gate** (south of the garden): Use a **lockpick** on it;
* the **north-west** and **north-east garden walls**: a stretch of each is already crumbling
  (the cache's "Crumbling wall", the same drystone half fallen down, with rubble at its foot).
  Use a **chisel** on it to work bricks out until it's climbable.

Each go takes 12 s next to it and can be done once a round, and looks it the whole time, as a
RuneScape skilling action does: the lockpicking (2009scape's chest lockpick, 536) or the chiselling
(881) plays again and again until the go is over. Anyone in the same zone sees it
("You see Bob picking the lock of the front gate!"). Getting through takes 1.5 times as many
rounds as the Detective needs clues (rounded up: 3 rounds in a 6-player game). The Murderer's
overlay shows each route's progress and whether they hold the right tool; the crumbling wall's
Climb option tells you the same (it isn't climbable until you're through). The lockpick and chisels lie around the grounds like the chore tools (see
below), and the Murderer keeps theirs from round to round. Bot Murderers do it too, when nobody
is watching.

**Planting the weapon.** Instead of hiding it, the Murderer can frame someone: right-click them
and **Plant weapon** (or Use the weapon on them) while their screen is black (lost in a chore's
long moment), with nobody else alive in sight. It slips into their pack in under two seconds and
nobody is told, not even them; their name joins the weapon's prints. Awake, or with someone
watching, Use on a person is the ordinary, visible hand-off. A household bot that finds a weapon
in its pack it never picked up says so and reports it to the Detective.

**Pickpocketing it back.** While the weapon you planted is still on them, right-click them and
**Pickpocket** to take it back. Done the same way (their screen black, nobody else alive in
sight) it's silent, though their print stays on the weapon. Try it on someone awake and they
feel your hand: nothing is taken, they're told who it was, and anyone looking sees it. A bot
Murderer that plants as a killer may lift the weapon back to fight with; a household bot that
knew the weapon was in its pack notices when it's gone.

## The Detective

* **Never announced.** Nobody is told who the Detective is: not the guard in the opening cutscene
  ("There's a detective among you"), not the overlay, not `::who`, and the Detective sits in an
  ordinary chair at dinner. Their gear gives them away, though.
* **The flypaper makes the Detective.** Whoever holds it (`MurderGame.isDetective`) can study the
  body, lift prints, Stop and Search, gets reports and the Detective's overlay (clues, notebook,
  disturbed furniture). When the Detective dies their things drop for anyone to take; whoever picks
  up the flypaper is the Detective from then on, quietly. That can be the **Murderer**: they keep
  their own role and win condition, and see the Detective's overlay too. The case file (clues from
  the body) carries over to whoever holds it.
* **Chores stay as they were.** The Detective dealt at the start has none; someone of the household
  who picks up the flypaper keeps theirs (bots split their time between the case and their chores).
* **Stop and Search** (once a round, during the investigation): the Detective right-clicks a person
  and picks **Stop and Search** (`check.ts`; a `sinclair_search` gamemode message). They're held
  still for 3 s (`detective.stopSearchSec`) while the Detective goes through their pockets
  (2009scape's pickpocket animation, 881), and every weapon from the pool they carry or wield is
  confiscated into the Detective's pack (or onto the floor at their feet when it's full). The dragon
  claws aren't from the pool: they're hidden too well to be found. Onlookers see the search and what
  was taken.
* **The Detective handles evidence with care**: a weapon they take (found, confiscated or off the
  floor) gets no prints of theirs, and the prints already on it go into their notebook.

## Weapons

The murder weapon is picked at random each game from a pool of iconic weapons in six types:
dagger (Rune, Dragon), scimitar (Dragon, Rune), longsword (Rune, Dragon), axe (Rune and Dragon
battleaxe), mace (Rune, Dragon) and maul (Granite maul). Others from the pool are hidden in
furniture as red herrings: one per two members of the household (at least one). Nothing is ever
labelled "the murder weapon" before an arrest. (The quest's Criminal's dagger was dropped from
the pool: it's a quest item with no combat stats, so it couldn't be wielded.)

* The Murderer starts holding the real one, with their prints on it for good.
* **Clues.** The Detective left-clicks the body (**Investigate**), or uses flypaper on it or its
  blood, and studies it for 25 s, kneeling over it the whole time (the kneel, 645, repeats).
  That gives one clue a round: each clue rules out some of the wrong weapon types, and the last
  one names the type. It takes one clue per 3 players (at least 2, at most 4), so in a big game
  the type only comes out late. The overlay shows the clues so far and the types still possible.
  The clues belong to the case: a new Detective carries on where the last one stopped. After
  that, lifting prints from a weapon of the wrong type tells them it's not the one.
* **Finds are taken and announced.** Anyone who finds a weapon in furniture (a red herring or the
  stashed murder weapon, while searching or doing a chore there) takes it at once if they have room,
  and the whole house is told who found which weapon, and where ("Bob found a Rune dagger hidden in
  the Drawers (Kitchen)!"). With a full pack it stays put, and that's announced too. `::report` still
  tells the Detective, quietly, about a weapon you're holding.
* **Kills are never announced.** The victim is told they were killed; everyone else only sees
  the living count drop, and has to work out who and where.
* **Kills leave blood.** When the Murderer kills someone, a pool of blood marks the spot for the
  rest of the game.
## Chores

Chores are household jobs done the way RuneScape does them, at least **five steps** each, starting
empty-handed: first **find** the tool lying around the house or grounds and Take it (the step is
done as soon as you hold it), then **Use** it on the right thing, or just left-click the thing
(Milk the cow, Churn, Cook, Take-from, Search...) while holding what it needs. That option is labelled with what it will do for you (`locLabels` in the HUD, relabelled by the client: "Fill Jug", "Flush Drain", a step's `op` in `mansion.ts`); otherwise furniture whose cache option is Investigate or Open reads **Search**. Only the Detective sees **Investigate**. The "Use X ->
Y" menu only appears while you hold the item, and finishing a step can swap your item for the
next one, as in OSRS: the bucket becomes a bucket of milk, the churn turns milk into butter (and
hands the bucket back) and butter into cheese, a watering can fills to (8) at the fountain and
loses a dose per patch, raw beef cooks on the range. Some steps also need a tool in your pack that
isn't used up (`need` on a step): the hammer and nails to fix a shelf, the thread to mend with a
needle. Tools stay in your pack, as in OSRS; food made along the way (cheese, a baked potato,
cooked meat) is used up or put away by the end, and none of it can be eaten (its Eat is taken
off the menu, `CHORE_FOODS` in `butler.ts`), so chores aren't free healing. **You can carry only
one of each chore item**: holding a bucket, you can't take another from the floor or out of
furniture ("You already have a bucket."). If two of your chores need the same tool, the second
waits until the first has used it up (filled the bucket with milk), then you fetch another; the
quest marker points at a step you can do meanwhile. **Chores and the tools you hold carry on from
round to round**: only a new game starts them afresh (they go back when you die or the game
ends).
Tools that OSRS never uses up stay in your pack after their step (the tinderbox, the rake,
the insect repellent, the hatchet, the chisel, Carol's needle), and a kept tool counts at once for
another of your chores that's waiting to find one.

**Every chore has one long moment** (`fade` on its step; `config.tasks.fadeSec`, 12 s, 6 with
`SINCLAIR_FAST`): watering the plants, waiting by the range while the bread bakes, chopping at the
willow. Your screen fades to black with a caption ("You water the plants for some time...") and
you're held still and can't click anything until it's over. Dying doesn't cut it short: you only
find out when the screen comes back. That's the Murderer's moment, and the bot Murderer knows it
(it's four times as likely to strike someone alone who's in one). Bots in one see nothing either.
The clock striking ends it (its own fade takes over). On screen, everyone else just sees you at
work: **long actions keep animating**, as RuneScape's skilling pulses do (2009scape's animations:
the range 883, the churn 2793, milking 2305, the watering can 2293, the rake 2273, pouring a bucket
2283, hammering 3676, sewing 1249, woodcutting 879, lighting a fire 733; `ANIMS` in `index.ts`).

Each tool is somewhere it belongs (`ITEM_SPAWNS` in `mansion.ts`), never dropped at random:
* **Out on a surface** it would be left on: the pot and jug on the dining table, the hammer on
  the study table, the kettle on the range, a bucket on the kitchen barrels and one on the cow's
  food trough, the watering can on the garden bench (an item on furniture sits on its top and is
  taken from beside it, as in OSRS).
* **On the floor only where it's set down for its job**: the tinderbox at the study hearth, the
  rake by the compost heap, the insect repellent by the beehive, the plank and chisel against the
  West Yard wall.
* **Kept in furniture** when nobody would leave it lying about (`in`): the raw beef in the
  larder sacks, the steel nails in Bob's barrel, Carol's needle in her drawers, the thread in
  Elizabeth's barrel, the second insect repellent in David's barrel, the lockpick in the
  servants' drawers. Searching the furniture hands it over if one of your chores (or, for the
  Murderer, the escape) needs it; otherwise you're told it's there but you've no use for it.
  The quest marker outlines that furniture ("Find some thread: search Elizabeth's barrel"), and
  bots search it the same way.

A taken item is back **8 s** later, so one of each is enough (the bucket, wanted by most chores,
and the insect repellent have two). That includes the Murderer's lockpick and chisel.

RuneScape's flashing yellow **quest hint arrow** (200 ms on, 200 ms off, like the classic client) hovers over the tile for your current step (the cow, the
range, the drawers, or a tool lying on the floor). When that tile is out of the camera's view,
the arrow sits on the edge of the game view, pointing the way. When the step is on the other
floor, it points at the staircase ("Climb up / down the stairs"). The chore box in the overlay shows only the chore you're on (with a done
count). Doing a chore in a piece of furniture means rummaging in it, so a weapon stashed there
turns up.

| Tool | Where it lies |
|---|---|
| bucket | on the kitchen barrels; on the cow's food trough |
| pot, jug, bowl | on the dining table |
| hatchet (bronze axe) | left by the willow tree in the garden |
| kettle | on the kitchen range |
| raw beef | in the larder (kitchen sacks) |
| tinderbox | study, at the hearth |
| hammer | on the study table |
| steel nails | in Bob's barrel (corridor) |
| plank | West Yard, against the wall |
| insect repellent | by the beehive; in David's barrel (upstairs) |
| rake | by the compost heap |
| watering can | on the garden bench |
| chisel | West Yard, by the crumbling wall |
| lockpick | in the servants' drawers |
| needle | in Carol's drawers (upstairs) |
| thread | in Elizabeth's barrel (upstairs) |

`yarn tsx scripts/check-sinclair-chores.ts` checks every chore against the real map: each piece
of furniture is where the gamemode thinks, someone can walk up to it, and every item spot can be
reached (furniture tops from beside them; tools kept in furniture need it searchable and reachable).

The long moment (the fade) is in **bold**.

| Chore | Steps |
|---|---|
| Make cheese for the larder | Find a bucket -> milk the Dairy cow -> churn the milk into butter -> **churn the butter into cheese** -> put it in the larder (kitchen sacks) |
| Bake the bread | Find a pot -> fill it at the Barrel of flour -> find a bucket -> fill it at the sink -> mix the water into the flour (dough; the pot and bucket come back) -> **bake at the Range** |
| Make buttered potatoes | Pick a potato -> **bake it on the Range** -> find a bucket -> milk the cow -> churn butter -> butter the baked potato -> put it in the larder |
| Put the kettle on | Find a tinderbox -> light the Range (the tinderbox stays) -> find the kettle -> fill it at the sink -> **boil it on the Range** |
| Make a stew for supper | Find a bowl -> fill it at the sink -> pick a potato -> add it to the water -> find raw beef -> cook it on the Range -> add the meat -> **cook the stew on the Range** (OSRS's stew) |
| Light the study fire | Find a hatchet -> **chop willow logs from the garden's Willow tree** -> find a tinderbox -> lay the logs in the study fireplace -> light the fire |
| Water the vegetables | Find a watering can -> fill it at the Fountain -> water the cabbages, **the wheat** and the potatoes (a dose each) |
| Tend the compost heap | Find a rake -> **rake the weeds from the vegetable patch** -> put them on the Compost heap -> find a bucket -> fill it with compost -> spread it on the patch |
| Collect beeswax (Merlin's Crystal) | Find the insect repellent -> spray the Beehive -> find a bucket -> **collect the wax** -> polish the drawing room drawers |
| Feed the guard dog | Find raw beef -> cook it on the Range -> **feed the dog at its gate** -> find a bucket -> fill it at the Fountain -> give the dog water |
| Unblock the drain | Find a chisel -> **chip out the blockage** -> find a bucket -> fill it at the Fountain -> flush the drain |
| Wash the family crest | Find a jug -> fill it at the Fountain -> **wash the crest** -> fill the jug again -> rinse the crest |
| Clear the spiders' nest | Find the insect repellent -> spray the nest (upstairs) -> find a bucket -> fill it at the sink -> **wash the nest away** |
| Fix the library shelves | Find a hammer, steel nails and a plank -> **nail the plank onto the west bookcase** -> nail the east bookcase back together (upstairs) |
| Mend the family's clothes | Find Carol's needle and some thread -> **mend Elizabeth's dress**, Carol's skirt and David's shirt (their drawers, upstairs) |

Everyone except the Detective has three chores on the go (`tasks.atOnce`), and finishing one deals
another at once (one you aren't doing, preferring one you haven't done yet), so chores go on until
the game ends. The **Murderer gets them too**: they're the alibi.

**Finishing a chore pays.** Coins for each of its steps (`coins.chorePerStep`, 25: a 5-step chore
pays 125, the 7-step buttered potatoes 175), and **chore tokens**, one per step (`tokens.perStep`;
`MurderGame.completeChore`). The token is the cache's stackable "Warrior guild token" (8851,
`tokens.itemId`).

**The Demon butler** (OSRS's house servant, NPC 229) waits in the dining room's north-west corner,
standing at his post (`wanderRadius` 0: pacing that boxed-in corner drew him gliding through the walls and sideboard; `butler.ts`). His **Talk-to** opens OSRS's shop interface, "The Demon Butler's Pantry", which takes
chore tokens, cheapest first:

* **A stamina potion** (1 dose), as in OSRS: 20% run energy back, and run energy drains 70% slower for 2 minutes (the engine's stamina effect, shown on the run orb). Its Drink is the gamemode's own (`index.ts`); it leaves an empty vial.
* **A shark** (heals 20). Eating it works as 2009scape's food does: the eat animation and sound,
  "It heals some health.", and the 3-tick food delay. SinclairBase doesn't load the dev
  gamemode's consumable scripts, so the shark has its own Eat (`index.ts`); before it had one,
  the engine's bare "consume" just took the shark away.
* **A rune pouch**: the runes for one Bind (3 earth, 3 water, 2 nature). It empties into your pack
  as you buy it, so it needs a pack slot for each kind of rune you don't already carry.
* **A prayer potion** (1 dose): drinking it puts **Protect from Melee** up for 6 ticks (3.6 s),
  at any Prayer level, and it blocks melee fully, players' hits included (RuneScape only takes 40% off those). (The item's Drink is the gamemode's own; it leaves an empty vial).

Prices (`tokens.basePrice`, `warePrice` in `butler.ts`): the stamina potion **1 token**, the runes **3**, a shark **6** and
the prayer potion **10**, each plus one for every three players in the game (rounded down): in an
8-player game 3, 5, 8 and 12. The pantry is repriced when a game of another size opens it. Buy 1/5/10/50 gets as many as your tokens cover
(as OSRS shops do with coins), Value gives the price in tokens, and the butler buys nothing back.
He serves the living only during the investigation: between games he says chores will earn tokens
once it starts, at the table he declines, and his shop shuts when the clock strikes, the game ends
or you die. Nobody can attack him.

**Tokens belong to the game.** Nobody has any when a game starts, and they're gone when it ends
(`restore` empties the pack of everything but coins and cosmetics). Dying doesn't drop them, they
can't be dropped, the Detective's kit hand-over skips them, and a player who reconnects within the
grace period gets theirs back. They never go into your saved progression or the bank.

Nobody starts with food or runes, so fighting back is earned.

## Coins and the end screen

Everything worth doing pays **gold coins** straight into your inventory, and coins stay with
you from game to game, across server restarts and from server to server (they're saved in your
browser; see the Store and Bank below), to spend in the cosmetic Store. Amounts are in `config.ts` (`coins`):
finished chores (per step), finding a hidden weapon, reporting one, studying the blood and
lifting prints, hiding or passing on the murder weapon, surviving a round, killing someone as
the Murderer, killing the Murderer, voting for the right arrest, and winning. **Killing someone who isn't the Murderer costs the Detective or household
member who did it 150 coins** (`penalties.killInnocent`; from the pack, then the bank, never
below none). The overlay shows the coins earned this game. The OSRS XP tracker and XP drops are left to real combat XP.

## The Store, the Bank and your progression

The login screen's character designer has **Store** and **Bank** buttons under **Play** (they log
you in first, then open; the lobby window has the same two buttons). Both are OSRS's own
interfaces run by the engine's shop and bank from the dev gamemode (`ShopService`,
`BankingManager`), wired in `store.ts` the way `VanillaGamemode` wires them:

* **Store**: the shop interface (300) titled "Sinclair Family Costumes", with your pack in the side
  panel (301). It sells the 40 cosmetics in `cosmetics.ts` (`COSMETIC_SHOP`): the six party hats
  (32,000) and black and rainbow (80,000), santa hats, the reindeer hat, h'ween masks (black: 18,000),
  the jack lantern mask, the skeleton, chicken and mime outfits, bunny ears and feet, the easter egg
  helm, the highwayman mask, a tan cavalier, and the toys. Fixed prices, 10 of each in stock,
  restocking one every 100 ticks. It's a specialty shop: Value, Buy 1/5/10/50, and it buys back only
  its own stock (the engine's specialty rate; untradeable holiday items can't be sold). The messages
  follow 2009scape's `Shop.kt` ("You don't have enough coins.", "Not enough space in your inventory.").
* **Bank**: the bank interface (12) with your pack beside it (15): tabs, placeholders, notes, drag
  and drop, deposit pack / worn. It keeps only **coins and cosmetics** ("The bank only keeps your
  coins and cosmetics."): deposit buttons skip game items.
* **Only between games.** Opening either while you're playing in a game says "You can't do that
  during a game." and a game starting closes them (the tick handler). No booth or shopkeeper in the
  mansion opens them, and every bank action counts only while the bank is open, as in OSRS (the
  `BankingServices` in `store.ts` check it).
* While either is open the overlay data carries `browsing` and the lobby window steps aside.
* **Toys** (2009scape's `ToyListeners.kt`, `ToyHorseyListener.kt`): the yo-yo's Play / Loop / Walk /
  Crazy, the marionette's Jump / Walk / Bow / Dance (with its spot animation), and the toy horsey's
  Play-with (with one of its three lines overhead).
* **Cosmetics are kept like coins** (`isCosmetic`): `restore` leaves them in your pack and on you,
  death drops nothing of them, the Detective's kit hand-over skips them, and the bots' item lists
  ignore them. The Detective's gear leaves the head, hands, feet, shield and ring slots free, so hats, gloves
  and boots stay on; a cosmetic worn in a slot the gear needs (a shirt, legs) goes to your pack (or the bank
  when the pack is full) when the gear goes on.

**Progression lives in the browser** (`progression.ts`, client `client/game/murder/Progression.ts`).
Your coins, the cosmetics you carry and wear, and your bank are saved in the browser's local
storage (`sinclair.progress.v1.<name>`), so they follow you to any copy of the game:

1. A new session's overlay data asks for it: `progressWanted: "<name>"`.
2. The client answers with a `sinclair_progress` gamemode message carrying its save (or `null`).
   It resends if it's still asked 5 s later (a lost message).
3. Between games, the server puts the save on you (`applyProgress`): its coins and cosmetics
   replace this copy's, in their pack slots, worn slots and bank. Something already in a slot moves
   to the pack, else the bank. Mid-game (a reconnect) the game's own state carries on instead.
   With no save in the browser (a first game there), the server's own copy (`game.sqlite`) stays.
4. From then on `progress` in the overlay data is your current progression, and the browser saves
   every change (`exportProgress`; game items are never in it).

A save is checked (`parseProgress`): only coins and cosmetics, pack slots 0-27, one cosmetic per
pack slot, amounts up to 2,147,483,647, version 1. It is the player's own data on their own machine,
so a hand-edited save can give someone coins or cosmetics; it can't bring game items in. The Store
and Bank buttons wait for the save to arrive before opening.

When a game ends, OSRS's own **"Quest complete!" scroll** (interface 153, with its jingle)
shows who won, the murder weapon's model, the coins you earned, the Murderer, your role and
fate, the richest player, and your coin total.

## PvP

* **Same stats for everyone, always.** Every player has the same mid-level stats in every game
  and every round: **70 Attack, 75 Strength, 70 Defence, 70 Magic, 40 Hitpoints and 22 Prayer**
  (`config.ts`, `pvp.stats`; not announced). 22 Prayer stops at Rapid Heal
  (no protection prayers).
* **The Murderer's opening usually kills.** A dragon claws special, then one hit with the
  murder weapon, kills an unarmed member of the household about **4 times in 5**. Three things
  make that happen at mid-level stats:
  * **Slice and Dice hits twice as hard as in OSRS** (`DRAGON_CLAWS_SPECIAL_DAMAGE_MULTIPLIER`).
    It costs 70% special energy (OSRS: 50%; `pvp.clawsSpecCost`), and a special that lands
    drains 40 of the target's run energy (`DRAGON_CLAWS_SPECIAL_RUN_DRAIN`).
  * **Dragon claws never deal less than half their potential**, a miss included
    (`DRAGON_CLAWS_MINIMUM_DAMAGE_FRACTION`): a normal swing hits at least half its max hit, and
    the special's four hits add up to at least half its best total.

  Both live in `DragonClawsSpec.ts` and are applied by `CombatHitEvaluator`; other weapons
  hit and miss as in OSRS. The 40 hitpoints are set from
  `tests/sinclair-mansion-balance.test.ts`, which measures the opening with the engine's own hit
  evaluator (20,000 openings over the whole murder-weapon pool, no prayers): **82.9%**.
  `--search` prints the kill chance at every hitpoints level if the stats or weapons change.
* **Pack.** Nobody starts with food or runes: chores pay tokens to buy a shark, the runes for one
  Bind or a prayer potion from the Demon butler (see Chores). Bind can be cast at any Magic level (`ignoresSpellLevel`
  hook). Hitpoints, special attack and run energy are full at the start of every game.
  The odd time the opening doesn't kill, the victim has a few ticks to Bind the Murderer,
  step out of reach, eat, or (better, before it lands) drink the prayer potion, which blocks
  the claws.
* **Gear.** Nobody brings combat gear except the **Detective**, who wears a full melee set
  wearable at 70 (`pvp.detectiveGear`: fire cape, amulet of fury, abyssal whip, fighter torso,
  dragon platelegs; no helmet, gloves, boots, off-hand or ring), and the
  **Murderer**, who has only the murder weapon and **dragon claws** (the engine's claws special:
  four hits, 70% energy, with this game's changes above).
* **Equipment stats** come from the item data and count only while worn: the engine adds up the
  bonuses of the equipped items on every hit. The Detective's set meets 70 Attack and Defence
  (checked against `items.json`).
* **Red herrings.** One per two members of the household. Anyone can wield one to fight back
  (they're ordinary weapons with their real stats); finding one also pays. A household bot
  holding one wields it when a fight starts.
* **When.** Everyone, people and bots, can be attacked only during the investigation (not
  at the table). Dinner heals everyone.
* **Ghosts look the part.** A ghost (killed, arrested, or joined mid-game) is shown as a random
  ghost from the cache, one of the Ghosts (NPCs 85-92), the Ghoul (289) or an Aberrant spectre
  (3), standing and walking with that NPC's own animations. It's OSRS's player-to-NPC transform:
  the appearance block sends 65535 and the NPC id in place of the body and gear
  (`PlayerAppearance.npcId`), and the client builds that NPC's model for the player. Only other
  ghosts see them anyway; the next game puts them back in their own clothes.
* **The dragon claws arm themselves.** Wielding the dragon claws turns their special attack on
  (the bar lit, varp 301) if there's energy for it, ready for the first swing.
* **Deaths.** A killed player becomes a ghost where they fell (no respawn). Everything they
  carried and wore drops on the floor for anyone to take, except their coins, which are theirs
  to keep. It drops on the tile, and floor, where their hitpoints hit 0 (`onPlayerDeath` gets the
  engine's death tile): the death animation plays first, and a bot killed at the top of the stairs
  used to keep walking during it, take the stairs (the same tile one floor down) and drop
  everything downstairs. A dying bot now does nothing. Weapons keep their prints. Killing the Murderer ends the game for the household. If
  **the Detective dies**, their gear and flypaper drop like anything else, free for **anyone** to
  pick up, and nobody is appointed or told. When the Murderer kills
  someone, a pool of blood marks the spot. Whatever the dead left lying around is cleared when
  the next game starts.
* **Bots are players.** The household members filling empty seats are AI players, like
  2009scape's `AIPlayer`: real players to everyone else, each with their own look (picked from the
  character designer's kits, seeded by name: `botLooks.ts`; worn items go out as id + 2048, as in
  modern OSRS, so the many designer kits numbered past 255 arrive as kits and render), name, inventory, worn gear, prayers
  and Attack/Follow/Trade options, synced and fought like anyone. Everything they do goes through
  the same routes a person's clicks take (`BotMover` in `bots.ts`, the gamemode services
  `addPlayerBot`, `attackPlayer`, `useInventoryItem`, `castSpellOnPlayer`): the same chores,
  searches, hand-offs, deaths and drops, the engine's combat with their real gear, and public
  chat (overhead and in the chatbox). The Detective bot wears the Detective set.
* **Bots have personalities** (`botChat.ts`): each types its own way (proper, casual, LOUD or
  dry), is more or less chatty, brave and easily led, and now and then fat-fingers a word and
  corrects it ("*watered"). They greet the table, banter when someone's around ("if I get
  murdered, tell the cow I loved her"), grumble about chores, warn before a chore's long moment,
  answer back when someone in chat accuses them or asks where they were, notice the living count
  drop, and react to what turns up in their pack (found, handed over, confiscated or planted).
  Jokes are just jokes: other bots don't count them as evidence.
* **The bot Murderer has a plan.** At the start of the game it decides to win by **escaping**
  (half the time, `C.bots.murdererEscapeChance`) or by **killing**. An escaper hides the weapon
  early (in furniture no chore uses, with nobody watching) or, now and then
  (`C.bots.plantChance`), plants it on someone in a chore's black screen; then it does its chores,
  blends in and works at a way out every round, picking a quiet moment. A killer blends in too, but
  stalks people who are alone (someone lost in a chore most of all, the Detective least), ambushes
  them with the dragon claws special, then walks away from the body; some keep the murder weapon
  to finish fights with (`C.bots.killerKeepsWeaponChance`). A killer that gets nowhere by round 3
  starts on the way out too.
* **The Detective bot** watches everything in sight (hand-offs, rummaging, who's holding what,
  fights, escape attempts), studies the body each round, dusts disturbed furniture, follows the
  prints (everyone whose prints are on a weapon of the right type gets dusted), Stops and Searches
  the likeliest suspect, patrols where people are, and steps in when someone is attacked.
* **Bots handle weapons.** The household picks up a red herring lying in sight (never the
  revealed murder weapon: their prints would go on it), wields it when it feels in danger (a death,
  claws, a fight; the brave always) and puts it away once things are calm. Brave, armed bots
  defend whoever is being attacked; the rest raise the alarm and run for the clock. The Detective
  bags any weapon on the floor as evidence. Bots pick up items from the floor at most once every
  2 ticks (`C.bots.pickupEveryTicks`), the dead Detective's kit one piece at a time.
* **Bots fight fairly**, a reaction time late and one action at a time (`combatThink` in
  `bots.ts`): they eat a shark once down to a third of their hitpoints (as 2009scape's combat bots
  do), drink the prayer potion when someone comes at them, wield what they carry, and fight back.
  A household bot with nothing to fight with Binds its attacker if it has the runes, then runs
  for the grandfather clock. The bot Murderer goes for anyone alone with it, human or bot: in any
  fight (its own ambush or someone coming at it) the dragon claws come out with their special
  attack on while it has the energy for one (`C.pvp.clawsSpecCost`), then the strongest weapon it
  carries (`murdererArm`; strength is the item's best melee attack and strength bonuses over its
  attack speed, `weaponPower`), and it puts its weapons away after the fight. Every bot arms
  itself with the strongest weapon it has (`arsenal`). Bots are registered with the action
  scheduler when they spawn, so their Wield, Eat and Drink clicks run like a person's. A bot that sees someone **wielding dragon claws** in its zone
  knows only the Murderer has those: the Detective, or a bot holding a weapon, attacks; anyone
  else shouts and runs to ring the grandfather clock. It names them at the table, and the
  Detective bot weighs it heavily. A bot with tokens enough for something it lacks walks to the
  Demon butler and buys it through his shop's own rules (`wantedWare`, `SinclairStore.botBuy`): the
  unarmed household buys Bind runes first, the armed buy food.
* **Bots act at a human pace** (`HUMAN` in `bots.ts`). They notice things a moment late (half a
  second to over a second for something alarming, a couple of seconds for a remark), and every
  line appears only after the time it would take to type it, at 4-6 characters a second (about
  45-70 words a minute): a shout takes about 5 s, a table alibi 10-20 s. Lines go out one at a
  time, the next table line waits a few seconds after the last, and a shout drops whatever small
  talk was still being typed. Votes go in as clicks (12-20 s after sitting down); saying who they voted
  for is typed after.
* **Zones.** While the household is spread out, the living only see people in their own zone:
  Dining Room, Entrance Hall, West Wing, East Wing, Library, Upstairs Hall, Upstairs West,
  Upstairs East, West Grounds and East Grounds (`ZONES` in `mansion.ts`). Ghosts see everyone,
  and everyone sees each other at the table. Hand-offs and lifts are only noticed in-zone too.
  (Today the living see within 7 tiles on their own floor during the investigation, `VIEW_DISTANCE`
  in `index.ts`.) **Sounds carry no further than that**: a fight out of view (its hits, the claws'
  special) isn't heard, so it can't give the Murderer away (`setSoundAudibilityFilter`, applied
  by the engine's `BroadcastService` and `SoundManager` to every sound played at a tile). Within
  that, sounds fade with distance: full volume beside you, quieter with each tile, nearly silent at
  8 (`setDefaultSoundRadius`, a radius given to sounds that name none, like combat hits; the client's
  `SoundEffectSystem` measures it along the longer axis, so diagonals fade the same way).

## The grounds

The quest's **guard dog** is back in its run east of the house (it stays in the pen).


The walled garden works as in OSRS: **Pick** the cabbages, wheat and potatoes (they grow back
after 30 s). It is no longer a hiding place. The buttered-potato chore starts by picking a potato.
## Controls (OSRS)

| Who | How |
|---|---|
| Everyone | Left-click to walk or use an object's main option; right-click for the full menu. Attacking someone (person or bot) follows OSRS's **Settings > Controls > Player 'Attack' options**, which everyone starts on "Always right-click": left-clicking a person walks there. "Left-click where available" (or "Depends on combat levels": everyone's level is the same) makes Attack the left click, and "Hidden" takes it off the menu. **While you're the Murderer it's "Left-click where available"**; your own choice comes back after the game, unless you change it yourself meanwhile (then yours stays). Their Follow and Trade are right-click, and so is anything behind them (the grandfather clock's Ring, a door), so a click aimed at someone never does something else by accident. Using an item on someone (a hand-off, flypaper) still works with a left-click. |
| Everyone | Middle mouse or arrow keys turn and tilt the camera (horizontal turning is inverted, `INVERT_HORIZONTAL_ROTATION` in `client/game/Camera.ts`). Click dialog text to choose. |
| Everyone | Furniture's normal option (Search, Open, Investigate, Take-from) searches it, or hands you a chore tool if that's your next step. Doors start open, and anyone can open or close them (bots open closed doors in their way; the dining room's west door swings into the dining room, hinged on the north side of the frame, so it never blocks the hall). **Ring** the grandfather clock (once a game) to end the round early. Examine works on everything (texts from the OSRS wiki in `server/data/examine-text.json`). |
| Murderer | Right-click your weapon, **Use**, then click a stash spot (any furniture with a search-type option) to hide it there, or a person to hand it over (3 s; people nearby in the same room see it, but not what was handed). |
| Household | Search furniture. A weapon you find is taken at once (with room in your pack) and announced to everyone. `::report` reports a weapon you're holding. Reports reach only the Detective. |
| Detective (whoever holds the flypaper) | Left-click the body (**Investigate**) or **Use** flypaper on it or its blood (a clue to the weapon type, 25 s, one a round), on furniture or on a person (prints, 30 s, stay put). Right-click a person, **Stop and Search** (once a round) to confiscate their weapons. Results go to the chatbox, the overlay and `::notes`. |
| Ghosts | The dead, the wrongly arrested and anyone who joins mid-game are invisible to the living. They can walk, watch and take the stairs and ladders but touch nothing else, don't vote, and their public chat only reaches other ghosts. |

Hovering over anything you can interact with shows its left-click option by the cursor, like RuneLite's Mouse Tooltips (`MouseTooltips` in `client/game/murder/MurderExtras.tsx`). OSRS's own cursor tooltip (a cache interface) is told there is at most one option, so it never adds "+N options" (`MINIMENU_NUMOPS` in `client/rs/cs2/handlers/ClientOps.ts`). Menus no longer show "(ID: ...)".

The xRSPS **side menu** and the **Leva debug panel** are gone. The overlays they switched
are OSRS's own settings, now together under **Settings > All Settings > Interfaces >
General** (after Interface scaling): **Ground Items Overlay** (the item name and price
labels; moved from Popout), **Highlight entities on mouse-over** (the hover/interact
outline) and **Highlight current tile** / **Highlight destination tile** (the tile markers;
both moved from Activities). Each setting is a varbit (14869, 13088, 12978, 12979, found by
toggling them in game): flipping the checkbox switches the client's plugin, and since the
plugins remember your choice in the browser, that choice is put back into the settings when
the server sends its copy (`client/game/plugins/OverlaySettings.ts`; the list changes are in
`SETTINGS_LIST_EDITS`, `client/rs/config/enumtype/EnumType.ts`). The notes and plugin-hub
panels that lived only in the side menu are no longer reachable (their code is still there).

The Settings panel's **FPS limit** (foreground and background) and **anti-aliasing** options now
take effect (`applyFpsLimitOptions` / `applyAntiAliasingOption` in `OsrsClient.ts`).

Bot chat appears overhead and in your chatbox (within 15 tiles). Other commands: `::tasks`,
`::notes`, `::who`, `::murder` (help), `::start` (the host, same as Start game).

The interface is scaled up in whole steps only (2x when the window is at least 1800x1040, as
in 1080p fullscreen, otherwise 1x): fractional scales put the pixel fonts between screen pixels
and looked blurry. To choose for yourself, **Settings > All Settings > Display > Interface
scaling** (100-225%, or right-click > Input for any value up to 400%); "Reset interface scaling"
goes back to the automatic size. It's OSRS's own setting from Interfaces > General, also listed
at the end of Display (`SETTINGS_LIST_EDITS` in `client/rs/config/enumtype/EnumType.ts`).
Master volume starts at 20%.

**Music** works as in the OSRS music tab. **Area** plays the mansion's own track, Monarch Waltz,
everywhere in the house and grounds and loops it (the map splits the grounds between two music
regions, Monarch Waltz and Camelot, which used to swap and fade the song as you walked past the
dog run). **Shuffle** plays a random track and moves on to another when it ends; Skip moves on
straight away. **Single** loops a track you click in the list. Every track is unlocked, so the
whole list can be played.

## Files

| File | What |
|---|---|
| `config.ts` | All tunables (round/freeze/arrest/lift/hand-off times, player counts, coins, PvP stats, bot behaviour, reconnect grace; there is no round limit); `SINCLAIR_FAST=1` |
| `MurderGame.ts` | Engine-agnostic rules: roles, weapons, crime scene, print sets, chores, rounds, arrests, reconnects, observations, overlay data. Talks to the world only through `GameIO`. |
| `bots.ts` | Bot brains and bot memory/talk (household, Murderer, Detective), using the same commands humans trigger |
| `mansion.ts` | Real map data: rooms on both floors, furniture (loc ids + tiles), chores and their items, weapon pool, wounds, crime-scene spots, doors, dining-table seats, bot NPC ids |
| `hud.ts` | Encodes the overlay data into the `GAMEMODE_DATA` packet |
| `rooms.ts` | `RoomManager`: room codes, host / join / leave / disconnect, one room per player, closing empty rooms, listings |
| `discovery.ts` | LAN beacons (UDP 43595) and `publicAddress()` |
| `upnp.ts` | With `SINCLAIR_UPNP=1`, asks the router to open the game port when someone hosts (only for direct connections; PeerJS needs none) |
| `index.ts` | The gamemode: login and reconnects, tick, doors, blood, loc / item / NPC / ground-item handlers, commands, dialogs, ghosts, freezing, the bots' bodies (AI players: walking, the stairs, attacking, wielding, eating, casting, buying), the Demon butler's Talk-to, the prayer potion's Drink, overlay pushes |
| `bots.ts` (fighting) | `combatThink`, `flee`, `afterFight`, `wantedWare`: how a bot plays a fight and what it buys from the Demon butler |
| `butler.ts` | The Demon butler: where he stands, his wares, their prices (worked out from the chores' average payout) and his shop |
| `botLooks.ts` | Each bot's look, from the character designer's kits and colours, seeded by name |
| `cosmetics.ts` | The cosmetic store's stock and prices (`COSMETIC_SHOP`, `COSMETIC_IDS`) and the toys' handlers |
| `store.ts` | `SinclairStore`: the Store and Bank (the engine's OSRS shop and bank) with Sinclair's rules, and the Demon butler's shop (tokens, the rune pouch, no buying back); `registerStoreHandlers` |
| `progression.ts` | Progression saved in the browser: export, check and apply coins, cosmetics and bank |
| `../../tests/sinclair-progression.test.ts` | Progression carrying between servers, and doctored saves refused |
| `../../tests/sinclair-mansion.test.ts` | Rules tests with a fake engine (`yarn test:sinclair` in `server/`) |
| `../../scripts/scan-sinclair-mansion.ts` | Lists the mansion's interactable locs and prints an ASCII wall plan (`--plan 0` or `--plan 1`) |
| `../../scripts/collision-probe.ts` | Prints server collision around a tile, to check a piece of furniture can be reached |
| `../../scripts/check-sinclair-chores.ts` | Checks every chore step and item spot against the real map (furniture present, reachable on foot) |
| `../../scripts/find-locs.ts` | Lists cache locs whose name matches a pattern (with sizes, shapes and options), for picking scenery |
| `../../scripts/seq-info.ts` | Prints animations' lengths in ticks, for picking ones to repeat during long actions |
| `../../scripts/obj-ops.ts` | Prints items' names and inventory options (which chore items the cache lets you Eat) |
| `../../tests/sinclair-mansion-balance.test.ts` | Hitpoints balance: claws spec + murder weapon kill odds (about 80%), with the engine's hit code |
| `client/game/murder/` | Client side: `LoginDesigner` (login screen, with Store and Bank), `MurderHudOverlay` (RuneLite-style panel), `MurderFade` (clock fade), `MurderExtras` (quest marker, mouse tooltips), `MurderHudStore`, `Progression` (the browser's save) |

### Engine changes outside this folder
* The settings tab's dropdowns (Player / NPC 'Attack' options): `sinclair-base.ts` now registers
  `gamemodes/dev/widgets/settingsWidgets.ts`, and that handler sends IF_SETEVENTS (op1) for the
  dropdown lists when a dropdown opens. Their option rows are created by a client script with a
  "Select" op, and the client only sends that click once the server enables it, so picking an
  option changed nothing but the label.
* Server-driven cameras (`client/network/serverConnection/handlers/inboundWorld.ts`), used by the
  opening cutscene: a look aimed the camera the opposite way (the yaw had an extra half turn) and
  always level (the pitch's sign was flipped); heights are now measured from the ground at the
  tile, and x/y name the tile's centre, as OSRS's cam_moveto / cam_lookat do; a look sent with a
  gliding move aims from where the camera is headed; and the reset puts back the angle you had
  before the cutscene took the camera.
* `gamemodes/dev/shops/ShopManager.ts`: `registerDefinition` is public, so a gamemode can add a
  shop that isn't in `shops.json` (the cosmetic store).
* `client/render/render/interact/check.ts`: a player's **Attack** menu option never sent
  anything (the menu row has no packet identifier), so players couldn't attack other
  players at all, only NPCs and bots. It now sends OPPLAYER1 itself, as Follow and Trade do.
* `client/game/scene/SceneRaycaster.ts`: mouse picking tested every player slot, including
  freed ones (someone who left view: another zone, another floor, a bot removed). A freed slot
  keeps its last position but loses its name, so hovering where someone had stood offered an
  invisible "Attack Player" that attacked whoever now held that id. Picking now only tests
  active, visible players.
* `CombatTickEngine.routeBeforeMovement`, called from `TickPhaseService.runMovementPhase`:
  an attacker routes toward its target at the start of its own turn, before moving, and the
  combat phase checks reach after the move (OSRS: interact, else path, move, interact again).
  Before, the chase route was only set after movement, so it was walked a tick late, one
  step at a time even with run on, and the attacker trailed a target walking away.
* `GamemodeDefinition.getStatusInfo` adds the gamemode's fields to `/status`;
  `src/network/StaticClientServer.ts` serves the built React client and OSRS cache;
  `scripts/build-collision-cache.ts --squares=x1-x2,y1-y2` builds only some map squares.
* `client`: `OsrsClient.switchServer` (log out, log in elsewhere), `closeConnection` and
  `getSessionCredentials` in `serverConnection/login.ts`, and `REACT_APP_SAME_ORIGIN_SERVER`
  in `config/clientEnv.ts`.
* `server/gamemodes/dev/.../falador/shops.ts`, `portSarim/shops.ts`: imported
  `startNpcConversation` from the wrong module (it was undefined at runtime).
* `server/data/doors.json`: the mansion's doors (25716/25718 single, 25748/25750 double) were
  missing from the door catalogue, so they couldn't be opened.
* `server/src/game/npc.ts`, `npcManager.ts`: `scriptControlled` NPCs don't idle-roam, walk
  back to spawn, or get stuck-reset (otherwise bots were dragged back to their spawn tile).
* `server/src/network/handlers/chatHandler.ts` + `GamemodeDefinition.ts`: optional
  `onPublicChat` hook (ghost-only chat).
* `server/src/network/AuthenticationService.ts` + `GamemodeDefinition.ts`: optional
  `passwordlessLogin` flag.
* Using an item on, or clicking, furniture (`InventoryActionHandler.ts`, `LocInteractionHandler.ts`,
  `LocTileLookupService.ts`): the client reports the ground tile under the cursor, which for tall
  furniture is often the tile behind it. The server now snaps that to the furniture's real tile
  (within 1), routes to its whole footprint, treats gates and other wall objects like doors, and,
  when no tile next to it can be reached (things behind the kitchen counter), lets you use it from
  2 tiles away. Before this, using an item on most furniture from across a room did nothing.
* `GamemodeDefinition.ts`: `resolveLocOption` (`interactHandlers.ts`: names a loc op the cache
  leaves empty, here the clock's Ring) and `ignoresSpellLevel` (`SpellCaster.ts`: Bind at any
  Magic level). Client: `check.ts` adds Ring to the clock while the overlay data allows it, and
  sends the furniture's own tile with "Use X -> furniture". `check.ts` also never offers Attack on
  the body, the guard dog or the Demon butler (`MURDER_SCENERY_NPCS`).
* Client: choosing **Use** from an inventory item's right-click menu no longer fails. The press
  picked Use, then the release landed on whatever was under the menu (the side panel or an
  inventory slot) and cancelled the selection or used the item on that slot ("Nothing
  interesting happens"). Item and spell selection from menus now stamps the entry time, and the
  release of that same click (within 400 ms) is ignored (`SAME_CLICK_MS` in `ClientState.ts`;
  `MenuAction.ts`, `widgetActionHandlers.ts`, `widgets/gl/widgetsGl/constants.ts`).
  That made the menu's own row the only thing selecting the item, and widget menu rows carried
  no item data: "Use" selected item -1 in slot 0, so "Use X -> furniture / person" sent nothing
  (no stashing the murder weapon, no hand-offs, no chore tools or flypaper on furniture). A
  widget "Use" row now carries the item's slot, container and id, as OSRS's item-use op (38)
  does (`ui/menu/MenuBridge.ts`; test: `client/tests/widget-menu-use-item.test.ts`).
* Virtual locs (`client/rs/config/loctype/VirtualLocs.ts`, resolved by the shared loc loaders on
  both server and client): id 65000 is the mansion's open door mirrored, so the dining room's
  west door can swing in hinged on the north side of its frame with the handle on the far end.
  `DoorStateManager.setSwingOverride` takes an optional `openedId` for this.
* Client textures on players, NPC animations, ground items and spot animations were one layer off
  (the shader adds 1 to the stored index, and those paths stored index + 1 too), so textured
  gear like the fire cape drew with the wrong texture (black). They now use
  `textureIdVertexIndexMap` (`WebGLOsrsRenderer.ts`, set in `render/textures/setup.ts`).
* Client: a widget's "cancel selection" click ignores the release of the click that picked
  Use/Cast from a menu over the side panel (`widgets/gl/widgetsGl/constants.ts`).
* **Player bots** (the household): `PlayerManager.addBot` takes a name and look and `removeBot`
  takes one out; gamemode services `addPlayerBot`, `removePlayerBot`, `getIdentityKits`,
  `useInventoryItem` (the inventory's Eat/Wield/Drink for a bot, through
  `InventoryMessageService.handleInventoryUse`, split from the socket handler),
  `castSpellOnPlayer` (`SpellActionHandler.handleSpellCastMessage`) and `attackPlayer`
  (`PlayerInteractionSystem.startBotCombat`, the same checks as a click: gamemode rules and
  single-way combat). `queueChatMessage` takes `playerId`/`from` for a bot's public chat.
* PvP hooks in `GamemodeDefinition.ts`: `canAttackPlayer` (checked in `PlayerInteractionSystem`),
  `resolveNpcOption` (`npcHandlers.ts`: lets op 2 on a Talk-to NPC be Attack) and `onPlayerDeath`
  (`PlayerDeathService.ts`: the gamemode handles the aftermath). `NpcState.configureCombat` gives a
  non-combat NPC stats. `src/game/visibility/ActorVisibility.ts`: an optional per-viewer
  visibility filter used by player and NPC sync. Client: `check.ts` shows Attack on players and
  NPCs when the overlay data says PvP is on; on players its priority follows the Player 'Attack'
  options setting (Follow is always deprioritized), and with a person under the cursor every other
  world option is deprioritized too, so the left click walks unless the setting makes it Attack.
* `server/src/world/DoorStateManager.ts`: per-tile door swing overrides (`setSwingOverride`),
  closing reverses the way a door actually opened, and `isDoorOpenAt` for bots.
  Test: `tests/door-swing-override.test.ts`.
* `server/src/game/interactions/ExamineText.ts` + `server/data/examine-text.json`: examine text
  for locs and NPCs (the cache carries none) and items (from `items.json`).
* `client/network/serverConnection/handlers/inboundUi.ts`: `GAMEMODE_DATA` packets with a
  `hud` key go to the overlay store.
* `client/game/OsrsClient.ts`: `quickLogin(name)`, master volume default 0.2, `debugId` off.
  `client/game/GameContainer.tsx`: mounts the login designer, overlay and fade.
  `client/game/Camera.ts`: inverted horizontal rotation. `client/ui/UiScale.ts`: window-fit UI scale.
* `server/config.json`: gamemode set to `sinclair-mansion`.
* `GamemodeDefinition.ts`: `getMusicArea` (`SoundManager.ts`: one music area across several map
  regions) and `hitNpc` in the gamemode services (`GamemodeServiceAdapter.ts`, `wsServer.ts`: a
  gamemode deals NPC damage with a real hitsplat; unused since the bots became players).
* Client music (`MusicSystem.ts`, `AudioVarpController.ts`, `OsrsClient.ts`): in the music tab's
  Shuffle mode songs play once, and when one ends the client presses Skip for you (the server
  picks the next); Area and Single loop.
* Client quest marker: `WebGLOsrsRenderer.pinnedLocHighlights` outlines locs until cleared, drawn
  by the hover-outline overlay (`render/render/interact/highlight.ts`).
* Client tables (`render/loader/itemSupportHeight.ts`, used by `SdMapDataLoader.ts`): OSRS raises
  items on a "supports items" loc to the top of its whole model, which put items on the dining
  table (loc 597, modelled with its candlesticks) at candle height (162) instead of on the cloth.
  Items now sit on the surface under their tile (the middle of five sampled points), so the dining
  table is 104 and the study table stays 94. A door/loc-only map reload (doors toggling during a
  round) builds no models and used to overwrite every table's height with 0, dropping the items
  under the cloth; it now keeps the heights from the full load (`WebGLMapSquare.ts`).
* Bots upstairs were invisible (when bots were still NPCs): a bot took the stairs by teleporting
  to the same x, y one floor up (`routeBot`), and `NpcManager` re-filed NPCs in its occupancy and region index only when x, y
  changed, at the new level. So the bot stayed filed on the ground floor, where lookups skip it
  for being on another level, and lookups upstairs never found it: no sync, no ticks. The index
  now remembers the tile and level each NPC is filed under, and a scripted teleport re-files it at
  once (`NpcManager.syncIndex`, called from `teleportNpc`). Test: `tests/npc-floor-change.test.ts`.
* Stairs (`gamemodes/dev/scripts/content/climbing.ts`): walking up or down a staircase has no
  animation, as in 2009scape's `ClimbActionHandler`; ladders keep the climb animation.
* Item and object interactions follow 2009scape (`MovementPulse`, `ScriptProcessor`, `PickupHandler`):
  * Picking up an item from your own tile has no animation; reaching onto a table plays the
    table-reach animation (832) from the tile beside it (north, south, east or west only).
    "Too late!" when it's gone, "You don't have enough inventory space to hold that item." when
    full (`GroundItemHandler.ts`).
  * Clicking an object or a ground item you can't get to: once the walk ends, "I can't reach that!"
    and the action is dropped. Before, it stayed pending silently and could fire later if you
    wandered next to the thing (`LocInteractionHandler.updateLocInteractions`,
    `PlayerInteractionSystem.updateGroundItemInteractions`). Item-on-object already did this.
  * An object option nothing handles says "Nothing interesting happens." (was silent).
  * Furniture with no reachable side (behind the kitchen counter) can still be used from 2 tiles
    away (`LOC_REACH_FALLBACK`): 2009scape would say "I can't reach that", but several chores need it.
* RuneScape combat rules, checked against 2009scape (`../2009scape-master`, also open source;
  `tests/combat-runescape-rules.test.ts`, run by `yarn test:sinclair`):
  * NPCs defend against magic with their Magic level only (`CombatHitEvaluator`).
  * A player who is walking doesn't auto-retaliate (`CombatRetaliationEngine`).
  * Single-way combat (`MultiCombatSystem.canAttack`) counts only who is attacking each side
    ("Someone else is fighting that." / "I'm already under attack."), and now applies to PvP
    (`PlayerInteractionSystem.startPlayerCombat`). Before, your own attack counted, so you couldn't
    hit back an aggressive NPC, and players had no single-way check at all.
  * A player standing with no route to its target drops the fight after 10 ticks
    (`CombatInteractionProcessor`, `UNREACHABLE_TIMEOUT_TICKS`).
  * The single-way combat timer is 10 seconds after the last hit (17 ticks; was 16).
  * A cast spell (Bind) always takes 5 ticks before your next attack, whatever you wield
    (`SpellActionHandler`, `CombatEffectService`); it used the weapon's speed (a maul: 7).
  * Standard maces (bronze to dragon) attack every 5 ticks, not 4 (`gamemodes/dev/data/weapons.ts`).
  * Bots are players, so they fight by all of these rules too (no separate bot combat).
  * Already RuneScape-accurate and left as they were: the accuracy and max-hit formulas, hit
    delays (melee same tick, ranged 1 + (3 + d) / 6, magic 1 + (1 + d) / 3), walk 1 / run 2 tiles a
    tick, and the per-entity turn order (NPCs, then players by PID).
* Client settings: Interface scaling also listed under Display, and the overlay toggles moved
  into Interfaces (`EnumType.ts`, `plugins/OverlaySettings.ts`); the side menu and Leva debug
  panel are no longer mounted (`GameContainer.tsx`).
* `GAMEMODE_MESSAGE` client packet (197; `ClientPacketId.ts`, `ClientBinaryEncoder.ts`,
  `ClientBinaryDecoder.ts`, `MessageRouter.ts`, `sendGamemodeMessage`): a gamemode's own
  message, delivered only to its `registerClientMessageHandler` handlers.
* Combat turn order (`CombatInteractionProcessor.targetAtTurn`, `PlayerState.markTurnStart`,
  `TickPhaseService.runMovementPhase`): OSRS gives NPCs, then each player in PID order, a whole
  turn (move, then attack). The engine moves everyone before combat, so a target that started
  walking away was always already gone. Now an attacker whose turn comes before the target's
  (a lower PID, or any NPC) sees it on the tile it started the tick on, so the hit lands as it
  steps away. A walker chasing a walker in a straight line still can't hit (you have to run to
  catch them), as in OSRS. Test: `tests/combat-chase-turn-order.test.ts`.

## Checks
* `yarn test:sinclair`: the progression save (`sinclair-progression.test.ts`: coins, cosmetics and
  bank carry to another server, game items never saved, doctored saves refused, the store's 40
  priced cosmetics), the RuneScape combat rule checks (`combat-runescape-rules.test.ts`), NPCs changing floor (`npc-floor-change.test.ts`), player kits past 255 surviving the appearance block (`appearance-kit-ids.test.ts`), the dragon claws damage floor (`dragon-claws-floor.test.ts`), the store and the Detective's gear (`sinclair-store-and-gear.test.ts`), the stamina potion (`sinclair-stamina.test.ts`), and the rules checks in `sinclair-mansion.test.ts` (including the lobby: host, password, cap, bots, hand-over; rooms: one room per
  player and per mansion, host migration, a dropped player's seat, empty rooms closing; PeerJS frames splitting and
  refusing typos; and the matchmaking registry) plus the door test (north hinge, mirrored open door), including: every chore
  can be finished from empty hands (fetch, then use, paid in coins) and by left-clicking the
  furniture, chores paying a token per step with no reward window, the Demon butler's prices (3, 6
  and 10 plus one per three players), a bot spending its tokens on what it lacks, every chore has at least five steps, a step's held tools (the hammer) are required
  but kept, the churn handing the bucket back, a tool kept in furniture going only to whoever
  needs it (marker on the furniture, back after 8 s, never on the floor), two chores sharing one tool, only one of each
  chore item carried, chores and tools carrying over to the next round, death drops landing where the player was killed, bots typing at a human pace and the bot Murderer going
  after a lone bot, the quest marker follows
  your step and points at the stairs from the other floor, the grandfather clock ends a round
  early once per player per game, bots react to dragon claws, the body's clues (one a round,
  scaled by players, never ruling out the real type), the Detective has a body
  and legs but no helmet, gloves, boots or off-hand, the Murderer's kills leave blood, the PvP
  setup (everyone the same stats, only the Detective geared, claws for the Murderer, red herrings for half the household), tools lying around and respawning, death drops (never coins), the Murderer's escape (lockpick and chisel, once a round, 1.5x the clues), the last-one-standing win and no round limit, the arrest choice closing on time-up, fights only
  during the investigation, killing the Murderer ends the game, the Detective never announced, a dead Detective's kit free
  for anyone and the flypaper making its holder the Detective (the Murderer too; the household
  keeping its chores), Stop and Search (once a round, pool weapons confiscated, never the claws),
  finds taken and announced (or left with a full pack), chores turn up stashed weapons, witnesses only in-zone, every finished game
  has a quest scroll that adds up, the opening cutscene (seated and held still, three shots, the
  guard naming the room and the Detective, then round 1), every chore's one long moment (the fade
  lasts fadeSec, holds you, outlasts your death, ends when the clock strikes), long actions
  repeating their animation (lockpicking, studying the body), tools OSRS never uses up staying and
  counting for the next chore, the stew and the study fire, the cow is not a hiding place, the crime scene moves and teaches the
  weapon type, weapons are never labelled before an arrest, decoys are unprinted, a dropped
  player keeps their role through the grace period, table talk, seating, overlay secrecy, and
  20 full bot games (after which nobody's overlay still shows chores).
* `yarn typecheck:sinclair`: no errors in this gamemode. The command still exits non-zero
  because of about 75 errors already in upstream `gamemodes/dev`. The engine itself
  (`npx tsc --noEmit -p tsconfig.json` in `server/`) and the client
  (`cd client && yarn typecheck`) typecheck clean.

## Notes
* OSRS's own quest fade (interface 174 + client script 948) relies on CS2 widget timers that
  the engine doesn't run, so the fade is drawn by the client overlay instead.
* Vanilla's static ground items are skipped. They included the quest's "Criminal's dagger"
  and "Pungent pot" lying in the mansion. The quest's blood stain in the study is removed
  and reused as the moving crime scene.
* Vision during a round is limited to your zone; the zones come from the real walls
  (`scripts/build-sinclair-zones.ts` writes `room-map.json` and the picture `zones.svg`).
  Hand-offs and lifts are only *announced* to people in the same room within 10 tiles.
* Known client quirk: clicking the minimap doesn't walk. Click in the game view instead.

## Playing with friends (the zip)

Nobody hosts a server: the game is shared as a zip, and each player's copy is a game server.

1. `yarn build:zip` (from the repository root) makes `dist/SinclairMansion.zip`, with its own
   Node.js runtime. Send it to your friends.
2. Everyone unzips it and double-clicks **Murder at Sinclair Mansion.exe**: it starts that
   player's own game server and opens `http://localhost:43594/` in the browser
   (`tools/package/launcher/Launcher.cs`, which runs `tools/package/launch.mjs`).
3. One player presses **Host** and sends the room code from the room panel; the others press
   **Join with a room code** and type it.

Friends on the same network connect directly; friends over the internet connect through the
host's browser with PeerJS (WebRTC through PeerJS's relay only, so nobody has to open router
ports and nobody sees another player's IP address). The host keeps their
game open while friends play. See `docs/developers.md` for details.
