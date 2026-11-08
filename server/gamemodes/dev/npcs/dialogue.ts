/**
 * NPC dialogue helpers — re-exports the shared dialogue runner plus
 * common mid-conversation actions used by Talk-to scripts.
 */
import type { NpcInteractionEvent } from "../../../src/game/scripts/types";
import {
    type DialogueContext,
    type DialogueExec,
    type DialogueOption,
    type DialogueStep,
    type ExecDialogueStep,
    type NpcDialogueStep,
    type OptionsDialogueStep,
    type PlayerDialogueStep,
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
    startConversation,
} from "../quests/dialogue";
import { openShopForNpc } from "./helpers";

export type {
    DialogueContext,
    DialogueExec,
    DialogueOption,
    DialogueStep,
    ExecDialogueStep,
    NpcDialogueStep,
    OptionsDialogueStep,
    PlayerDialogueStep,
};

export { choose, option, run, sayNpc, sayPlayer, startConversation };

export type BankOpenMode = "bank" | "collect";

/** Open the player's bank (or collection box) mid-conversation. */
export function openBank(mode: BankOpenMode = "bank"): ExecDialogueStep {
    return run((ctx) => {
        ctx.services.banking?.openBank?.(ctx.player, { mode });
    });
}

/** Open the shop bound to the NPC that started this conversation. */
export function openShop(): ExecDialogueStep {
    return run((ctx) => {
        ctx.services.shopping?.openShop?.(ctx.player, { npcTypeId: ctx.npcId });
    });
}

/** Open shop using the live interaction event (shop Talk-to builders). */
export function openShopFromEvent(event: NpcInteractionEvent): ExecDialogueStep {
    return run(() => {
        openShopForNpc(event);
    });
}

/** Send a game-message spam line. */
export function gameMessage(text: string): ExecDialogueStep {
    return run((ctx) => {
        ctx.services.messaging.sendGameMessage(ctx.player, text);
    });
}

/** Give items to the player inventory. */
export function giveItems(itemId: number, quantity = 1): ExecDialogueStep {
    return run((ctx) => {
        ctx.player.items.addItem(itemId, quantity);
    });
}

/** Take items if the player has enough; returns whether the take succeeded. */
export function takeItems(itemId: number, quantity: number): ExecDialogueStep {
    return run((ctx) => {
        if (!ctx.player.items.hasItem(itemId, quantity)) return;
        ctx.player.items.removeItem(itemId, quantity, { assureFullRemoval: true });
    });
}

/** Build a standard greeting + option menu conversation. */
export function greetingWithOptions(
    greeting: string | readonly string[],
    options: readonly DialogueOption[],
    title?: string,
): DialogueStep[] {
    return [sayNpc(greeting), choose(options, title)];
}
