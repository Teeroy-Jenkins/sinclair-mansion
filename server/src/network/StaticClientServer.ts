// Serves the built web client (and the local OSRS cache under /caches/) from the game server's
// own HTTP port, for the portable build: one program, one port, open http://localhost:<port>/.
// Only this computer is served; other machines only reach /status and the game socket, so the
// cache never leaves the PC it was downloaded on.
// Enabled by SINCLAIR_CLIENT_DIR (the client build folder); /caches/ comes from SINCLAIR_CACHES_DIR.
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import path from "path";

const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json",
};

/** Same headers the dev server sends: SharedArrayBuffer needs cross-origin isolation. */
const ISOLATION = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
};

export class StaticClientServer {
    private constructor(private readonly clientDir: string, private readonly cachesDir: string | undefined) {}

    static fromEnv(): StaticClientServer | undefined {
        // Opt out: set SINCLAIR_NO_CLIENT=1 (dev mode — use React dev server instead)
        if (process.env.SINCLAIR_NO_CLIENT === "1") return undefined;
        // Priority: explicit env var > next-to-server 'web' dir > parent 'client/build' dir
        const explicit = process.env.SINCLAIR_CLIENT_DIR?.trim();
        if (explicit && fs.existsSync(path.join(explicit, "index.html"))) {
            const caches = process.env.SINCLAIR_CACHES_DIR?.trim();
            return new StaticClientServer(path.resolve(explicit), caches ? path.resolve(caches) : undefined);
        }
        // Check for a 'web' folder next to this source file (used by build-web)
        const builtIn = path.resolve(__dirname, "../web");
        if (fs.existsSync(path.join(builtIn, "index.html"))) {
            const repoRoot = path.resolve(__dirname, "../..");
            const cachesDir = path.join(repoRoot, "caches");
            return new StaticClientServer(builtIn, fs.existsSync(cachesDir) ? cachesDir : undefined);
        }
        // Check for 'client/build' relative to the repo root (one level up from server/)
        const repoRoot = path.resolve(__dirname, "../../..");
        const clientBuild = path.join(repoRoot, "client", "build");
        if (fs.existsSync(path.join(clientBuild, "index.html"))) {
            const cachesDir = path.join(repoRoot, "caches");
            return new StaticClientServer(clientBuild, fs.existsSync(cachesDir) ? cachesDir : undefined);
        }
        return undefined;
    }

    /** Handles the request if it's for the client; returns false to let the caller answer. */
    handle(req: IncomingMessage, res: ServerResponse): boolean {
        if (req.method !== "GET" && req.method !== "HEAD") return false;
        const remote = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
        // By default only serve the client to localhost (portable build).
        // Set SINCLAIR_ALLOW_REMOTE_CLIENT=1 to serve to any IP (web/itch.io hosting).
        const allowRemote = process.env.SINCLAIR_ALLOW_REMOTE_CLIENT === "1";
        if (!allowRemote && remote !== "127.0.0.1" && remote !== "::1") return false;
        let urlPath: string;
        try {
            urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
        } catch {
            return false;
        }
        let root = this.clientDir;
        if (urlPath.startsWith("/caches/")) {
            if (!this.cachesDir) return false;
            root = this.cachesDir;
            urlPath = urlPath.slice("/caches".length);
        }
        const file = path.resolve(root, "." + urlPath);
        if (file !== root && !file.startsWith(root + path.sep)) return false; // no ../ escapes
        let stat: fs.Stats | undefined;
        try {
            stat = fs.statSync(file);
            if (stat.isDirectory()) stat = undefined;
        } catch {}
        if (!stat) {
            // The client is a single-page app: unknown paths get index.html (not for the cache).
            if (root !== this.clientDir || path.extname(urlPath)) {
                res.writeHead(404, ISOLATION);
                res.end();
                return true;
            }
            return this.send(req, res, path.join(this.clientDir, "index.html"), fs.statSync(path.join(this.clientDir, "index.html")));
        }
        return this.send(req, res, file, stat);
    }

    private send(req: IncomingMessage, res: ServerResponse, file: string, stat: fs.Stats): boolean {
        const headers: Record<string, string | number> = {
            ...ISOLATION,
            "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
            "Accept-Ranges": "bytes",
            ETag: `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`,
            "Last-Modified": stat.mtime.toUTCString(),
            "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
        };
        // The client streams the 200 MB cache file in pieces (HTTP Range).
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
        if (range && (range[1] || range[2])) {
            let start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
            let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
            start = Math.max(0, start);
            end = Math.min(end, stat.size - 1);
            if (start > end || start >= stat.size) {
                res.writeHead(416, { ...ISOLATION, "Content-Range": `bytes */${stat.size}` });
                res.end();
                return true;
            }
            res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
            if (req.method === "HEAD") res.end();
            else fs.createReadStream(file, { start, end }).pipe(res);
            return true;
        }
        res.writeHead(200, { ...headers, "Content-Length": stat.size });
        if (req.method === "HEAD") res.end();
        else fs.createReadStream(file).pipe(res);
        return true;
    }
}
