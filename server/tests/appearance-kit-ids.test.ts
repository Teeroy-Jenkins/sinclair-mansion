// Kits past 255 (many of the character designer's newer torsos, arms, legs and beards) must
// reach the client as kits, not be misread as worn items and vanish.
import assert from "node:assert/strict";

import { decodeAppearanceBinary } from "../../client/game/sync/AppearanceDecoder";
import { encodeAppearanceBinary } from "../src/network/encoding/AppearanceEncoder";
import type { PlayerViewSnapshot } from "../src/network/encoding/types";

const equip = new Array<number>(14).fill(-1);
equip[0] = 1153; // iron full helm (head slot)
const kits = [9, 117, 257, 263, 34, 281, 43];
const bytes = encodeAppearanceBinary({
    appearance: { gender: 0, kits, colors: [1, 2, 3, 4, 5], equip },
    name: "Bob",
} as unknown as PlayerViewSnapshot);
const decoded = decodeAppearanceBinary(bytes);
assert.ok(decoded, "appearance decodes");
// The helm covers the hair slot; every other kit (including 257, 263, 281) arrives intact.
assert.deepEqual(decoded!.kits.slice(1, 7), kits.slice(1, 7), "kits past 255 stay kits");
assert.equal(decoded!.equipment[0], 1153, "worn items still decode as items");
assert.equal(decoded!.npcId, -1, "a player is a player unless transformed");

// A ghost shown as an NPC (OSRS's transform): the NPC id arrives, and the rest still decodes.
const ghost = decodeAppearanceBinary(encodeAppearanceBinary({
    appearance: { gender: 0, kits, colors: [1, 2, 3, 4, 5], equip, npcId: 289 },
    anim: { idle: 1275, walk: 819 },
    name: "Casper",
} as unknown as PlayerViewSnapshot));
assert.equal(ghost?.npcId, 289, "transformed into the ghoul");
assert.equal(ghost?.name, "Casper", "the name after the transform still lines up");
assert.equal(ghost?.anim.idle, 1275, "the NPC's own stand animation");
assert.deepEqual(ghost?.colors, [1, 2, 3, 4, 5]);
console.log("appearance kit ids: ok");
