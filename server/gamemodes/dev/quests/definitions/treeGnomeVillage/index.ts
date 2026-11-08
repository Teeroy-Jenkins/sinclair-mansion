import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    STAGE_COMPLETE,
    STAGE_STARTED,
    TREE_GNOME_VILLAGE_QUEST_KEY,
    VARP_TREE_GNOME_VILLAGE,
} from "./constants";
import { registerTreeGnomeVillageInteractions } from "./interactions";
import { buildTreeGnomeVillageJournal } from "./journal";

export const treeGnomeVillageQuest: QuestDefinition = {
    key: TREE_GNOME_VILLAGE_QUEST_KEY,
    name: "Tree Gnome Village",
    members: true,
    varpId: VARP_TREE_GNOME_VILLAGE,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 2,
        xp: [{ skillId: SkillId.Attack, amount: 11_450, label: "Attack" }],
        items: [{ itemId: ITEM.gnomeAmulet, quantity: 1, label: "Gnome amulet" }],
        other: ["Use of the Spirit Tree network"],
    },
    rewardItemId: ITEM.gnomeAmulet,
    overviewStartText: "speaking to <col=800000>King Bolren<col=000080> in the Tree Gnome Village maze.",
    buildJournal(player, services): string[] {
        return buildTreeGnomeVillageJournal(player, services, treeGnomeVillageQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerTreeGnomeVillageInteractions(treeGnomeVillageQuest, registry, services);
    },
};
