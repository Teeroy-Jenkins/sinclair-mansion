import { getConfiguredServers } from "../../../config/clientEnv";
import { SERVER_LIST_URL } from "./constants";
import type { LoginRendererHost } from "./host";
import type { ServerListEntry } from "./types";

function filterServersForCurrentHost(servers: ServerListEntry[]) {

        if (typeof window === "undefined") return servers;
        const pageHost = window.location.hostname.toLowerCase();
        const pageIsLocal =
            pageHost === "localhost" ||
            pageHost === "127.0.0.1" ||
            pageHost === "[::1]" ||
            pageHost === "::1";
        if (pageIsLocal) return servers;

        return servers.filter((s) => {
            const address = s.address.trim().toLowerCase();
            return !(
                address === "localhost" ||
                address.startsWith("localhost:") ||
                address === "127.0.0.1" ||
                address.startsWith("127.0.0.1:") ||
                address === "[::1]" ||
                address.startsWith("[::1]:") ||
                address === "::1"
            );
        });
    
}

function probeWebSocket(url: string, timeoutMs: number) {

        return new Promise((resolve) => {
            let settled = false;
            const ws = new WebSocket(url);
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    ws.close();
                    resolve(false);
                }
            }, timeoutMs);
            ws.addEventListener("open", () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    ws.close();
                    resolve(true);
                }
            });
            ws.addEventListener("error", () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(false);
                }
            });
        });
    
}

export async function fetchServerList(host: LoginRendererHost): Promise<void> {

        if (host.serverListFetched) return;

        const configured = getConfiguredServers();
        if (configured && configured.length > 0) {
            host.serverList = filterServersForCurrentHost(
                configured.map((s) => ({
                    name: s.name,
                    address: s.address,
                    secure: s.secure,
                    playerCount: null,
                    maxPlayers: s.maxPlayers,
                })),
            );
            host.serverListFetched = true;
            return;
        }

        try {
            const res = await fetch(SERVER_LIST_URL, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    host.serverList = filterServersForCurrentHost(
                        data.map((s: any) => ({
                            name: s.name ?? "Unknown",
                            address: s.address ?? "",
                            secure: s.secure ?? false,
                            playerCount: null,
                            maxPlayers: s.maxPlayers ?? 2047,
                        })),
                    );
                }
            }
        } catch {
            // keep fallback
        }
        host.serverListFetched = true;
    
}

export function refreshServerList(host: LoginRendererHost) {

        if (host.probing) return;
        host.probed = false;
        host.probing = true;

        const promises = host.serverList.map(async (server) => {
            const protocol = server.secure ? "https" : "http";
            let httpOk = false;
            try {
                const res = await fetch(`${protocol}://${server.address}/status`, {
                    signal: AbortSignal.timeout(8000),
                });
                if (res.ok) {
                    const data = await res.json();
                    server.playerCount =
                        typeof data.playerCount === "number" ? data.playerCount : null;
                    if (typeof data.maxPlayers === "number") server.maxPlayers = data.maxPlayers;
                    if (typeof data.serverName === "string") server.name = data.serverName;
                    httpOk = true;
                }
            } catch {
                /* fall through to ws probe */
            }

            if (!httpOk) {
                const wsProto = server.secure ? "wss" : "ws";
                const alive = await probeWebSocket(`${wsProto}://${server.address}`, 5000);
                server.playerCount = alive ? -1 : null;
            }
        });

        Promise.all(promises).finally(() => {
            host.probing = false;
            host.probed = true;
        });
    
}
