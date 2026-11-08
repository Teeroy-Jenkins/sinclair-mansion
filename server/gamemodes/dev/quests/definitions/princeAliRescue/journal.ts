import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    BLONDE_WIG_ITEM_ID,
    BRONZE_KEY_ITEM_ID,
    PINK_SKIRT_ITEM_ID,
    ROPE_ITEM_ID,
    SKIN_PASTE_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_GUARD_DRUNK,
    STAGE_KELI_TIED,
    STAGE_PREPARATION_COMPLETE,
    STAGE_PRINCE_SAVED,
    STAGE_SPOKEN_TO_OSMAN,
    STAGE_STARTED,
} from "./constants";
import { carriesItem } from "./items";

export function buildPrinceAliRescueJournal(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === 0) {
        return [
            "I can start this quest by speaking to <col=800000>Chancellor Hassan</col>",
            "in <col=800000>Al Kharid Palace</col>.",
        ];
    }
    if (stage === STAGE_STARTED) {
        return [
            "<str>I offered to help Chancellor Hassan.</str>",
            "He told me to report to <col=800000>Osman</col>, the spymaster.",
        ];
    }
    const summary = [
        "<str>Prince Ali was kidnapped and is held near Draynor Village.</str>",
        "<str>I must disguise him and tie up Lady Keli to free him.</str>",
    ];
    if (stage >= STAGE_SPOKEN_TO_OSMAN && stage < STAGE_PREPARATION_COMPLETE) {
        return [
            ...summary,
            "",
            "I should speak to <col=800000>Leela</col> near Draynor Village.",
            carriesItem(player, services, BRONZE_KEY_ITEM_ID)
                ? "<str>I have the duplicate bronze key.</str>"
                : "I need a key print, a bronze bar, and a duplicate key.",
            carriesItem(player, services, ROPE_ITEM_ID)
                ? "<str>I have rope for Lady Keli.</str>"
                : "I need rope to tie Lady Keli up.",
            carriesItem(player, services, SKIN_PASTE_ITEM_ID)
                ? "<str>I have skin paste.</str>"
                : "I need something to lighten the Prince's skin.",
            carriesItem(player, services, PINK_SKIRT_ITEM_ID)
                ? "<str>I have a pink skirt.</str>"
                : "I need a pink skirt like Lady Keli's.",
            carriesItem(player, services, BLONDE_WIG_ITEM_ID)
                ? "<str>I have a blonde wig.</str>"
                : "I need a blonde wig.",
        ];
    }
    if (stage === STAGE_PREPARATION_COMPLETE) {
        return [
            ...summary,
            "",
            "Before freeing Prince Ali, I need to deal with the door guard.",
            "Leela suggested finding his weakness.",
        ];
    }
    if (stage === STAGE_GUARD_DRUNK) {
        return [
            ...summary,
            "<str>I got Joe drunk so he cannot interfere.</str>",
            "",
            "I should use my <col=800000>rope</col> on <col=800000>Lady Keli</col>.",
        ];
    }
    if (stage === STAGE_KELI_TIED) {
        return [
            ...summary,
            "<str>I got Joe drunk and tied Lady Keli in a cupboard.</str>",
            "",
            "I can now unlock the cell and give Prince Ali the full disguise.",
        ];
    }
    if (stage === STAGE_PRINCE_SAVED) {
        return [
            ...summary,
            "<str>I disguised Prince Ali and helped him escape.</str>",
            "",
            "I should return to <col=800000>Chancellor Hassan</col> for my reward.",
        ];
    }
    if (stage >= STAGE_COMPLETE) {
        return [
            ...summary,
            "<str>I got Joe drunk and tied Lady Keli up.</str>",
            "<str>I disguised Prince Ali and helped him escape.</str>",
            "<str>Chancellor Hassan rewarded me for the rescue.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    return summary;
}
