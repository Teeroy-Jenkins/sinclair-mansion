// Framing for game messages over a WebRTC data channel (see PeerSocket / PeerHost). A data
// channel message can't be as big as a WebSocket one (browsers cap it, some at 64 KB), so each
// message is cut into chunks with a one-byte header: bit 0 marks the last chunk of a message,
// bit 1 marks a text message. The channel is reliable and ordered, so chunks arrive in order.

import { MAX_PEER_MESSAGE_BYTES } from "./PeerConfig";

export const CHUNK_BYTES = 16 * 1024;
const LAST = 1;
const TEXT = 2;

/** One message (binary or text) as the frames to send. */
export function toFrames(data: ArrayBuffer | ArrayBufferView | string): Uint8Array[] {
    const text = typeof data === "string";
    const bytes =
        typeof data === "string" ? new TextEncoder().encode(data)
        : data instanceof ArrayBuffer ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const frames: Uint8Array[] = [];
    let at = 0;
    do {
        const part = bytes.subarray(at, at + CHUNK_BYTES);
        at += part.length;
        const frame = new Uint8Array(part.length + 1);
        frame[0] = (at >= bytes.length ? LAST : 0) | (text ? TEXT : 0);
        frame.set(part, 1);
        frames.push(frame);
    } while (at < bytes.length);
    return frames;
}

/**
 * Puts frames back together; `push` returns each whole message once its last chunk is in, or
 * null once a message grows past `maxBytes` (the other side is broken or hostile: hang up).
 */
export class FrameReader {
    private parts: Uint8Array[] = [];
    private size = 0;

    constructor(private readonly maxBytes = MAX_PEER_MESSAGE_BYTES) {}

    push(frame: ArrayBuffer | ArrayBufferView): ArrayBuffer | string | undefined | null {
        const bytes = frame instanceof ArrayBuffer ? new Uint8Array(frame) : new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength);
        if (bytes.length === 0) return undefined;
        this.size += bytes.length - 1;
        if (this.size > this.maxBytes) {
            this.parts = [];
            this.size = 0;
            return null;
        }
        this.parts.push(bytes.subarray(1));
        if (!(bytes[0] & LAST)) return undefined;
        const size = this.size;
        const whole = new Uint8Array(size);
        let at = 0;
        for (const p of this.parts) {
            whole.set(p, at);
            at += p.length;
        }
        this.parts = [];
        this.size = 0;
        return bytes[0] & TEXT ? new TextDecoder().decode(whole) : whole.buffer;
    }
}
