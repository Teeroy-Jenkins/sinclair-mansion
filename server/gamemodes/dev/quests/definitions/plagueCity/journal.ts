import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    STAGE_COMPLETE,
    STAGE_FIND_DWELLBERRIES,
    STAGE_FREED_ELENA,
    STAGE_GAS_MASK,
    STAGE_HAVE_WARRANT,
    STAGE_NEED_CLEARANCE,
    STAGE_NEED_HANGOVER_CURE,
    STAGE_NOT_STARTED,
    STAGE_PIPE_OPEN,
    STAGE_READ_SCROLL,
    STAGE_RETURNED_BOOK,
    STAGE_ROPE_TIED,
    STAGE_SHOWN_PICTURE,
    STAGE_SOFTEN_MUD,
    STAGE_SPOKE_TO_MILLI,
    STAGE_SPOKE_TO_REHNISONS,
    STAGE_TUNNEL_OPEN,
    STAGE_WATER_4,
} from "./constants";

export function buildPlagueCityJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by speaking to <col=800000>Edmond</col>",
            "behind his house in <col=800000>East Ardougne</col>.",
            "",
            "There are no requirements for this quest.",
        ];
    }

    const lines = ["<str>Edmond asked me to find his missing daughter Elena.</str>", ""];
    if (stage === STAGE_FIND_DWELLBERRIES) {
        lines.push("I need <col=800000>dwellberries</col> so Alrena can make a gas mask.");
    } else if (stage === STAGE_GAS_MASK) {
        lines.push("<str>Alrena made me a gas mask.</str>", "I should speak to <col=800000>Edmond</col>.");
    } else if (stage >= STAGE_SOFTEN_MUD && stage < STAGE_WATER_4) {
        lines.push("I must pour four <col=800000>buckets of water</col> onto the mud patch.");
    } else if (stage === STAGE_WATER_4) {
        lines.push("The soil is soft. I should use a <col=800000>spade</col> on it.");
    } else if (stage === STAGE_TUNNEL_OPEN) {
        lines.push("I reached the sewers. The pipe grill needs a <col=800000>rope</col>.");
    } else if (stage === STAGE_ROPE_TIED) {
        lines.push("The rope is tied. I need <col=800000>Edmond</col> to help pull the grill away.");
    } else if (stage === STAGE_PIPE_OPEN) {
        lines.push("I should wear my gas mask, enter West Ardougne, and find <col=800000>Jethick</col>.");
    } else if (stage === STAGE_SHOWN_PICTURE) {
        lines.push("Jethick gave me a book to return to the <col=800000>Rehnison family</col>.");
    } else if (stage === STAGE_RETURNED_BOOK) {
        lines.push("I should ask <col=800000>Ted or Martha Rehnison</col> about Elena.");
    } else if (stage === STAGE_SPOKE_TO_REHNISONS) {
        lines.push("Their daughter <col=800000>Milli</col> saw what happened. She is upstairs.");
    } else if (stage === STAGE_SPOKE_TO_MILLI) {
        lines.push("I should investigate the plague house in southern West Ardougne.");
    } else if (stage === STAGE_NEED_CLEARANCE) {
        lines.push("I need clearance from <col=800000>Bravek</col> to enter the plague house.");
    } else if (stage === STAGE_NEED_HANGOVER_CURE) {
        lines.push("Bravek needs a <col=800000>hangover cure</col> before he can help me.");
    } else if (stage === STAGE_HAVE_WARRANT) {
        lines.push("I have a warrant. I must enter the plague house and free Elena.");
    } else if (stage === STAGE_FREED_ELENA) {
        lines.push("<str>I freed Elena.</str>", "I should return to <col=800000>Edmond</col>.");
    } else if (stage >= STAGE_COMPLETE) {
        lines.push(
            "<str>Edmond rewarded me for rescuing Elena.</str>",
            stage >= STAGE_READ_SCROLL
                ? "<str>I learned the Ardougne Teleport spell.</str>"
                : "I should read Edmond's magic scroll.",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        );
    }
    return lines;
}

