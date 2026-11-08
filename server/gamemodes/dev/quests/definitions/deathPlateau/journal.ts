import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import { completedJournal } from "../desertTreasureSeries/journalHelpers";

export function buildDeathPlateauJournal(player: PlayerState, _services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(QUEST_STATE[QUEST_KEYS.deathPlateau].varpId);
    if (stage >= 80) {
        return completedJournal([
            "I found a secret route to Death Plateau.",
            "The Burthorpe Imperial Guard can use the route.",
        ]);
    }
    if (stage >= 75)
        return [
            "I have the map and Harold's combination.",
            "I should report back to <col=800000>Denulth</col>.",
        ];
    if (stage >= 70)
        return [
            "Tenzing showed me the secret route.",
            "I need <col=800000>Dunstan</col> to add spikes to the climbing boots.",
        ];
    if (stage >= 60)
        return [
            "I decoded Harold's gambling IOU.",
            "I should ask <col=800000>Saba</col> about another route.",
        ];
    if (stage >= 20)
        return [
            "Harold may know how the trolls reach the plateau.",
            "He drinks in the <col=800000>Toad and Chicken</col> in Burthorpe.",
        ];
    if (stage >= 10)
        return [
            "<col=800000>Denulth</col> needs a secret route to Death Plateau.",
            "I should speak to <col=800000>Eohric</col> in Burthorpe Castle.",
        ];
    return [
        "I can start this quest by speaking to",
        "<col=800000>Denulth</col> in the Burthorpe training camp.",
    ];
}
