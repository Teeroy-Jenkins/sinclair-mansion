import { combatConsumableManager } from "../../../../src/game/combat/engine/CombatConsumableManager";
import { INVENTORY_SLOT_COUNT, type PlayerState } from "../../../../src/game/player";
import type { ScriptServices } from "../../../../src/game/scripts/types";

export type ConsumableExecuteContext = {
    player: PlayerState;
    slotIndex: number;
    itemId: number;
    option?: string;
    tick: number;
    services: ScriptServices;
};

export type ConsumableProfile = "food" | "potion" | "comboFood";

export interface ConsumableActionOptions {
    player: PlayerState;
    slotIndex: number;
    itemId: number;
    option?: string;
    tick?: number;
    delayTicks?: number;
    groups?: string[];
    loggerTag?: string;
    services: ScriptServices;
    onExecute: (context: ConsumableExecuteContext) => void;
    profile?: ConsumableProfile;
}

const clampSlot = (slot: number): number => Math.max(0, Math.min(slot, INVENTORY_SLOT_COUNT - 1));

const PROFILE_CONFIG: Record<ConsumableProfile, { groups: string[]; cooldownTicks: number }> = {
    food: { groups: ["inventory.food"], cooldownTicks: 0 },
    potion: { groups: ["inventory.potion"], cooldownTicks: 0 },
    comboFood: { groups: ["inventory.combo_food"], cooldownTicks: 2 },
};

const normalizeGroups = (groups: string[] | undefined): string[] => {
    if (!groups || groups.length === 0) return ["inventory.consume"];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const group of groups) {
        const key = String(group || "").trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(key);
    }
    return result.length > 0 ? result : ["inventory.consume"];
};

export function scheduleConsumableAction(options: ConsumableActionOptions): boolean {
    const {
        player,
        slotIndex,
        itemId,
        option,
        tick,
        delayTicks = 0,
        groups,
        loggerTag = "consumable",
        services,
        onExecute,
        profile,
    } = options;

    // Eating/drinking closes interruptible interfaces (modals, dialogs)
    services.dialog.closeInterruptibleInterfaces(player);

    const normalizedSlot = clampSlot(slotIndex);
    const normalizedItemId = itemId;
    const resolvedTick = Number.isFinite(tick) ? (tick as number) : 0;
    const log = (message: string, meta?: Record<string, unknown>) =>
        services.system.logger.warn?.(`[script:${loggerTag}] ${message}`, meta);

    const profileConfig = profile ? PROFILE_CONFIG[profile] : undefined;
    const effectiveGroups = normalizeGroups(groups ?? profileConfig?.groups);
    const consumableType = profile;

    if (consumableType === "food" && !combatConsumableManager.canEatFood(player, resolvedTick)) {
        log("food consume rejected", { reason: "food_delay" });
        return false;
    }
    if (
        consumableType === "potion" &&
        !combatConsumableManager.canDrinkPotion(player, resolvedTick)
    ) {
        log("potion consume rejected", { reason: "potion_delay" });
        return false;
    }

    const runExecute = (snapshot: boolean) => {
        try {
            onExecute({
                player,
                slotIndex: normalizedSlot,
                itemId: normalizedItemId,
                option,
                tick: resolvedTick,
                services,
            });
        } catch (err) {
            log("onExecute threw", {
                itemId: normalizedItemId,
                option: option ?? "",
                error: err instanceof Error ? (err.stack ?? err.message) : String(err ?? "unknown"),
            });
        }
        if (snapshot) {
            services.inventory.snapshotInventoryImmediate(player);
        }
    };

    const result = services.combat.requestAction(
        player,
        {
            kind: "inventory.consume_script",
            data: {
                slotIndex: normalizedSlot,
                itemId: normalizedItemId,
                option,
                consumableType,
                apply: () => runExecute(false),
            },
            delayTicks,
            cooldownTicks: profileConfig?.cooldownTicks ?? 0,
            groups: effectiveGroups,
        },
        resolvedTick,
    );
    if (!result.ok) {
        log("consume action rejected", { reason: result.reason ?? "unknown" });
        return false;
    }
    return true;
}
