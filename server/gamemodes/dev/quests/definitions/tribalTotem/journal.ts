import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    STAGE_COMPLETE,
    STAGE_CRATE_DELIVERED,
    STAGE_CRATE_MARKED,
    STAGE_NOT_STARTED,
    STAGE_STARTED,
    STAGE_TELEPORTED,
    TRAP_COMBINATION_SOLVED_BIT,
    VARP_HANDELMORT_TRAPS,
} from "./constants";

export function buildTribalTotemJournal(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by speaking to <col=800000>Kangai Mau</col>",
            "in the Shrimp & Parrot restaurant in Brimhaven.",
            "",
            "I need level 21 <col=800000>Thieving</col>.",
        ];
    }
    const lines = ["<str>I agreed to recover the Rantuki tribe's totem from Lord Handelmort.</str>", ""];
    if (stage === STAGE_STARTED) {
        lines.push("I need a way into <col=800000>Handelmort Mansion</col> in Ardougne.");
    } else if (stage === STAGE_CRATE_MARKED) {
        lines.push("I relabelled Cromperty's teleport block. The <col=800000>GPDT employees</col> should deliver it.");
    } else if (stage === STAGE_CRATE_DELIVERED) {
        lines.push("The block was delivered. <col=800000>Wizard Cromperty</col> can teleport me inside.");
    } else if (stage === STAGE_TELEPORTED) {
        const unlocked = (player.varps.getVarpValue(VARP_HANDELMORT_TRAPS) & TRAP_COMBINATION_SOLVED_BIT) !== 0;
        if (!unlocked) lines.push("I must solve the mansion security door's four-letter combination.");
        else if (services.inventory.findOwnedItemLocation(player, ITEM.tribalTotem)) {
            lines.push("I have the totem and should return it to <col=800000>Kangai Mau</col>.");
        } else {
            lines.push("I bypassed the security door and must retrieve the <col=800000>tribal totem</col>.");
        }
    } else if (stage >= STAGE_COMPLETE) {
        lines.push("<str>I returned the tribal totem to Kangai Mau.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>");
    }
    return lines;
}
