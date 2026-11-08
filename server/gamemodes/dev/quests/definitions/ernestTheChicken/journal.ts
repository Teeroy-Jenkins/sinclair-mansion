import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_COMPLETE,
    STAGE_ODDENSTEIN,
    STAGE_STARTED,
    VARP_ERNEST,
} from "./constants";

export function buildErnestTheChickenJournal(
    player: PlayerState,
    _services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_ERNEST);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I repaired the machine and Ernest is human again.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_ODDENSTEIN) {
        return [
            "Professor Oddenstein needs a <col=800000>pressure gauge</col>,",
            "<col=800000>rubber tube</col> and <col=800000>oil can</col> to restore Ernest.",
        ];
    }
    if (stage >= STAGE_STARTED) {
        return [
            "I should search Draynor Manor for Ernest",
            "and speak to <col=800000>Professor Oddenstein</col> upstairs.",
        ];
    }
    return [
        "I can start this quest by speaking to",
        "<col=800000>Veronica</col> outside Draynor Manor.",
    ];
}
