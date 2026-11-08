import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    AUX,
    ITEM,
    STAGE_COMPLETE,
    STAGE_EXCALIBUR_BOUND,
    STAGE_MERLIN_FREED,
    STAGE_NOT_STARTED,
    STAGE_SPOKEN_GAWAIN,
    STAGE_SPOKEN_LANCELOT,
    STAGE_SPOKEN_MORGAN,
    STAGE_STARTED,
    VARP_MERLINS_CRYSTAL,
} from "./constants";

export function buildMerlinsCrystalJournal(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by speaking to <col=800000>King Arthur</col>",
            "in Camelot Castle.",
        ];
    }
    const lines = ["<str>King Arthur asked me to free Merlin from a giant crystal.</str>", ""];
    if (stage === STAGE_STARTED) {
        lines.push("The <col=800000>Knights of the Round Table</col> may know who trapped Merlin.");
    } else if (stage === STAGE_SPOKEN_GAWAIN) {
        lines.push("Morgan Le Faye is responsible. <col=800000>Sir Lancelot</col> may know how to enter her keep.");
    } else if (stage === STAGE_SPOKEN_LANCELOT) {
        lines.push("I can hide in <col=800000>Arhein's crate</col> in Catherby to reach Keep Le Faye.");
    } else if (stage === STAGE_SPOKEN_MORGAN) {
        const raw = player.varps.getVarpValue(VARP_MERLINS_CRYSTAL);
        if ((raw & AUX.chaosWordsKnown) === 0) {
            lines.push("I must check a <col=800000>chaos altar</col> for the binding words.");
        }
        if (!services.inventory.findOwnedItemLocation(player, ITEM.excalibur)) {
            lines.push("I need <col=800000>Excalibur</col> from the Lady of the Lake.");
        }
        if (!services.inventory.findOwnedItemLocation(player, ITEM.litBlackCandle)) {
            lines.push("I need a <col=800000>lit black candle</col> from the candle maker in Catherby.");
        }
        lines.push("I must drop <col=800000>bat bones</col> on the magic symbol north-east of Camelot.");
    } else if (stage === STAGE_EXCALIBUR_BOUND) {
        lines.push("Thrantax bound the spell to Excalibur. I can now smash <col=800000>Merlin's crystal</col>.");
    } else if (stage === STAGE_MERLIN_FREED) {
        lines.push("<str>I freed Merlin.</str>", "I should report back to <col=800000>King Arthur</col>.");
    } else if (stage >= STAGE_COMPLETE) {
        lines.push("<str>King Arthur made me a Knight of the Round Table.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>");
    }
    return lines;
}
