import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import {
    completedJournal,
    journalRequirement,
    journalSkillLevel,
} from "../desertTreasureSeries/journalHelpers";

export function buildDigSiteJournal(player: PlayerState, services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(QUEST_STATE[QUEST_KEYS.digSite].varpId);
    if (stage >= 9)
        return completedJournal([
            "I passed the Dig Site examinations.",
            "I uncovered an ancient altar beneath the Dig Site.",
        ]);
    if (stage >= 7)
        return [
            "Terry Balando has asked me to investigate the dig shafts.",
            "I should bring the <col=800000>ancient talisman</col> to the museum curator.",
        ];
    if (stage >= 4)
        return [
            "I passed the three examinations.",
            "I should speak to <col=800000>Terry Balando</col> at the Exam Centre.",
        ];
    if (stage >= 1)
        return [
            "The examiner wants proof that I studied the Dig Site.",
            "I should interview all <col=800000>three students</col>.",
        ];
    return [
        "I can start this quest at the <col=800000>Dig Site Exam Centre</col>.",
        journalRequirement("10 Agility", journalSkillLevel(player, services, 16) >= 10),
        journalRequirement("10 Herblore", journalSkillLevel(player, services, 15) >= 10),
        journalRequirement("25 Thieving", journalSkillLevel(player, services, 17) >= 25),
    ];
}
