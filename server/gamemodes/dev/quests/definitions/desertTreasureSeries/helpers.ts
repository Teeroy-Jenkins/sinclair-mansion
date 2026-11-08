import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, isQuestComplete } from "../../QuestService";
import { type DialogueStep, startConversation } from "../../dialogue";
import type { QuestDefinition, QuestItemRequirement } from "../../types";
import { DT_DIRECT_PREREQUISITES } from "./constants";
import { trackPlayer } from "./state";

export function registerTalk(
    registry: IScriptRegistry,
    npcIds: readonly number[],
    handler: (event: NpcInteractionEvent) => void,
): void {
    const trackedHandler = (event: NpcInteractionEvent) => {
        trackPlayer(event.player);
        handler(event);
    };
    for (const npcId of npcIds) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: trackedHandler });
        registry.registerNpcScript({ npcId, option: undefined, handler: trackedHandler });
    }
}

export function talk(event: NpcInteractionEvent, npcName: string, steps: DialogueStep[]): void {
    startConversation(
        {
            player: event.player,
            services: event.services,
            npcId: event.npc.typeId,
            npcName,
        },
        steps,
    );
}

export function gameMessage(player: PlayerState, services: ScriptServices, text: string): void {
    services.messaging.sendGameMessage(player, text);
}

export function giveItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
    label = "quest item",
): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    services.inventory.snapshotInventory(player);
    if (result.added >= quantity) return true;
    gameMessage(player, services, `You need more inventory space for the ${label}.`);
    return false;
}

export function hasItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    return countCarriedItem(player, services, itemId) >= quantity;
}

export function requirement(
    itemId: number,
    quantity: number,
    journalLabel: string,
): QuestItemRequirement {
    return { itemId, quantity, journalLabel };
}

export function skillLevel(player: PlayerState, services: ScriptServices, skillId: number): number {
    return services.skills.getSkill(player, skillId).baseLevel;
}

export function finishQuest(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): void {
    if (!isQuestComplete(player, quest)) completeQuest(player, services, quest);
}

export function allPrerequisitesComplete(
    player: PlayerState,
    quests: Readonly<Record<string, QuestDefinition>>,
): boolean {
    return DT_DIRECT_PREREQUISITES.every((key) => isQuestComplete(player, quests[key]));
}

export function sendMissingDesertTreasureRequirements(
    player: PlayerState,
    services: ScriptServices,
    quests: Readonly<Record<string, QuestDefinition>>,
): void {
    const missing = DT_DIRECT_PREREQUISITES.filter(
        (key) => !isQuestComplete(player, quests[key]),
    ).map((key) => quests[key].name);
    if (skillLevel(player, services, 6) < 50) missing.push("50 Magic");
    gameMessage(player, services, `You must first meet these requirements: ${missing.join(", ")}.`);
}
