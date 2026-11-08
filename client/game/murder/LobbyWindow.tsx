// The lobby window. Before you're in a game: two buttons, Join (the server browser: this
// server's room, rooms on the local network and in the matchmaking registry, saved addresses,
// or a room code) and Host (name, optional password, bots). Once you're in the lobby it's a
// small panel in the corner so you can walk around; the host starts the game or changes its
// settings there.
// Buttons send a "sinclair_lobby" gamemode message (not chat, so a password never shows up there).
// The server answers Host and Join with `hud.notice`: an error to show, or a redirect when a
// room code belongs to another server (this window then reconnects there and joins).
import { useEffect, useRef, useState } from "react";

import { getDefaultServerAddress } from "../../config/clientEnv";
import { getLastUrl, sendGamemodeMessage } from "../../network/ServerConnection";
import { probePeer, type PeerHostStatus } from "../../network/peer/PeerLink";
import { watchInternetRooms } from "../../network/peer/PeerRoomList";
import { getPeerHostStatus, subscribePeerHostStatus } from "./PeerHosting";
import "./LobbyWindow.css";
import { LobbyView, MurderHud, ServerEntry } from "./MurderHudStore";

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 12;
const NAME_MAX = 24;
const PASSWORD_MAX = 20;
const DEFAULT_PORT = 43594;

const lobby = (action: string, payload: Record<string, unknown> = {}) => sendGamemodeMessage("sinclair_lobby", { action, ...payload });

/** Moves the client to another server; `then` runs once logged in there (optional). */
export type SwitchServer = (address: string, then?: () => void) => void;

/** A join waiting for the login on another server (the password goes with it). */
let pendingJoin: { address: string; password: string; roomCode?: string; until: number } | undefined;
const ROOM_CODE_LENGTH = 6;
/** A typed or pasted room code: upper case, letters and numbers only. */
const cleanCode = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);

/** A Host pressed on a friend's game, waiting for the login back on your own. */
let pendingHost: { settings: Record<string, unknown>; until: number } | undefined;

/**
 * Your own copy of the game: the server that served this page (the zip build), or the
 * configured default (development). You always host there.
 */
function homeServer(): string {
    const address = getDefaultServerAddress();
    return /:\d+$/.test(address) ? address : `${address}:${DEFAULT_PORT}`;
}

/** Whether this tab is connected to its own copy of the game (so it hosts that copy's room). */
export function atHomeServer(): boolean {
    const home = homeServer();
    return isEquivalentServer(home) || sameServer(home);
}

const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
const shield = { onKeyDown: stop, onKeyUp: stop, onMouseDown: stop, onWheel: stop };

function Seats({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    return (
        <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
                <option key={n} value={n}>{n}</option>
            ))}
        </select>
    );
}

/** Hosting: name, password, cap and bots. The host's later changes leave the name alone. */
function SettingsForm({ initial, submitLabel, onSubmit, onBack, minSeats, withName }: {
    initial: { name: string; maxPlayers: number; fillWithBots: boolean; locked?: boolean };
    submitLabel: string;
    onSubmit: (s: { name?: string; password?: string; maxPlayers: number; fillWithBots: boolean }) => void;
    onBack: () => void;
    minSeats?: number;
    withName: boolean;
}) {
    const [name, setName] = useState(initial.name);
    const [password, setPassword] = useState("");
    const [maxPlayers, setMaxPlayers] = useState(initial.maxPlayers);
    const [fillWithBots, setFillWithBots] = useState(initial.fillWithBots);
    const [removePassword, setRemovePassword] = useState(false);
    // Blank keeps a lobby's existing password; "Remove password" clears it.
    const passwordField = removePassword ? { password: "" } : password || !initial.locked ? { password } : {};
    const seats = Math.max(maxPlayers, minSeats ?? MIN_PLAYERS);
    return (
        <div className="lw-form">
            {withName && (
                <label>
                    <span>Server name</span>
                    <input value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
                </label>
            )}
            <label>
                <span>Password</span>
                <input
                    type="password"
                    value={password}
                    maxLength={PASSWORD_MAX}
                    placeholder={initial.locked ? "(unchanged)" : "(optional)"}
                    disabled={removePassword}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </label>
            {initial.locked && (
                <label className="lw-check">
                    <input type="checkbox" checked={removePassword} onChange={(e) => setRemovePassword(e.target.checked)} />
                    <span>Remove password</span>
                </label>
            )}
            <label>
                <span>Players</span>
                <Seats value={seats} onChange={setMaxPlayers} />
            </label>
            <label className="lw-check">
                <input type="checkbox" checked={fillWithBots} onChange={(e) => setFillWithBots(e.target.checked)} />
                <span>Fill empty seats with bots</span>
            </label>
            <button className="lw-primary" onClick={() => onSubmit({ ...(withName ? { name } : {}), maxPlayers: seats, fillWithBots, ...passwordField })}>
                {submitLabel}
            </button>
            <button onClick={onBack}>Back</button>
        </div>
    );
}

/** One row of the browser: this server's game, a saved address, or one heard on the network. */
interface Row extends ServerEntry {
    here: boolean;
    saved?: boolean;
    /** Friendly display name for this server. */
    label: string;
    /** A masked version of the address for status text (hides the raw IP). */
    maskedAddress?: string;
    /** A saved address that didn't answer, or answered with no game hosted. */
    offline?: string;
    /** Whether this entry came from the matchmaking registry. */
    matchmaking?: boolean;
    /** A room hosted over the internet (the PeerJS room list); joined with its code. */
    internet?: boolean;
}

const SAVED_KEY = "sinclair.savedServers";
const PROBE_MS = 4000;
/** Track pending probes to avoid flooding when many saved servers are down. */
const pendingProbes = new Map<string, AbortController>();

/** Saved server entry: address + optional user-assigned label. */
type SavedServer = { address: string; label?: string };

function maskAddress(address: string): string {
    const [host, port] = address.split(":");
    const parts = host.split(".");
    if (parts.length === 4) {
        // Private ranges: hide the last octet; others: mask middle octets
        const p = Number(parts[0]);
        if (p === 10 || p === 172 || p === 192) {
            return `${parts[0]}.${parts[1]}.x.x${port ? ":" + port : ""}`;
        }
        return `xxx.xxx.${parts[2]}.${parts[3]}${port ? ":" + port : ""}`;
    }
    // Non-IP (hostname): show first 4 chars + masked remainder
    return host.length <= 4 ? host : host.slice(0, 4) + "***" + (port ? ":" + port : "");
}

function generateLabel(address: string): string {
    return "Sinclair Server" + (address !== "127.0.0.1" && address !== "localhost" ? ` (${maskAddress(address)})` : "");
}

function loadSaved(): SavedServer[] {
    try {
        const list = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
        if (!Array.isArray(list)) return [];
        return list.filter((s): s is SavedServer => s && typeof s.address === "string").slice(0, 30);
    } catch {
        return [];
    }
}

function storeSaved(list: SavedServer[]): void {
    try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch {}
}

/** Asks a saved server what it's hosting (its public /status). */
async function probe(address: string): Promise<Row> {
    const label = generateLabel(address);
    const masked = maskAddress(address);
    const base: Row = { address, name: address, host: "", players: 0, maxPlayers: 0, locked: false, inGame: false, here: false, saved: true, label, maskedAddress: masked };
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(`http://${address}/status`, { signal: ctrl.signal, cache: "no-store" });
        clearTimeout(timer);
        const s = await res.json();
        if (s?.game !== "sinclair-mansion") return { ...base, offline: "Not a Sinclair Mansion server" };
        if (!s.lobby) return { ...base, offline: "Online, nobody hosting yet" };
        return { ...base, ...s.lobby, address, here: false, saved: true };
    } catch {
        return { ...base, offline: `Not reachable (${masked})` };
    }
}

function ServerBrowser({ hud, onBack, onSwitchServer, onRoomCode }: { hud: MurderHud; onBack: () => void; onSwitchServer?: SwitchServer; onRoomCode?: () => void }) {
    const [selected, setSelected] = useState<string | undefined>();
    const [password, setPassword] = useState("");
    const [saved, setSaved] = useState<SavedServer[]>(loadSaved);
    const [probed, setProbed] = useState<Record<string, Row>>({});
    const [mmServers, setMmServers] = useState<ServerEntry[]>([]);
    const [netRooms, setNetRooms] = useState<ServerEntry[]>([]);
    const [note, setNote] = useState("");
    // Rooms friends host over the internet (network/peer/PeerRoomList.ts).
    useEffect(
        () => watchInternetRooms((rooms) => setNetRooms(rooms.map((r) => ({ ...r, address: `peer:${r.roomCode}` })))),
        [],
    );
    // Ask the server for the LAN list while the browser is open.
    useEffect(() => {
        lobby("browse", { open: true });
        // Rooms on other servers, from the matchmaking registry
        const refresh = async () => {
            try {
                const r = await fetch(gameServerHttp("/matchmaking/servers"), { signal: AbortSignal.timeout(5000), cache: "no-store" });
                if (r.ok) {
                    const data = await r.json();
                    if (Array.isArray(data)) setMmServers(data);
                }
            } catch { /* Silent fail — local/LAN list still works */ }
        };
        refresh();
        const timer = setInterval(refresh, PROBE_MS);
        return () => {
            lobby("browse", { open: false });
            clearInterval(timer);
        };
    }, []);
    // Check on the saved servers every few seconds, with per-address debounce
    // to avoid flooding when many saved servers are down.
    useEffect(() => {
        let live = true;
        const run = () => {
            for (const entry of saved) {
                const address = entry.address;
                // Skip if this address already has a pending probe
                if (pendingProbes.has(address)) continue;
                const ctrl = new AbortController();
                pendingProbes.set(address, ctrl);
                void probe(address).finally(() => pendingProbes.delete(address)).then((row) => {
                    if (!live) return;
                    setProbed((p) => ({ ...p, [address]: row }));
                });
            }
        };
        run();
        const timer = setInterval(run, PROBE_MS);
        return () => {
            live = false;
            clearInterval(timer);
            // Cancel any remaining probes
            for (const ctrl of pendingProbes.values()) ctrl.abort();
            pendingProbes.clear();
        };
    }, [saved]);
    const forget = (address: string) => {
        const next = saved.filter((s) => s.address !== address);
        storeSaved(next);
        setSaved(next);
    };
    const rename = () => {
        const entry = saved.find((s) => s.address === selected);
        if (!entry) return;
        const currentLabel = entry.label || entry.address;
        const name = prompt("Rename this server:", currentLabel);
        if (name === null || name === currentLabel) return;
        const next = saved.map((s) => (s.address === selected ? { ...s, label: name.slice(0, 24) } : s));
        storeSaved(next);
        setSaved(next);
    };
    const view = hud.lobby;
    // The same room can be heard on the LAN and in the registry: list each room code once,
    // this server's own room first.
    const listed = new Set(view?.roomCode ? [view.roomCode] : []);
    const fresh = (s: ServerEntry) => {
        if (sameServer(s.address) || saved.find((entry) => entry.address === s.address)) return false;
        if (!s.roomCode) return true;
        if (listed.has(s.roomCode)) return false;
        listed.add(s.roomCode);
        return true;
    };
    const lan = (hud.servers ?? []).filter(fresh);
    const mm = mmServers.filter(fresh);
    const net = netRooms.filter(fresh);
    const rows: Row[] = [
        ...(view
            ? [{ address: "", name: view.name, host: view.host, players: view.players.length, maxPlayers: view.maxPlayers, locked: view.locked, inGame: view.inGame, here: true, roomCode: view.roomCode, label: view.name }]
            : []),
        ...saved.filter((s) => !sameServer(s.address)).map((s) => {
            const p = probed[s.address];
            if (p) return { ...p, label: s.label || p.label };
            const masked = maskAddress(s.address);
            return { address: s.address, name: s.address, host: "", players: 0, maxPlayers: 0, locked: false, inGame: false, here: false, saved: true, label: s.label || generateLabel(s.address), maskedAddress: masked, offline: "Checking..." };
        }),
        ...lan.map((s) => ({ ...s, here: false, label: s.name })),
        // Matchmaking servers (cross-server lobby discovery)
        ...mm.map((s) => ({
            address: s.address,
            name: s.name,
            host: s.host,
            players: s.players,
            maxPlayers: s.maxPlayers,
            locked: s.locked,
            inGame: s.inGame,
            here: false,
            roomCode: s.roomCode,
            label: s.name,
            matchmaking: true,
        })),
        ...net.map((s) => ({ ...s, here: false, label: s.name, internet: true })),
    ];
    const pick = rows.find((r) => rowKey(r) === selected);
    const join = (row: Row) => {
        if (row.here) return lobby("join", { password, roomCode: row.roomCode });
        if (!row.internet) return goTo(row.address, password, row.roomCode, onSwitchServer);
        // As with a typed code: check the host answers before leaving your own game.
        const roomCode = row.roomCode ?? "";
        setNote("Connecting to that game over the internet...");
        void probePeer(roomCode).then((r) => {
            if (!r.ok) return setNote(`${r.reason} The game may have just closed.`);
            setNote("Found it. Connecting...");
            goTo(row.address, password, roomCode, onSwitchServer);
        });
    };
    return (
        <div className="lw-form">
            <div className="lw-browser" role="listbox">
                {rows.length === 0 && (
                    <div className="lw-hint lw-empty">No games found. Use a room code to join.</div>
                )}
                {rows.map((r) => {
                    const full = !r.offline && r.players >= r.maxPlayers;
                    return (
                        <div
                            key={rowKey(r)}
                            role="option"
                            aria-selected={rowKey(r) === selected}
                            className={`lw-server${rowKey(r) === selected ? " lw-selected" : ""}${full || r.offline ? " lw-full" : ""}`}
                            onClick={() => setSelected(rowKey(r))}
                            onDoubleClick={() => !full && !r.offline && !r.locked && join(r)}
                        >
                            <span className="lw-server-name">{r.locked ? "🔒 " : ""}{r.label}</span>
                            <span className="lw-server-count">{r.offline ? "" : `${r.players}/${r.maxPlayers}`}</span>
                            <span className="lw-server-info">
                                {r.here ? "This server" : "[hidden]"}
                                {r.offline ? ` · ${r.offline}` : ` · ${r.host || "?"} · ${r.inGame ? "In game" : "In lobby"}`}
                                {r.internet ? " · Internet" : r.matchmaking ? " · Network" : r.saved ? "" : r.here ? "" : " · LAN"}
                            </span>
                        </div>
                    );
                })}
            </div>
            {pick?.saved && (
                <>
                    <button className="lw-small" onClick={() => forget(pick.address)}>Remove from list</button>
                    <button className="lw-small" onClick={rename}>Rename</button>
                </>
            )}
            {pick?.locked && (
                <label>
                    <span>Password</span>
                    <input type="password" value={password} maxLength={PASSWORD_MAX} onChange={(e) => setPassword(e.target.value)} />
                </label>
            )}
            {pick?.inGame && <div className="lw-hint">A game is running: you'll watch as a ghost and play in the next one.</div>}
            {note && <div className="lw-hint">{note}</div>}
            <button
                className="lw-primary"
                disabled={!pick || !!pick.offline || pick.players >= pick.maxPlayers}
                onClick={() => pick && join(pick)}
            >
                {pick && !pick.offline && pick.players >= pick.maxPlayers ? "Full" : "Join"}
            </button>
            <button className="lw-secondary" onClick={() => onRoomCode?.()}>Use a room code</button>
            <button onClick={onBack}>Back</button>
        </div>
    );
}

const rowKey = (r: Row) => (r.here ? "here" : r.matchmaking ? `mm:${r.address}` : r.address);

/** A friend's game over PeerJS: "peer:<room code>" (see network/peer/PeerLink.ts). */
const isPeerAddress = (address: string) => address.startsWith("peer:");

/** Whether host:port (or peer:<code>) is the server this client is connected to. */
function sameServer(address: string): boolean {
    if (isPeerAddress(address)) return getLastUrl().toLowerCase() === `peer://${address.slice(5)}`.toLowerCase();
    try {
        const url = new URL(getLastUrl());
        if (url.protocol === "peer:") return false;
        return `${url.hostname}:${url.port || DEFAULT_PORT}` === address;
    } catch {
        return false;
    }
}

/** Whether two addresses point to the same machine (handles localhost ↔ 127.0.0.1 ↔ 0.0.0.0). */
function isEquivalentServer(address: string): boolean {
    if (isPeerAddress(address)) return sameServer(address);
    try {
        const url = new URL(getLastUrl());
        if (url.protocol === "peer:") return false;
        const currentHost = `${url.hostname}:${url.port || DEFAULT_PORT}`;
        // Normalize all localhost/wildcard variants to 127.0.0.1
        const normalize = (a: string): string =>
            a.replace(/^localhost/i, "127.0.0.1").replace(/^0\.0\.0\.0/i, "127.0.0.1");
        return normalize(currentHost) === normalize(address);
    } catch {
        return false;
    }
}

function goTo(address: string, password: string, roomCode: string | undefined, onSwitchServer?: SwitchServer) {
    // Already on this server — send the join message directly.
    if (sameServer(address) || isEquivalentServer(address)) {
        lobby("join", { password, roomCode });
        return;
    }
    if (!onSwitchServer) return;
    onSwitchServer(address, () => {
        pendingJoin = { address, password, roomCode, until: Date.now() + 30_000 };
    });
}

/**
 * An HTTP URL on the game server this client is connected to (its /matchmaking endpoints).
 * Not the page's own origin: in development the page comes from the client dev server.
 */
function gameServerHttp(path: string): string {
    try {
        const url = new URL(getLastUrl());
        url.protocol = url.protocol === "wss:" ? "https:" : "http:";
        return new URL(path, url).toString();
    } catch {
        return path;
    }
}

/** How friends join: the room code, and whether it's reachable over the internet (PeerJS). */
function ShareBox({ roomCode, sharing }: { roomCode?: string; sharing: boolean }) {
    const [copied, setCopied] = useState(false);
    const [peer, setPeer] = useState<PeerHostStatus | undefined>(getPeerHostStatus());
    useEffect(() => subscribePeerHostStatus(setPeer), []);
    if (!roomCode) return null;
    const copy = () => void navigator.clipboard?.writeText(roomCode).then(() => setCopied(true), () => {});
    const note = !sharing
        ? "Friends join with this room code while the game's host keeps their game open."
        : peer === "ready" ? "Send this code to your friends!"
        : typeof peer === "object" ? `${peer.error} Friends on your network can still join from the Join list.`
        : "Connecting to the internet so friends can join...";
    return (
        <div className="lw-share">
            <div className="lw-room-code">
                <span>Room code</span>
                <button className="lw-small lw-copy-code" title="Copy room code" onClick={copy}>
                    {copied ? "Copied!" : roomCode}
                </button>
            </div>
            <div className={`lw-hint${sharing && peer !== "ready" ? " lw-warn" : ""}`}>{note}</div>
        </div>
    );
}

/** The cosmetic store and your bank (OSRS interfaces; the server opens them between games only). */
function StoreButtons() {
    const open = (screen: "store" | "bank") => sendGamemodeMessage("sinclair_store", { open: screen });
    return (
        <div className="lw-store">
            <button onClick={() => open("store")}>Store</button>
            <button onClick={() => open("bank")}>Bank</button>
        </div>
    );
}

/** In the lobby: a panel in the corner. The host starts the game or changes the settings. */
function LobbyPanel({ view, you, sharing }: { view: LobbyView; you: MurderHud; sharing: boolean }) {
    const [editing, setEditing] = useState(false);
    const bots = view.fillWithBots ? Math.max(0, view.maxPlayers - view.players.length) : 0;
    useEffect(() => setEditing(false), [view.maxPlayers, view.fillWithBots, view.locked]);
    return (
        <div className="lobby-window lw-docked" {...shield}>
            <div className="lw-lobby-name">{view.locked ? "🔒 " : ""}{view.name}</div>
            <div className="lw-form">
                <div className="lw-row"><span>Players</span><span>{view.players.length}/{view.maxPlayers}{bots > 0 ? ` (+${bots} bots)` : ""}</span></div>
                <ul className="lw-players">
                    {view.players.map((n) => (
                        <li key={n}>{n}{n === view.host ? <span className="lw-host"> (host)</span> : null}</li>
                    ))}
                </ul>
                <ShareBox roomCode={view.roomCode} sharing={sharing} />
                {you.winner && <div className="lw-hint">Last game: the {you.winner === "detective" ? "household" : "Murderer"} won.</div>}
                {view.isHost ? (
                    editing ? (
                        <SettingsForm
                            initial={view}
                            submitLabel="Save"
                            minSeats={view.players.length}
                            withName={false}
                            onSubmit={(s) => lobby("configure", s)}
                            onBack={() => setEditing(false)}
                        />
                    ) : (
                        <>
                            <button className="lw-primary" disabled={!view.canStart} onClick={() => lobby("start")}>
                                Start game
                            </button>
                            {!view.canStart && <div className="lw-hint">Need {MIN_PLAYERS} players, or turn on bots.</div>}
                            <button onClick={() => setEditing(true)}>Change settings</button>
                        </>
                    )
                ) : (
                    <div className="lw-hint">Waiting for {view.host} to start the game...</div>
                )}
                {!editing && <StoreButtons />}
                {!editing && <button onClick={() => lobby("leave")}>Leave</button>}
            </div>
        </div>
    );
}

export function LobbyWindow({ hud, playerName, onSwitchServer }: { hud: MurderHud; playerName: string; onSwitchServer?: SwitchServer }) {
    const [screen, setScreen] = useState<"menu" | "join" | "host" | "code">("menu");
    const [code, setCode] = useState("");
    const [codePassword, setCodePassword] = useState("");
    const [status, setStatus] = useState("");
    /** The last server notice acted on (each one only once). */
    const handled = useRef(0);
    const view = hud.lobby;
    const notice = hud.notice;
    const home = homeServer();
    const atHome = isEquivalentServer(home) || sameServer(home);
    // The server's reply to a Join: the room is on another server here (LAN), or it isn't known
    // here at all, so look for its host over the internet (PeerJS).
    useEffect(() => {
        if (!notice || notice.id === handled.current) return;
        handled.current = notice.id;
        if (notice.redirect) {
            setStatus("That game is on your network. Connecting...");
            goTo(notice.redirect.address, codePassword, notice.redirect.roomCode, onSwitchServer);
        } else if (notice.tryPeer) {
            const roomCode = notice.tryPeer;
            setStatus("Looking for that game over the internet...");
            // Check the host answers before leaving your own game, so a dead code doesn't log you out.
            void probePeer(roomCode).then((r) => {
                if (!r.ok) return setStatus(`${r.reason} Check the code, and that your friend's game is still open.`);
                setStatus("Found it. Connecting...");
                goTo(`peer:${roomCode}`, codePassword, roomCode, onSwitchServer);
            });
        } else {
            setStatus("");
        }
    }, [notice, codePassword, onSwitchServer]);
    // Just arrived from another server: join its game, or host on our own.
    useEffect(() => {
        if (hud.joined) return;
        if (pendingHost) {
            if (Date.now() < pendingHost.until && atHome) lobby("host", pendingHost.settings);
            pendingHost = undefined;
        }
        if (!pendingJoin) return;
        if (Date.now() < pendingJoin.until && (sameServer(pendingJoin.address) || isEquivalentServer(pendingJoin.address))) {
            lobby("join", { password: pendingJoin.password, roomCode: pendingJoin.roomCode });
        }
        pendingJoin = undefined;
    }, [hud.joined, view, atHome]);
    useEffect(() => {
        setScreen("menu");
        setStatus(""); // a "Connecting..." from before joining (or leaving) is over
    }, [hud.joined]);
    // Entering the room code screen fills in a code from the clipboard (a host's "Copy").
    useEffect(() => {
        if (screen !== "code") return;
        void navigator.clipboard?.readText().then((text) => {
            const pasted = cleanCode(text);
            if (pasted.length === ROOM_CODE_LENGTH) setCode(pasted);
        }, () => {});
    }, [screen]);
    if (hud.joined && view) return <LobbyPanel view={view} you={hud} sharing={atHome} />;
    /** Your own server looks first (its room, the LAN); a code it doesn't know comes back as tryPeer. */
    const joinByCode = () => {
        if (code.length !== ROOM_CODE_LENGTH) return setStatus("A room code is 6 letters and numbers.");
        setStatus(`Looking for room ${code}...`);
        lobby("join", { roomCode: code, password: codePassword });
    };
    /** You always host on your own copy of the game: from a friend's, go home first. */
    const host = (settings: Record<string, unknown>) => {
        if (atHome || !onSwitchServer) return lobby("host", settings);
        setStatus("Going back to your own game to host...");
        onSwitchServer(home, () => {
            pendingHost = { settings, until: Date.now() + 30_000 };
        });
    };
    const go = (next: typeof screen) => {
        setStatus("");
        setScreen(next);
    };
    const error = notice?.error;
    return (
        <div className="lobby-window" {...shield}>
            <div className="lw-title">Murder at Sinclair Mansion</div>
            {error && <div className="lw-hint lw-error">{error}</div>}
            {status && !error && <div className="lw-hint">{status}</div>}
            {screen === "menu" && (
                <div className="lw-form lw-menu">
                    <button className="lw-big" onClick={() => go("join")}>Join</button>
                    <button className="lw-big" onClick={() => go("host")}>Host</button>
                    <button className="lw-secondary" onClick={() => go("code")}>Join with a room code</button>
                    <StoreButtons />
                </div>
            )}
            {screen === "join" && (
                <>
                    <div className="lw-subtitle">Join a game</div>
                    <ServerBrowser hud={hud} onBack={() => go("menu")} onSwitchServer={onSwitchServer} onRoomCode={() => go("code")} />
                </>
            )}
            {screen === "host" &&
                (view && atHome ? (
                    <div className="lw-form">
                        <div className="lw-hint">Your game is already open: "{view.name}", hosted by {view.host}. Join it from the list.</div>
                        <button onClick={() => go("join")}>Join instead</button>
                        <button onClick={() => go("menu")}>Back</button>
                    </div>
                ) : (
                    <>
                        <div className="lw-subtitle">Host a game</div>
                        {!atHome && <div className="lw-hint">You'll host on your own copy of the game; friends join with your room code.</div>}
                        <SettingsForm
                            initial={{ name: `${playerName || "My"}'s game`, maxPlayers: 8, fillWithBots: false }}
                            submitLabel="Host"
                            withName
                            onSubmit={host}
                            onBack={() => go("menu")}
                        />
                    </>
                ))}
            {screen === "code" && (
                <div className="lw-form">
                    <div className="lw-subtitle">Join with a room code</div>
                    <label>
                        <span>Room code</span>
                        <input
                            value={code}
                            maxLength={ROOM_CODE_LENGTH + 2}
                            placeholder="e.g. ABCD12"
                            autoFocus
                            onChange={(e) => setCode(cleanCode(e.target.value))}
                            onKeyDown={(e) => e.key === "Enter" && joinByCode()}
                        />
                    </label>
                    <label>
                        <span>Password</span>
                        <input
                            type="password"
                            value={codePassword}
                            maxLength={PASSWORD_MAX}
                            placeholder="(if it has one)"
                            onChange={(e) => setCodePassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && joinByCode()}
                        />
                    </label>
                    <button className="lw-primary" disabled={code.length !== ROOM_CODE_LENGTH} onClick={joinByCode}>
                        Join
                    </button>
                    <button onClick={() => go("menu")}>Back</button>
                </div>
            )}
        </div>
    );
}
