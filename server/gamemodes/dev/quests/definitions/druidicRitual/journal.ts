import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import {
    ENCHANTED_MEATS,
    STAGE_COMPLETE,
    STAGE_GATHERING_MEATS,
    STAGE_RETURN_TO_KAQEMEEX,
    STAGE_STARTED,
    VARP_DRUIDIC_RITUAL,
} from "./constants";

export function buildDruidicRitualJournal(
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_DRUIDIC_RITUAL);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I helped the druids purify their stone circle.</str>",
            "<str>Kaqemeex taught me the Herblore skill.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_RETURN_TO_KAQEMEEX) {
        return [
            "<str>I took the enchanted meats to Sanfew.</str>",
            "I should return to <col=800000>Kaqemeex</col> at the",
            "stone circle in <col=800000>Taverley</col>.",
        ];
    }
    if (stage >= STAGE_GATHERING_MEATS) {
        const lines = [
            "Sanfew needs four raw meats dipped in the",
            "<col=800000>Cauldron of Thunder</col> beneath Taverley:",
            "",
        ];
        for (const meat of ENCHANTED_MEATS) {
            lines.push(
                countCarriedItem(player, services, meat.itemId) > 0
                    ? `<str>${meat.journalLabel}</str>`
                    : meat.journalLabel,
            );
        }
        return lines;
    }
    if (stage >= STAGE_STARTED) {
        return [
            "Kaqemeex asked me to help purify the druids'",
            "stone circle. I should speak to <col=800000>Sanfew</col>",
            "upstairs in the Taverley herb shop.",
        ];
    }
    return [
        "I can start this quest by speaking to",
        "<col=800000>Kaqemeex</col> at the stone circle north of",
        "<col=800000>Taverley</col>.",
        "",
        "There aren't any requirements for this quest.",
    ];
}
