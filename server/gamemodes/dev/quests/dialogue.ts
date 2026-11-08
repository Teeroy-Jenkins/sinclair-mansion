import type { PlayerState } from "../../../src/game/player";
import type { ScriptServices } from "../../../src/game/scripts/types";

// ============================================================================
// Declarative dialogue runner
//
// Plays a linear sequence of chatbox dialogue steps (NPC chat, player chat,
// option menus, server actions) without hand-rolled callback nesting. Option
// branches splice their steps in front of the remaining sequence, so all
// branches converge on whatever follows the options step.
// ============================================================================

export interface DialogueContext {
    player: PlayerState;
    services: ScriptServices;
    npcId: number;
    npcName: string;
}

export type DialogueExec = (ctx: DialogueContext) => void;

export interface DialogueOption {
    text: string;
    /** Echo the chosen text as a player chat line before continuing (default true) */
    echo?: boolean;
    next?: DialogueStep[];
}

export type NpcDialogueStep = {
    npc: string[];
    animationId?: number;
    npcId?: number;
    npcName?: string;
};
export type PlayerDialogueStep = { player: string[]; animationId?: number };
export type OptionsDialogueStep = { options: DialogueOption[]; title?: string };
export type ExecDialogueStep = { exec: DialogueExec };
export type ItemDialogueStep = {
    item: { itemId: number; quantity?: number; title?: string; lines: string[] };
};
export type DoubleItemDialogueStep = {
    items: {
        leftItemId: number;
        rightItemId: number;
        leftQuantity?: number;
        rightQuantity?: number;
        title?: string;
        lines: string[];
    };
};

export type DialogueStep =
    | NpcDialogueStep
    | PlayerDialogueStep
    | OptionsDialogueStep
    | ExecDialogueStep
    | ItemDialogueStep
    | DoubleItemDialogueStep;

function asLines(lines: string | readonly string[]): string[] {
    return typeof lines === "string" ? [lines] : [...lines];
}

/** NPC chatbox line(s). */
export function sayNpc(
    lines: string | readonly string[],
    animationId?: number,
): NpcDialogueStep {
    return animationId === undefined
        ? { npc: asLines(lines) }
        : { npc: asLines(lines), animationId };
}

/** Player chatbox line(s). */
export function sayPlayer(
    lines: string | readonly string[],
    animationId?: number,
): PlayerDialogueStep {
    return animationId === undefined
        ? { player: asLines(lines) }
        : { player: asLines(lines), animationId };
}

/** Run a typed side-effect mid-conversation (open shop/bank, grant items, …). */
export function run(exec: DialogueExec): ExecDialogueStep {
    return { exec };
}

/** A single option-menu entry. */
export function option(
    text: string,
    next: DialogueStep[] = [],
    opts?: { echo?: boolean },
): DialogueOption {
    const entry: DialogueOption = { text, next };
    if (opts?.echo !== undefined) entry.echo = opts.echo;
    return entry;
}

/** Option menu step. */
export function choose(
    options: readonly DialogueOption[],
    title?: string,
): OptionsDialogueStep {
    return title === undefined ? { options: [...options] } : { options: [...options], title };
}

export function showItem(
    itemId: number,
    lines: string | readonly string[],
    options?: { quantity?: number; title?: string },
): ItemDialogueStep {
    return { item: { itemId, lines: asLines(lines), ...options } };
}

export function showTwoItems(
    leftItemId: number,
    rightItemId: number,
    lines: string | readonly string[],
    options?: { leftQuantity?: number; rightQuantity?: number; title?: string },
): DoubleItemDialogueStep {
    return {
        items: { leftItemId, rightItemId, lines: asLines(lines), ...options },
    };
}

const activeConversations = new Set<number>();
let dialogSequence = 0;

export function startConversation(ctx: DialogueContext, steps: DialogueStep[]): void {
    const pid = ctx.player.id;
    if (activeConversations.has(pid)) {
        // Self-heal a stale guard if another system closed our dialog without
        // firing onClose (e.g. a different script replaced the chatbox modal).
        const modalOpen =
            ctx.services.dialog.getInterfaceService()?.getCurrentChatboxModal(ctx.player) !==
            undefined;
        if (modalOpen) return;
        activeConversations.delete(pid);
    }
    activeConversations.add(pid);
    playSteps(ctx, steps);
}

function endConversation(ctx: DialogueContext, closeDialogId?: string): void {
    if (closeDialogId !== undefined) {
        ctx.services.dialog.closeDialog(ctx.player, closeDialogId);
    }
    activeConversations.delete(ctx.player.id);
}

function playSteps(ctx: DialogueContext, steps: DialogueStep[]): void {
    const step = steps[0];
    if (!step) {
        endConversation(ctx);
        return;
    }
    const rest = steps.slice(1);

    if ("exec" in step) {
        step.exec(ctx);
        if (rest.length === 0) {
            endConversation(ctx);
        } else {
            playSteps(ctx, rest);
        }
        return;
    }

    const dialogId = `quest_dialogue_${ctx.player.id}_${dialogSequence++}`;
    const onClose = () => endConversation(ctx);

    if ("options" in step) {
        ctx.services.dialog.openDialogOptions(ctx.player, {
            id: dialogId,
            title: step.title ?? "Select an Option",
            options: step.options.map((entry) => entry.text),
            onClose,
            onSelect: (choice) => {
                const selected = step.options[choice];
                if (!selected) {
                    endConversation(ctx);
                    return;
                }
                const echoed: DialogueStep[] =
                    selected.echo === false ? [] : [sayPlayer(selected.text)];
                playSteps(ctx, [...echoed, ...(selected.next ?? []), ...rest]);
            },
        });
        return;
    }

    const isLast = rest.length === 0;
    const onContinue = isLast ? () => endConversation(ctx, dialogId) : () => playSteps(ctx, rest);

    if ("npc" in step) {
        ctx.services.dialog.openDialog(ctx.player, {
            kind: "npc",
            id: dialogId,
            npcId: step.npcId ?? ctx.npcId,
            npcName: step.npcName ?? ctx.npcName,
            lines: step.npc,
            animationId: step.animationId,
            clickToContinue: true,
            closeOnContinue: isLast,
            onContinue,
            onClose,
        });
        return;
    }

    if ("item" in step) {
        ctx.services.dialog.openDialog(ctx.player, {
            kind: "sprite",
            id: dialogId,
            itemId: step.item.itemId,
            itemQuantity: step.item.quantity,
            title: step.item.title,
            lines: step.item.lines,
            clickToContinue: true,
            closeOnContinue: isLast,
            onContinue,
            onClose,
        });
        return;
    }

    if ("items" in step) {
        ctx.services.dialog.openDialog(ctx.player, {
            kind: "double_sprite",
            id: dialogId,
            leftItemId: step.items.leftItemId,
            rightItemId: step.items.rightItemId,
            leftItemQuantity: step.items.leftQuantity,
            rightItemQuantity: step.items.rightQuantity,
            title: step.items.title,
            lines: step.items.lines,
            clickToContinue: true,
            closeOnContinue: isLast,
            onContinue,
            onClose,
        });
        return;
    }

    ctx.services.dialog.openDialog(ctx.player, {
        kind: "player",
        id: dialogId,
        playerName: ctx.player.name ?? "You",
        lines: step.player,
        animationId: step.animationId,
        clickToContinue: true,
        closeOnContinue: isLast,
        onContinue,
        onClose,
    });
}
