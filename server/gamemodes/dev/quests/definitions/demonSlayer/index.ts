import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    DEMON_SLAYER_KEY,
    DEMON_SLAYER_STAGE_BITS,
    SILVERLIGHT_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_SPOKEN_TO_ARIS,
    VARP_DEMON_SLAYER,
} from "./constants";
import { registerDemonSlayerInteractions } from "./interactions";
import { buildDemonSlayerJournal } from "./journal";

export { DEMON_SLAYER_KEY } from "./constants";

export const demonSlayerQuest: QuestDefinition = {
    key: DEMON_SLAYER_KEY,
    name: "Demon Slayer",
    varpId: VARP_DEMON_SLAYER,
    stageBits: DEMON_SLAYER_STAGE_BITS,
    startedValue: STAGE_SPOKEN_TO_ARIS,
    completionValue: STAGE_COMPLETE,
    rewards: { questPoints: 3 },
    rewardItemId: SILVERLIGHT_ITEM_ID,
    overviewStartText:
        "speaking to <col=800000>Aris<col=000080> in her tent in <col=800000>Varrock Square<col=000080>.",
    buildJournal: (player, services) => buildDemonSlayerJournal(demonSlayerQuest, player, services),
    register(registry: IScriptRegistry, services: ScriptServices): void {
        registerDemonSlayerInteractions(demonSlayerQuest, registry, services);
    },
};
