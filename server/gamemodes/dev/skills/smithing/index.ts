import type { IScriptRegistry, ScriptServices } from "../../../../src/game/scripts/types";
import { openSmithingBarModal } from "../../modals/smithingBarModalHandler";
import { executeSmeltAction, registerSmeltingInteractions } from "./smelting";
import { executeSmithAction, registerSmithingInteractions } from "./smithing";
import {
    SMITHING_CUSTOM_QUANTITY_COMPONENTS,
    SMITHING_FIXED_QUANTITY_MODE_BY_COMPONENT,
    SMITHING_GROUP_ID,
    SMITHING_SLOT_BY_COMPONENT,
} from "./smithingInterface";
import { SmithingUI } from "./smithingUI";

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.smith", executeSmithAction);
    registry.registerActionHandler("skill.smelt", executeSmeltAction);

    const smithingUI = new SmithingUI(services);

    const production = services.production;
    if (production) {
        production.openSmeltingInterface = (player) => smithingUI.openSmeltingInterface(player);
        production.openForgeInterface = (player, preferredBarItemId) =>
            smithingUI.openForgeInterface(player, preferredBarItemId);
        production.openSmithingInterface = (player) => smithingUI.openSmithingInterface(player);
        production.smeltBars = (player, params) =>
            smithingUI.handleSmeltingSelection(
                player,
                params.recipeId,
                params.count > 0 ? params.count : undefined,
            );
        production.smithItems = (player, params) =>
            smithingUI.handleSmithingSelection(
                player,
                params.recipeId,
                params.count > 0 ? params.count : undefined,
            );
        production.updateSmithingInterface = (player) => smithingUI.updateSmithingInterface(player);
        production.updateSmeltingInterface = (player) => smithingUI.updateSmeltingInterface(player);
        production.getBarTypeByItemId = (itemId) => smithingUI.getBarTypeByItemId(itemId);
        production.openSmithingBarModal = (player) => openSmithingBarModal(player, services);
    }

    for (const [componentId, mode] of SMITHING_FIXED_QUANTITY_MODE_BY_COMPONENT) {
        registry.onButton(SMITHING_GROUP_ID, componentId, (event) => {
            smithingUI.handleModeChange(event.player, mode);
        });
    }

    for (const componentId of SMITHING_CUSTOM_QUANTITY_COMPONENTS) {
        registry.onButton(SMITHING_GROUP_ID, componentId, (event) => {
            smithingUI.promptCustomQuantity(event.player);
        });
    }

    for (const [componentId, slot] of SMITHING_SLOT_BY_COMPONENT) {
        registry.onButton(SMITHING_GROUP_ID, componentId, (event) => {
            const recipe = smithingUI.resolveRecipeFromComponent(event.player, componentId, slot);
            if (!recipe) {
                services.messaging.sendGameMessage(event.player, "You can't smith that.");
                return;
            }
            smithingUI.handleSmithingSelection(event.player, recipe.id);
        });
    }

    registry.registerClientMessageHandler("smithing_make", (event) => {
        const recipeId = (event.payload.recipeId as string) ?? "";
        const mode = event.payload.mode === "forge" ? "forge" : "smelt";
        if (mode === "forge") smithingUI.handleSmithingSelection(event.player, recipeId);
        else smithingUI.handleSmeltingSelection(event.player, recipeId);
    });

    registry.registerClientMessageHandler("smithing_mode", (event) => {
        smithingUI.handleModeChange(
            event.player,
            (event.payload.mode as number) ?? event.player.bank.getSmithingQuantityMode(),
            event.payload.custom as number | undefined,
        );
    });

    registerSmithingInteractions(registry, services);
    registerSmeltingInteractions(registry, services);
}
