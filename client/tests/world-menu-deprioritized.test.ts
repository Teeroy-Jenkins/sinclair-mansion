import assert from "node:assert/strict";

import { MenuTargetType, type OsrsMenuEntry } from "../rs/MenuEntry";
import { worldEntriesToSimple } from "../ui/menu/MenuBridge";
import { MENU_ACTION_DEPRIORITIZE_OFFSET } from "../ui/menu/MenuAction";
import { chooseDefaultMenuEntry } from "../ui/menu/MenuEngine";
import { MenuOpcode, MenuState } from "../ui/menu/MenuState";

// Left-clicking a person in Murder at Sinclair Mansion walks there on "Always right-click" (the
// default): their Follow, Trade and Attack are right-click only (deprioritized). The flag used to
// be dropped on the way into the menu, so the left click picked the top person option, Attack,
// and you fought whoever you clicked near (a bot then fought back). On "Left-click where
// available" (the Murderer's default) Attack isn't deprioritized, and the left click attacks.
const BOT = 7;
const player = (option: string, actionIndex: number): OsrsMenuEntry => ({
    option,
    targetId: BOT,
    targetType: MenuTargetType.PLAYER,
    targetName: "Bob",
    targetLevel: 80,
    playerServerId: BOT,
    actionIndex,
    deprioritized: true,
});

const menuState = new MenuState();
const entries = worldEntriesToSimple(
    [
        { option: "Walk here", targetId: -1, targetType: MenuTargetType.NONE, targetName: "" },
        player("Follow", 2),
        player("Trade with", 1),
        player("Attack", 0),
    ],
    { menuState },
);

const attack = entries.find((e) => e.option === "Attack");
assert.ok(attack && typeof attack.menuStateIndex === "number");
assert.equal(attack.deprioritized, true, "Attack keeps its right-click-only flag");
assert.equal(
    menuState.opcodes[attack.menuStateIndex],
    MenuOpcode.PlayerFirstOption + MENU_ACTION_DEPRIORITIZE_OFFSET,
    "Attack sorts below normal entries",
);
assert.equal(entries[0].option, "Walk here", "Walk here is the top entry");
assert.equal(chooseDefaultMenuEntry(entries)?.option, "Walk here", "left click walks");

// Where Attack isn't deprioritized ("Left-click where available"), the left click attacks.
const wild = worldEntriesToSimple(
    [
        { option: "Walk here", targetId: -1, targetType: MenuTargetType.NONE, targetName: "" },
        { ...player("Attack", 0), deprioritized: false },
    ],
    {},
);
assert.equal(chooseDefaultMenuEntry(wild)?.option, "Attack");

console.log("world menu deprioritized: ok");
