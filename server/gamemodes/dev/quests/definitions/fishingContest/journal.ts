import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { STAGE_COMPLETE, STAGE_GARLIC, STAGE_WON, VARP_FISHING_CONTEST } from "./constants";

export function buildFishingContestJournal(player: PlayerState, _services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_FISHING_CONTEST);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I won the Hemenster Fishing Contest.</str>",
            "<str>The dwarves let me use their tunnel.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_WON) {
        return [
            "I won the contest and should take the <col=800000>trophy</col>",
            "back to Austri or Vestri at White Wolf Mountain.",
        ];
    }
    if (stage >= STAGE_GARLIC) {
        return [
            "The sinister stranger moved away from the pipes.",
            "I should use <col=800000>red vine worms</col> at the pipe fishing spot.",
        ];
    }
    if (stage >= 2) {
        return [
            "My assigned spot cannot catch the winning fish.",
            "Perhaps the sinister stranger can be moved with <col=800000>garlic</col>.",
        ];
    }
    if (stage >= 1) {
        return [
            "The dwarves gave me a <col=800000>Fishing pass</col>.",
            "I must win the contest at <col=800000>Hemenster</col>.",
        ];
    }
    return ["Speak to <col=800000>Austri or Vestri</col> beside the", "White Wolf Mountain tunnel.", "", "<col=ff0000>Requires level 10 Fishing.</col>"];
}
