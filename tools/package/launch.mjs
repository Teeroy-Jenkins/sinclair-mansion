// Copied to game/launch.mjs and started on the bundled game/node/node.exe, by the zip's
// "Murder at Sinclair Mansion.exe" (no window; it opens the browser itself and sets
// SINCLAIR_NO_BROWSER) or by game/"Play with console.cmd": starts this player's own game server,
// waits for it, then opens the game in the browser. It stops when its parent closes.
import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 43594;
const url = `http://localhost:${port}/`;

const server = spawn(process.execPath, [path.join(here, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"], {
    cwd: path.join(here, "server"),
    stdio: "inherit",
    windowsHide: true,
    env: {
        ...process.env,
        PORT: String(port),
        SINCLAIR_CLIENT_DIR: path.join(here, "web"),
        SINCLAIR_CACHES_DIR: path.join(here, "server", "caches"),
    },
});
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(signal, () => server.kill());

/** Opens the game once the server answers /status (it takes a little while to load the map). */
function openWhenReady(triesLeft) {
    http.get(`${url}status`, (res) => {
        res.resume();
        console.log(`\n  Murder at Sinclair Mansion is running: ${url}\n`);
        if (process.env.SINCLAIR_NO_BROWSER === "1") return;
        console.log("  Keep this window open while you play.\n");
        const open = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
        spawn(open[0], open[1], { stdio: "ignore", detached: true, windowsHide: true }).unref();
    }).on("error", () => {
        if (triesLeft > 0) setTimeout(() => openWhenReady(triesLeft - 1), 1000);
        else console.log(`\n  The game server didn't start. See the messages above.\n`);
    });
}
openWhenReady(120);
