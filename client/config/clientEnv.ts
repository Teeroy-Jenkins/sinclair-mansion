/**
 * Build-time client config from CRA `REACT_APP_*` env vars.
 * Domain-specific values must never be hardcoded — set them in Vercel / `.env*`.
 *
 * IMPORTANT: CRA only inlines env vars referenced as static property access
 * (`process.env.REACT_APP_FOO`). Dynamic `process.env[key]` is left undefined.
 */

function read(value: string | undefined): string | undefined {
    // Strip BOM + whitespace; Windows/PowerShell env writes often include U+FEFF.
    const trimmed = value?.replace(/^\uFEFF/, "").trim();
    return trimmed ? trimmed : undefined;
}

export type ConfiguredServer = {
    name: string;
    address: string;
    secure: boolean;
    maxPlayers: number;
};

function readBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") return true;
        if (normalized === "false" || normalized === "0") return false;
    }
    return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/** Base URL for OSRS cache files. Trailing slash always present. */
export function getCacheBaseUrl(): string {
    const fromEnv = read(process.env.REACT_APP_CACHE_BASE_URL);
    if (!fromEnv) return "/caches/";
    return fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`;
}

/**
 * The portable build (REACT_APP_SAME_ORIGIN_SERVER=true) is served by the game server itself,
 * so the default server is whatever served the page.
 */
function sameOriginAddress(): string | undefined {
    if (!readBoolean(process.env.REACT_APP_SAME_ORIGIN_SERVER, false)) return undefined;
    return typeof window !== "undefined" && window.location.host ? window.location.host : undefined;
}

/** Default WebSocket URL used before the player picks a server. */
export function getDefaultWsUrl(): string {
    const same = sameOriginAddress();
    return read(process.env.REACT_APP_DEFAULT_WS_URL) ?? (same ? `ws://${same}` : "ws://localhost:43594");
}

export function getDefaultServerAddress(): string {
    return read(process.env.REACT_APP_DEFAULT_SERVER_ADDRESS) ?? sameOriginAddress() ?? "localhost:43594";
}

export function getDefaultServerName(): string {
    return read(process.env.REACT_APP_DEFAULT_SERVER_NAME) ?? "Local Development";
}

export function getDefaultServerSecure(): boolean {
    const raw = read(process.env.REACT_APP_DEFAULT_SERVER_SECURE)?.toLowerCase();
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    return getDefaultWsUrl().startsWith("wss://");
}

/**
 * Optional full server list baked in at build time (JSON array).
 * When set, this takes precedence over fetching `/servers.json`.
 */
export function getConfiguredServers(): ConfiguredServer[] | undefined {
    const raw = read(process.env.REACT_APP_SERVERS_JSON);
    if (!raw) return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return undefined;
        return parsed.map((entry): ConfiguredServer => {
            const server = isRecord(entry) ? entry : {};
            return {
                name: typeof server.name === "string" ? server.name : "Server",
                address:
                    typeof server.address === "string" ? server.address : "localhost:43594",
                secure: readBoolean(server.secure, false),
                maxPlayers: typeof server.maxPlayers === "number" ? server.maxPlayers : 2047,
            };
        });
    } catch {
        console.warn("[clientEnv] Failed to parse REACT_APP_SERVERS_JSON");
        return undefined;
    }
}

/** Optional override for the remote server-list URL. */
export function getServerListUrl(): string {
    return (
        read(process.env.REACT_APP_SERVER_LIST_URL) ??
        (typeof window !== "undefined"
            ? `${window.location.origin}/servers.json`
            : "/servers.json")
    );
}
