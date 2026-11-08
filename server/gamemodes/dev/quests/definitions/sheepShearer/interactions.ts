import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import { getQuestStage } from "../../QuestService";
import { FRED_THE_FARMER_NPC_ID, STAGE_COMPLETE, STAGE_STARTED, STRANGE_SHEEP_NPC_ID } from "./constants";
import { createSheepShearerTalkHandler, markSheepShearerThingSeen } from "./dialogue";

export function registerSheepShearerInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const handleFredTalk = createSheepShearerTalkHandler(quest);
    registry.registerNpcScript({
        npcId: FRED_THE_FARMER_NPC_ID,
        option: "talk-to",
        handler: handleFredTalk,
    });
    registry.registerNpcScript({
        npcId: FRED_THE_FARMER_NPC_ID,
        option: undefined,
        handler: handleFredTalk,
    });

    const shearThing = registry.findNpcInteractionDirect(STRANGE_SHEEP_NPC_ID, "shear");
    if (shearThing) {
        registry.registerNpcScript({
            npcId: STRANGE_SHEEP_NPC_ID,
            option: "shear",
            handler: (event) => {
                const hadShears = event.services.inventory.playerHasItem(event.player, 1735);
                const result = shearThing(event);
                const stage = getQuestStage(event.player, quest);
                if (hadShears && stage >= STAGE_STARTED && stage < STAGE_COMPLETE) {
                    markSheepShearerThingSeen(event.player);
                }
                return result;
            },
        });
    }
}
