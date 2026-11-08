import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_ADDED_POUCH,
    STAGE_BLESSED,
    STAGE_BLESSED_SICKLE,
    STAGE_CAST_SPELL,
    STAGE_COMPLETE,
    STAGE_ENTERED_GROTTO,
    STAGE_ENTERED_SWAMP,
    STAGE_FULL_TRANSFORM,
    STAGE_GIVEN_JOURNAL,
    STAGE_KILLED_GHAST_1,
    STAGE_KILLED_GHAST_2,
    STAGE_KILLED_GHAST_3,
    STAGE_PERFORMED_RITUAL,
    STAGE_PICKED_FUNGI,
    STAGE_RECEIVED_SPELL,
    STAGE_SHOWN_MIRROR,
    STAGE_SPOKEN_FILLIMAN_2,
    STAGE_STARTED,
    VARP_NATURE_SPIRIT,
} from "./constants";

export function buildNatureSpiritJournal(player: PlayerState, _services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_NATURE_SPIRIT);
    if (stage >= STAGE_COMPLETE) return ["<str>I helped Filliman become a Nature Spirit.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (stage >= STAGE_ADDED_POUCH) {
        const killed = stage >= STAGE_KILLED_GHAST_3 ? 3 : stage >= STAGE_KILLED_GHAST_2 ? 2 : stage >= STAGE_KILLED_GHAST_1 ? 1 : 0;
        return [`I have released ${killed} of the 3 Ghasts.`, killed === 3 ? "Return to the <col=800000>Nature Spirit</col>." : "Defeat Ghasts with charges from my druid pouch."];
    }
    if (stage >= STAGE_BLESSED_SICKLE) return ["Use the blessed sickle to make swamp plants bloom,", "then fill the <col=800000>druid pouch</col> with their produce."];
    if (stage >= STAGE_FULL_TRANSFORM) return ["Bring the Nature Spirit a <col=800000>silver sickle</col> to bless."];
    if (stage >= STAGE_ENTERED_GROTTO || stage >= STAGE_PERFORMED_RITUAL) return ["Enter the grotto and speak to Filliman to complete his transformation."];
    if (stage >= STAGE_SPOKEN_FILLIMAN_2 || stage >= STAGE_PICKED_FUNGI) return ["Place the fungus on the nature stone and the used spell on", "the spirit stone, then speak to Filliman on the faith stone."];
    if (stage >= STAGE_CAST_SPELL || stage >= STAGE_BLESSED) return ["Pick <col=800000>Mort myre fungus</col> grown by the Bloom spell."];
    if (stage >= STAGE_RECEIVED_SPELL) return ["Ask <col=800000>Drezel</col> to bless me, then cast Filliman's spell in the swamp."];
    if (stage >= STAGE_GIVEN_JOURNAL) return ["Ask Filliman how I can help him become a nature spirit."];
    if (stage >= STAGE_SHOWN_MIRROR) return ["Find Filliman's <col=800000>journal</col> in the grotto tree and give it to him."];
    if (stage >= STAGE_ENTERED_SWAMP) return ["Wear an amulet of ghostspeak, find a mirror, and convince Filliman he is dead."];
    if (stage >= STAGE_STARTED) return ["Enter Mort Myre swamp and find <col=800000>Filliman Tarlock</col>."];
    return ["Speak to <col=800000>Drezel</col> after completing Priest in Peril."];
}

