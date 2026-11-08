/**
 * The logout tab's two buttons (relabelled in client/widgets/custom/logoutTab.ts):
 *  - Leave Lobby: out of the room, as the lobby window's Leave (during a game that counts as
 *    dying, and a Murderer who leaves is caught).
 *  - Exit Game: asks this copy's own game server (the page's origin) to save and stop, which also
 *    quits the launcher, then closes the browser tab.
 */
import {
    LOGOUT_TAB_EXIT_CHILD,
    LOGOUT_TAB_GROUP_ID,
    LOGOUT_TAB_LEAVE_CHILD,
} from "../../widgets/custom/logoutTab";
import { closeConnection, sendGamemodeMessage, suppressReconnection } from "../../network/ServerConnection";

let exiting = false;

export function isLogoutTabButton(groupId: number, childId: number): boolean {
    return (groupId | 0) === LOGOUT_TAB_GROUP_ID && ((childId | 0) === LOGOUT_TAB_LEAVE_CHILD || (childId | 0) === LOGOUT_TAB_EXIT_CHILD);
}

/** Handle a click on the logout tab's buttons. Returns true if it was one of them. */
export function handleLogoutTabAction(groupId: number, childId: number): boolean {
    if ((groupId | 0) !== LOGOUT_TAB_GROUP_ID) return false;
    if ((childId | 0) === LOGOUT_TAB_LEAVE_CHILD) {
        sendGamemodeMessage("sinclair_lobby", { action: "leave" });
        return true;
    }
    if ((childId | 0) === LOGOUT_TAB_EXIT_CHILD) {
        exitGame();
        return true;
    }
    return false;
}

function exitGame(): void {
    if (exiting) return;
    exiting = true;
    // Leave whatever game we're in first (a friend's included): the server treats it as leaving.
    try {
        suppressReconnection();
        closeConnection();
    } catch (e) {
        console.warn("[ExitGame] closing the connection failed", e);
    }
    // The page is served by this player's own copy of the game, so its origin is their own server.
    const stop = fetch(`${window.location.origin}/exit`, {
        method: "POST",
        headers: { "X-Sinclair-Exit": "1" },
    }).catch(() => undefined); // dev setups (yarn start) serve the page elsewhere: just close the tab
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    void Promise.race([stop, timeout]).then(closeTab);
}

function closeTab(): void {
    window.close();
    // Browsers only let a page close a tab that a script opened. If this one is still here,
    // say so instead of leaving a dead game on screen.
    setTimeout(() => {
        if (window.closed) return;
        document.title = "Murder at Sinclair Mansion";
        document.body.innerHTML =
            '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
            'background:#000;color:#ff981f;font:16px/1.5 sans-serif;text-align:center;padding:16px">' +
            "<div>The game has been closed.<br>You can close this tab now.</div></div>";
    }, 300);
}
