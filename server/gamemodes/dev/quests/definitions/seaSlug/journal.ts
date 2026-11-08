import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    STAGE_BOAT_REPAIRED,
    STAGE_COMPLETE,
    STAGE_KENNITH_NEEDS_ESCAPE,
    STAGE_LIT_TORCH,
    STAGE_NEEDS_CRANE,
    STAGE_NEEDS_SWAMP_PASTE,
    STAGE_NOT_STARTED,
    STAGE_PANEL_OPENED,
    STAGE_SAVED_KENNITH,
    STAGE_SAILED_TO_KENT,
    STAGE_SPOKEN_TO_KENNITH,
    STAGE_SPOKEN_TO_KENT,
    STAGE_STARTED,
} from "./constants";

export function buildSeaSlugJournal(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return [
            "I can start this quest by speaking to <col=800000>Caroline</col>",
            "on the coast <col=800000>east of Ardougne</col>.",
            "",
            "I need level 30 <col=800000>Firemaking</col>.",
        ];
    }
    const history = ["<str>I agreed to find Caroline's husband Kent and son Kennith.</str>", ""];
    if (stage === STAGE_STARTED) {
        return [...history, "I should speak to <col=800000>Holgart</col> about reaching the Fishing Platform."];
    }
    if (stage === STAGE_NEEDS_SWAMP_PASTE) {
        return [
            ...history,
            services.inventory.playerHasItem(player, 1941)
                ? "I should give my <col=800000>swamp paste</col> to Holgart."
                : "Holgart needs <col=800000>swamp paste</col> to repair his boat.",
        ];
    }
    if (stage === STAGE_BOAT_REPAIRED) {
        return [...history, "Holgart's boat is repaired. I should sail to the <col=800000>Fishing Platform</col>."];
    }
    if (stage === STAGE_SPOKEN_TO_KENNITH || stage === STAGE_SAILED_TO_KENT) {
        return [...history, "I found Kennith hiding on the platform. I need to find <col=800000>Kent</col>."];
    }
    if (stage === STAGE_SPOKEN_TO_KENT) {
        return [...history, "Sea slugs fear heat. I need Bailey's torch and a way to <col=800000>light it</col>."];
    }
    if (stage === STAGE_LIT_TORCH) {
        return [...history, "My torch keeps the fishermen away. I should return to <col=800000>Kennith</col>."];
    }
    if (stage === STAGE_KENNITH_NEEDS_ESCAPE) {
        return [...history, "Kennith needs another escape route. The nearby wall panel looks weak."];
    }
    if (stage === STAGE_PANEL_OPENED) {
        return [...history, "I opened the wall. I should tell <col=800000>Kennith</col>."];
    }
    if (stage === STAGE_NEEDS_CRANE) {
        return [...history, "I need to use the <col=800000>crane</col> to lower Kennith into Holgart's boat."];
    }
    if (stage === STAGE_SAVED_KENNITH) {
        return [...history, "Kennith is safe. I should return to <col=800000>Caroline</col>."];
    }
    if (stage >= STAGE_COMPLETE) {
        return [
            ...history,
            "<str>I rescued Kennith and helped reunite Caroline's family.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    return history;
}
