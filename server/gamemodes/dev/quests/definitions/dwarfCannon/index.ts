import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    DWARF_CANNON_QUEST_KEY,
    ITEM,
    STAGE_COMPLETE,
    STAGE_REPAIR_RAILINGS,
    VARP_DWARF_CANNON,
} from "./constants";
import { registerDwarfCannonInteractions } from "./interactions";
import { buildDwarfCannonJournal } from "./journal";

export { DWARF_CANNON_QUEST_KEY } from "./constants";

export const dwarfCannonQuest: QuestDefinition = {
    key: DWARF_CANNON_QUEST_KEY,
    name: "Dwarf Cannon",
    members: true,
    varpId: VARP_DWARF_CANNON,
    startedValue: STAGE_REPAIR_RAILINGS,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Crafting, amount: 750, label: "Crafting" }],
        other: ["Ability to use dwarf multicannons", "Ability to make cannonballs", "Black Guard membership"],
    },
    rewardItemId: ITEM.ammoMould,
    overviewStartText: "speaking to <col=800000>Captain Lawgof<col=000080> near the Coal Trucks.",
    buildJournal(player, services): string[] {
        return buildDwarfCannonJournal(player, services, dwarfCannonQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerDwarfCannonInteractions(dwarfCannonQuest, registry, services);
    },
};

