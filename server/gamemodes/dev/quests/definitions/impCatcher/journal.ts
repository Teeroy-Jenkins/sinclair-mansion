import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import {
    REQUIRED_ITEMS,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_IMP_CATCHER,
} from "./constants";

export function buildImpCatcherJournal(player: PlayerState, services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_IMP_CATCHER);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I have spoken to Wizard Mizgog.</str>",
            "<str>I collected all four of his missing beads.</str>",
            "<str>He rewarded me with an Amulet of Accuracy.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_STARTED) {
        const lines = [
            "I have spoken to <col=800000>Wizard Mizgog</col>.",
            "",
            "I need to collect these items by killing imps:",
        ];
        for (const requirement of REQUIRED_ITEMS) {
            lines.push(
                countCarriedItem(player, services, requirement.itemId) >= requirement.quantity
                    ? `<str>${requirement.journalLabel}</str>`
                    : requirement.journalLabel,
            );
        }
        return lines;
    }
    return [
        "I can start this quest by talking to",
        "<col=800000>Wizard Mizgog</col> in the",
        "<col=800000>Wizards' Tower</col>.",
        "",
        "There aren't any requirements for this quest.",
    ];
}
