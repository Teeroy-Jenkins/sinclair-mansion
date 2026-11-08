import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { STAGE_CHARLIE_CLUE, STAGE_COMPLETE, STAGE_DEMON_DEFEATED, STAGE_FOUND_JOURNAL, STAGE_FOUND_PRISONER, STAGE_GIVEN_TWIGS, STAGE_HAZELMERE, STAGE_INVASION_PLANS, STAGE_LUMBER_ORDER, STAGE_RELAYED_MESSAGE, STAGE_RELEASED, STAGE_SEARCHING_DACONIA, STAGE_SPOKEN_GLOUGH, STAGE_SPOKEN_PRISONER, STAGE_STARTED, STAGE_TRAPDOOR, VARP_GRAND_TREE } from "./constants";

export function buildGrandTreeJournal(player: PlayerState, _services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_GRAND_TREE);
    if (stage >= STAGE_COMPLETE) return ["<str>I exposed Glough and saved the Grand Tree.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (stage >= STAGE_SEARCHING_DACONIA) return ["Search the Grand Tree's roots for the final <col=800000>Daconia rock</col>."];
    if (stage >= STAGE_DEMON_DEFEATED) return ["Tell <col=800000>King Narnode</col> about Glough and the demon."];
    if (stage >= STAGE_TRAPDOOR) return ["Enter Glough's trapdoor and defeat his black demon."];
    if (stage >= STAGE_GIVEN_TWIGS) return ["Place the four twigs on Glough's pillars in the order T-U-Z-O."];
    if (stage >= STAGE_INVASION_PLANS) return ["Take Glough's invasion plans to <col=800000>King Narnode</col>."];
    if (stage >= STAGE_CHARLIE_CLUE) return ["Get Glough's key from Anita and search his cupboard."];
    if (stage >= STAGE_LUMBER_ORDER) return ["Show the lumber order to <col=800000>Charlie</col> in the Grand Tree prison."];
    if (stage >= STAGE_RELEASED) return ["Investigate the Karamja shipyard and speak to its foreman."];
    if (stage >= STAGE_FOUND_JOURNAL) return ["Give Glough's journal to King Narnode."];
    if (stage >= STAGE_SPOKEN_PRISONER || stage >= STAGE_FOUND_PRISONER) return ["Speak to Charlie, then search Glough's chest for evidence."];
    if (stage >= STAGE_SPOKEN_GLOUGH) return ["Return to King Narnode and ask about Glough's suspect."];
    if (stage >= STAGE_RELAYED_MESSAGE) return ["Speak to <col=800000>Glough</col> south-east of the Grand Tree."];
    if (stage >= STAGE_HAZELMERE) return ["Translate Hazelmere's warning for King Narnode."];
    if (stage >= STAGE_STARTED) return ["Take the bark sample to <col=800000>Hazelmere</col> east of Yanille."];
    return ["Speak to <col=800000>King Narnode Shareen</col> with level 25 Agility."];
}
