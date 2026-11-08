// Overlay data travels in the GAMEMODE_DATA packet (JSON) under a `hud`
// key; the client routes it to the Murder at Sinclair Mansion overlay instead
// of the content store. Format: [opcode][len u16][flags][jsonLen u32][json, deflated when flags & 1].
import { deflateSync } from "zlib";

import { ServerPacketId } from "../../../client/common/packets/ServerPacketId";
import type { MurderHud } from "./MurderGame";

export const HUD_SNAPSHOT = "sinclair_hud";
export const HUD_REFRESH_TICKS = 5; // re-send the timer every 3 s; the client counts down in between
/** JSON longer than this goes deflated. */
const COMPRESS_OVER_BYTES = 4096;

export function encodeHudPacket(hud: MurderHud): Uint8Array {
    return encodeGamemodeData({ hud });
}

/** Any GAMEMODE_DATA payload (the HUD, or `datasets` for the client's content store). */
export function encodeGamemodeData(data: Record<string, unknown>): Uint8Array {
    const json = Buffer.from(JSON.stringify({ gamemodeId: "sinclair-mansion", ...data }), "utf-8");
    // Big payloads are deflated (the client inflates flag 1). Over PeerJS the host tab relays the
    // game's messages as they are, so this is what the relay carries; it also keeps the packet
    // inside its 16-bit length.
    const compressed = json.length > COMPRESS_OVER_BYTES;
    const body = compressed ? deflateSync(json) : json;
    const dataLen = 1 + 4 + body.length;
    if (dataLen > 0xffff) throw new Error(`GAMEMODE_DATA payload too big (${json.length} bytes of JSON)`);
    const packet = new Uint8Array(3 + dataLen);
    packet[0] = ServerPacketId.GAMEMODE_DATA;
    packet[1] = (dataLen >> 8) & 0xff;
    packet[2] = dataLen & 0xff;
    packet[3] = compressed ? 1 : 0; // flags: bit 0 = deflated
    packet[4] = (json.length >> 24) & 0xff;
    packet[5] = (json.length >> 16) & 0xff;
    packet[6] = (json.length >> 8) & 0xff;
    packet[7] = json.length & 0xff;
    packet.set(body, 8);
    return packet;
}
