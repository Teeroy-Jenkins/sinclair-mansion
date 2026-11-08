/**
 * Regression coverage for face-entity sync after auto-retaliation.
 *
 * Run with: npx tsx tests/combat-interaction-facing.test.ts
 */
import assert from "node:assert/strict";

import { encodeInteractionIndex } from "../src/game/interactionIndex";
import { deriveInteractionIndex } from "../src/game/interactions/InteractionViewBuilder";
import type { NpcState } from "../src/game/npc";
import type { PlayerState } from "../src/game/player";

const npcInteractionIndex = encodeInteractionIndex("npc", 42);
const player = {
    level: 0,
    getInteractionIndex: () => npcInteractionIndex,
} as unknown as PlayerState;

const derived = deriveInteractionIndex({
    player,
    interaction: undefined,
    playerLookup: () => undefined,
    npcLookup: () => undefined as NpcState | undefined,
});

assert.equal(
    derived,
    npcInteractionIndex,
    "canonical actor facing must survive without a legacy click-interaction entry",
);

console.log("combat interaction facing regression test passed");
