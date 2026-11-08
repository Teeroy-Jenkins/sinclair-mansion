import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import { completedJournal } from "../desertTreasureSeries/journalHelpers";

export function buildWaterfallQuestJournal(
    player: PlayerState,
    _services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(QUEST_STATE[QUEST_KEYS.waterfall].varpId);
    if (stage >= 10)
        return completedJournal([
            "I discovered the treasure of Baxtorian.",
            "I survived the waterfall dungeon.",
        ]);
    if (stage >= 8)
        return [
            "I placed Glarial's amulet and urn at the statue.",
            "I should take the treasure from <col=800000>Baxtorian's chalice</col>.",
        ];
    if (stage >= 5)
        return [
            "I recovered Glarial's amulet and urn.",
            "The dungeon requires <col=800000>6 air, water and earth runes</col>.",
        ];
    if (stage >= 3)
        return [
            "I read the Book on Baxtorian.",
            "I should ask <col=800000>Golrie</col> about Glarial's tomb.",
        ];
    if (stage >= 1)
        return [
            "Almera fears for her son Hudon.",
            "I should investigate the waterfall and speak to <col=800000>Hadley</col>.",
        ];
    return [
        "I can start this quest by speaking to",
        "<col=800000>Almera</col> beside Baxtorian Falls.",
    ];
}
