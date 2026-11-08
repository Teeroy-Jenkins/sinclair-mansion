import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    STAGE_COMPLETE,
    STAGE_FIRST_HINT,
    STAGE_NOT_STARTED,
    STAGE_SECOND_HINT,
    STAGE_STARTED,
} from "./constants";

function ownsAny(player: PlayerState, services: ScriptServices, ids: readonly number[]): boolean {
    return ids.some((id) => services.inventory.findOwnedItemLocation(player, id) !== undefined);
}

export function buildScorpionCatcherJournal(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by speaking to <col=800000>Thormac</col>",
            "in the <col=800000>Sorcerer's Tower</col> south-west of Catherby.",
            "",
            "I need level 31 <col=800000>Prayer</col>.",
        ];
    }
    const lines = ["<str>Thormac asked me to recover his three Kharid scorpions.</str>", ""];
    if (stage === STAGE_STARTED) {
        return [...lines, "I should ask a <col=800000>Seer</col> where the scorpions escaped to."];
    }
    const hasFirst = ownsAny(player, services, [ITEM.first, ITEM.firstSecond, ITEM.firstThird, ITEM.fullCage]);
    const hasSecond = ownsAny(player, services, [ITEM.second, ITEM.firstSecond, ITEM.secondThird, ITEM.fullCage]);
    const hasThird = ownsAny(player, services, [ITEM.third, ITEM.firstThird, ITEM.secondThird, ITEM.fullCage]);
    if (stage >= STAGE_FIRST_HINT) {
        lines.push(
            hasFirst
                ? "<str>I caught the scorpion in the secret room near spiders and coffins.</str>"
                : "One scorpion is in a <col=800000>secret room</col> near spiders and two coffins.",
        );
    }
    if (stage >= STAGE_SECOND_HINT) {
        lines.push(
            hasSecond
                ? "<str>I caught the scorpion hidden at the Barbarian Outpost.</str>"
                : "One scorpion was taken to the <col=800000>Barbarian Outpost</col>.",
            hasThird
                ? "<str>I caught the scorpion upstairs in the Edgeville Monastery.</str>"
                : "One scorpion is upstairs by brown robes in the <col=800000>Monastery</col>.",
        );
    }
    if (stage === STAGE_SECOND_HINT && hasFirst && hasSecond && hasThird) {
        lines.push("", "I should take the full cage back to <col=800000>Thormac</col>.");
    }
    if (stage === STAGE_COMPLETE) {
        lines.push("", "<str>I returned all three scorpions to Thormac.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>");
    }
    return lines;
}
