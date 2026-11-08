import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_COMPLETE,
    STAGE_FINDING_WATER,
    STAGE_FIXED_CART,
    STAGE_FIXING_CART,
    STAGE_GIVEN_WATER,
    STAGE_LOOKING_FOR_CEDRIC,
    STAGE_RETURNED_BLANKET,
    STAGE_STARTED,
    VARP_MONKS_FRIEND,
} from "./constants";

export function buildMonksFriendJournal(
    player: PlayerState,
    _services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_MONKS_FRIEND);
    const blanket = "<str>I recovered the child's blanket for Brother Omad.</str>";
    if (stage >= STAGE_COMPLETE) {
        return [
            blanket,
            "<str>I helped Brother Cedric repair his cart.</str>",
            "<str>I returned to the monastery for the party.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_FIXED_CART) {
        return [blanket, "<str>I repaired Brother Cedric's cart.</str>", "I should return to <col=800000>Brother Omad</col>."];
    }
    if (stage >= STAGE_FIXING_CART) {
        return [blanket, "Brother Cedric needs some ordinary <col=800000>logs</col>", "to repair his broken cart."];
    }
    if (stage >= STAGE_GIVEN_WATER) {
        return [blanket, "<str>I sobered Brother Cedric up with water.</str>", "I should ask whether he needs more help."];
    }
    if (stage >= STAGE_FINDING_WATER) {
        return [blanket, "Brother Cedric is drunk. I need to bring him", "a <col=800000>jug of water</col>."];
    }
    if (stage >= STAGE_LOOKING_FOR_CEDRIC) {
        return [blanket, "I should find <col=800000>Brother Cedric</col> on the road", "south of the Ardougne zoo."];
    }
    if (stage >= STAGE_RETURNED_BLANKET) {
        return [blanket, "I should ask <col=800000>Brother Omad</col> about the party."];
    }
    if (stage >= STAGE_STARTED) {
        return [
            "Brother Omad asked me to recover a child's blanket.",
            "The thieves' cave is hidden beneath a <col=800000>ring of stones</col>",
            "south-west of the Clock Tower.",
        ];
    }
    return [
        "I can start this quest by speaking to",
        "<col=800000>Brother Omad</col> at the monastery south of",
        "<col=800000>Ardougne</col>.",
        "",
        "There aren't any requirements for this quest.",
    ];
}
