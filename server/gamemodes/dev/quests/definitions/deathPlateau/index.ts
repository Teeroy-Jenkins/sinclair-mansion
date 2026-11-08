import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { QUEST_KEYS, QUEST_STATE } from "../desertTreasureSeries/constants";
import { ITEM } from "./constants";
import { registerDeathPlateauInteractions } from "./interactions";
import { buildDeathPlateauJournal } from "./journal";

export const deathPlateauQuest: QuestDefinition = {
    key: QUEST_KEYS.deathPlateau,
    name: "Death Plateau",
    members: true,
    varpId: QUEST_STATE[QUEST_KEYS.deathPlateau].varpId,
    startedValue: 10,
    completionValue: QUEST_STATE[QUEST_KEYS.deathPlateau].completionValue,
    rewards: {
        questPoints: 1,
        xp: [{ skillId: SkillId.Attack, amount: 3000, label: "Attack" }],
        items: [{ itemId: ITEM.steelClaws, quantity: 1, label: "Steel claws" }],
        other: ["The ability to make climbing boots and steel claws"],
    },
    rewardItemId: ITEM.steelClaws,
    overviewStartText: "talking to <col=800000>Denulth<col=000080> in Burthorpe.",
    buildJournal: buildDeathPlateauJournal,
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerDeathPlateauInteractions(deathPlateauQuest, registry, services);
    },
};
