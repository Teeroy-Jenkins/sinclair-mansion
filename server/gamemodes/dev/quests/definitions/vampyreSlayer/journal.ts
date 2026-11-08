import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_COMPLETE,
    STAGE_HARLOW,
    STAGE_STARTED,
    VARP_VAMPYRE_SLAYER,
} from "./constants";

export function buildVampyreSlayerJournal(
    player: PlayerState,
    _services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_VAMPYRE_SLAYER);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I killed Count Draynor and saved the village.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_HARLOW) {
        return [
            "I need to kill <col=800000>Count Draynor</col> beneath Draynor Manor.",
            "I need a <col=800000>stake and hammer</col>; garlic will weaken him.",
        ];
    }
    if (stage >= STAGE_STARTED) {
        return [
            "Morgan told me to find <col=800000>Dr Harlow</col> in",
            "Varrock's <col=800000>Blue Moon Inn</col>.",
        ];
    }
    return [
        "I can start this quest by speaking to",
        "<col=800000>Morgan</col> in Draynor Village.",
    ];
}
