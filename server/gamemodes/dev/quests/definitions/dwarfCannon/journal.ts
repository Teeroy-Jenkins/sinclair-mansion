import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    CANNON_REPAIR_MASK,
    RAIL_MASK,
    STAGE_CANNON_REPAIRED,
    STAGE_CHECK_WATCHTOWER,
    STAGE_COMPLETE,
    STAGE_FIND_CAVE,
    STAGE_FIND_LOLLK,
    STAGE_INSPECTED_CANNON,
    STAGE_REPAIR_CANNON,
    STAGE_REPAIR_RAILINGS,
    STAGE_RETURN_NOTES,
    STAGE_RETURN_TO_LAWGOF,
    STAGE_SPEAK_TO_NULODION,
    VARP_DWARF_CANNON_MULTI,
} from "./constants";

export function buildDwarfCannonJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = player.varps.getVarpValue(quest.varpId);
    const multi = player.varps.getVarpValue(VARP_DWARF_CANNON_MULTI);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I helped Captain Lawgof defend his outpost.</str>",
            "<str>I can use dwarf multicannons and make cannonballs.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_RETURN_NOTES) {
        return ["I have Nulodion's notes and ammo mould.", "I should return to <col=800000>Captain Lawgof</col>."];
    }
    if (stage >= STAGE_SPEAK_TO_NULODION) {
        return ["I should speak to <col=800000>Nulodion</col> at the", "dwarven mine entrance south of Ice Mountain."];
    }
    if (stage >= STAGE_CANNON_REPAIRED) {
        return ["The multicannon is repaired.", "I should report to <col=800000>Captain Lawgof</col>."];
    }
    if (stage >= STAGE_INSPECTED_CANNON || stage >= STAGE_REPAIR_CANNON) {
        const repaired = multi & CANNON_REPAIR_MASK;
        return [
            `I repaired ${repaired.toString(2).replace(/0/g, "").length} of the 3 damaged cannon mechanisms.`,
            "I should use the <col=800000>toolkit</col> on the broken cannon.",
        ];
    }
    if (stage >= STAGE_RETURN_TO_LAWGOF) {
        return ["I found Lollk alive in the goblin cave.", "I should return to <col=800000>Captain Lawgof</col>."];
    }
    if (stage >= STAGE_FIND_LOLLK) {
        return ["The goblins took Lollk.", "I should search the <col=800000>crates</col> inside their cave."];
    }
    if (stage >= STAGE_FIND_CAVE) {
        return ["The remains belonged to Gilob, but Lollk may live.", "I should find the <col=800000>goblin cave</col> to the south-east."];
    }
    if (stage >= STAGE_CHECK_WATCHTOWER) {
        return ["I should climb the southern watchtower", "and investigate why it has gone quiet."];
    }
    if (stage >= STAGE_REPAIR_RAILINGS) {
        const repaired = ((multi & RAIL_MASK) >>> 5).toString(2).replace(/0/g, "").length;
        return [
            `I repaired ${repaired} of the 6 damaged railings.`,
            "Captain Lawgof gave me replacement rails and a hammer.",
        ];
    }
    return [
        "Speak to <col=800000>Captain Lawgof</col> at the Coal Trucks,",
        "north-west of the Fishing Guild.",
    ];
}

