# Patch notes

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
