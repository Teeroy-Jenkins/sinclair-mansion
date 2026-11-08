import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import {
    STAGE_BLUE_REJECTED,
    STAGE_COMPLETE,
    STAGE_ORANGE_REJECTED,
    STAGE_STARTED,
    VARP_GOBLIN_DIPLOMACY,
} from "./constants";

export function buildGoblinDiplomacyJournal(
    player: PlayerState,
    _services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(VARP_GOBLIN_DIPLOMACY);
    if (stage >= STAGE_COMPLETE) {
        return [
            "<str>I helped the Goblin Generals choose brown armour.</str>",
            "<str>The goblins have stopped arguing about colours.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    if (stage >= STAGE_BLUE_REJECTED) {
        return [
            "<str>The generals rejected orange and blue armour.</str>",
            "They now want to try the original <col=800000>brown goblin mail</col>.",
        ];
    }
    if (stage >= STAGE_ORANGE_REJECTED) {
        return [
            "<str>The generals rejected orange armour.</str>",
            "They now want a suit of <col=800000>blue goblin mail</col>.",
        ];
    }
    if (stage >= STAGE_STARTED) {
        return [
            "The Goblin Generals want a suit of",
            "<col=800000>orange goblin mail</col> to test on Grubfoot.",
            "Goblin mail can be found in crates around the village.",
            "<col=800000>Aggie</col> in Draynor Village knows about dyes.",
        ];
    }
    return [
        "I can start this quest by speaking to either",
        "<col=800000>Goblin General</col> in the hut at",
        "<col=800000>Goblin Village</col>.",
        "",
        "There aren't any requirements for this quest.",
    ];
}
