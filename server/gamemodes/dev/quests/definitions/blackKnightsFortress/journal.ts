import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_COMPLETE,
    STAGE_INVESTIGATE,
    STAGE_RETURN_TO_AMIK,
    STAGE_SABOTAGE,
    VARP_BLACK_KNIGHTS_FORTRESS,
} from "./constants";

export function buildBlackKnightsFortressJournal(
    player: PlayerState,
    _services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_BLACK_KNIGHTS_FORTRESS);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>Sir Amik asked me to investigate the Black Knights.</str>",
            "<str>I discovered and sabotaged their invincibility potion.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_RETURN_TO_AMIK) {
        return [
            "<str>I infiltrated the Black Knights' Fortress.</str>",
            "<str>I ruined the witch's invincibility potion with a cabbage.</str>",
            "",
            "I should claim my reward from <col=800000>Sir Amik Varze</col>",
            "in <col=800000>Falador Castle</col>.",
        ];
    }
    if (stage >= STAGE_SABOTAGE) {
        return [
            "<str>I infiltrated the Black Knights' Fortress.</str>",
            "<str>I learned that their secret weapon is an invincibility potion.</str>",
            "",
            "An ordinary <col=800000>cabbage</col> will ruin the potion.",
            "A cabbage from Draynor Manor would help the witch instead.",
        ];
    }
    if (stage >= STAGE_INVESTIGATE) {
        return [
            "Sir Amik asked me to infiltrate the <col=800000>Black Knights' Fortress</col>",
            "near Ice Mountain and sabotage their secret weapon.",
            "",
            "An <col=800000>iron chainbody</col> and <col=800000>bronze med helm</col>",
            "will let me pass as a fortress guard.",
        ];
    }
    return [
        "I can start this quest by speaking to <col=800000>Sir Amik Varze</col>",
        "on the upper floor of <col=800000>Falador Castle</col>.",
        "",
        "I need at least <col=800000>12 Quest Points</col>.",
    ];
}
