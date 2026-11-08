// Builds the zip players share: unzip, double-click "Murder at Sinclair Mansion.exe", and you're
// running your own copy of the game (no hosting, no installs, no console window). Each copy is a
// game server; friends join yours with an invite code.
// Run via: yarn build:zip   (add --skip-client to reuse an existing client build). Windows only.
//
// dist/SinclairMansion/
//   Murder at Sinclair Mansion.exe   tools/package/launcher/Launcher.cs: runs the server hidden
//                                    behind a small taskbar window (loading bar, then reopen/quit)
//   README.txt
//   game/node/node.exe            this Node.js runtime
//   game/launch.mjs               starts the server, then opens the browser
//   game/version.json             this build's version (the in-game updater compares it with GitHub)
//   game/Play with console.cmd    the same with the server's output in a window (troubleshooting)
//   game/logs/server.log          written by the exe each run
//   game/server/                  src, gamemodes, extrascripts, data, caches, config
//   game/client/                  the shared code the server imports (common, rs, custom, ui)
//   game/web/                     the built web client (served by the game server itself)
//   game/node_modules/            the server's packages, where both server/ and client/ find them

import AdmZip from "adm-zip";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dist = path.join(repo, "dist");
const stage = path.join(dist, "SinclairMansion");
const game = path.join(stage, "game");

const copy = (from, to) => fs.cpSync(path.join(repo, from), path.join(game, to ?? from), { recursive: true, dereference: true });
const exeName = "Murder at Sinclair Mansion.exe";

if (process.platform !== "win32") throw new Error("The zip bundles this machine's node.exe and a Windows launcher: build it on Windows.");
// The C# compiler that ships with every Windows (.NET Framework 4), so the launcher needs no SDK.
const csc = path.join(process.env.WINDIR ?? "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
if (!fs.existsSync(csc)) throw new Error(`No C# compiler at ${csc} (it comes with .NET Framework 4).`);

if (!process.argv.includes("--skip-client")) {
    console.log("Building the web client (served by each player's own game server)...");
    execSync("yarn --cwd client build", { cwd: repo, stdio: "inherit", env: { ...process.env, REACT_APP_SAME_ORIGIN_SERVER: "true" } });
}
if (!fs.existsSync(path.join(repo, "client", "build", "index.html"))) throw new Error("No client build: run without --skip-client.");
if (!fs.existsSync(path.join(repo, "server", "caches", "caches.json"))) throw new Error("No game cache: run `yarn setup` first.");

console.log("Staging dist/SinclairMansion/ ...");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(game, "node"), { recursive: true });
fs.copyFileSync(process.execPath, path.join(game, "node", "node.exe"));
for (const dir of ["src", "gamemodes", "extrascripts", "data", "caches"]) copy(`server/${dir}`);
for (const file of ["config.json", "package.json", "tsconfig.json"]) copy(`server/${file}`);
for (const dir of ["common", "rs", "custom", "ui"]) copy(`client/${dir}`);
copy("client/build", "web");
copy("server/node_modules", "node_modules");
// Saved players (game.sqlite*) belong to whoever built the zip, not to the friends who get it.
for (const dir of fs.readdirSync(path.join(game, "server", "data", "gamemodes"))) {
    const at = path.join(game, "server", "data", "gamemodes", dir);
    for (const file of fs.readdirSync(at)) if (file.startsWith("game.sqlite")) fs.rmSync(path.join(at, file));
}
fs.copyFileSync(path.join(repo, "tools", "package", "launch.mjs"), path.join(game, "launch.mjs"));
// The version the main menu shows and the updater compares with GitHub's latest release.
const version = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version;
fs.writeFileSync(path.join(game, "version.json"), JSON.stringify({ version }) + "\n");

console.log(`Compiling ${exeName} ...`);
execSync(
    [
        `"${csc}"`, "/nologo", "/target:winexe", "/optimize+", "/platform:anycpu",
        `/win32icon:"${path.join(repo, "client", "public", "favicon", "favicon.ico")}"`,
        "/r:System.Windows.Forms.dll", "/r:System.Drawing.dll", "/r:System.IO.Compression.dll", "/r:System.IO.Compression.FileSystem.dll",
        `/out:"${path.join(stage, exeName)}"`,
        `"${path.join(repo, "tools", "package", "launcher", "Launcher.cs")}"`,
    ].join(" "),
    { stdio: "inherit" },
);
fs.writeFileSync(
    path.join(game, "Play with console.cmd"),
    ['@echo off', 'title Murder at Sinclair Mansion', '"%~dp0node\\node.exe" "%~dp0launch.mjs"', 'pause', ''].join("\r\n"),
);
fs.writeFileSync(
    path.join(stage, "README.txt"),
    [
        "MURDER AT SINCLAIR MANSION",
        "",
        `Play: double-click "${exeName}". The game opens in your browser at http://localhost:43594/`,
        "A small window shows the game loading, then stays on your taskbar while you play: use",
        "it to open the game again, or close it (Quit) when you're done.",
        "",
        "Windows may say it protected your PC the first time (the game isn't signed): choose",
        "More info, then Run anyway.",
        "",
        "Host: press Host in the lobby window and send your friends the room code it shows.",
        "Keep your game open while they play: over the internet, they connect through it.",
        "Join: press 'Join with a room code' and type the code your friend sent you.",
        "",
        "It works over the internet with no router setup (WebRTC, through the free PeerJS",
        "service), and on your home network directly. Windows may ask to allow Node.js through",
        "the firewall the first time: allow it (for friends on your home network).",
        "",
        "Updates: when a new version is out, the main menu shows Update next to the version",
        "number (bottom left). Press it and the game downloads, checks and installs it, then",
        "starts again. Your coins, cosmetics and look are kept.",
        "",
        "Trouble? Press Show log in the game's window (game\\logs\\server.log), or run",
        "game\\Play with console.cmd to see the server's messages in a window.",
        "",
        `Another port: set PORT before starting, e.g. in a command prompt: set PORT=43600 && "${exeName}"`,
        "",
    ].join("\r\n"),
);

console.log("Zipping dist/SinclairMansion.zip (this takes a minute) ...");
const zip = new AdmZip();
zip.addLocalFolder(stage, "SinclairMansion");
zip.writeZip(path.join(dist, "SinclairMansion.zip"));
const mb = (fs.statSync(path.join(dist, "SinclairMansion.zip")).size / 1024 / 1024).toFixed(0);
console.log(`Done: dist/SinclairMansion.zip (${mb} MB). Share it; players unzip it and run "${exeName}".`);
