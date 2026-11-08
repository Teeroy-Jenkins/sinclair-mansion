import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import { completedJournal } from "../desertTreasureSeries/journalHelpers";

export function buildPriestInPerilJournal(
    player: PlayerState,
    _services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(QUEST_STATE[QUEST_KEYS.priestInPeril].varpId);
    if (stage >= 60)
        return completedJournal([
            "I restored the River Salve barrier.",
            "Drezel can safely guard the temple again.",
        ]);
    if (stage >= 50)
        return [
            "Drezel has purified the well.",
            "He needs <col=800000>50 rune or pure essence</col> to restore the barrier.",
        ];
    if (stage >= 40)
        return [
            "I found the key to Drezel's cell.",
            "I should speak to <col=800000>Drezel</col> in the temple.",
        ];
    if (stage >= 20)
        return [
            "King Roald explained the terrible mistake.",
            "I must return to the temple and rescue <col=800000>Drezel</col>.",
        ];
    if (stage >= 10)
        return [
            "King Roald sent me to check on Drezel.",
            "I should investigate the temple east of Varrock.",
        ];
    return [
        "I can start this quest by speaking to",
        "<col=800000>King Roald</col> in Varrock Palace.",
    ];
}
