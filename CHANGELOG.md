# Patch notes

## v0.4.0

**Run energy has to last**
- Run energy is no longer topped up at the start of each round. Whatever you have left when the clock strikes is what you start the next round with. It comes back the usual OSRS way, by walking and standing still, and the Demon butler's stamina potion still gives 20% back. Everyone still starts each game with full run energy, and ghosts never tire.

**A grace period at the dinner table**
- Once the vote is settled (someone has more than half the votes, or everyone has voted), the table waits 20 seconds before anything happens. Everyone is told, and the vote panel counts down ("The table decides in 15s"). Votes can still be changed during the wait.
- If a change unsettles the vote (the majority breaks up and not everyone has voted), the wait is called off and the table talks on. When the vote settles again, a new 20-second wait starts.
- The wait never runs past the table's own 60 seconds. When time runs out, the table acts on the votes as they stand: anyone with more than half is arrested.

**The arrest cutscene**
- When the table votes someone out, a short cutscene plays (about 8 seconds). The camera turns to them from across the table. The Detective gets up, walks round and takes them by the arm ("you're coming with me"), and they protest. If the Detective is the one arrested, or there's no Detective at the table, someone who voted for them does it.
- Only once the cutscene is over is it said what they carried and whether they were the Murderer. Bots wait for the verdict before saying anything about it.

## v0.3.2

**Bug fixes**
- A long chat message stays blue when it wraps onto a second line. The game drew each wrapped line on its own and forgot the message's colour, so the second line came out black. Like RuneScape's own chat, a colour (or shadow, underline or strikethrough) now carries on across lines.
- When the grandfather clock strikes, every fight stops, and nobody carries one on at the dinner table. Before, a blow already on its way when the clock struck could set off an auto-retaliate, and the two kept fighting at the table. Fights are broken off when the clock strikes, again when everyone sits down, and on every tick until the next investigation, and nobody auto-retaliates in between.
- Bots only react to a real attack: a hit or a miss that actually reaches someone. Clicking Attack on a player or bot and walking away before the swing no longer sets a bot Detective (or anyone else) on you. A bot that sees the blow land still steps in, raises the alarm or fights back as before.

## v0.3.1

**Stop and Search needs a clue first**
- The Detective can't Stop and Search anyone until they've found at least one clue on a body. Trying earlier gets the message "I don't even have any clues yet, I can't just start searching people", and the round's search isn't used up.
- Bot Detectives wait for their first clue before frisking anyone, and a bot Murderer doesn't get nervous about being searched until then.

## v0.3.0

**Bodies have to be found**
- Nobody knows where Lord Sinclair's body is when the game starts. The guard in the opening cutscene only says he has been murdered, and the overlay's "Body found" line stays empty.
- Whoever comes across the body left-clicks it (**Report**, once). The whole house is told who found it and in which room, the overlay and notes show where, and the finder earns 20 coins. Only then can the Detective study it.
- Bots report a body when they walk into its room. A Murderer bot leaves its own victims for someone else to find.

**Victims leave a body**
- Everyone the Murderer kills now leaves a body lying in their blood. Like Lord Sinclair's, it can be reported once.
- Once a victim's body is reported, the Detective can **Investigate** it for one extra clue to the murder weapon. It's on top of Lord Sinclair's one clue a round, so each kill gives the Detective more to go on. Each victim's body gives its clue once. The bot Detective studies victims' bodies too.

**Bug fixes**
- A blood stain no longer deletes the rug under it. OSRS allows one floor decoration per tile, so a stain spawned on a rug replaced it, and the rug stayed gone after the stain was cleared. Blood is now drawn as a layer on top of whatever is on the floor.
- Bodies are drawn on top of rugs and other floor decorations instead of being partly hidden under them.

## v0.2.4

**Bug fixes**
- The in-game updater no longer fails with "GitHub answered 504". GitHub's release download links (github.com/.../releases/download/...) sometimes time out with a 504 for minutes at a time. The updater now downloads through GitHub's API address for the release file, which serves the same file, and falls back to the old link. Each address gets a couple of retries when GitHub times out or answers with a server error. If GitHub's download servers are still down after that, the message says to try again in a few minutes.
- The character designer no longer shows an invisible character when you first open the game. The preview used to draw only once, often before the model had finished loading, and then waited until you rotated it. It now redraws by itself until every part has loaded.

**Updating from v0.2.3:** v0.2.3's updater still uses the old download link. If **Update now** fails with a 504, wait a few minutes and try again, or download the zip from the release page.

## v0.2.3

A documentation update. The game itself plays exactly as in v0.2.2.

**Docs brought up to date**
- The design summary (`docs/design-summary.md`) is rewritten for the current game. It used to describe the original Murder Mystery quest (the coloured thread, the poison alibis, a fixed list of six suspects), which the game doesn't use.
- The rules (`server/gamemodes/sinclair-mansion/README.md`) now give the real numbers: games are 4 to 10 players (not 12), everyone has 75 Strength and 40 Hitpoints (not 70 and 39), the Murderer's opening kills about 83% of the time, chores pay 25 coins a step (not 15), killing someone who isn't the Murderer costs 150 coins (not 1,000), and the dragon claws special costs 70% energy (not 50%).
- Bots vote 12 to 20 seconds after sitting down at the table (the docs said within 10 seconds).
- Ghosts are described the same way everywhere: the dead, the wrongly arrested and late joiners, who can walk and take the stairs but don't vote.
- Internet play is described everywhere as relay-only, so nobody sees another player's IP address. One page still said it tried a direct connection first.
- "Playing with friends" now says to double-click **Murder at Sinclair Mansion.exe** (`Play.cmd` is gone).
- The docs site's home page, setup guide and FAQ now point to this project's downloads, repository and issue tracker instead of XRSPS's. The setup guide explains the passwordless login. The gamemode guide lists the current files.

## v0.2.2

**Bug fixes**
- Picking up a chore tool with a full pack no longer makes it disappear. It stays on the floor and you're told your pack is full. The same goes for bots.
- Searching furniture with a full pack leaves the tools you couldn't carry in the furniture, instead of losing them until they respawned.
- Shop buttons only work while the shop is actually on screen. Before, if the shop closed some other way (a dialog, or a game starting), you could still buy and sell, even from the cosmetic store during a game.

**Safety**
- The character look you send is checked against the character designer's own options. A made-up look can no longer show other players a broken model.
- Progression saves from the browser are limited to one entry per pack, gear and bank slot, so an oversized save can't bloat every HUD update.
- Web pages can no longer add rooms to your game's room list (the matchmaking registry). Before, any site you visited could list fake rooms or claim a real room code. Real game servers still register as before.
- **Exit Game** now also checks that the request comes from the game's own page, like the updater already did.

**Performance**
- Bots find their way with fewer pathfinding searches. Each failed route used to search every target tile twice.
- The view-distance check that runs for every pair of players each tick does each lookup once instead of up to three times.
- Big HUD updates are compressed (about 13 KB down to 1 KB). This mostly helps internet games, which go through the PeerJS relay. It also stops a very large HUD from overflowing its packet.
- The browser caches the game's files properly: unchanged files get a quick "not modified" answer, and the build's hashed files are kept for good. Reloading the page is faster.
- The overlay's countdown only redraws while there's a timer, and your progression is only written to browser storage when it changes, not on every update.

**Smaller download**
- The zip leaves out the web client's source maps and the TypeScript compiler and type packages. The game never used them at runtime, and leaving them out saves about 50 MB unpacked.

## v0.2.1

**Interface**
- The launcher window's subtitle now reads "Built on xRSPS".
- The **Join a game** browser no longer has an **Address** box (or its **Add to list** and **Connect now** buttons). Players join by room code or from the list.
- The lobby's room code note now simply says "Send this code to your friends!"

## v0.2.0

**Updates in the game**
- The main menu's bottom-left button (it said "Local Development") now shows the game's version.
- When the game starts it checks GitHub for a newer release. If there is one, an **Update to vX** button appears next to the version. Press it to see the patch notes, then **Update now**: the game downloads the new version, checks it against GitHub's published SHA-256 checksum, installs it and starts again. The page reloads by itself.
- Your coins, cosmetics, bank and look are kept (they live in your browser), and so are the server's saves in `game.sqlite`. The old version is deleted the next time the game starts.
- Running from source, the button shows the version and links to the release page.

**Privacy and safety for peer-to-peer play**
- Internet games now always go through PeerJS's TURN relay. Players never see each other's IP addresses: before, WebRTC could connect two browsers directly and show each one the other's public address. The traffic is still end-to-end encrypted (DTLS).
- After switching to a friend's game, the login screen no longer shows the server address.
- Limits against misbehaving peers: game messages are capped at 1 MB (the server used to accept up to 100 MB), a host relays at most 24 connections, and the internet room list holder accepts at most 300 connections, each allowed to ask for the list once a second.
- The updater only downloads from GitHub over HTTPS, refuses a zip whose checksum doesn't match, and refuses zip entries that would unpack outside the game folder. Only your own browser can start an update: requests from other computers or other websites are refused.

## v0.1.0

- First public release.
- The Murderer bot fights with a weapon: the dragon claws with their special attack while it has the energy, then the strongest weapon it carries.
- Bots' Wield, Eat and Drink actions now work (they were silently dropped).
