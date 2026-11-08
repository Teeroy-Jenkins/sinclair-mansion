import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    SIDE_HAZEEL,
    STAGE_CHOSEN_SIDE,
    STAGE_COMPLETE,
    STAGE_FINISHED_SIDE_TASK,
    STAGE_POISONED_FOOD,
    STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL,
    STAGE_SPOKEN_TO_CLIVET,
    STAGE_STARTED,
    VARP_HAZEEL_SIDE,
} from "./constants";

export function buildHazeelCultJournal(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I uncovered the plot surrounding the Carnillean family.",
            player.varps.getVarpValue(VARP_HAZEEL_SIDE) === SIDE_HAZEEL
                ? "<str>I helped the cult resurrect Lord Hazeel."
                : "<str>I stopped the cult and exposed Butler Jones.",
            "<col=ff0000>Quest complete!",
        ];
    }
    if (stage < STAGE_STARTED) {
        return ["I can start this quest by speaking to", "<col=800000>Ceril Carnillean<col=000080> south-west of Ardougne."];
    }

    const lines = ["<str>Ceril asked me to recover his stolen family armour."];
    if (stage < STAGE_SPOKEN_TO_CLIVET) {
        lines.push("I should investigate the cave near the Clock Tower.");
        return lines;
    }
    lines.push("<str>Clivet told me the cult's version of the mansion's history.");
    if (stage < STAGE_CHOSEN_SIDE) {
        lines.push("I must decide whether to help the Carnilleans or the cult.");
        return lines;
    }

    const evil = player.varps.getVarpValue(VARP_HAZEEL_SIDE) === SIDE_HAZEEL;
    if (evil) {
        if (stage < STAGE_POISONED_FOOD) lines.push("I must pour Clivet's poison into the mansion's range.");
        else if (stage < STAGE_FINISHED_SIDE_TASK) lines.push("I should return to Clivet, then meet Alomone in the hideout.");
        else if (stage < STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL) lines.push("I must find the Hazeel scroll hidden inside the mansion.");
        else lines.push("I should take the Hazeel scroll to Alomone.");
    } else if (stage < STAGE_FINISHED_SIDE_TASK) {
        lines.push("I must defeat Alomone and recover the Carnillean armour.");
    } else if (stage < STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL) {
        lines.push("I should return the Carnillean armour to Ceril.");
    } else {
        lines.push("Jones escaped Ceril's suspicion. I need evidence from the upstairs cupboard.");
    }
    void services;
    return lines;
}
