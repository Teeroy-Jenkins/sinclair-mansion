import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import {
    CADAVA_BERRIES_ITEM_ID,
    CADAVA_POTION_ITEM_ID,
    JULIETS_MESSAGE_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_JULIET_IN_CRYPT,
    STAGE_PASSED_MESSAGE,
    STAGE_SPOKEN_TO_APOTHECARY,
    STAGE_SPOKEN_TO_FATHER_LAWRENCE,
    STAGE_SPOKEN_TO_JULIET,
    STAGE_SPOKEN_TO_ROMEO,
    VARP_ROMEO_AND_JULIET,
} from "./constants";

const romeoLines = [
    "<str>I agreed to find Juliet for Romeo and tell her how</str>",
    "<str>he feels.</str>",
];

const julietLines = [
    "<str>I found Juliet west of Varrock. She gave me a</str>",
    "<str>message to take back to Romeo.</str>",
];

const fatherLines = [
    "<str>Father Lawrence suggested a potion that would make</str>",
    "<str>Juliet appear dead so Romeo could rescue her.</str>",
];

export function buildRomeoAndJulietJournal(
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_ROMEO_AND_JULIET);
    if (stage >= STAGE_COMPLETE) {
        return [
            ...romeoLines,
            "",
            ...julietLines,
            "",
            ...fatherLines,
            "<str>I delivered the Cadava potion and told Romeo the plan.</str>",
            "<str>He did not understand it, but rewarded me anyway.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_JULIET_IN_CRYPT) {
        return [
            ...romeoLines,
            "",
            ...julietLines,
            "",
            ...fatherLines,
            "<str>I delivered the Cadava potion to Juliet.</str>",
            "I must tell <col=800000>Romeo</col> what has happened.",
        ];
    }
    if (stage >= STAGE_SPOKEN_TO_APOTHECARY) {
        const carriedPotion = countCarriedItem(player, services, CADAVA_POTION_ITEM_ID) > 0;
        const carriedBerries = countCarriedItem(player, services, CADAVA_BERRIES_ITEM_ID) > 0;
        return [
            ...romeoLines,
            "",
            ...julietLines,
            "",
            ...fatherLines,
            "<str>The Apothecary agreed to make a Cadava potion.</str>",
            carriedPotion
                ? "I should take the <col=800000>Cadava potion</col> to <col=800000>Juliet</col>."
                : carriedBerries
                  ? "I should take these <col=800000>Cadava berries</col> to the <col=800000>Apothecary</col>."
                  : "I need to find some <col=800000>Cadava berries</col>.",
        ];
    }
    if (stage >= STAGE_SPOKEN_TO_FATHER_LAWRENCE) {
        return [
            ...romeoLines,
            "",
            ...julietLines,
            "",
            ...fatherLines,
            "I need to find the <col=800000>Apothecary</col> and ask him",
            "to make a <col=800000>Cadava potion</col>.",
        ];
    }
    if (stage >= STAGE_PASSED_MESSAGE) {
        return [
            ...romeoLines,
            "",
            ...julietLines,
            "<str>I delivered Juliet's message to Romeo.</str>",
            "I should find <col=800000>Father Lawrence</col> and ask for help.",
        ];
    }
    if (stage >= STAGE_SPOKEN_TO_JULIET) {
        return [
            ...romeoLines,
            "",
            ...julietLines,
            countCarriedItem(player, services, JULIETS_MESSAGE_ITEM_ID) > 0
                ? "I should take <col=800000>Juliet's message</col> to <col=800000>Romeo</col>."
                : "I should ask <col=800000>Juliet</col> for another copy of her message.",
        ];
    }
    if (stage >= STAGE_SPOKEN_TO_ROMEO) {
        return [
            ...romeoLines,
            "",
            "I should speak to <col=800000>Juliet</col>, west of <col=800000>Varrock</col>.",
        ];
    }
    return [
        "I can start this quest by talking to",
        "<col=800000>Romeo</col> in <col=800000>Varrock Square</col>.",
        "",
        "There aren't any requirements for this quest.",
    ];
}

