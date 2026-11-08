import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_CLIMBED_LADDER,
    STAGE_COMPLETE,
    STAGE_FOUND_DISTILLATOR,
    STAGE_FOUND_SECRET,
    STAGE_GIVEN_DISTILLATOR,
    STAGE_POISONED_STEW,
    STAGE_RELEASED_PIGEONS,
    STAGE_REPORTED_TO_ELENA,
    STAGE_SPOKEN_TO_CHEMIST,
    STAGE_SPOKEN_TO_JERICO,
    STAGE_STARTED,
    STAGE_USED_BIRD_FEED,
    VARP_BIOHAZARD,
} from "./constants";

export function buildBiohazardJournal(player: PlayerState, _services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_BIOHAZARD);
    if (stage >= STAGE_COMPLETE) return ["<str>I uncovered the Ardougne plague hoax.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (stage >= STAGE_REPORTED_TO_ELENA) return ["Elena told me to report the conspiracy to <col=800000>King Lathas</col>."];
    if (stage >= STAGE_FOUND_SECRET) return ["Guidor proved there is no plague.", "I should tell <col=800000>Elena</col> immediately."];
    if (stage >= STAGE_SPOKEN_TO_CHEMIST) return ["The three couriers can smuggle Elena's reagents to Varrock.", "I must collect them at the <col=800000>Dancing Donkey Inn</col> and see Guidor."];
    if (stage >= STAGE_GIVEN_DISTILLATOR) return ["Take Elena's plague sample to the <col=800000>Chemist</col> in Rimmington."];
    if (stage >= STAGE_FOUND_DISTILLATOR) return ["I found Elena's distillator and should return it to her."];
    if (stage >= STAGE_POISONED_STEW) return ["The mourners are ill. I need a <col=800000>medical gown</col>", "and must search their upstairs crates for the distillator."];
    if (stage >= STAGE_CLIMBED_LADDER) return ["I crossed into West Ardougne.", "A rotten apple might spoil the mourners' stew."];
    if (stage >= STAGE_RELEASED_PIGEONS) return ["The watchtower guards are distracted. Speak to <col=800000>Omart</col> now."];
    if (stage >= STAGE_USED_BIRD_FEED) return ["Release Jerico's <col=800000>pigeons</col> beside the watchtower."];
    if (stage >= STAGE_SPOKEN_TO_JERICO) return ["Use <col=800000>bird feed</col> and pigeons to distract the watchtower."];
    if (stage >= STAGE_STARTED) return ["Speak to <col=800000>Jerico</col> near the East Ardougne chapel."];
    return ["Speak to <col=800000>Elena</col> after completing Plague City."];
}

