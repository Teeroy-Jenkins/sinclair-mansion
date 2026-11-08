import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import {
    completedJournal,
    journalRequirement,
    journalSkillLevel,
} from "../desertTreasureSeries/journalHelpers";

export function buildTempleOfIkovJournal(player: PlayerState, services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(QUEST_STATE[QUEST_KEYS.templeOfIkov].varpId);
    if (stage >= 80)
        return completedJournal([
            "I recovered the Staff of Armadyl.",
            "I decided the fate of Lucien and the guardians.",
        ]);
    if (stage >= 70)
        return [
            "I found the Guardians of Armadyl.",
            "I must decide who receives the <col=800000>Staff of Armadyl</col>.",
        ];
    if (stage >= 60)
        return [
            "I defeated the Fire Warrior of Lesarkus.",
            "I should search the Temple of Ikov for the guardians.",
        ];
    if (stage >= 10)
        return [
            "Lucien gave me his pendant.",
            "I need <col=800000>20 limpwurt roots</col> and must find Winelda.",
        ];
    return [
        "I can start this quest by speaking to <col=800000>Lucien</col>",
        "at the Flying Horse Inn in East Ardougne.",
        journalRequirement("42 Thieving", journalSkillLevel(player, services, 17) >= 42),
    ];
}
