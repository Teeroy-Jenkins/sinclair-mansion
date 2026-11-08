import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import {
    completedJournal,
    journalRequirement,
    journalSkillLevel,
} from "../desertTreasureSeries/journalHelpers";

export function buildTrollStrongholdJournal(
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(QUEST_STATE[QUEST_KEYS.trollStronghold].varpId);
    if (stage >= 50)
        return completedJournal([
            "I entered the Troll Stronghold.",
            "I rescued Godric from the troll prison.",
        ]);
    if (stage >= 40)
        return [
            "I have both cell keys.",
            "I should release <col=800000>Godric</col> and return to Dunstan.",
        ];
    if (stage >= 30)
        return [
            "I defeated a Troll General and found the prison key.",
            "I need the two cell keys carried by <col=800000>Twig and Berry</col>.",
        ];
    if (stage >= 20)
        return [
            "I defeated Dad and may enter the stronghold.",
            "I should defeat a <col=800000>Troll General</col> for the prison key.",
        ];
    if (stage >= 10)
        return [
            "Dunstan's son Godric is held in the Troll Stronghold.",
            "I must climb the mountain and defeat <col=800000>Dad</col>.",
        ];
    return [
        journalRequirement(
            "Death Plateau",
            player.varps.getVarpValue(QUEST_STATE[QUEST_KEYS.deathPlateau].varpId) >= 80,
        ),
        journalRequirement("15 Agility", journalSkillLevel(player, services, 16) >= 15),
        "Speak to <col=800000>Denulth</col> after meeting the requirements.",
    ];
}
