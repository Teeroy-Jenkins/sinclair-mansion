import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    STAGE_AVAN_PIECE,
    STAGE_CALEB_PIECE,
    STAGE_COMPLETE,
    STAGE_CURED_JOHNATHON,
    STAGE_NOT_STARTED,
    STAGE_SEEKING_AVAN,
    STAGE_SPOKEN_AVAN,
    STAGE_SPOKEN_BOOT,
    STAGE_SPOKEN_CALEB,
    STAGE_SPOKEN_DIMINTHEIS,
    STAGE_SPOKEN_GEM_TRADER,
    STAGE_SPOKEN_JOHNATHON,
} from "./constants";

export function buildFamilyCrestJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by speaking to <col=800000>Dimintheis</col> in south-east Varrock.",
            "",
            "I will need level 40 Mining, Smithing and Crafting, and level 59 Magic.",
        ];
    }
    const lines = ["<str>I agreed to restore the Fitzharmon family crest.</str>", ""];
    if (stage === STAGE_SPOKEN_DIMINTHEIS)
        lines.push("I should find <col=800000>Caleb</col>, a chef beyond White Wolf Mountain.");
    else if (stage === STAGE_SPOKEN_CALEB)
        lines.push("Caleb needs cooked shrimp, salmon, tuna, bass and swordfish.");
    else if (stage === STAGE_CALEB_PIECE)
        lines.push("I have Caleb's piece. I should ask him where his brothers went.");
    else if (stage === STAGE_SEEKING_AVAN)
        lines.push("A trader in <col=800000>Al Kharid</col> may know where Avan is.");
    else if (stage === STAGE_SPOKEN_GEM_TRADER)
        lines.push("I should find <col=800000>Avan</col> near the Al Kharid mine.");
    else if (stage === STAGE_SPOKEN_AVAN)
        lines.push("I should ask <col=800000>Boot</col> in the Dwarven Mine about perfect gold.");
    else if (stage === STAGE_SPOKEN_BOOT)
        lines.push("I need a perfect ruby ring and necklace for Avan.");
    else if (stage === STAGE_AVAN_PIECE)
        lines.push("I should cure <col=800000>Johnathon</col> at the Jolly Boar Inn.");
    else if (stage === STAGE_SPOKEN_JOHNATHON)
        lines.push("Johnathon needs a dose of poison cure.");
    else if (stage === STAGE_CURED_JOHNATHON)
        lines.push("I must weaken Chronozon with all four Blast spells, kill him, and restore the crest.");
    else if (stage >= STAGE_COMPLETE)
        lines.push("<str>I restored the Fitzharmon family crest.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>");
    return lines;
}
