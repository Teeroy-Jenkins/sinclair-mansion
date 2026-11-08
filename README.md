# Murder at Sinclair Mansion

**There's been an awful tragedy...**

One of the Sinclair household killed Lord Sinclair. Everyone else does their chores, gathers clues and argues it out at the dinner table. The Murderer tries to frame someone, picks people off when they're alone, or slips out through the garden wall. Think *Among Us* or *Town of Salem*, played in the real Sinclair Mansion north of Camelot, with OSRS models, menus, combat and chat.

[**⬇ Download the latest release**](https://github.com/Teeroy-Jenkins/sinclair-mansion/releases/latest) · [Report a bug](https://github.com/Teeroy-Jenkins/sinclair-mansion/issues) · [Full game rules](server/gamemodes/sinclair-mansion/README.md)

> 🤖 **Made with AI ("vibecoding").** Most of this project's code, docs and design were written by AI coding assistants (mainly Anthropic's Claude, through Claude Code), steered, played and tested by a human. Expect rough edges. Bug reports and pull requests are welcome.

## Play

1. Download `SinclairMansion.zip` from the [latest release](https://github.com/Teeroy-Jenkins/sinclair-mansion/releases/latest) and unzip it anywhere.
2. Double-click **`Murder at Sinclair Mansion.exe`**. The game opens in your browser. There's nothing to install: Node.js is bundled.
3. Design your character, press **Play**, then **Host** a room (empty seats can be filled with bots) or **Join** a friend's room with its 6-character code.

**Updates:** the game checks GitHub for a new version when it starts. The version number is in the bottom-left corner of the main menu; when an update is out, an **Update** button appears beside it. Press it and the game downloads, checks and installs the new version, then starts again. You keep your coins, cosmetics and look. What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

The exe isn't code-signed, so Windows SmartScreen may say "Windows protected your PC" the first time. Choose **More info → Run anyway**. The zip is Windows only for now. On other systems, run from source (below).

Friends can join from anywhere with the room code. Internet games connect peer-to-peer through [PeerJS](https://peerjs.com/), so nobody needs a hosted server or port forwarding. The connection always goes through a relay, so other players never see your IP address.

## The game

- **Roles.** The household (4–10 players, people and bots together) includes one secret **Murderer** and a **Detective** nobody is told about.
- **Investigate.** Do chores around the mansion and grounds, study the body for the wound, dust weapons for fingerprints, and Stop and Search suspects.
- **The dinner table.** When the grandfather clock strikes, everyone sits down to talk it over and vote. A majority arrests a suspect.
- **The Murderer** hides or plants the murder weapon, pickpockets it back, ambushes people with a **dragon claws** special attack, or lockpicks and chisels a way out of the grounds.
- **Bots** play every role. They do chores, give alibis, notice who's carrying what, fight back, and vote on the evidence they have.
- **Progression.** Earn coins, buy cosmetics (party hats, h'ween masks, toys...) in the store and keep them in your bank. Your save lives in your browser.

The complete rules are in [`server/gamemodes/sinclair-mansion/README.md`](server/gamemodes/sinclair-mansion/README.md).

## Credits

This project stands on the work of others:

- **[XRSPS](https://github.com/xrsps/xrsps-typescript)** by dennisdev and the XRSPS contributors: the TypeScript OSRS-style engine (WebGL client, WebSocket server, cache pipeline) the game is built on. It's licensed under the BSD 2-Clause License (see [`LICENSE`](LICENSE)).
- **[2009scape](https://gitlab.com/2009scape/2009scape)**: an open-source RuneScape emulator (AGPL-3.0). We used its code as a reference for bot AI, cutscenes, animations, item behaviour and quest content, and adapted parts of it.
- **[Old School RuneScape](https://oldschool.runescape.com/)** by **Jagex**: the world, the Murder Mystery quest's Sinclair Mansion, and every model, sound and interface the game uses come from OSRS.
- **[PeerJS](https://github.com/peers/peerjs)** (MIT) for peer-to-peer internet play, and the [Impostor](https://github.com/Impostor/Impostor) Among Us server, which inspired the room and lobby design.
- **AI tools**: Anthropic's Claude (Claude Code) wrote most of the code. See the note above.

*This is a non-commercial fan project. It is not affiliated with, endorsed by or connected to Jagex Ltd. RuneScape and Old School RuneScape are trademarks of Jagex Ltd. The game data is downloaded from the OSRS cache and isn't part of this repository's source.*

## License

The source code is under the BSD 2-Clause License in [`LICENSE`](LICENSE), inherited from XRSPS. Code adapted from 2009scape stays under its AGPL-3.0 terms. Game assets belong to Jagex.

---

# For developers

## Quick Start (from source)

```powershell
# 1. Clone, install dependencies and download the game cache
git clone https://github.com/Teeroy-Jenkins/sinclair-mansion.git
cd sinclair-mansion
yarn setup

# 2. Start the game server and web client together
yarn start
```

That's it. The server starts on **`ws://localhost:43594`** and the client opens at **`http://localhost:3000`**.

## One-Command Launch

| Command | What it does |
|---------|-------------|
| `yarn start` | Starts **both** server and client (default, use this) |
| `yarn server` | Starts only the game server (`ws://localhost:43594`) |
| `yarn client` | Starts only the web client dev server (`http://localhost:3000`) |

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| [Node.js](https://nodejs.org/) | v22.16+ | Runtime |
| [Git](https://git-scm.com/) | Any recent | Clone the repo |

Yarn 4 is managed via **Corepack** (bundled with Node.js). No separate Yarn install needed. If Yarn is not recognized, run `corepack enable` first.

## Project Structure

```
sinclair-mansion/
├── client/          # React + WebGL game client (craco)
├── server/          # Node.js WebSocket game server
├── docs/            # VitePress documentation
├── tools/           # Build helpers (web/itch.io packaging)
├── package.json     # Root — run yarn commands from here
└── README.md        # You are here
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `43594` | Game server WebSocket port |
| `HOST` | `0.0.0.0` | Server bind address |
| `TICK_MS` | `600` | Server tick interval (ms) |
| `GAMEMODE` | `sinclair-mansion` | Active game mode |
| `SINCLAIR_FAST` | (unset) | Set to `1` for 60-second rounds (server only) |
| `SINCLAIR_UPNP` | (off) | Set to `1` to ask the router to open the game port when hosting (only for direct connections; PeerJS needs no open ports) |
| `SINCLAIR_DISCOVERY` | (on) | Set to `0` to turn off LAN beacons (UDP 43595) |
| `SINCLAIR_MATCHMAKING_URL` | (empty) | Optional: another server's `/matchmaking` URL to share one room list with (see below). Not needed for zip/P2P play. |
| `SINCLAIR_UPDATE_CHECK` | (on) | Set to `0` to stop checking GitHub for updates |
| `SINCLAIR_PUBLIC_ADDRESS` | first LAN IPv4 + `PORT` | Optional: the `host:port` advertised to a matchmaking registry. |

## Store, Bank and Your Progression

The main menu (the character designer) has **Store** and **Bank** buttons beside **Play**; the lobby window has them too.

- **Store** opens OSRS's own shop interface, "Sinclair Family Costumes", with your pack beside it. Buy 5/10/50 buys as many as your coins and pack allow, as in OSRS; it buys its own cosmetics back at 45% of its price, and Value on your pack quotes exactly that. It sells 40 cosmetics for the gold you earn in games: party hats (including black and rainbow), santa hats, h'ween masks, the skeleton, chicken and mime outfits, bunny ears, and toys (the yo-yo, marionette and toy horsey can be played with, as in 2009scape). Prices and stock are in `server/gamemodes/sinclair-mansion/cosmetics.ts`.
- **Bank** opens OSRS's bank interface with your pack beside it. It keeps only your **coins and cosmetics**: game items stay in the game.
- Both open only **between games** (never while you're playing one); a game starting closes them.
- Cosmetics are yours for good, like coins: you keep them when a game ends, when you die, and when the Detective's kit changes hands. You can wear them into a game (hats, gloves and boots stay on even for the Detective; a cosmetic shirt or legs the Detective's gear replaces goes to your pack). Cosmetics in your pack take up space a chore tool could use, so bank the ones you don't wear.

**Your progression lives in your browser.** Your coins, the cosmetics you carry and wear, and your bank are saved in the browser's local storage (`sinclair.progress.v1.<name>`, one save per name), so they come with you to any copy of the game you play on: your own, a friend's room, the LAN or over PeerJS. When you log in, the server asks for your save and replaces its own copy with it (between games), then sends every change back to be saved. If this browser has no save yet, the server's copy (from `game.sqlite`) is kept and saved to the browser. Your character's look is saved in the browser too (`sinclair.look.v1`) and sent to the server after every login, so a friend's game shows you as you designed yourself. Clearing the browser's site data clears your progression for that browser. Each copy of the game is somebody's own server, so the save is trusted as far as it's well formed: only coins and cosmetics, with sane amounts.

## Sharing the Game (zip, no hosting)

The game is distributed as a zip. There is no central server to host: every player's copy *is* a game server, and friends play together by connecting to the host's copy directly (peer-to-peer).

```powershell
# Build the web client and package everything into dist/SinclairMansion.zip (~215 MB)
yarn build:zip

# Reuse an existing client build
node tools/package/build-zip.js --skip-client
```

The zip contains a bundled Node.js runtime, so players don't need to install anything:

| In the zip | What it is |
|---|---|
| `Murder at Sinclair Mansion.exe` | Double-click to play: starts your own game server with no console window and opens `http://localhost:43594/` in your browser. A small window on the taskbar shows a loading bar while the server boots (driven by its boot log), then offers **Open game**, **Show log** and **Quit**; closing it asks first, then stops the server. Double-clicking the exe again while it runs just reopens the game. If the server stops on its own, a message box says why. |
| `README.txt` | How to host and join |
| `game/node/node.exe` | The Node.js runtime the zip was built with |
| `game/Play with console.cmd` | The same, with the server's output in a console window (troubleshooting) |
| `game/logs/server.log` | The server's output from the last run (the one before is `server.previous.log`) |
| `game/` | Also the server (`server/`), the shared client code it imports (`client/`), the built web client (`web/`), the game cache and the server's packages |

The exe is a small launcher window (`tools/package/launcher/Launcher.cs`; its loading-bar stages match the server's `Boot:` log lines, so update `Milestones` there if those change) that `build:zip` compiles with the C# compiler built into Windows (.NET Framework 4), so building the zip needs Windows but no extra SDK. The server runs in a Windows job object, so quitting the launcher (or it crashing) never leaves a server running in the background. The exe isn't code-signed, so SmartScreen shows "Windows protected your PC" the first time; players choose **More info → Run anyway**.

### The in-game updater

`server/src/update/Updater.ts`, `client/game/murder/UpdateBadge.tsx` and `GameUpdate` in `tools/package/launcher/Launcher.cs`:

1. A few seconds after starting (then every 6 hours) the server asks `api.github.com/repos/Teeroy-Jenkins/sinclair-mansion/releases/latest` for the newest release and compares its tag with its own version (`game/version.json`, written by `build:zip` from the root `package.json`; from source it reads `package.json`).
2. The main menu polls `GET /update/status` and shows the version, plus an **Update** button and the release notes when a newer version is out.
3. **Update now** sends `POST /update/download`: the server streams `SinclairMansion.zip` from the release into `<install>\update\`, hashing it as it goes, and keeps it only if the SHA-256 matches the `digest` GitHub publishes for the asset. Downloads only come over HTTPS from GitHub hosts.
4. The page then sends `POST /update/restart`: the server saves and exits with code 65. The launcher checks the hash again, unpacks the zip into `update\staged\` (refusing entries that would land outside it), copies `game.sqlite*` and the logs into the new copy, renames `game\` and its own exe aside (a running exe can be renamed) and moves the new ones in, then starts the new exe with `--updated`. If anything fails before the swap, nothing changes and the old version starts again. The old files are deleted on the next start.
5. The page waits for the server to answer with the new version, then reloads.

The `/update/*` endpoints answer only loopback requests from a localhost page (or with no Origin), and the POSTs need an `X-Sinclair-Update` header, so another website can't start an update. Only a copy started by the exe can install (`SINCLAIR_LAUNCHER=1`); from source or `Play with console.cmd` the menu links to the release page.

**To publish an update:** bump `version` in the root `package.json`, add patch notes to `CHANGELOG.md`, build the zip and attach it to a GitHub release tagged `vX.Y.Z` with the asset named `SinclairMansion.zip`. The release notes are what the menu shows.

Saved players from the builder's machine are left out (`game.sqlite*`). To run a second copy on one PC (for testing), set another port first: `set PORT=43600` then run the exe from that command prompt.

## Hosting and Joining

The lobby works like an Among Us private server ([Impostor](https://github.com/Impostor/Impostor)), and internet connections work like [PeerJS](https://peerjs.com/) games: a host opens a **room** on their own copy, the room gets a **6-character room code**, and friends join with that code from anywhere, with no port forwarding.

- **Host**: the lobby window's **Host** opens a room on *your own* copy of the game. If you're visiting a friend's game when you press it, the client reconnects to your own copy first and hosts there. One room per copy: every game plays in the same Sinclair Mansion world (NPCs, doors, ground items), and each player has their own copy anyway. The room panel shows the code with a copy button, and whether it's reachable over the internet.
- **Join with a room code**: type or paste it (case doesn't matter), plus the password if the room has one. Your own copy looks for it in this order:
  1. its own room;
  2. rooms on your network (LAN beacons, UDP 43595): a direct connection;
  3. otherwise **over the internet with PeerJS** (below). The client first checks the host answers, so a dead or mistyped code shows an error and leaves you in your own game.

  Once found, the client logs out of your copy, logs in to the host's with the same name, and joins. If the host can't be reached within 30 s, it returns to your own copy.
- **Join from the browser**: **Join** lists the room on the copy you're connected to, rooms hosted over the internet (the PeerJS room list, below), rooms heard on the LAN and saved addresses (probed through `/status`). Joining an internet room checks its host answers first, as a room code does. You can also type an address and use **Add to list** or **Connect now**.
- **Leave** (or **Leave Lobby** in the logout tab) takes you out of the room and back to the gate, standing still, until you host or join again. The logout tab's **Exit Game** saves, stops your own game server (the launcher quits too) and closes the tab (if the browser won't let it, the page says the game is closed).
- **Leaving during a game** (Leave Lobby, Exit Game, closing the tab or losing the connection) counts as dying: you drop everything but your coins and cosmetics where you stood. If the Murderer leaves, they're caught and the game ends with no win rewards. Come back before that game ends and you're a ghost.
- **Errors** (wrong password, room full, already in a room, no game with that code online) appear in the lobby window.
- **Host hand-over and closing**: if the host leaves, the next player becomes host. When the last person leaves, the room closes once the game is over, its bots go home, and anyone can host again.

### Internet play: PeerJS (no port forwarding)

```
friend's browser --(WebRTC data channel)--> host's browser --(WebSocket)--> host's game server
```

- While a tab is connected to its own copy and that copy has a room open, the tab registers the room code with PeerJS (id `sinclair-mansion-<code>`) and relays every friend who connects into its own game server (`client/network/peer/PeerLink.ts`, `PeerHost`; started by `client/game/murder/PeerHosting.ts`).
- A friend's client talks to the host through `PeerSocket`, a WebSocket look-alike used for `peer://<code>` server URLs, so the rest of the client and the server are unchanged. Messages are cut into 16 KB frames for the data channel (`PeerFrames.ts`).
- [PeerJS](https://github.com/peers/peerjs) (MIT, `peerjs@1.5.5`) brings everything else, using its free public cloud: the `0.peerjs.com` server only introduces the two browsers, and PeerJS's free TURN servers (`eu-0`/`us-0.turn.peerjs.com`) carry the data.
- **IP addresses stay hidden.** Every peer is created with `iceTransportPolicy: "relay"` and no STUN server (`client/network/peer/PeerConfig.ts`), so WebRTC never offers a direct connection: each browser only ever sees the relay's address, never another player's. The data channel is end-to-end encrypted (DTLS), so the relay can't read it. Room-list rows never carry an address, the lobby masks the addresses you save, and the login screen doesn't show the address of a game you switched to.
- **Limits against misbehaving peers:** one game message is at most 1 MB (the server's WebSocket `maxPayload`, and the host tab's frame reader), a host relays at most 24 connections, and the room-list holder serves at most 300 connections, each asking for the list at most once a second.
- **The internet room list** (`client/network/peer/PeerRoomList.ts`): PeerJS's free cloud can't list who's online, so the hosts keep the list themselves. One hosting tab holds the PeerJS id `sinclair-mansion-room-list-v1`; every other host reports its room to it every few seconds, and a Join browser asks it for the rows (name, host, seats, lock, in game; never a password or address). When that tab closes, the next host claims the id, so the list lasts as long as anyone is hosting.
- The host's **tab must stay open** while friends play: it's their connection. Closing it disconnects friends who came in over the internet (friends on the LAN connect directly).
- To the server, internet friends all connect from `127.0.0.1`, so loopback is exempt from the login rate limit.
- `SINCLAIR_UPNP=1` still asks the router to open the game port, for direct connections by address; it's off by default, since PeerJS doesn't need it.

Windows may ask whether to let Node.js through the firewall the first time; allow it on private networks (for friends on your LAN).

### Matchmaking registry (optional)

Each copy also runs a small matchmaking registry (`server/src/matchmaking/`). It isn't needed for zip/P2P play. If you ever run an always-on server, pointing other copies' `SINCLAIR_MATCHMAKING_URL` at its `/matchmaking` makes rooms from every copy appear in each other's browser.

| Endpoint | What it does |
|---|---|
| `POST /matchmaking/register` | A server's heartbeat: `{ id, address, name, lobbies: [...] }`. Its room list replaces the previous one; servers expire 30 s after their last heartbeat. |
| `GET /matchmaking/servers` | One row per room on every live server. |
| `GET /matchmaking/registry` | The live servers themselves (other registries sync from this). |
| `GET /matchmaking/resolve?code=ABC123` | `{ address }` of the room with that internal room code, else 404. |
| `GET /status` | This server's room (`lobby`), for saved-address probes. |

## Documentation

Full architecture and design docs are in `docs/`. View them locally:

```powershell
cd docs
yarn dev
```

## Troubleshooting

- **Port 43594 in use** — Kill the existing server process or set `PORT=xxxx`.
- **Cache download fails** — Delete `server/caches/` and run `yarn setup` again.
- **Blank client screen** — Ensure the server is running first; check the browser console for WebSocket errors.
- **Node version errors** — Run `node -v` and ensure you're on v22.16+.
