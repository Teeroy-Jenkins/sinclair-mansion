import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_COMPLETE,
    STAGE_OBTAINED_SKULL,
    STAGE_SPOKEN_GHOST,
    STAGE_SPOKEN_URHNEY,
    STAGE_STARTED,
    VARP_RESTLESS_GHOST,
} from "./constants";

export function buildRestlessGhostJournal(player: PlayerState, _services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_RESTLESS_GHOST);
    if (stage < STAGE_STARTED) {
        return [
            "I can start this quest by speaking to",
            "<col=800000>Father Aereck</col> in the <col=800000>church</col>",
            "next to <col=800000>Lumbridge Castle</col>.",
            "",
            "I must be unafraid of a <col=800000>level 13 Skeleton</col>.",
        ];
    }

    const lines = [
        "<str>Father Aereck asked me to help him deal with</str>",
        "<str>the ghost in the graveyard next to the church.</str>",
        "",
    ];
    if (stage < STAGE_SPOKEN_URHNEY) {
        return [
            ...lines,
            "I should find <col=800000>Father Urhney</col>, an expert on ghosts.",
            "He lives in a <col=800000>shack</col> in <col=800000>Lumbridge Swamp</col>.",
        ];
    }
    lines.push(
        "<str>Father Urhney gave me an Amulet of Ghostspeak</str>",
        "<str>so I can talk to the ghost.</str>",
        "",
    );
    if (stage < STAGE_SPOKEN_GHOST) {
        return [...lines, "I should wear the amulet and talk to the <col=800000>Ghost</col>."];
    }
    lines.push(
        "<str>The Ghost told me an evil warlock stole his skull.</str>",
        "",
    );
    if (stage < STAGE_OBTAINED_SKULL) {
        return [
            ...lines,
            "I should search the <col=800000>Wizards' Tower</col> south-west of",
            "Lumbridge for the <col=800000>Ghost's Skull</col>.",
        ];
    }
    lines.push(
        "<str>I found the Ghost's Skull in the Wizards' Tower.</str>",
        "",
    );
    if (stage < STAGE_COMPLETE) {
        return [...lines, "I should put the <col=800000>Skull</col> in the Ghost's coffin."];
    }
    return [
        ...lines,
        "<str>I placed the Skull in the coffin and allowed the</str>",
        "<str>Ghost to rest in peace.</str>",
        "",
        "<col=ff0000>QUEST COMPLETE!</col>",
    ];
}
