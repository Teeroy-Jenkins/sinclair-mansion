import type { IScriptRegistry, NpcInteractionEvent } from "../../../src/game/scripts/types";
import {
    type DialogueOption,
    type DialogueStep,
    choose,
    option,
    openShopFromEvent,
    sayNpc,
} from "./dialogue";
import {
    registerNpcOptions,
    registerTalkTo,
    requestTradeOpen,
    startNpcConversation,
} from "./helpers";

export type ShopTalkDefinition = {
    npcIds: readonly number[];
    greeting: string | readonly string[];
    openShopOptions: readonly string[];
    declineOption: string;
    declineReply?: string | readonly string[];
    extras?: readonly DialogueOption[];
};

function buildShopTalkSteps(
    event: NpcInteractionEvent,
    def: ShopTalkDefinition,
): DialogueStep[] {
    const options: DialogueOption[] = [
        ...def.openShopOptions.map((text) => option(text, [openShopFromEvent(event)])),
        ...(def.extras ?? []),
        option(
            def.declineOption,
            def.declineReply !== undefined ? [sayNpc(def.declineReply)] : [],
        ),
    ];

    return [sayNpc(def.greeting), choose(options)];
}

export function registerShopTalk(registry: IScriptRegistry, def: ShopTalkDefinition): void {
    if (!def.npcIds.length) return;

    const npcIds = [...def.npcIds];

    registerTalkTo(registry, npcIds, (event) => {
        startNpcConversation(event, buildShopTalkSteps(event, def));
    });

    registerNpcOptions(registry, npcIds, ["trade", "trade-with"], (event) => {
        const typeId = event.npc?.typeId;
        if (typeId == null) return;
        requestTradeOpen(event.player, event.services, typeId, event.tick);
    });
}

export function registerShopTalkMany(
    registry: IScriptRegistry,
    defs: readonly ShopTalkDefinition[],
): void {
    for (const def of defs) registerShopTalk(registry, def);
}
