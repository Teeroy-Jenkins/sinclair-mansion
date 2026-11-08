import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    BONES_REQUIRED,
    PRYSIN_KEY_ITEM_ID,
    ROVIN_KEY_ITEM_ID,
    STAGE_COLLECTING_BONES,
    STAGE_COMPLETE,
    STAGE_KEY_HUNT,
    STAGE_SILVERLIGHT,
    STAGE_SPOKEN_TO_ARIS,
    STAGE_TRAIBORN_KEY,
    TRAIBORN_KEY_ITEM_ID,
} from "./constants";
import { carriesItem } from "./items";

export function buildDemonSlayerJournal(
    quest: QuestDefinition,
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === 0) {
        return [
            "I can start this quest by speaking to <col=800000>Aris</col> in the",
            "<col=800000>tent in Varrock's main square</col>.",
            "",
            "I must be able to defeat an apocalyptic demon!",
        ];
    }

    const history = [
        "<str>I spoke to Aris in Varrock Square, who saw my future.</str>",
        "<str>It involved killing Delrith, who almost destroyed Varrock.</str>",
    ];
    if (stage === STAGE_SPOKEN_TO_ARIS) {
        return [
            ...history,
            "",
            "To defeat <col=800000>Delrith</col> I need the magical sword",
            "<col=800000>Silverlight</col>. I should speak to <col=800000>Sir Prysin</col> in Varrock Palace.",
        ];
    }
    if (stage >= STAGE_KEY_HUNT && stage < STAGE_SILVERLIGHT) {
        const lines = [
            ...history,
            "",
            "Sir Prysin needs three keys before he can give me Silverlight.",
            carriesItem(player, services, PRYSIN_KEY_ITEM_ID)
                ? "<str>I have recovered Sir Prysin's key.</str>"
                : "His key was dropped down the palace kitchen drain.",
            carriesItem(player, services, ROVIN_KEY_ITEM_ID)
                ? "<str>I have Captain Rovin's key.</str>"
                : "Captain Rovin has another key in Varrock Palace.",
        ];
        if (carriesItem(player, services, TRAIBORN_KEY_ITEM_ID)) {
            lines.push("<str>I have Wizard Traiborn's key.</str>");
        } else if (stage >= STAGE_COLLECTING_BONES && stage <= STAGE_TRAIBORN_KEY) {
            const given = stage - STAGE_COLLECTING_BONES;
            lines.push(
                `Wizard Traiborn still needs ${Math.max(0, BONES_REQUIRED - given)} sets of bones.`,
            );
        } else {
            lines.push("Wizard Traiborn has the third key at the Wizards' Tower.");
        }
        if (
            carriesItem(player, services, PRYSIN_KEY_ITEM_ID) &&
            carriesItem(player, services, ROVIN_KEY_ITEM_ID) &&
            carriesItem(player, services, TRAIBORN_KEY_ITEM_ID)
        ) {
            lines.push("", "I should take all three keys back to Sir Prysin.");
        }
        return lines;
    }
    if (stage === STAGE_SILVERLIGHT) {
        return [
            ...history,
            "<str>I reclaimed Silverlight from Sir Prysin.</str>",
            "",
            "I should go to the stone circle south of Varrock and destroy",
            "<col=800000>Delrith</col> while wielding <col=800000>Silverlight</col>.",
        ];
    }
    if (stage >= STAGE_COMPLETE) {
        return [
            ...history,
            "<str>I reclaimed Silverlight from Sir Prysin.</str>",
            "<str>I used it and Aris's incantation to banish Delrith.</str>",
            "",
            "<col=ff0000>QUEST COMPLETE!</col>",
        ];
    }
    return history;
}
