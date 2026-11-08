import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    STAGE_COMPLETE,
    STAGE_FAILED_TITAN,
    STAGE_FINDING_PERCIVAL,
    STAGE_GIVEN_WHISTLE,
    STAGE_NOT_STARTED,
    STAGE_SPOKEN_CRONE,
    STAGE_SPOKEN_MERLIN,
    STAGE_STARTED,
} from "./constants";

export function buildHolyGrailJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED)
        return ["After Merlin's Crystal, I can ask <col=800000>King Arthur</col> for another quest."];
    const lines = ["<str>King Arthur sent me to recover the Holy Grail.</str>", ""];
    if (stage === STAGE_STARTED) lines.push("I should speak to <col=800000>Merlin</col> in his Camelot workshop.");
    else if (stage === STAGE_SPOKEN_MERLIN) lines.push("I should speak to the High Priest on <col=800000>Entrana</col>.");
    else if (stage === STAGE_SPOKEN_CRONE) lines.push("Galahad can provide a Fisher Realm keepsake. Then I need two magic whistles.");
    else if (stage === STAGE_FAILED_TITAN) lines.push("The Titan's final blow must be dealt with <col=800000>Excalibur</col>.");
    else if (stage === STAGE_FINDING_PERCIVAL) lines.push("King Arthur's feather points to sacks in Goblin Village, where Percival is trapped.");
    else if (stage === STAGE_GIVEN_WHISTLE) lines.push("Percival has returned. I can revisit the restored realm and claim the Holy Grail.");
    else if (stage >= STAGE_COMPLETE)
        lines.push("<str>I returned the Holy Grail to Camelot.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>");
    return lines;
}
