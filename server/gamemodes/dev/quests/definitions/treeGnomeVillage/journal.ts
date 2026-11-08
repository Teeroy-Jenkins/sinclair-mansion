import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    STAGE_BALLISTA_FIRED,
    STAGE_COMPLETE,
    STAGE_DEFEATED_WARLORD,
    STAGE_FINDING_TRACKERS,
    STAGE_GIVEN_LOGS,
    STAGE_NOT_STARTED,
    STAGE_RETRIEVED_ORB,
    STAGE_RETURNED_FIRST_ORB,
    STAGE_SPOKEN_MONTAI,
    STAGE_STARTED,
} from "./constants";

export function buildTreeGnomeVillageJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED)
        return ["I can start this quest by speaking to <col=800000>King Bolren</col> in the Tree Gnome Village maze."];
    const lines = ["<str>I agreed to recover the gnomes' orbs of protection.</str>", ""];
    if (stage === STAGE_STARTED) lines.push("I should report to <col=800000>Commander Montai</col> on the battlefield.");
    else if (stage === STAGE_SPOKEN_MONTAI) lines.push("Montai needs <col=800000>six normal logs</col>.");
    else if (stage === STAGE_GIVEN_LOGS) lines.push("I should speak to Montai again about the attack.");
    else if (stage === STAGE_FINDING_TRACKERS) lines.push("I should find the three trackers, then fire the <col=800000>ballista</col>.");
    else if (stage === STAGE_BALLISTA_FIRED) lines.push("The stronghold is breached. I need the orb from its upstairs chest.");
    else if (stage === STAGE_RETRIEVED_ORB) lines.push("I should return the first orb to <col=800000>King Bolren</col>.");
    else if (stage === STAGE_RETURNED_FIRST_ORB) lines.push("I must defeat the <col=800000>Khazard warlord</col> north-west of the battlefield.");
    else if (stage === STAGE_DEFEATED_WARLORD) lines.push("I should return the remaining orbs to King Bolren.");
    else if (stage >= STAGE_COMPLETE)
        lines.push("<str>I restored all three orbs of protection.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>");
    return lines;
}
