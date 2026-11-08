// A per-tile swing override makes a single door open into its own tile instead of the
// neighbouring one, and closing it puts it back exactly.
// Usage (from server/): yarn tsx tests/door-swing-override.test.ts
import assert from "node:assert/strict";

import { CollisionOverlayStore } from "../src/world/CollisionOverlayStore";
import { DoorCollisionService } from "../src/world/DoorCollisionService";
import type { DoorDefinitionLoader } from "../src/world/DoorDefinitions";
import { DoorStateManager } from "../src/world/DoorStateManager";

const CLOSED = 25718;
const OPENED = 25719;
const defs = {
    getGateDef: () => undefined,
    getDoubleDoorDef: () => undefined,
    getSingleDoorPair: (id: number) => (id === CLOSED || id === OPENED ? { closed: CLOSED, opened: OPENED } : undefined),
} as unknown as DoorDefinitionLoader;
const lookup = (x: number, y: number, _level: number, id?: number) =>
    x === 2738 && y === 3578 && id === CLOSED ? { id: CLOSED, type: 0, rotation: 0 } : undefined;

function manager(): DoorStateManager {
    const loader = { load: (id: number) => ({ id, name: "Door", actions: ["Open"], types: [0], sizeX: 1, sizeY: 1 }) };
    return new DoorStateManager(loader, defs, new DoorCollisionService(new CollisionOverlayStore()), () => 0, undefined, lookup);
}

// Without an override the door swings onto the neighbouring tile (the hall).
const plain = manager().toggleDoor({ x: 2738, y: 3578, level: 0, currentId: CLOSED, action: "open", currentTick: 0 });
assert.equal(plain?.success, true);
assert.notDeepEqual(plain?.newTile, { x: 2738, y: 3578 });

// With it, the door stays on its own tile (inside the dining room), hinged north: west wall -> north wall.
const m = manager();
m.setSwingOverride(2738, 3578, 0, { dx: 0, dy: 0, rotation: 1 });
const open = m.toggleDoor({ x: 2738, y: 3578, level: 0, currentId: CLOSED, action: "open", currentTick: 0 });
assert.equal(open?.success, true);
assert.deepEqual(open?.newTile, { x: 2738, y: 3578 });
assert.equal(open?.newRotation, 1);
assert.equal(m.isDoorOpenAt(2738, 3578, 0), true);

const shut = m.toggleDoor({ x: 2738, y: 3578, level: 0, currentId: OPENED, rotation: 1, action: "close", currentTick: 5 });
assert.equal(shut?.success, true);
assert.deepEqual(shut?.newTile, { x: 2738, y: 3578 });
assert.equal(shut?.newRotation, 0);
assert.equal(m.isDoorOpenAt(2738, 3578, 0), false);

// A different open loc (a mirrored copy, so the hinge stays at the frame) and back again.
const VIRTUAL_OPEN = 65000;
const v = manager();
v.setSwingOverride(2738, 3578, 0, { dx: 0, dy: 0, rotation: 1, openedId: VIRTUAL_OPEN });
const vOpen = v.toggleDoor({ x: 2738, y: 3578, level: 0, currentId: CLOSED, action: "open", currentTick: 0 });
assert.equal(vOpen?.newLocId, VIRTUAL_OPEN);
assert.deepEqual(vOpen?.newTile, { x: 2738, y: 3578 });
const vShut = v.toggleDoor({ x: 2738, y: 3578, level: 0, currentId: VIRTUAL_OPEN, rotation: 1, action: "close", currentTick: 5 });
assert.equal(vShut?.success, true);
assert.equal(vShut?.newLocId, CLOSED);
assert.equal(vShut?.newRotation, 0);

console.log("door swing override: ok");
