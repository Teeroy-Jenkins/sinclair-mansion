import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import {
    REQUIRED_ITEMS,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_COOKS_ASSISTANT,
} from "./constants";

export function buildCooksAssistantJournal(
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_COOKS_ASSISTANT);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>It was the Duke of Lumbridge's birthday,</str>",
            "<str>and I brought his cook an egg, some flour</str>",
            "<str>and some milk for his birthday cake.</str>",
            "",
            "<str>I can now use the cook's high-quality range.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_STARTED) {
        const lines = [
            "It is the <col=800000>Duke of Lumbridge's</col> birthday.",
            "His <col=800000>cook</col> needs the following ingredients:",
            "",
        ];
        for (const requirement of REQUIRED_ITEMS) {
            const carried = countCarriedItem(player, services, requirement.itemId);
            lines.push(
                carried >= requirement.quantity
                    ? `<str>${requirement.journalLabel}</str>`
                    : requirement.journalLabel,
            );
        }
        return lines;
    }
    return [
        "I can start this quest by speaking to the",
        "<col=800000>Cook</col> in the kitchen on the ground floor",
        "of <col=800000>Lumbridge Castle</col>.",
        "",
        "There aren't any requirements for this quest.",
    ];
}
