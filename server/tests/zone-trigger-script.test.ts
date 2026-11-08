import assert from "node:assert/strict";

import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import { ZoneTriggerService } from "../src/game/scripts/ZoneTriggerService";
import type {
    RegionEvent,
    ScriptServices,
    ZoneDefinition,
    ZoneEventHandler,
} from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";

const TEST_GAMEMODE = {
    id: "zone-trigger-test",
    name: "Zone trigger test",
    initializePlayer: () => undefined,
    canInteract: () => true,
} as GamemodeDefinition;

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});

const registry = new ScriptRegistry();
const scheduler = new ScriptScheduler();
const services = { hotReloadEnabled: true } as unknown as ScriptServices;
const runtime = new ScriptRuntime({
    registry,
    scheduler,
    services,
    logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
    },
});
const triggers = new ZoneTriggerService(runtime);

const questZone: ZoneDefinition = {
    id: "quest-yard",
    minX: 10,
    maxX: 12,
    minY: 10,
    maxY: 12,
    levels: [0],
    worldViewIds: [-1],
};
const zoneEvents: string[] = [];
registry.registerZone(questZone, {
    enter: (event) => zoneEvents.push(`${event.type}:${event.current.x}`),
    exit: (event) => zoneEvents.push(`${event.type}:${event.current.x}`),
    step: (event) => zoneEvents.push(`${event.type}:${event.current.x}`),
});
const contextRegionEvents: string[] = [];
registry.registerRegionHandler(0, (event) => {
    contextRegionEvents.push(
        `${event.type}:${event.previous.level}:${event.current.level}:${event.current.worldViewId}`,
    );
});

const player = new PlayerState(1, 9, 10, 0, TEST_GAMEMODE);
triggers.observeBeforeMovement(player);
assert.equal(player.forceStep(10, 10), true);
assert.equal(triggers.processAfterMovement(player, 1), true);
scheduler.process(1);
assert.deepEqual(zoneEvents, ["enter:10", "step:10"]);

assert.equal(triggers.processAfterMovement(player, 1), false);
scheduler.process(1);
assert.deepEqual(zoneEvents, ["enter:10", "step:10"], "a tile is dispatched only once");

assert.equal(player.forceStep(11, 10), true);
triggers.processAfterMovement(player, 2);
scheduler.process(2);
assert.deepEqual(zoneEvents.slice(-1), ["step:11"]);

player.teleport(13, 10, 0);
triggers.processAfterMovement(player, 3);
scheduler.process(3);
assert.deepEqual(zoneEvents.slice(-1), ["exit:13"]);

player.teleport(10, 10, 0);
triggers.processAfterMovement(player, 4);
scheduler.process(4);
assert.deepEqual(zoneEvents.slice(-2), ["enter:10", "step:10"]);
const eventsAfterTeleport = zoneEvents.length;
triggers.processAfterMovement(player, 4);
scheduler.process(4);
assert.equal(zoneEvents.length, eventsAfterTeleport, "teleport/rebuild observation does not repeat");

player.teleport(10, 10, 1);
triggers.processAfterMovement(player, 5);
scheduler.process(5);
assert.deepEqual(zoneEvents.slice(-1), ["exit:10"], "changing plane exits a plane-bound zone");
assert.deepEqual(contextRegionEvents.slice(-2), ["leave:0:1:-1", "enter:0:1:-1"]);

player.teleport(10, 10, 0);
triggers.processAfterMovement(player, 6);
scheduler.process(6);
assert.deepEqual(zoneEvents.slice(-2), ["enter:10", "step:10"]);

player.worldViewId = 5;
triggers.processAfterMovement(player, 7);
scheduler.process(7);
assert.deepEqual(
    zoneEvents.slice(-1),
    ["exit:10"],
    "changing world view exits a world-view-bound zone",
);
assert.deepEqual(contextRegionEvents.slice(-2), ["leave:0:0:5", "enter:0:0:5"]);

const previousRegionId = ((63 >> 6) << 8) | (64 >> 6);
const currentRegionId = ((64 >> 6) << 8) | (64 >> 6);
const regionEvents: Array<Pick<RegionEvent, "regionId" | "type">> = [];
registry.registerRegionHandler(previousRegionId, (event) => {
    regionEvents.push({ regionId: event.regionId, type: event.type });
});
registry.registerRegionHandler(currentRegionId, (event) => {
    regionEvents.push({ regionId: event.regionId, type: event.type });
});
const regionPlayer = new PlayerState(2, 63, 64, 0, TEST_GAMEMODE);
triggers.observeBeforeMovement(regionPlayer);
assert.equal(regionPlayer.forceStep(64, 64), true);
triggers.processAfterMovement(regionPlayer, 8);
scheduler.process(8);
assert.deepEqual(regionEvents, [
    { regionId: previousRegionId, type: "leave" },
    { regionId: currentRegionId, type: "enter" },
]);

const hotReloadZone: ZoneDefinition = {
    id: "hot-reload-zone",
    minX: 100,
    maxX: 101,
    minY: 100,
    maxY: 101,
};
const baseEnter: ZoneEventHandler = () => undefined;
const firstReloadEnter: ZoneEventHandler = () => undefined;
const secondReloadEnter: ZoneEventHandler = () => undefined;
registry.registerZone(hotReloadZone, { enter: baseEnter });
runtime.registerHandlers("zone-hot-reload", (scripts) => {
    scripts.registerZone(hotReloadZone, { enter: firstReloadEnter });
});
assert.equal(registry.findZoneHandler(hotReloadZone.id, "enter"), firstReloadEnter);

let restoredDuringReload: ZoneEventHandler | undefined;
runtime.registerHandlers("zone-hot-reload", (scripts) => {
    restoredDuringReload = scripts.findZoneHandler(hotReloadZone.id, "enter");
    scripts.registerZone(hotReloadZone, { enter: secondReloadEnter });
});
assert.equal(restoredDuringReload, baseEnter);
assert.equal(registry.findZoneHandler(hotReloadZone.id, "enter"), secondReloadEnter);

console.log("zone-trigger-script.test.ts: all assertions passed");
