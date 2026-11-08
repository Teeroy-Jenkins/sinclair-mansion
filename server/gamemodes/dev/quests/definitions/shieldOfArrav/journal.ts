import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem, getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    AUX,
    ITEM,
    STAGE_CERTIFICATE,
    STAGE_COMPLETE,
    STAGE_GANG_TASK,
    STAGE_JOINED_GANG,
    STAGE_NOT_STARTED,
    STAGE_READ_BOOK,
    STAGE_STARTED,
} from "./constants";

function hasFlag(player: PlayerState, flag: number): boolean {
    return (player.varps.getVarpValue(145) & flag) !== 0;
}

export function buildShieldOfArravJournal(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return ["I can start this quest by speaking to", "Reldo in Varrock Palace library."];
    }
    if (stage >= STAGE_COMPLETE) {
        return ["<str>I returned the Shield of Arrav to Varrock.", "", "<col=ff0000>QUEST COMPLETE!"];
    }

    const lines = ["Reldo told me about the stolen Shield of Arrav."];
    if (stage === STAGE_STARTED) {
        lines.push("I should search the marked bookcase and read the book.");
        return lines;
    }
    if (stage === STAGE_READ_BOOK && !hasFlag(player, AUX.gangChosen)) {
        lines.push("I can investigate the Phoenix Gang through Baraek,", "or the Black Arm Gang through Charlie the Tramp.");
        return lines;
    }

    const phoenix = hasFlag(player, AUX.phoenixGang);
    lines.push(`I chose to work with the ${phoenix ? "Phoenix" : "Black Arm"} Gang.`);
    if (stage === STAGE_READ_BOOK) {
        lines.push(phoenix ? "I should find Straven at the Phoenix hideout." : "I should speak to Katrine in the Black Arm hideout.");
    } else if (stage === STAGE_GANG_TASK) {
        lines.push(
            phoenix
                ? "I must kill Jonny the Beard and return his intel report."
                : "I must bring Katrine two Phoenix crossbows.",
        );
    } else if (stage === STAGE_JOINED_GANG) {
        const shield = phoenix ? ITEM.phoenixShieldHalf : ITEM.blackArmShieldHalf;
        lines.push(
            countCarriedItem(player, services, shield) > 0
                ? "I have my half of the shield and should take it to the curator."
                : `I should search the ${phoenix ? "Phoenix chest" : "Black Arm cupboard"} for my half of the shield.`,
        );
    } else if (stage >= STAGE_CERTIFICATE) {
        if (countCarriedItem(player, services, ITEM.certificate) > 0) {
            lines.push("I have a completed certificate to show King Roald.");
        } else {
            lines.push("I need to exchange a certificate half with a member", "of the opposite gang, then combine the two halves.");
        }
    }
    return lines;
}
