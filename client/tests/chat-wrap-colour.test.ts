import assert from "node:assert/strict";

import { carryMarkupAcrossLines } from "../widgets/components/TextRenderer";

// A public chat message that wraps keeps its blue colour on the second line.
assert.deepEqual(
    carryMarkupAcrossLines(["Alice: <col=0000ff>this is a long message that", "wraps onto the next line</col>"]),
    ["Alice: <col=0000ff>this is a long message that", "<col=0000ff>wraps onto the next line</col>"],
);

// A closed colour does not leak onto the next line.
assert.deepEqual(carryMarkupAcrossLines(["<col=ff0000>red</col> plain", "still plain"]), [
    "<col=ff0000>red</col> plain",
    "still plain",
]);

// The latest colour wins, and it carries over several lines along with shadow.
assert.deepEqual(carryMarkupAcrossLines(["<shad=000000><col=ff0000>a <col=00ff00>b", "c", "d"]), [
    "<shad=000000><col=ff0000>a <col=00ff00>b",
    "<col=00ff00><shad=000000>c",
    "<col=00ff00><shad=000000>d",
]);

console.log("chat-wrap-colour tests passed");
