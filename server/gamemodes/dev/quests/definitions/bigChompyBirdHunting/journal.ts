import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_CHOMPY_COOKED,
    STAGE_COMPLETE,
    STAGE_GIVEN_ARROWS,
    STAGE_GIVEN_BOW,
    STAGE_KIDS_EXPLAINED_TOADS,
    STAGE_KILLED_CHOMPY,
    STAGE_SHOWN_TOAD,
    STAGE_STARTED,
    STAGE_TOLD_TO_COOK,
    VARP_CHOMPY_BIRD,
} from "./constants";

export function buildBigChompyBirdHuntingJournal(player: PlayerState, _services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_CHOMPY_BIRD);
    if (stage >= STAGE_COMPLETE) return ["<str>I hunted and cooked a seasoned chompy for Rantz.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (stage >= STAGE_CHOMPY_COOKED) return ["Give the <col=800000>seasoned chompy</col> to Rantz."];
    if (stage >= STAGE_TOLD_TO_COOK) return ["Ask <col=800000>Bugs</col> and <col=800000>Fycie</col> which flavours they want,", "then cook the raw chompy on Rantz's spit roast."];
    if (stage >= STAGE_KILLED_CHOMPY) return ["Pluck the dead chompy and show its raw meat to <col=800000>Rantz</col>."];
    if (stage >= STAGE_GIVEN_BOW) return ["Shoot the chompy with the <col=800000>ogre bow</col> and ogre arrows."];
    if (stage >= STAGE_SHOWN_TOAD) return ["Release a <col=800000>bloated toad</col> in the clearing south of Rantz."];
    if (stage >= STAGE_KIDS_EXPLAINED_TOADS) return ["Open the rock-covered chest in the cave for ogre bellows,", "fill them at swamp bubbles, then inflate a swamp toad."];
    if (stage >= STAGE_GIVEN_ARROWS) return ["Ask Rantz how to attract a chompy, then speak to his children."];
    if (stage >= STAGE_STARTED) return ["Make six ogre arrows from achey logs, wolf bones and feathers,", "then give the arrows to <col=800000>Rantz</col>."];
    return ["Speak to <col=800000>Rantz</col> east of Gu'Tanoth in the Feldip Hills."];
}
