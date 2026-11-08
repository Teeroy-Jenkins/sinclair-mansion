import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import { BIT, ITEM, VARP_ELEMENTAL_WORKSHOP } from "./constants";

function has(player: PlayerState, bit: number): boolean {
    return (player.varps.getVarpValue(VARP_ELEMENTAL_WORKSHOP) & bit) !== 0;
}

export function buildElementalWorkshopIJournal(
    player: PlayerState,
    services: ScriptServices,
    _quest: QuestDefinition,
): string[] {
    if (has(player, BIT.complete)) {
        return ["<str>I restored the workshop and made an elemental shield.", "", "<col=ff0000>QUEST COMPLETE!"];
    }
    if (!has(player, BIT.readBook)) {
        return [
            "I can start this quest by reading a battered book",
            "found in a house in Seers' Village.",
            "",
            "Minimum requirements: 20 Mining, Smithing and Crafting.",
        ];
    }
    const lines = ["I found a battered book describing elemental metal."];
    if (!has(player, BIT.slashedBook)) {
        lines.push("There may be something hidden inside its binding.");
        return lines;
    }
    lines.push("I cut open the book and found a battered key.");
    if (!has(player, BIT.enteredWorkshop)) {
        lines.push("I should use it on the odd wall in the Seers' Village smithy.");
        return lines;
    }
    lines.push("I discovered the Elemental Workshop beneath the village.");
    if (!has(player, BIT.waterFlowing)) lines.push("The eastern then western water controls should power the wheel.");
    if (!has(player, BIT.bellowsRepaired)) lines.push("The bellows need leather, thread and a needle.");
    if (!has(player, BIT.furnaceLit)) lines.push("A stone bowl of lava will light the furnace.");
    if (countCarriedItem(player, services, ITEM.elementalMetal) > 0) {
        lines.push("I should use the elemental metal on a workbench with a hammer.");
    } else if (has(player, BIT.airBlowing)) {
        lines.push("The furnace is ready for elemental ore and four coal.");
    } else {
        lines.push("Once the wheel and bellows work, I can heat the furnace properly.");
    }
    return lines;
}
