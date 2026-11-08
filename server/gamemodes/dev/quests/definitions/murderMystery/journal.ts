import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    EVIDENCE_FINGERPRINTS,
    EVIDENCE_THREAD,
    POISON_LOCATION_CHECKED,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_MURDER_EVIDENCE,
    VARP_POISON_PROOF,
} from "./constants";

export function buildMurderMysteryJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage >= STAGE_COMPLETE) {
        return ["<str>I gathered three independent pieces of evidence.", "<str>I identified Lord Sinclair's murderer.", "<col=ff0000>Quest complete!"];
    }
    if (stage < STAGE_STARTED) {
        return ["I can start this quest by speaking to a", "<col=800000>guard<col=000080> outside the Sinclair Mansion."];
    }
    const evidence = player.varps.getVarpValue(VARP_MURDER_EVIDENCE);
    return [
        "The guards asked me to investigate Lord Sinclair's murder.",
        (evidence & EVIDENCE_THREAD) !== 0 ? "<str>I found coloured thread at the broken window." : "I should investigate the broken study window.",
        (evidence & EVIDENCE_FINGERPRINTS) !== 0 ? "<str>I matched a family member's prints to the dagger." : "I should compare fingerprints from the dagger and silver belongings.",
        player.varps.getVarpValue(VARP_POISON_PROOF) >= POISON_LOCATION_CHECKED ? "<str>I proved one family member lied about using poison." : "I should ask the poison salesman and inspect where each suspect used poison.",
        "When all three clues agree, I should report to the guard.",
    ];
}
