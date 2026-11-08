import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    STAGE_COMPLETE,
    STAGE_NOT_STARTED,
    STAGE_SPIRIT_DEFEATED,
    STAGE_SPOKEN_SHAMUS,
    STAGE_STAFF_MADE,
    STAGE_STARTED,
    STAGE_TREE_CHOPPED,
} from "./constants";

export function buildLostCityJournal(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        const crafting = services.skills.getSkill(player, 12).baseLevel;
        const woodcutting = services.skills.getSkill(player, 8).baseLevel;
        return [
            "I can start this quest by speaking to the <col=800000>adventurers</col>",
            "in Lumbridge Swamp.",
            "",
            `${crafting >= 31 ? "<str>" : ""}Level 31 Crafting${crafting >= 31 ? "</str>" : ""}`,
            `${woodcutting >= 36 ? "<str>" : ""}Level 36 Woodcutting${woodcutting >= 36 ? "</str>" : ""}`,
            "I must defeat a level 101 spirit without bringing weapons to Entrana.",
        ];
    }
    const lines = ["<str>An adventurer revealed that a leprechaun knows the way to Zanaris.</str>", ""];
    if (stage === STAGE_STARTED) {
        lines.push("I should chop the unusual <col=800000>trees</col> near the adventurers to find him.");
    } else if (stage === STAGE_SPOKEN_SHAMUS) {
        lines.push("Shamus told me to obtain a branch from the <col=800000>Dramen tree</col> beneath Entrana.");
    } else if (stage === STAGE_SPIRIT_DEFEATED) {
        lines.push("<str>I defeated the Tree spirit.</str>", "I can now cut a <col=800000>Dramen branch</col>.");
    } else if (stage === STAGE_TREE_CHOPPED) {
        lines.push("I should carve the branch into a staff with a <col=800000>knife</col>.");
    } else if (stage === STAGE_STAFF_MADE) {
        lines.push("I should wield the Dramen staff and enter the <col=800000>shed in Lumbridge Swamp</col>.");
    } else if (stage >= STAGE_COMPLETE) {
        lines.push("<str>I entered Zanaris through the shed.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>");
    }
    return lines;
}
