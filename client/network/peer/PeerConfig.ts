// Options for every PeerJS peer this game makes (rooms, friends joining, the room list).
//
// Privacy: by default WebRTC connects two browsers directly, which tells each one the other's
// public IP address (and with it, roughly where they live). Players here are strangers off a room
// list, so every connection is forced through a TURN relay instead (iceTransportPolicy "relay"):
// each browser only ever sees the relay's address, never another player's. No STUN server is
// listed, since STUN exists to discover and share the public address. The data is end-to-end
// encrypted (DTLS), so the relay carries it without being able to read it. The PeerJS signalling
// server (0.peerjs.com, over wss) only introduces the browsers and never forwards addresses to the
// other player: the relay-only policy means no address-bearing ICE candidates are offered.
import type { PeerOptions } from "peerjs";

/** PeerJS's free public TURN servers (the same ones PeerJS uses by default). UDP, then TCP. */
const ICE_SERVERS: RTCIceServer[] = [
    {
        urls: [
            "turn:eu-0.turn.peerjs.com:3478",
            "turn:us-0.turn.peerjs.com:3478",
            "turn:eu-0.turn.peerjs.com:3478?transport=tcp",
            "turn:us-0.turn.peerjs.com:3478?transport=tcp",
        ],
        username: "peerjs",
        credential: "peerjsp",
    },
];

/** Relay-only WebRTC: peers never learn each other's IP addresses. */
export const PEER_OPTIONS: PeerOptions = {
    config: {
        iceServers: ICE_SERVERS,
        iceTransportPolicy: "relay",
    },
    // Errors only: PeerJS's chattier log levels print connection details to the console.
    debug: 1,
};

/** The biggest single game message accepted from another browser (the server takes up to 1 MB). */
export const MAX_PEER_MESSAGE_BYTES = 1024 * 1024;
