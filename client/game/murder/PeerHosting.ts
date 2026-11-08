// Keeps this tab sharing its room over PeerJS (see network/peer/PeerLink.ts) while it's connected
// to its own game server and that server has a room open. Friends anywhere then join with the
// room code, no router setup needed. Only one PeerHost at a time, for the current room code.
import { PeerHost, type PeerHostStatus } from "../../network/peer/PeerLink";

let host: PeerHost | undefined;
let status: PeerHostStatus | undefined;
const listeners = new Set<(s: PeerHostStatus | undefined) => void>();

function setStatus(s: PeerHostStatus | undefined): void {
    status = s;
    for (const cb of listeners) cb(s);
}

/** Share `roomCode` (this tab's own server at `serverUrl`), or stop sharing with undefined. */
export function setPeerHosting(roomCode: string | undefined, serverUrl: string): void {
    if (host && host.roomCode === roomCode) return;
    host?.destroy();
    host = undefined;
    setStatus(undefined);
    if (roomCode) host = new PeerHost(roomCode, serverUrl, (s) => host?.roomCode === roomCode && setStatus(s));
}

export function getPeerHostStatus(): PeerHostStatus | undefined {
    return status;
}

export function subscribePeerHostStatus(cb: (s: PeerHostStatus | undefined) => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
