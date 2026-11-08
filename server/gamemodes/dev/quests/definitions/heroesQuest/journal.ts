import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { ITEM, STAGE_COMPLETE, STAGE_PHOENIX_ARMBAND, STAGE_STARTED, VARP_HEROES_QUEST } from "./constants";

export function buildHeroesQuestJournal(player: PlayerState, services: ScriptServices): string[] {
    const stage = player.varps.getVarpValue(VARP_HEROES_QUEST);
    if (stage >= STAGE_COMPLETE) return ["<str>I proved myself worthy of the Heroes' Guild.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>"];
    if (stage === 0) return ["Speak to <col=800000>Achietties</col> outside the Heroes' Guild in Burthorpe."];
    const owns = (itemId: number) => services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
    return [
        "Achietties requires three proofs:",
        `${owns(ITEM.fireFeather) ? "<str>" : ""}An Entranan firebird feather${owns(ITEM.fireFeather) ? "</str>" : ""}`,
        `${owns(ITEM.cookedLavaEel) ? "<str>" : ""}A cooked lava eel${owns(ITEM.cookedLavaEel) ? "</str>" : ""}`,
        `${stage === STAGE_PHOENIX_ARMBAND || stage >= 13 || owns(ITEM.thievesArmband) ? "<str>" : ""}A master thief's armband${stage === STAGE_PHOENIX_ARMBAND || stage >= 13 || owns(ITEM.thievesArmband) ? "</str>" : ""}`,
        stage >= STAGE_STARTED ? "Work with your Shield of Arrav gang contacts in Brimhaven." : "",
    ];
}
