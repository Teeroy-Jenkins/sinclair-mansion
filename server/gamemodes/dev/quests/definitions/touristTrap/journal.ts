import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import {
    completedJournal,
    journalRequirement,
    journalSkillLevel,
} from "../desertTreasureSeries/journalHelpers";

export function buildTouristTrapJournal(player: PlayerState, services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(QUEST_STATE[QUEST_KEYS.touristTrap].varpId);
    if (stage >= 30)
        return completedJournal([
            "I rescued Ana from the desert mining camp.",
            "I returned her safely to Irena.",
        ]);
    if (stage >= 25)
        return [
            "Ana is hidden in a barrel.",
            "I must smuggle her out and return to <col=800000>Irena</col>.",
        ];
    if (stage >= 20)
        return [
            "I have entered the mine disguised as a slave.",
            "I need to find <col=800000>Ana</col> in the underground mine.",
        ];
    if (stage >= 10)
        return [
            "I can enter the camp, but need a disguise.",
            "<col=800000>Al Shabim</col> can help me make slave clothing.",
        ];
    if (stage >= 1)
        return [
            "Irena's daughter Ana is imprisoned in the mining camp.",
            "I should deal with the <col=800000>Mercenary Captain</col>.",
        ];
    return [
        "I can start this quest by speaking to <col=800000>Irena</col>",
        "at the Shantay Pass.",
        journalRequirement("20 Smithing", journalSkillLevel(player, services, 13) >= 20),
        journalRequirement("10 Fletching", journalSkillLevel(player, services, 9) >= 10),
    ];
}
