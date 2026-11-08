import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import {
    REQUIRED_ITEMS,
    STAGE_COMPLETE,
    STAGE_INGREDIENTS_GIVEN,
    STAGE_STARTED,
    VARP_WITCHS_POTION,
} from "./constants";

export function buildWitchsPotionJournal(
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_WITCHS_POTION);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I brought Hetty an onion, a rat's tail,</str>",
            "<str>a piece of burnt meat and an eye of newt.</str>",
            "<str>I drank from her cauldron and my magic power increased.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_INGREDIENTS_GIVEN) {
        return [
            "<str>I brought Hetty all the ingredients for her potion.</str>",
            "",
            "I should <col=800000>drink from the cauldron</col> and improve my magic.",
        ];
    }
    if (stage >= STAGE_STARTED) {
        const lines = [
            "<str>I spoke to Hetty in Rimmington.</str>",
            "She can increase my magic power if I bring:",
            "",
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
        "I can start this quest by speaking to",
        "<col=800000>Hetty</col> in her house in <col=800000>Rimmington</col>,",
        "west of <col=800000>Port Sarim</col>.",
        "",
        "There aren't any requirements for this quest.",
    ];
}

