// Playing over the internet without opening router ports, using PeerJS (WebRTC). The host's
// browser registers the room code as its PeerJS id; a friend's browser connects to it, and the
// host's browser pipes that data channel into its own game server's WebSocket:
//
//   friend's client --PeerSocket--> (WebRTC) --> PeerHost (host's tab) --WebSocket--> host's server
//
// PeerJS's free cloud (0.peerjs.com) only introduces the two browsers; the data always goes through
// PeerJS's free TURN relays, so neither browser learns the other's IP address (PeerConfig.ts).
// The game server never knows: each friend is one more WebSocket client (from 127.0.0.1).
import Peer, { type DataConnection, type PeerError } from "peerjs";

import { MAX_PEER_MESSAGE_BYTES, PEER_OPTIONS } from "./PeerConfig";
import { FrameReader, toFrames } from "./PeerFrames";

const PEER_PREFIX = "sinclair-mansion-";
/** How long a friend waits for the host's browser to answer. */
const CONNECT_TIMEOUT_MS = 20_000;
/** Friends one room's host relays at once (rooms seat 12; the rest is headroom for probes). */
const MAX_LINKS = 24;
/** What a friend accepts from the host's game server in one message (the host only relays it). */
const MAX_SERVER_MESSAGE_BYTES = 32 * 1024 * 1024;

/** The PeerJS id a room is reachable at. */
export function peerIdFor(roomCode: string): string {
    return `${PEER_PREFIX}${roomCode.toLowerCase()}`;
}

/** Calls `onMessage` with each whole message, in order (Blob chunks are read one at a time). */
function readFrames(conn: DataConnection, maxBytes: number, onMessage: (data: ArrayBuffer | string) => void): void {
    const reader = new FrameReader(maxBytes);
    let queue = Promise.resolve();
    conn.on("data", (data: unknown) => {
        queue = queue.then(async () => {
            if (!(data instanceof Blob || data instanceof ArrayBuffer || ArrayBuffer.isView(data))) return; // not a frame
            const bytes = data instanceof Blob ? await data.arrayBuffer() : data;
            const message = reader.push(bytes);
            if (message === null) conn.close(); // over the size limit: a broken or hostile peer
            else if (message !== undefined) onMessage(message);
        });
    });
}

function sendFrames(conn: DataConnection, data: ArrayBuffer | ArrayBufferView | string): void {
    for (const frame of toFrames(data)) conn.send(frame);
}

/**
 * A WebSocket look-alike (what the connection code uses of one) that talks to a room's host over
 * PeerJS. Created for `peer://<room code>` server URLs.
 */
export class PeerSocket extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = PeerSocket.CONNECTING;
    binaryType: BinaryType = "arraybuffer";
    private readonly peer = new Peer(PEER_OPTIONS);
    private conn?: DataConnection;
    private timer?: ReturnType<typeof setTimeout>;

    constructor(readonly roomCode: string) {
        super();
        this.timer = setTimeout(() => this.fail("The host's game didn't answer."), CONNECT_TIMEOUT_MS);
        this.peer.on("open", () => {
            const conn = this.peer.connect(peerIdFor(roomCode), { reliable: true, serialization: "raw" });
            this.conn = conn;
            conn.on("open", () => {
                if (this.readyState !== PeerSocket.CONNECTING) return;
                clearTimeout(this.timer);
                this.readyState = PeerSocket.OPEN;
                this.dispatchEvent(new Event("open"));
            });
            readFrames(conn, MAX_SERVER_MESSAGE_BYTES, (data) => {
                if (this.readyState === PeerSocket.OPEN) this.dispatchEvent(new MessageEvent("message", { data }));
            });
            conn.on("close", () => this.finish(1006, "host gone", false));
            conn.on("error", (err) => this.fail(err.message));
        });
        // "peer-unavailable": no host with that code is online right now.
        this.peer.on("error", (err: PeerError<string>) =>
            this.fail(err.type === "peer-unavailable" ? "No game with that room code is online." : err.message),
        );
    }

    send(data: ArrayBuffer | ArrayBufferView | string): void {
        if (this.readyState !== PeerSocket.OPEN || !this.conn) return;
        sendFrames(this.conn, data);
    }

    close(code = 1000, reason = ""): void {
        this.finish(code, reason, true);
    }

    private fail(reason: string): void {
        if (this.readyState >= PeerSocket.CLOSING) return;
        this.dispatchEvent(Object.assign(new Event("error"), { message: reason }));
        this.finish(1006, reason, false);
    }

    private finish(code: number, reason: string, wasClean: boolean): void {
        if (this.readyState === PeerSocket.CLOSED) return;
        clearTimeout(this.timer);
        this.readyState = PeerSocket.CLOSED;
        try {
            this.conn?.close();
        } catch {}
        this.peer.destroy();
        this.dispatchEvent(new CloseEvent("close", { code, reason, wasClean }));
    }
}

/** Whether a room code's host answers over PeerJS (connects, then hangs up). */
export function probePeer(roomCode: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    return new Promise((resolve) => {
        const socket = new PeerSocket(roomCode);
        let reason = "The host's game didn't answer.";
        socket.addEventListener("error", (e) => (reason = (e as Event & { message?: string }).message || reason));
        socket.addEventListener("open", () => {
            resolve({ ok: true });
            socket.close(1000, "probe");
        });
        socket.addEventListener("close", () => resolve({ ok: false, reason }));
    });
}

export type PeerHostStatus = "connecting" | "ready" | { error: string };

/**
 * The host's side: answers PeerJS connections to the room code and pipes each into its own
 * WebSocket to this game server. Lives in the host's browser tab while their room is open.
 */
export class PeerHost {
    private peer: Peer;
    private readonly links = new Set<{ conn: DataConnection; ws: WebSocket }>();
    private destroyed = false;

    constructor(
        readonly roomCode: string,
        private readonly serverUrl: string,
        private readonly onStatus: (status: PeerHostStatus) => void,
    ) {
        onStatus("connecting");
        this.peer = new Peer(peerIdFor(roomCode), PEER_OPTIONS);
        this.peer.on("open", () => onStatus("ready"));
        this.peer.on("connection", (conn) => this.bridge(conn));
        // Lost the PeerJS cloud (not the friends already connected): register again shortly.
        // After a fatal error (reported by "error" below) PeerJS has destroyed the peer: no retry.
        this.peer.on("disconnected", () => {
            if (this.destroyed || this.peer.destroyed) return;
            onStatus("connecting");
            setTimeout(() => !this.destroyed && !this.peer.destroyed && this.peer.reconnect(), 3000);
        });
        this.peer.on("error", (err: PeerError<string>) => {
            if (err.type === "peer-unavailable") return; // a friend's probe for someone else
            onStatus({
                error: err.type === "unavailable-id" ? "This room code is already being shared from another tab."
                    : err.type === "network" || err.type === "server-error" || err.type === "socket-error" ? "Couldn't reach the PeerJS network (is the internet down?)."
                    : err.message,
            });
        });
    }

    private bridge(conn: DataConnection): void {
        if (this.links.size >= MAX_LINKS) {
            conn.on("open", () => conn.close());
            return;
        }
        const ws = new WebSocket(this.serverUrl);
        ws.binaryType = "arraybuffer";
        const link = { conn, ws };
        this.links.add(link);
        const waiting: Array<ArrayBuffer | string> = [];
        const end = () => {
            this.links.delete(link);
            try {
                ws.close(1000, "peer left");
            } catch {}
            try {
                conn.close();
            } catch {}
        };
        readFrames(conn, MAX_PEER_MESSAGE_BYTES, (data) => (ws.readyState === WebSocket.OPEN ? ws.send(data) : waiting.push(data)));
        ws.addEventListener("open", () => waiting.splice(0).forEach((data) => ws.send(data)));
        ws.addEventListener("message", (e) => conn.open && sendFrames(conn, e.data as ArrayBuffer | string));
        ws.addEventListener("close", end);
        conn.on("close", end);
        conn.on("error", end);
    }

    destroy(): void {
        this.destroyed = true;
        for (const { conn, ws } of this.links) {
            try {
                ws.close(1000, "host stopped");
                conn.close();
            } catch {}
        }
        this.links.clear();
        this.peer.destroy();
    }
}
