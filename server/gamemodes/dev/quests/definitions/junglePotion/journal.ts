import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import {
    JUNGLE_POTION_HERBS,
    STAGE_COMPLETE,
    STAGE_NOT_STARTED,
    VARP_JUNGLE_POTION,
} from "./constants";

export function buildJunglePotionJournal(
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_JUNGLE_POTION);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by speaking to",
            "<col=800000>Trufitus Shakaya</col> in <col=800000>Tai Bwo Wannai</col>.",
            "",
            "I must have completed <col=800000>Druidic Ritual</col>.",
        ];
    }

    const lines = [
        "<str>I spoke to Trufitus. He needs to commune with the gods</str>",
        "<str>and asked me to collect five special jungle herbs.</str>",
        "",
    ];
    for (const herb of JUNGLE_POTION_HERBS) {
        if (stage > herb.foundStage) {
            lines.push(`<str>I collected fresh ${herb.name} for Trufitus.</str>`);
            continue;
        }
        if (stage === herb.foundStage) {
            const carrying =
                countCarriedItem(player, services, herb.grimyItemId) > 0 ||
                countCarriedItem(player, services, herb.cleanItemId) > 0;
            lines.push(
                carrying
                    ? `<str>I found some fresh ${herb.name}.</str>`
                    : `I need to collect more fresh <col=800000>${herb.name}</col>.`,
            );
            if (carrying) {
                lines.push(`I should clean it and give it to <col=800000>Trufitus</col>.`);
            }
            break;
        }
        if (stage === herb.requestedStage) {
            lines.push(`I need to find fresh <col=800000>${herb.name}</col> for <col=800000>Trufitus</col>.`);
            break;
        }
    }
    if (stage >= STAGE_COMPLETE) {
        lines.push("", "<col=ff0000>QUEST COMPLETE!</col>");
    }
    return lines;
}
