import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import {
    ANY_LOC_ID,
    type IScriptRegistry,
    type ScriptActionHandlerContext,
    type ScriptServices,
} from "../../../../src/game/scripts/types";
import {
    buildMessageEffect,
    buildSkillFailure,
    getInventory,
    hasItem,
} from "../production/shared";
import { HAMMER_ITEM_ID, SMITHING_RECIPES, getSmithingRecipeById } from "./smithingData";

interface SkillSmithActionData {
    recipeId: string;
    count: number;
}

function buildSmithingInterfaceFailure(
    player: PlayerState,
    message: string,
    reason: string,
    services: ScriptServices,
): ActionExecutionResult {
    const result = buildSkillFailure(player, message, reason);
    services.production?.updateSmithingInterface(player);
    return result;
}

export function executeSmithAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as SkillSmithActionData;
    const recipe = getSmithingRecipeById(data.recipeId);
    if (!recipe) {
        return buildSmithingInterfaceFailure(
            player,
            "You can't smith that.",
            "unknown_recipe",
            services,
        );
    }

    const skill = services.skills.getSkill(player, SkillId.Smithing);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return buildSmithingInterfaceFailure(
            player,
            `You need Smithing level ${recipe.level} to smith that.`,
            "smith_level",
            services,
        );
    }

    if (
        recipe.requireHammer !== false &&
        !services.inventory.playerHasItem(player, HAMMER_ITEM_ID)
    ) {
        return buildSmithingInterfaceFailure(
            player,
            "You need a hammer to smith items.",
            "hammer",
            services,
        );
    }

    const targetCount = Math.max(1, data.count);
    const removed = new Map<number, number>();
    const requiredBars = Math.max(1, recipe.barCount);

    for (let i = 0; i < requiredBars; i++) {
        const slot = services.inventory.findInventorySlotWithItem(player, recipe.barItemId);
        if (slot === undefined || !services.inventory.consumeItem(player, slot)) {
            services.production?.restoreInventoryItems(player, recipe.barItemId, removed);
            return buildSmithingInterfaceFailure(
                player,
                "You need more bars.",
                "missing_bars",
                services,
            );
        }
        removed.set(slot, (removed.get(slot) ?? 0) + 1);
    }

    const firstSlot = removed.keys().next()?.value;
    if (firstSlot !== undefined) {
        services.inventory.setInventorySlot(
            player,
            firstSlot,
            recipe.outputItemId,
            Math.max(1, recipe.outputQuantity),
        );
    } else {
        const dest = services.inventory.addItemToInventory(
            player,
            recipe.outputItemId,
            Math.max(1, recipe.outputQuantity),
        );
        if (dest.added <= 0) {
            services.production?.restoreInventoryItems(player, recipe.barItemId, removed);
            return buildSmithingInterfaceFailure(
                player,
                "You need more inventory space to smith that.",
                "inventory_full",
                services,
            );
        }
    }

    services.animation.playPlayerSeq(player, recipe.animation ?? 898);
    services.skills.addSkillXp(player, SkillId.Smithing, recipe.xp);
    services.system.eventBus?.emit("item:craft", {
        playerId: player.id,
        itemId: recipe.outputItemId,
        count: Math.max(1, recipe.outputQuantity),
    });

    const effects: ActionEffect[] = [
        { type: "inventorySnapshot", playerId: player.id },
        buildMessageEffect(
            player,
            `You smith ${
                recipe.outputQuantity > 1
                    ? `${recipe.outputQuantity} ${recipe.name}`
                    : `a ${recipe.name}`
            }.`,
        ),
    ];

    const remaining = Math.max(0, targetCount - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.smith",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks ?? 4,
                cooldownTicks: recipe.delayTicks ?? 4,
                groups: ["skill.smith"],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop smithing because you're already busy."),
            );
        }
    }

    services.production?.updateSmithingInterface(player);
    return {
        ok: true,
        cooldownTicks: recipe.delayTicks !== undefined ? Math.max(1, recipe.delayTicks) : 4,
        groups: ["skill.smith"],
        effects,
    };
}

export function registerSmithingInteractions(registry: IScriptRegistry, services: ScriptServices) {
    const openForge = (player: PlayerState, barItemId?: number) => {
        const inventory = getInventory(services, player);
        if (!hasItem(inventory, HAMMER_ITEM_ID)) {
            services.messaging.sendGameMessage(player, "You need a hammer to smith.");
            return;
        }
        const hasBars =
            barItemId !== undefined
                ? hasItem(inventory, barItemId)
                : SMITHING_RECIPES.some((recipe) => hasItem(inventory, recipe.barItemId));
        if (!hasBars) {
            services.messaging.sendGameMessage(
                player,
                barItemId !== undefined
                    ? "You need metal bars to smith."
                    : "You should select an item from your inventory and use it on the anvil.",
            );
            return;
        }
        services.production?.openForgeInterface?.(player, barItemId);
    };

    registry.registerLocAction("smith", (event) => {
        openForge(event.player);
    });

    const barItemIds = new Set(SMITHING_RECIPES.map((r) => r.barItemId));
    for (const barItemId of barItemIds) {
        registry.registerItemOnLoc(barItemId, ANY_LOC_ID, (event) => {
            const locDef = services.data.getLocDefinition(event.target.locId);
            if (!locDef) return;
            const actions = locDef.ops ?? [];
            if (!actions.some((a: string) => a?.toLowerCase() === "smith")) return;
            openForge(event.player, event.source.itemId);
        });
    }
}
