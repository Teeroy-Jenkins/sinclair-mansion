import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    STAGE_COMPLETE,
    STAGE_DEFEATED_EXPERIMENT,
    STAGE_FOUND_MAGNET,
    STAGE_NOT_STARTED,
    STAGE_STARTED,
    STAGE_UNLOCKED_BACK_DOOR,
} from "./constants";

export function buildWitchsHouseJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by speaking to the <col=800000>little boy</col>",
            "standing by the long garden just <col=800000>north of Taverley</col>.",
            "",
            "I must be able to defeat a <col=800000>level 53 enemy</col>.",
        ];
    }

    const history = [
        "<str>A small boy kicked his ball into the nearby garden.</str>",
        "<str>I agreed to retrieve it for him.</str>",
        "",
    ];
    if (stage === STAGE_STARTED) {
        return [...history, "I should find a way into the <col=800000>garden</col> where the ball is."];
    }
    if (stage === STAGE_FOUND_MAGNET) {
        return [...history, "I found a <col=800000>magnet</col> in a basement cupboard."];
    }
    if (stage >= STAGE_UNLOCKED_BACK_DOOR && stage < STAGE_DEFEATED_EXPERIMENT) {
        return [
            ...history,
            "<str>I found a magnet in a basement cupboard.</str>",
            "<str>I worked out how to unlock the back door to the garden.</str>",
            "",
            "The boy's ball is locked in the <col=800000>garden shed</col>.",
        ];
    }
    if (stage === STAGE_DEFEATED_EXPERIMENT) {
        return [...history, "Now the <col=800000>shapeshifter</col> is dead, I should return the boy's <col=800000>ball</col>."];
    }
    if (stage >= STAGE_COMPLETE) {
        return [
            ...history,
            "<str>I defeated the witch's strange experiment.</str>",
            "<str>I returned the child's ball to him.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    return history;
}
