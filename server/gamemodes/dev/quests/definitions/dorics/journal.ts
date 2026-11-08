import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import { REQUIRED_ITEMS, STAGE_COMPLETE, STAGE_STARTED, VARP_DORICS_QUEST } from "./constants";

export function buildDoricJournal(player: PlayerState, services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_DORICS_QUEST);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I have spoken to Doric.</str>",
            "<str>I have collected some clay, copper and</str>",
            "<str>iron ore, and Doric let me use his anvils.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_STARTED) {
        const lines = [
            "I have spoken to <col=800000>Doric</col>.",
            "",
            "To use his anvils, I need to bring him:",
        ];
        for (const req of REQUIRED_ITEMS) {
            const carried = countCarriedItem(player, services, req.itemId);
            lines.push(
                carried >= req.quantity ? `<str>${req.journalLabel}</str>` : req.journalLabel,
            );
        }
        return lines;
    }
    return [
        "I can start this quest by speaking to",
        "<col=800000>Doric</col> who is <col=800000>north of Falador</col>.",
        "",
        "There aren't any requirements for this quest,",
        "but level <col=800000>15 Mining</col> will help.",
    ];
}
