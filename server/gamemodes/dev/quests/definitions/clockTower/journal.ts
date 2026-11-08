import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import { COGS, STAGE_ALL_COGS_PLACED, STAGE_COMPLETE, STAGE_NOT_STARTED, VARP_CLOCK_TOWER_BITS } from "./constants";

function isBitSet(value: number, bit: number): boolean {
    return (value & (1 << bit)) !== 0;
}

export function buildClockTowerJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by talking to <col=800000>Brother Kojo</col>",
            "at the <col=800000>Clock Tower</col> south of <col=800000>Ardougne</col>.",
        ];
    }

    const lines = [
        "<str>I agreed to help Brother Kojo repair the Clock Tower.</str>",
        "",
    ];
    const bits = player.varps.getVarpValue(VARP_CLOCK_TOWER_BITS);
    for (const cog of COGS) {
        lines.push(
            isBitSet(bits, cog.placedBit)
                ? `<str>I placed the ${cog.name} cog on its spindle.</str>`
                : `I still need to place the <col=800000>${cog.name} cog</col> on its spindle.`,
        );
    }

    if (stage === STAGE_ALL_COGS_PLACED) {
        lines.push("", "I should speak to <col=800000>Brother Kojo</col> for my reward.");
    }
    if (stage >= STAGE_COMPLETE) {
        lines.push("", "<col=ff0000>QUEST COMPLETE!</col>");
    }
    return lines;
}
