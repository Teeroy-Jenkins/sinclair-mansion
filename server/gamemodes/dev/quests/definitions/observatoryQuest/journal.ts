import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import { STAGE } from "./constants";

export function buildObservatoryQuestJournal(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage >= STAGE.complete) return ["<str>I repaired the Observatory telescope.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (stage === STAGE.notStarted) return ["I can start this quest by speaking to the", "<col=800000>Observatory professor</col> south-west of Ardougne."];
    if (stage === STAGE.planks) return ["The professor needs <col=800000>three wooden planks</col> for a new tripod."];
    if (stage === STAGE.bronze) return ["The professor needs a <col=800000>bronze bar</col> for the telescope tube."];
    if (stage === STAGE.glass) return ["The professor needs <col=800000>molten glass</col> for a replacement lens."];
    if (stage === STAGE.mould) return ["The goblins hid the professor's <col=800000>lens mould</col> in the Observatory dungeon."];
    if (stage === STAGE.lens) return ["I should use the <col=800000>lens mould</col> with <col=800000>molten glass</col>."];
    return ["The telescope is repaired. I should meet the professor", "at the Observatory and <col=800000>look through the telescope</col>."];
}
