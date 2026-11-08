import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { setQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import { VARBIT_DEMON_DRAIN } from "./constants";

export function setDemonDrainState(
    player: PlayerState,
    services: ScriptServices,
    value: number,
): void {
    player.varps.setVarbitValue(VARBIT_DEMON_DRAIN, value);
    services.variables.sendVarbit(player, VARBIT_DEMON_DRAIN, value);
}

export function syncDemonDrainState(player: PlayerState, services: ScriptServices): void {
    services.variables.sendVarbit(
        player,
        VARBIT_DEMON_DRAIN,
        player.varps.getVarbitValue(VARBIT_DEMON_DRAIN),
    );
}

/** Quest stage and drain share cache varp 222, so restore the drain bits after a stage write. */
export function setDemonStage(
    player: PlayerState,
    quest: QuestDefinition,
    services: ScriptServices,
    value: number,
): void {
    setQuestStage(player, quest, services, value);
    syncDemonDrainState(player, services);
}
