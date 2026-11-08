// HTTP endpoints of the matchmaking registry, on the same port as the game socket and /status.
//
//   POST /matchmaking/register        a server's heartbeat (ServerEntry JSON, see registry.ts)
//   GET  /matchmaking/servers         every room on every live server, one row per room (the browser)
//   GET  /matchmaking/registry        the live servers themselves (other registries sync from this)
//   GET  /matchmaking/resolve?code=X  { address } of the room with that code, or 404

import type { IncomingMessage, ServerResponse } from "http";
import { getMatchmakingRegistry, sanitizeEntry } from "./registry";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};
const MAX_BODY = 16 * 1024;

function json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS });
    res.end(JSON.stringify(body));
}

/**
 * Handle a /matchmaking request; returns false for any other path. `resolveRoomCode` also
 * looks in the gamemode's own rooms and the LAN (the registry only knows registered servers).
 */
export function handleMatchmaking(req: IncomingMessage, res: ServerResponse, resolveRoomCode?: (code: string) => string | undefined): boolean {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/matchmaking/")) return false;
    const registry = getMatchmakingRegistry();

    if (req.method === "OPTIONS") {
        res.writeHead(204, CORS);
        res.end();
    } else if (url.pathname === "/matchmaking/register" && req.method === "POST") {
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
            body += chunk;
            if (body.length > MAX_BODY) req.destroy();
        });
        req.on("end", () => {
            let entry;
            try {
                entry = sanitizeEntry(JSON.parse(body));
            } catch {}
            if (!entry) return json(res, 400, { error: "Expected a server entry with an address." });
            registry.register(entry);
            json(res, 200, { ok: true });
        });
    } else if (url.pathname === "/matchmaking/servers" && req.method === "GET") {
        json(res, 200, registry.getAllRooms());
    } else if (url.pathname === "/matchmaking/registry" && req.method === "GET") {
        json(res, 200, registry.getAllServers());
    } else if (url.pathname === "/matchmaking/resolve" && req.method === "GET") {
        const code = url.searchParams.get("code")?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
        const address = code.length === 6 ? resolveRoomCode?.(code) ?? registry.resolveRoomCode(code) : undefined;
        if (code.length !== 6) json(res, 400, { error: "A room code is 6 letters and numbers." });
        else if (address) json(res, 200, { address });
        else json(res, 404, { error: "No game found with that room code." });
    } else {
        json(res, 404, { error: "Unknown matchmaking endpoint." });
    }
    return true;
}
