import assert from "node:assert/strict";

import { WidgetManager } from "../widgets/WidgetManager";

const root: any = {
    uid: 900 << 16,
    id: 900 << 16,
    groupId: 900,
    fileId: 0,
    childIndex: -1,
    parentUid: -1,
    isIf3: true,
    type: 0,
    rawX: 0,
    rawY: 0,
    rawWidth: 0,
    rawHeight: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    widthMode: 1,
    heightMode: 1,
    xPositionMode: 0,
    yPositionMode: 0,
    hidden: false,
    scrollX: 0,
    scrollY: 0,
    scrollWidth: 0,
    scrollHeight: 0,
    onLoad: [123],
    onSubChange: [789],
};
const subRoot = {
    ...root,
    uid: 901 << 16,
    id: 901 << 16,
    groupId: 901,
    onLoad: [456],
    onSubChange: undefined,
};
const loader = {
    loadWidgetGroup: (groupId: number) => {
        const group = groupId === 900 ? root : subRoot;
        return { root: group, widgets: new Map([[group.uid, group]]) };
    },
    getAvailableGroups: () => [900, 901],
    clearCache: () => undefined,
};
const manager = new WidgetManager({} as never, loader as never);
let rootLoads = 0;
manager.onLoadListener = (scriptId) => {
    if (scriptId === 123) rootLoads++;
};
let subChanges = 0;
manager.onSubChangeListener = () => subChanges++;

manager.setRootInterface(900);
manager.openSubInterface(root.uid, 901);
assert.equal(rootLoads, 0);

manager.resize(800, 600);
assert.equal(rootLoads, 1);
assert.equal(root.width, 800);
assert.equal(root.height, 600);
assert.equal(manager.getSubInterface(root.uid)?.group, 901);
assert.equal(subChanges, 2);

manager.resize(801, 600);
assert.equal(rootLoads, 1);

console.log("Widget root onLoad race test passed");
