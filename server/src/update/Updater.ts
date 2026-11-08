// The in-game updater. Each copy checks GitHub for a newer release when it starts (and every few
// hours); the main menu shows the version and, when there's a newer one, an Update button.
//
//   1. check:    GET api.github.com/repos/<repo>/releases/latest -> tag, notes, the zip's SHA-256
//   2. download: the release's SinclairMansion.zip into <install>/update/, hashing as it streams;
//                kept only if the hash matches the one GitHub published for the asset
//   3. restart:  the server exits with UPDATE_EXIT_CODE; the launcher exe (which owns every file,
//                including node.exe and itself) unpacks the zip, swaps the folders and starts the
//                new version. The player's saves are kept (they live in the browser and in
//                game/server/data/gamemodes/*/game.sqlite, which the launcher carries over).
//
// Only the copy started by the launcher can install (SINCLAIR_LAUNCHER=1). Running from source,
// the menu still shows the version and links to the release page.
import crypto from "crypto";
import fs from "fs";
import https from "https";
import path from "path";

import { logger } from "../utils/logger";

export const UPDATE_REPO = "Teeroy-Jenkins/sinclair-mansion";
export const UPDATE_ASSET = "SinclairMansion.zip";
/** Exit code for "an update is downloaded: install it and start again" (see Launcher.cs). */
export const UPDATE_EXIT_CODE = 65;

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 3000;
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_NOTES_CHARS = 4000;
const USER_AGENT = "SinclairMansion-Updater";
/** Hosts a release download may be served from (GitHub redirects to its asset CDN). */
const DOWNLOAD_HOSTS = [/^github\.com$/i, /^api\.github\.com$/i, /^objects\.githubusercontent\.com$/i, /^release-assets\.githubusercontent\.com$/i, /^[a-z0-9-]+\.githubusercontent\.com$/i];

export type UpdateState = "idle" | "checking" | "downloading" | "ready" | "error";

export interface UpdateStatus {
    current: string;
    latest?: string;
    available: boolean;
    /** Whether this copy can install updates itself (started by the launcher exe). */
    canInstall: boolean;
    state: UpdateState;
    /** 0..1 while downloading. */
    progress: number;
    notes?: string;
    releaseUrl: string;
    error?: string;
}

interface Release {
    version: string;
    notes: string;
    url: string;
    asset: { url: string; size: number; sha256: string };
}

/** "v1.2.3" / "1.2.3-beta" -> [1, 2, 3]; undefined when it isn't a version. */
export function parseVersion(text: string | undefined): number[] | undefined {
    const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec((text ?? "").trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

/** Whether `latest` is a newer version than `current`. */
export function isNewer(latest: string | undefined, current: string | undefined): boolean {
    const a = parseVersion(latest);
    const b = parseVersion(current);
    if (!a || !b) return false;
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
}

/** This copy's version: game/version.json in the zip, else the repo's package.json. */
function readCurrentVersion(): string {
    const root = path.resolve(__dirname, "../../..");
    for (const file of ["version.json", "package.json"]) {
        try {
            const v = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))?.version;
            if (typeof v === "string" && parseVersion(v)) return v;
        } catch {}
    }
    return "0.0.0";
}

/** GETs a URL over HTTPS, following redirects only to GitHub's own hosts. */
function get(url: string, accept: string, redirects = 5): Promise<import("http").IncomingMessage> {
    return new Promise((resolve, reject) => {
        let target: URL;
        try {
            target = new URL(url);
        } catch {
            return reject(new Error("Bad download address."));
        }
        if (target.protocol !== "https:" || !DOWNLOAD_HOSTS.some((h) => h.test(target.hostname))) {
            return reject(new Error(`Refusing to download from ${target.hostname}.`));
        }
        const req = https.get(target, { headers: { "User-Agent": USER_AGENT, Accept: accept }, timeout: 30_000 }, (res) => {
            const status = res.statusCode ?? 0;
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume();
                if (redirects <= 0) return reject(new Error("Too many redirects."));
                return resolve(get(new URL(res.headers.location, target).toString(), accept, redirects - 1));
            }
            if (status !== 200) {
                res.resume();
                return reject(new Error(status === 403 ? "GitHub is rate limiting update checks; try again later." : `GitHub answered ${status}.`));
            }
            resolve(res);
        });
        req.on("timeout", () => req.destroy(new Error("GitHub didn't answer in time.")));
        req.on("error", reject);
    });
}

async function getJson(url: string): Promise<unknown> {
    const res = await get(url, "application/vnd.github+json");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res) {
        size += (chunk as Buffer).length;
        if (size > 2 * 1024 * 1024) throw new Error("GitHub's answer was too big.");
        chunks.push(chunk as Buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** The latest published release, with the zip asset and its SHA-256. */
async function fetchLatestRelease(): Promise<Release> {
    const data = (await getJson(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`)) as Record<string, unknown>;
    const version = typeof data.tag_name === "string" ? data.tag_name.replace(/^v/i, "") : "";
    if (!parseVersion(version)) throw new Error("The latest release has no version number.");
    const assets = Array.isArray(data.assets) ? (data.assets as Array<Record<string, unknown>>) : [];
    const zip = assets.find((a) => a.name === UPDATE_ASSET);
    const digest = typeof zip?.digest === "string" ? /^sha256:([0-9a-f]{64})$/i.exec(zip.digest)?.[1] : undefined;
    const htmlUrl = typeof data.html_url === "string" && data.html_url.startsWith(`https://github.com/${UPDATE_REPO}/`) ? data.html_url : `https://github.com/${UPDATE_REPO}/releases/latest`;
    return {
        version,
        notes: typeof data.body === "string" ? data.body.slice(0, MAX_NOTES_CHARS) : "",
        url: htmlUrl,
        asset: {
            url: typeof zip?.browser_download_url === "string" ? zip.browser_download_url : "",
            size: typeof zip?.size === "number" ? zip.size : 0,
            sha256: digest?.toLowerCase() ?? "",
        },
    };
}

export class Updater {
    readonly current = readCurrentVersion();
    readonly canInstall = process.env.SINCLAIR_LAUNCHER === "1" && process.platform === "win32" && !!process.env.SINCLAIR_INSTALL_DIR;
    private state: UpdateState = "idle";
    private progress = 0;
    private error?: string;
    private release?: Release;
    private timer?: ReturnType<typeof setInterval>;
    private downloading?: Promise<void>;

    /** <install>/update: where the zip is downloaded and the launcher looks for it. */
    private get updateDir(): string {
        return path.join(path.resolve(process.env.SINCLAIR_INSTALL_DIR ?? "."), "update");
    }

    start(): void {
        if (process.env.SINCLAIR_UPDATE_CHECK === "0") return;
        setTimeout(() => void this.check(), FIRST_CHECK_DELAY_MS).unref();
        this.timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
        this.timer.unref();
    }

    status(): UpdateStatus {
        const available = isNewer(this.release?.version, this.current);
        return {
            current: this.current,
            latest: this.release?.version,
            available,
            canInstall: this.canInstall && available && !!this.release?.asset.url && !!this.release?.asset.sha256,
            state: this.state,
            progress: this.progress,
            notes: available ? this.release?.notes : undefined,
            releaseUrl: this.release?.url ?? `https://github.com/${UPDATE_REPO}/releases/latest`,
            error: this.error,
        };
    }

    async check(): Promise<void> {
        if (this.state === "checking" || this.state === "downloading" || this.state === "ready") return;
        this.state = "checking";
        try {
            this.release = await fetchLatestRelease();
            this.error = undefined;
            if (isNewer(this.release.version, this.current)) logger.info(`[update] Version ${this.release.version} is available (this is ${this.current})`);
            else logger.info(`[update] Up to date (${this.current})`);
        } catch (e) {
            // Offline, rate limited, no releases yet: not worth bothering the player about.
            logger.info(`[update] Couldn't check for updates: ${(e as Error).message}`);
        } finally {
            this.state = "idle";
        }
    }

    /** Starts downloading the latest release (once); poll status() for progress. */
    download(): { ok: boolean; error?: string } {
        const s = this.status();
        if (!s.canInstall || !this.release) return { ok: false, error: s.available ? "This copy can't update itself: download the new zip from GitHub." : "There's no update to install." };
        if (this.state === "ready" || this.downloading) return { ok: true };
        this.downloading = this.fetchZip(this.release)
            .then(() => {
                this.state = "ready";
                logger.info(`[update] Version ${this.release?.version} downloaded and verified`);
            })
            .catch((e) => {
                this.state = "error";
                this.error = (e as Error).message;
                logger.warn(`[update] Download failed: ${this.error}`);
            })
            .finally(() => (this.downloading = undefined));
        return { ok: true };
    }

    /** Whether a verified update is waiting for the launcher to install it. */
    isReady(): boolean {
        return this.state === "ready";
    }

    private async fetchZip(release: Release): Promise<void> {
        this.state = "downloading";
        this.progress = 0;
        this.error = undefined;
        const dir = this.updateDir;
        fs.mkdirSync(dir, { recursive: true });
        const partial = path.join(dir, "download.zip.part");
        const final = path.join(dir, "SinclairMansion.zip");
        const marker = path.join(dir, "ready.json");
        for (const f of [partial, final, marker]) fs.rmSync(f, { force: true });

        const res = await get(release.asset.url, "application/octet-stream");
        const total = Number(res.headers["content-length"]) || release.asset.size;
        if (total > MAX_DOWNLOAD_BYTES) throw new Error("The update is too big.");
        const hash = crypto.createHash("sha256");
        const out = fs.createWriteStream(partial);
        let got = 0;
        try {
            for await (const chunk of res) {
                const buf = chunk as Buffer;
                got += buf.length;
                if (got > MAX_DOWNLOAD_BYTES) throw new Error("The update is too big.");
                hash.update(buf);
                if (!out.write(buf)) await new Promise((r) => out.once("drain", r));
                if (total > 0) this.progress = Math.min(0.99, got / total);
            }
            await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
        } catch (e) {
            out.destroy();
            fs.rmSync(partial, { force: true });
            throw e;
        }
        const sha = hash.digest("hex");
        if (sha !== release.asset.sha256) {
            fs.rmSync(partial, { force: true });
            throw new Error("The download was damaged (its checksum doesn't match GitHub's). Try again.");
        }
        fs.renameSync(partial, final);
        // The launcher installs the update only when this marker names the zip and its hash.
        fs.writeFileSync(marker, JSON.stringify({ version: release.version, zip: "SinclairMansion.zip", sha256: sha }));
        this.progress = 1;
    }
}

let updater: Updater | undefined;
export function getUpdater(): Updater {
    updater ??= new Updater();
    return updater;
}
