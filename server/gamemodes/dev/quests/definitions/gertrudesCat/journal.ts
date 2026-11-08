import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_COMPLETE,
    STAGE_GAVE_MILK,
    STAGE_GAVE_SARDINE,
    STAGE_PAID_BOY,
    STAGE_RESCUED,
    STAGE_STARTED,
    VARP_GERTRUDES_CAT,
} from "./constants";

export function buildGertrudesCatJournal(player: PlayerState, _services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_GERTRUDES_CAT);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I found Fluffs and returned her kitten.</str>",
            "<str>Gertrude gave me a kitten of my own.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_RESCUED) {
        return [
            "Fluffs ran home with her kitten.",
            "I should return to <col=800000>Gertrude</col>.",
        ];
    }
    if (stage >= STAGE_GAVE_SARDINE) {
        return [
            "Fluffs is fed but afraid to leave.",
            "I can hear a <col=800000>kitten mewing in the lumber yard crates</col>.",
        ];
    }
    if (stage >= STAGE_GAVE_MILK) {
        return [
            "Fluffs is no longer thirsty.",
            "Gertrude said she likes a raw sardine seasoned with <col=800000>doogle leaves</col>.",
        ];
    }
    if (stage >= STAGE_PAID_BOY) {
        return [
            "Shilop saw Fluffs at the abandoned lumber yard",
            "north-east of the Jolly Boar Inn.",
        ];
    }
    if (stage >= STAGE_STARTED) {
        return [
            "Gertrude asked me to speak to",
            "<col=800000>Shilop and Wilough</col> in Varrock marketplace.",
        ];
    }
    return ["Speak to <col=800000>Gertrude</col> in her house", "west of Varrock."];
}
