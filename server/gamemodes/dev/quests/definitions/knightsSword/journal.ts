import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem, getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    STAGE_ASK_SQUIRE_FOR_PORTRAIT,
    STAGE_COMPLETE,
    STAGE_FIND_IMCANDO_DWARF,
    STAGE_FIND_MATERIALS,
    STAGE_FIND_PORTRAIT,
    STAGE_FIND_RELDO,
    STAGE_GAVE_THURGO_PIE,
    STAGE_NOT_STARTED,
} from "./constants";

export function buildKnightsSwordJournal(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by talking to the <col=800000>Squire</col>",
            "in the courtyard of the <col=800000>White Knights' Castle</col>.",
            "",
            "I need <col=800000>level 10 Mining</col> to obtain blurite ore.",
        ];
    }

    const lines = [
        "<str>I agreed to help replace Sir Vyvin's lost family sword.</str>",
        "",
    ];
    if (stage === STAGE_FIND_RELDO) {
        lines.push("I should ask <col=800000>Reldo</col> in Varrock Palace about Imcando dwarves.");
    } else if (stage === STAGE_FIND_IMCANDO_DWARF) {
        lines.push(
            "Reldo said an Imcando dwarf lives on Asgarnia's southern peninsula.",
            "A <col=800000>redberry pie</col> may help me earn his trust.",
        );
    } else if (stage === STAGE_GAVE_THURGO_PIE) {
        lines.push("I earned <col=800000>Thurgo's</col> trust. I should ask him to make the sword.");
    } else if (stage === STAGE_ASK_SQUIRE_FOR_PORTRAIT) {
        lines.push("Thurgo needs a picture. I should ask the <col=800000>Squire</col> where to find one.");
    } else if (stage === STAGE_FIND_PORTRAIT) {
        const carrying = countCarriedItem(player, services, ITEM.portrait) > 0;
        lines.push(
            carrying
                ? "<str>I found Sir Vyvin's portrait showing the sword.</str>"
                : "I need the <col=800000>portrait</col> from the cupboard in Sir Vyvin's room.",
            carrying ? "I should take it to <col=800000>Thurgo</col>." : "I must search it while Sir Vyvin is distracted.",
        );
    } else if (stage === STAGE_FIND_MATERIALS) {
        if (countCarriedItem(player, services, ITEM.bluriteSword) > 0) {
            lines.push("<str>Thurgo made the replacement blurite sword.</str>", "I should return it to the <col=800000>Squire</col>.");
        } else {
            lines.push(
                "Thurgo needs <col=800000>one blurite ore</col> and <col=800000>two iron bars</col>.",
                "Blurite is found in the icy cave beneath the cliffs near his home.",
            );
        }
    } else if (stage >= STAGE_COMPLETE) {
        lines.push(
            "<str>Thurgo made a replacement and I returned it to the Squire.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        );
    }
    return lines;
}
