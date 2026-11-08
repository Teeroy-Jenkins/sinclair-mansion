# Murder at Sinclair Mansion

**There's been an awful tragedy...**

One of the Sinclair household killed Lord Sinclair. Everyone else does their chores, gathers clues and argues it out at the dinner table. The Murderer tries to frame someone, picks people off when they're alone, or slips out through the garden wall. Think *Among Us* or *Town of Salem*, played in the real Sinclair Mansion north of Camelot, with OSRS models, menus, combat and chat.

[**⬇ Download the latest release**](https://github.com/Teeroy-Jenkins/sinclair-mansion/releases/latest) · [Report a bug](https://github.com/Teeroy-Jenkins/sinclair-mansion/issues)

> 🤖 **Made with AI ("vibecoding").** Most of this project's code, docs and design were written by AI coding assistants (mainly Anthropic's Claude, through Claude Code), steered, played and tested by a human. Expect rough edges. Bug reports and pull requests are welcome.

## Installing

**FYI: The exe isn't code-signed, so you may get a prompt saying "Windows protected your PC" the first time. Choose "More info → Run anyway". The zip is Windows only for now.**


1. Download `SinclairMansion.zip` from the [latest release](https://github.com/Teeroy-Jenkins/sinclair-mansion/releases/latest) and unzip it anywhere.
2. Double-click **`Murder at Sinclair Mansion.exe`**. The game opens in your browser. There's nothing to install: Node.js is bundled.
3. Design your character, press **Play**, then **Host** a room (empty seats can be filled with bots) or **Join** a friend's room with a room code.

# How to Play

## **Roles:**
- **The Detective** should study the body to look for clues and dust weapons for fingerprints with the **Fly Paper**. They can also stop and search people once per round.
- **The Murderer** might hide the murder weapon, or plant the murder weapon on another player! Pickpocket it back even. Ambush people with **dragon claws**, or find a way to escape the grounds.
- **The Household** will do chores and keep their eyes open! Gain IOU's that can be spent on items to help survive the chaos...

**Progression:** Earn coins, buy cosmetics (party hats, h'ween masks, toys...) horde them in your bank if you choose.

**Updates:** The version number is in the bottom-left corner of the main menu; when an update is out, an **Update** button appears beside it. What changed in each version is in [CHANGELOG.md](CHANGELOG.md).


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

## Troubleshooting

- **Port 43594 in use** — Kill the existing server process or set `PORT=xxxx`.
- **Cache download fails** — Delete `server/caches/` and run `yarn setup` again.
- **Blank client screen** — Ensure the server is running first; check the browser console for WebSocket errors.
- **Node version errors** — Run `node -v` and ensure you're on v22.16+.
