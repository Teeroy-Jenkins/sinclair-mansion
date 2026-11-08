import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    SHEEP,
    STAGE_COMPLETE,
    STAGE_DISPOSING_SHEEP,
    STAGE_NEEDS_PROTECTIVE_CLOTHING,
    STAGE_NOT_STARTED,
    VARP_SHEEP_DISPOSAL,
} from "./constants";

function progress(player: PlayerState, startBit: number): number {
    return (player.varps.getVarpValue(VARP_SHEEP_DISPOSAL) >>> startBit) & 0x7;
}

export function buildSheepHerderJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by speaking to <col=800000>Councillor Halgrive</col>",
            "outside the church near the East Ardougne zoo.",
        ];
    }
    const lines = [
        "<str>Councillor Halgrive asked me to dispose of four diseased sheep.</str>",
        "<str>He gave me poisoned sheep feed.</str>",
        "",
    ];
    if (stage === STAGE_NEEDS_PROTECTIVE_CLOTHING) {
        lines.push("I need to buy protective clothing from <col=800000>Doctor Orbon</col> for 100 coins.");
        return lines;
    }
    if (stage >= STAGE_DISPOSING_SHEEP) {
        lines.push("I must equip the plague suit and cattleprod, herd each sheep into the pen, poison it, and burn its bones.");
        for (const sheep of SHEEP) {
            const value = progress(player, sheep.startBit);
            lines.push(
                value === 6
                    ? `<str>${sheep.name}'s remains have been incinerated.</str>`
                    : value === 2
                      ? `${sheep.name}'s bones must be burned in the <col=800000>incinerator</col>.`
                      : value === 1
                        ? `${sheep.name} is in the pen and must be given <col=800000>sheep feed</col>.`
                        : `${sheep.name} must be herded into the enclosure.`,
            );
        }
    }
    if (stage === STAGE_COMPLETE) {
        lines.push("", "<str>I disposed of all four sheep and claimed Halgrive's reward.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>");
    }
    return lines;
}
