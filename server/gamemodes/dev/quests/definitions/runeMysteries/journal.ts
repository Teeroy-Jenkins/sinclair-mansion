import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import {
    RESEARCH_NOTES_ITEM_ID,
    RESEARCH_PACKAGE_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_GIVEN_PACKAGE,
    STAGE_GIVEN_TALISMAN,
    STAGE_RECEIVED_NOTES,
    STAGE_RECEIVED_PACKAGE,
    STAGE_STARTED,
    VARP_RUNE_MYSTERIES,
} from "./constants";

const dukeLines = [
    "<str>I spoke to Duke Horacio and he showed me a strange</str>",
    "<str>talisman found by one of his subjects.</str>",
    "<str>I agreed to take it to the Wizards' Tower.</str>",
];

const sedridorLines = [
    "<str>I gave the talisman to Archmage Sedridor and</str>",
    "<str>agreed to help with his research into rune stones.</str>",
];

const auburyLines = [
    "<str>I took Sedridor's research package to Aubury</str>",
    "<str>in Varrock.</str>",
];

export function buildRuneMysteriesJournal(
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_RUNE_MYSTERIES);
    if (stage >= STAGE_COMPLETE) {
        return [
            ...dukeLines,
            "",
            ...sedridorLines,
            "",
            ...auburyLines,
            "<str>I delivered Aubury's notes to Sedridor and learned</str>",
            "<str>the secret of the Rune Essence.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_RECEIVED_NOTES) {
        return [
            ...dukeLines,
            "",
            ...sedridorLines,
            "",
            ...auburyLines,
            countCarriedItem(player, services, RESEARCH_NOTES_ITEM_ID) > 0
                ? "I should take <col=800000>Aubury's notes</col> to <col=800000>Sedridor</col>."
                : "I should ask <col=800000>Aubury</col> for another copy of his notes.",
        ];
    }
    if (stage >= STAGE_GIVEN_PACKAGE) {
        return [
            ...dukeLines,
            "",
            ...sedridorLines,
            "",
            ...auburyLines,
            "I should speak to <col=800000>Aubury</col> again after he",
            "has examined the research package.",
        ];
    }
    if (stage >= STAGE_RECEIVED_PACKAGE) {
        return [
            ...dukeLines,
            "",
            ...sedridorLines,
            "",
            countCarriedItem(player, services, RESEARCH_PACKAGE_ITEM_ID) > 0
                ? "I should take the <col=800000>research package</col> to <col=800000>Aubury</col>"
                : "I should ask <col=800000>Sedridor</col> to recover the lost package.",
            "Aubury owns the rune shop in <col=800000>Varrock</col>.",
        ];
    }
    if (stage >= STAGE_GIVEN_TALISMAN) {
        return [
            ...dukeLines,
            "",
            "<str>I gave the talisman to Archmage Sedridor.</str>",
            "I should speak to <col=800000>Sedridor</col> again and offer",
            "to help with his research.",
        ];
    }
    if (stage >= STAGE_STARTED) {
        return [
            ...dukeLines,
            "",
            "I need to find <col=800000>Archmage Sedridor</col> in the cellar",
            "of the <col=800000>Wizards' Tower</col> and give him the talisman.",
        ];
    }
    return [
        "I can start this quest by speaking to",
        "<col=800000>Duke Horacio</col>, upstairs in",
        "<col=800000>Lumbridge Castle</col>.",
        "",
        "There aren't any requirements for this quest.",
    ];
}

