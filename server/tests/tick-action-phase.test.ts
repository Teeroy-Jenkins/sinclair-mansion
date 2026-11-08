/**
 * Regression coverage for queued actions remaining independent of combat.
 *
 * Run with: npx tsx tests/tick-action-phase.test.ts
 */
import assert from "node:assert/strict";

import type { ServerServices } from "../src/game/ServerServices";
import type { ActionEffect } from "../src/game/actions/types";
import { TickPhaseService } from "../src/game/services/TickPhaseService";
import type { TickFrame } from "../src/game/tick/TickPhaseOrchestrator";

const inventoryEffect: ActionEffect = {
    type: "inventorySnapshot",
    playerId: 42,
};

let processedTick: number | undefined;
const services = {
    actionScheduler: {
        processTick: (tick: number): ActionEffect[] => {
            processedTick = tick;
            return [inventoryEffect];
        },
    },
} as unknown as ServerServices;
const frame = {
    tick: 125,
    actionEffects: [],
} as unknown as TickFrame;

new TickPhaseService(services).runActionPhase(frame);

assert.equal(processedTick, frame.tick);
assert.deepEqual(frame.actionEffects, [inventoryEffect]);

console.log("tick action phase tests passed");
