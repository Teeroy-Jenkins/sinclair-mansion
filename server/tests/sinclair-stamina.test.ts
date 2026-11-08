// The butler's stamina potion, as OSRS's: run energy drains 70% slower for 2 minutes, and the
// effect reaches the client (which turns the run orb orange, varbit 25) and clears when it ends.
import assert from "node:assert/strict";
import { RUN_ENERGY_MAX } from "../src/game/actor";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import { PlayerState } from "../src/game/player";
import { MovementService } from "../src/game/services/MovementService";
import { encodeMessage } from "../src/network/messages";
import { decodeServerPacket } from "../../client/network/packet/ServerBinaryDecoder";

registerSkillConfiguration({ computeCombatLevel: () => 3, skillRestoreIntervalTicks: 100, skillBoostDecayIntervalTicks: 100, hitpointRegenIntervalTicks: 100, hitpointOverhealDecayIntervalTicks: 100, preserveDecayMultiplier: 1.5 } as any);
const MODE: any = { id: "stamina-test", name: "stamina test", initializePlayer: () => undefined, canInteract: () => true };
let now = 1000;
const mv = new MovementService({
    inventoryService: { getInventory: () => [] },
    equipmentService: { ensureEquipArray: () => [] },
    ticker: { currentTick: () => now },
    tickMs: 600,
} as any);

function runFor(ticks: number, stamina: boolean): PlayerState {
    now = 1000;
    const p = new PlayerState(1, 3200, 3200, 0, MODE);
    p.energy.setRunEnergyUnits(RUN_ENERGY_MAX);
    if (stamina) p.energy.applyStaminaEffect(now, 200, 0.3);
    for (let i = 0; i < ticks; i++) mv.updateRunEnergy(p, { ran: true, moved: true, runSteps: 2 }, ++now);
    return p;
}

const plain = RUN_ENERGY_MAX - runFor(50, false).energy.getRunEnergyUnits();
const p = runFor(50, true);
const slowed = RUN_ENERGY_MAX - p.energy.getRunEnergyUnits();
assert.ok(Math.abs(slowed / plain - 0.3) < 0.02, `stamina drain ${slowed} vs ${plain}`);

const payload = mv.buildRunEnergyPayload(p)!;
assert.equal(payload.staminaTicks, 150);
const dec = (m: any) => decodeServerPacket(m instanceof Uint8Array ? m : new Uint8Array(m)) as any;
const on = dec(encodeMessage({ type: "run_energy", payload } as any));
assert.deepEqual(on.payload, { percent: payload.percent, running: payload.running, staminaTicks: 150, staminaMultiplier: 0.3 });

// It wears off after 2 minutes, and the client is told (even at full energy, standing still).
p.energy.markRunEnergySynced();
now = 1000 + 200;
p.energy.tickStaminaEffect(now);
assert.ok(p.energy.hasRunEnergyUpdate(), "expiry is sent");
const off = dec(encodeMessage({ type: "run_energy", payload: mv.buildRunEnergyPayload(p)! } as any));
assert.equal(off.payload.staminaTicks, undefined);
console.log(`sinclair stamina: ok (drain ${slowed} vs ${plain} units over 50 ticks)`);
