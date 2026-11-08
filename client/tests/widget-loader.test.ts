import assert from "node:assert/strict";

import { CacheSystem } from "../rs/cache/CacheSystem";
import { WidgetLoader } from "../widgets/WidgetLoader";
import { loadCache, loadCacheInfos, loadCacheList } from "../scripts/cache/load-util";

const cache = CacheSystem.fromFiles(
    "dat2",
    loadCache(loadCacheList(loadCacheInfos()).latest).files,
);
const bank = new WidgetLoader(cache).loadWidgetGroup(12);
const model = bank?.widgets.get((12 << 16) | 55);

assert.ok(model, "bank widget 12:55 should decode");
assert.equal(model.type, 6);
assert.equal(model.parentUid, (12 << 16) | 54);
assert.equal(model.modelId, -1);

const characterCreator = new WidgetLoader(cache)
    .loadWidgetGroup(679)
    ?.widgets.get((679 << 16) | 73);
assert.ok(characterCreator, "character creator widget 679:73 should decode");
assert.equal(characterCreator.modelZoom, 450);
assert.equal(characterCreator.sequenceId, -1);

const npcDialogue = new WidgetLoader(cache).loadWidgetGroup(231)?.widgets.get((231 << 16) | 2);
assert.ok(npcDialogue, "NPC dialogue widget 231:2 should decode");
assert.equal(npcDialogue.modelZoom, 796);
assert.equal(npcDialogue.sequenceId, -1);
console.log("Widget loader regression test passed");
