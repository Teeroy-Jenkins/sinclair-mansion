import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { countCarriedItem } from "../../QuestService";
import {
    completedJournal,
    journalRequirement,
    journalSkillLevel,
} from "../desertTreasureSeries/journalHelpers";
import {
    DT_DIRECT_PREREQUISITES,
    type DesertTreasureQuestKey,
    EBLIS_SUPPLIES,
    ITEM,
    QUEST_KEYS,
    QUEST_STATE,
} from "./constants";

const PREREQUISITE_NAMES: Record<DesertTreasureQuestKey, string> = {
    [QUEST_KEYS.deathPlateau]: "Death Plateau",
    [QUEST_KEYS.digSite]: "The Dig Site",
    [QUEST_KEYS.templeOfIkov]: "Temple of Ikov",
    [QUEST_KEYS.touristTrap]: "The Tourist Trap",
    [QUEST_KEYS.trollStronghold]: "Troll Stronghold",
    [QUEST_KEYS.priestInPeril]: "Priest in Peril",
    [QUEST_KEYS.waterfall]: "Waterfall Quest",
    [QUEST_KEYS.desertTreasure]: "Desert Treasure I",
};

export function buildDesertTreasureIJournal(
    player: PlayerState,
    services: ScriptServices,
): string[] {
    const stage = player.varps.getVarpValue(QUEST_STATE[QUEST_KEYS.desertTreasure].varpId);
    if (stage >= 15) {
        return completedJournal([
            "I freed Azzanadra from the desert pyramid.",
            "I can now use the Ancient Magicks spellbook.",
        ]);
    }
    if (stage >= 13)
        return [
            "I placed the four diamonds in their obelisks.",
            "I must reach <col=800000>Azzanadra</col> at the heart of the pyramid.",
        ];
    if (stage >= 11) {
        return [
            "I must recover the four Diamonds of Azzanadra:",
            journalRequirement(
                "Blood diamond",
                countCarriedItem(player, services, ITEM.bloodDiamond) > 0,
            ),
            journalRequirement(
                "Ice diamond",
                countCarriedItem(player, services, ITEM.iceDiamond) > 0,
            ),
            journalRequirement(
                "Smoke diamond",
                countCarriedItem(player, services, ITEM.smokeDiamond) > 0,
            ),
            journalRequirement(
                "Shadow diamond",
                countCarriedItem(player, services, ITEM.shadowDiamond) > 0,
            ),
        ];
    }
    if (stage >= 9) {
        return [
            "Eblis needs materials to make scrying mirrors:",
            ...EBLIS_SUPPLIES.map((req) =>
                journalRequirement(
                    req.journalLabel,
                    countCarriedItem(player, services, req.itemId) >= req.quantity,
                ),
            ),
        ];
    }
    if (stage >= 8)
        return [
            "I found Eblis in the Bandit Camp.",
            "I should ask him how to locate Azzanadra's diamonds.",
        ];
    if (stage >= 6)
        return [
            "The translation points to the Bandit Camp.",
            "I should buy a <col=800000>Bandit's brew</col> and question the bartender.",
        ];
    if (stage >= 4)
        return [
            "Terry Balando translated the desert etchings.",
            "I should show the translation to the <col=800000>Asgarnia Smith</col>.",
        ];
    if (stage >= 1)
        return [
            "The Asgarnia Smith found ancient etchings in the desert.",
            "I should take them to <col=800000>Terry Balando</col> at the Dig Site.",
        ];

    return [
        "Speak to the <col=800000>Asgarnia Smith</col> at the Bedabin Camp.",
        journalRequirement("50 Magic", journalSkillLevel(player, services, 6) >= 50),
        ...DT_DIRECT_PREREQUISITES.map((key) =>
            journalRequirement(
                PREREQUISITE_NAMES[key],
                player.varps.getVarpValue(QUEST_STATE[key].varpId) >=
                    QUEST_STATE[key].completionValue,
            ),
        ),
    ];
}
