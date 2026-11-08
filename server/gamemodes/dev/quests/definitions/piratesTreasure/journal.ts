import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_COMPLETE,
    STAGE_KEY,
    STAGE_NOTE,
    STAGE_STARTED,
    VARP_PIRATES_TREASURE,
} from "./constants";

export function buildPiratesTreasureJournal(
    player: PlayerState,
    _services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_PIRATES_TREASURE);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I found Redbeard Frank's buried treasure.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage === STAGE_NOTE) {
        return [
            "The pirate message points to an <col=800000>X in Falador Park</col>.",
            "I should bring a <col=800000>spade</col>.",
        ];
    }
    if (stage === STAGE_KEY) {
        return [
            "Frank gave me a key for a chest upstairs in",
            "the <col=800000>Blue Moon Inn in Varrock</col>.",
        ];
    }
    if (stage === STAGE_STARTED) {
        return [
            "I must smuggle <col=800000>Karamjan rum</col> to Redbeard Frank.",
            "Luthas's banana crate is shipped to Wydin's shop.",
        ];
    }
    return [
        "I can start this quest by speaking to",
        "<col=800000>Redbeard Frank</col> at Port Sarim.",
    ];
}
