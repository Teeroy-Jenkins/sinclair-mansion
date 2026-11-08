import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    MERLINS_CRYSTAL_QUEST_KEY,
    STAGE_BITS,
    STAGE_COMPLETE,
    STAGE_STARTED,
    VARP_MERLINS_CRYSTAL,
} from "./constants";
import { registerMerlinsCrystalInteractions } from "./interactions";
import { buildMerlinsCrystalJournal } from "./journal";

export { MERLINS_CRYSTAL_QUEST_KEY } from "./constants";

export const merlinsCrystalQuest: QuestDefinition = {
    key: MERLINS_CRYSTAL_QUEST_KEY,
    name: "Merlin's Crystal",
    members: true,
    varpId: VARP_MERLINS_CRYSTAL,
    stageBits: STAGE_BITS,
    startedValue: STAGE_STARTED,
    completionValue: STAGE_COMPLETE,
    rewards: {
        questPoints: 6,
        other: ["Excalibur", "Become a Knight of the Round Table"],
    },
    rewardItemId: ITEM.excalibur,
    overviewStartText: "speaking to <col=800000>King Arthur<col=000080> in Camelot Castle.",
    buildJournal(player, services): string[] {
        return buildMerlinsCrystalJournal(player, services, merlinsCrystalQuest);
    },
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerMerlinsCrystalInteractions(merlinsCrystalQuest, registry, services);
    },
};
