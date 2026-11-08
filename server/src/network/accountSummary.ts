import {
    ACCOUNT_SUMMARY_GROUP_ID,
    SCRIPT_ACCOUNT_SUMMARY_SET_COMBAT_LEVEL_ID,
    SCRIPT_ACCOUNT_SUMMARY_SET_TIME_ID,
    buildAccountSummarySetCombatLevelScriptArgs,
    buildAccountSummarySetTimeScriptArgs,
} from "../../../client/common/ui/accountSummary";
import type { ServerServices } from "../game/ServerServices";
import { getAccountSummaryTimeMinutes } from "../game/accountSummaryTime";
import type { PlayerState } from "../game/player";

export class AccountSummaryTracker {
    private readonly lastStateByPlayer = new Map<
        number,
        { minutes: number; combatLevel: number }
    >();

    constructor(private readonly svc: ServerServices) {}

    clearPlayer(playerIdRaw: number): void {
        const playerId = playerIdRaw;
        if (playerId < 0) return;
        this.lastStateByPlayer.delete(playerId);
    }

    syncPlayer(player: PlayerState, nowMs: number = Date.now(), force: boolean = false): void {
        const playerId = player.id;
        if (
            !this.svc.interfaceManager.isWidgetGroupOpenInLedger(playerId, ACCOUNT_SUMMARY_GROUP_ID)
        ) {
            this.lastStateByPlayer.delete(playerId);
            return;
        }

        const minutes = getAccountSummaryTimeMinutes(player, nowMs);
        const combatLevel = player.skillSystem.combatLevel;
        const previous = this.lastStateByPlayer.get(playerId);
        const minutesChanged = previous?.minutes !== minutes;
        const combatChanged = previous?.combatLevel !== combatLevel;
        if (!force && !minutesChanged && !combatChanged) {
            return;
        }

        this.lastStateByPlayer.set(playerId, { minutes, combatLevel });
        if (force || minutesChanged) {
            this.svc.queueWidgetEvent(playerId, {
                action: "run_script",
                scriptId: SCRIPT_ACCOUNT_SUMMARY_SET_TIME_ID,
                args: buildAccountSummarySetTimeScriptArgs(minutes),
            });
        }
        if (force || combatChanged) {
            this.svc.queueWidgetEvent(playerId, {
                action: "run_script",
                scriptId: SCRIPT_ACCOUNT_SUMMARY_SET_COMBAT_LEVEL_ID,
                args: buildAccountSummarySetCombatLevelScriptArgs(combatLevel),
            });
        }
    }
}
