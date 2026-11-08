// The main menu's version button (bottom left) and the in-game updater. The player's own game
// server (which served this page) checks GitHub for a newer release; when there is one, an
// Update button appears beside the version. Updating downloads the new zip (checked against
// GitHub's SHA-256), then the server hands over to the launcher exe, which installs it and starts
// the game again; this tab waits and reloads itself. See server/src/update/Updater.ts.
import { useCallback, useEffect, useRef, useState } from "react";

import "./UpdateBadge.css";

const VERSION = process.env.REACT_APP_VERSION || "0.0.0";
const RELEASES = "https://github.com/Teeroy-Jenkins/sinclair-mansion/releases/latest";
/** Only the portable build is served by the player's own game server (which has /update/*). */
const HAS_UPDATER = process.env.REACT_APP_SAME_ORIGIN_SERVER === "true";

interface UpdateStatus {
    current: string;
    latest?: string;
    available: boolean;
    canInstall: boolean;
    state: "idle" | "checking" | "downloading" | "ready" | "error";
    progress: number;
    notes?: string;
    releaseUrl: string;
    error?: string;
}

async function getStatus(): Promise<UpdateStatus | undefined> {
    try {
        const res = await fetch("/update/status", { cache: "no-store" });
        return res.ok ? ((await res.json()) as UpdateStatus) : undefined;
    } catch {
        return undefined;
    }
}

async function post(path: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetch(path, { method: "POST", headers: { "X-Sinclair-Update": "1" } });
        return (await res.json()) as { ok: boolean; error?: string };
    } catch {
        return { ok: false, error: "Couldn't reach your game." };
    }
}

/** Opens a link in a new tab without giving it a handle on this one. */
function openExternal(url: string): void {
    if (/^https:\/\/github\.com\//.test(url)) window.open(url, "_blank", "noopener,noreferrer");
}

export function UpdateBadge() {
    const [status, setStatus] = useState<UpdateStatus>();
    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState<"idle" | "restarting" | "slow">("idle");
    const [error, setError] = useState<string>();
    const restartTarget = useRef<string | undefined>(undefined);

    // Ask the server how the update check went: quickly at first (it checks a few seconds after
    // starting) and while downloading, then once a minute.
    useEffect(() => {
        if (!HAS_UPDATER) return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            const s = await getStatus();
            if (stopped) return;
            if (s) setStatus(s);
            const fast = !s || s.state === "downloading" || s.state === "checking" || s.latest === undefined;
            timer = setTimeout(poll, s?.state === "downloading" ? 700 : fast ? 4000 : 60_000);
        };
        void poll();
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, []);

    // Downloaded and checked: restart into the new version, then reload once it answers.
    useEffect(() => {
        // "ready" only follows the player's Update now (perhaps from before they left the menu).
        if (!status || status.state !== "ready" || phase !== "idle") return;
        restartTarget.current ??= status.latest;
        setOpen(true);
        setPhase("restarting");
        void post("/update/restart").then((r) => {
            if (!r.ok) {
                setPhase("idle");
                setError(r.error);
                return;
            }
            const target = restartTarget.current;
            const started = Date.now();
            const wait = async () => {
                const s = await getStatus();
                if (s && s.current === target) {
                    window.location.reload();
                    return;
                }
                if (Date.now() - started > 180_000) setPhase("slow");
                setTimeout(wait, 2000);
            };
            setTimeout(wait, 4000);
        });
    }, [status, phase]);

    const update = useCallback(async () => {
        if (!status?.latest) return;
        setError(undefined);
        restartTarget.current = status.latest;
        const r = await post("/update/download");
        if (!r.ok) setError(r.error);
        else setStatus((s) => (s ? { ...s, state: "downloading", progress: 0 } : s));
    }, [status]);

    const available = !!status?.available;
    const busy = status?.state === "downloading" || phase !== "idle";

    return (
        <div className="update-badge" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {open && (
                <div className="ub-panel">
                    {phase === "restarting" ? (
                        <div className="ub-title">Installing v{restartTarget.current}... the game reloads by itself.</div>
                    ) : phase === "slow" ? (
                        <div className="ub-title">This is taking a while. Check the game's window on your taskbar.</div>
                    ) : available && status ? (
                        <>
                            <div className="ub-title">Version {status.latest} is out</div>
                            <div className="ub-sub">You have v{status.current}.</div>
                            {status.notes && <div className="ub-notes">{status.notes}</div>}
                            {status.state === "downloading" ? (
                                <div className="ub-progress">
                                    <div className="ub-bar" style={{ width: `${Math.round(status.progress * 100)}%` }} />
                                    <span>Downloading... {Math.round(status.progress * 100)}%</span>
                                </div>
                            ) : status.canInstall ? (
                                <>
                                    <div className="ub-warn">The game restarts to update: anyone in your room is disconnected. Your coins, cosmetics and look are kept.</div>
                                    <div className="ub-buttons">
                                        <button className="ub-primary" onClick={() => void update()}>Update now</button>
                                        <button onClick={() => setOpen(false)}>Later</button>
                                    </div>
                                </>
                            ) : (
                                <div className="ub-buttons">
                                    <button className="ub-primary" onClick={() => openExternal(status.releaseUrl)}>Download from GitHub</button>
                                    <button onClick={() => setOpen(false)}>Later</button>
                                </div>
                            )}
                            {(error || status.error) && <div className="ub-error">{error || status.error}</div>}
                        </>
                    ) : (
                        <>
                            <div className="ub-title">Murder at Sinclair Mansion v{VERSION}</div>
                            <div className="ub-sub">
                                {!HAS_UPDATER ? "Running from source: pull the repo to update." : status?.latest ? "You have the latest version." : "Checking for updates..."}
                            </div>
                            <div className="ub-buttons">
                                <button onClick={() => openExternal(status?.releaseUrl ?? RELEASES)}>Release notes</button>
                                <button onClick={() => setOpen(false)}>Close</button>
                            </div>
                        </>
                    )}
                </div>
            )}
            <div className="ub-row">
                <button className="ub-version" title="Version and updates" onClick={() => setOpen((o) => !o)}>
                    v{status?.current ?? VERSION}
                </button>
                {available && (
                    <button className={`ub-update${busy ? "" : " pulse"}`} onClick={() => setOpen(true)}>
                        {busy ? (phase !== "idle" ? "Installing..." : `Updating ${Math.round((status?.progress ?? 0) * 100)}%`) : `Update to v${status?.latest}`}
                    </button>
                )}
            </div>
        </div>
    );
}
