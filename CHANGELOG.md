# Patch notes

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
