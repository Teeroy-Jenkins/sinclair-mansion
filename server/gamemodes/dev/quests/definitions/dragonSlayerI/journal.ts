import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { STAGE_BOUGHT_SHIP, STAGE_COMPLETE, STAGE_CRANDOR, STAGE_GUILDMASTER, STAGE_NED_READY, STAGE_OZIACH, STAGE_REPAIR_3, VARP_DRAGON_SLAYER } from "./constants";

export function buildDragonSlayerIJournal(player: PlayerState, _services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_DRAGON_SLAYER);
    if (stage >= STAGE_COMPLETE) return ["<str>I slew Elvarg and became a true dragon slayer.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (stage >= STAGE_CRANDOR) return ["Enter Crandor's volcano and defeat <col=800000>Elvarg</col>."];
    if (stage >= STAGE_NED_READY) return ["Board the Lady Lumbridge with Captain Ned and sail to Crandor."];
    if (stage >= STAGE_REPAIR_3) return ["Bring the completed Crandor map to <col=800000>Ned</col> in Draynor."];
    if (stage >= STAGE_BOUGHT_SHIP) return ["Repair all three holes in the Lady Lumbridge with planks", "and 30 steel nails per hole. Complete the three map pieces."];
    if (stage >= STAGE_OZIACH) return ["Find the three Crandor map pieces: in Melzar's Maze,", "behind the Oracle's magic door, and from Wormbrain.", "Obtain an anti-dragon shield from Duke Horacio."];
    if (stage >= STAGE_GUILDMASTER) return ["Speak to <col=800000>Oziach</col> near Edgeville."];
    return ["You need 32 Quest Points, then speak to the Champions' Guildmaster."];
}
