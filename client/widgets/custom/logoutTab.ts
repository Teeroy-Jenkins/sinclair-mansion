/**
 * Murder at Sinclair Mansion: the logout tab (interface 182) has no worlds to switch and nowhere
 * to log out to, so its two buttons become "Leave Lobby" (component 3, the World Switcher) and
 * "Exit Game" (component 8, Logout). The clicks are handled by client/game/murder/LogoutTab.ts.
 */
export const LOGOUT_TAB_GROUP_ID = 182;
export const LOGOUT_TAB_LEAVE_CHILD = 3; // was "World Switcher" (its label is component 7)
export const LOGOUT_TAB_EXIT_CHILD = 8; // was "Click here to logout" (its label is component 12)

const INFO_CHILD = 2;
const LEAVE_LABEL_CHILD = 7;
const EXIT_LABEL_CHILD = 12;

/** Relabel the cache's logout tab, and take away its own logout script. */
export function patchLogoutTabGroup(groupId: number, widgets: Map<number, any>): void {
    if ((groupId | 0) !== LOGOUT_TAB_GROUP_ID) return;
    const get = (child: number) => widgets.get((LOGOUT_TAB_GROUP_ID << 16) | child);
    const info = get(INFO_CHILD);
    if (info) info.text = "Use the buttons below to<br>leave the lobby or exit the game.";
    const leave = get(LOGOUT_TAB_LEAVE_CHILD);
    if (leave) leave.actions = ["Leave Lobby"];
    const leaveLabel = get(LEAVE_LABEL_CHILD);
    if (leaveLabel) leaveLabel.text = "Leave Lobby";
    const exit = get(LOGOUT_TAB_EXIT_CHILD);
    if (exit) {
        exit.actions = ["Exit Game"];
        exit.onOp = null; // the cache's logout script (970)
        exit.__hasOriginalOnOp = false;
    }
    const exitLabel = get(EXIT_LABEL_CHILD);
    if (exitLabel) {
        exitLabel.onLoad = null; // script 2244 would write "Click here to logout" back
        exitLabel.text = "Exit Game";
    }
}
