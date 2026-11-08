import { type IScriptRegistry, type ScriptServices } from "../../../../src/game/scripts/types";
import type { PlayerState } from "../../../../src/game/player";

const TOXIC_BLOWPIPE_EMPTY_ITEM_ID = 12924;
const TOXIC_BLOWPIPE_ITEM_ID = 12926;
const ZULRAHS_SCALES_ITEM_ID = 12934;
const MAX_BLOWPIPE_CHARGES = 16_383;
const INVENTORY_SLOT_COUNT = 28;
const DART_ITEM_IDS = Object.freeze([806, 807, 808, 3093, 809, 810, 811, 25849, 11230]);

export function registerToxicBlowpipeHandlers(
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const reportCharges = (player: PlayerState, svc: ScriptServices) => {
        const state = player.equipment.getBlowpipeChargeState();
        svc.messaging.sendGameMessage(
            player,
            `Your toxic blowpipe contains ${state.scales} scales and ${state.dartCount} darts.`,
        );
    };
    const blowpipeIds = [TOXIC_BLOWPIPE_EMPTY_ITEM_ID, TOXIC_BLOWPIPE_ITEM_ID];
    for (const blowpipeId of blowpipeIds) {
        registry.registerItemOnItem(
            ZULRAHS_SCALES_ITEM_ID,
            blowpipeId,
            ({ player, source, target, services: svc }) => {
                const material =
                    source.itemId === ZULRAHS_SCALES_ITEM_ID ? source : target;
                const blowpipe = material === source ? target : source;
                const inventory = svc.inventory.getInventoryItems(player);
                const stack = inventory[material.slot];
                if (!stack || stack.itemId !== ZULRAHS_SCALES_ITEM_ID) return;

                const state = player.equipment.getBlowpipeChargeState();
                const loaded = Math.min(
                    stack.quantity,
                    Math.max(0, MAX_BLOWPIPE_CHARGES - state.scales),
                );
                if (loaded <= 0) {
                    svc.messaging.sendGameMessage(player, "Your toxic blowpipe cannot hold any more scales.");
                    return;
                }

                player.equipment.setBlowpipeChargeState({
                    ...state,
                    scales: state.scales + loaded,
                });
                const remaining = stack.quantity - loaded;
                svc.inventory.setInventorySlot(
                    player,
                    material.slot,
                    remaining > 0 ? ZULRAHS_SCALES_ITEM_ID : -1,
                    remaining,
                );
                if (blowpipe.itemId === TOXIC_BLOWPIPE_EMPTY_ITEM_ID) {
                    svc.inventory.setInventorySlot(
                        player,
                        blowpipe.slot,
                        TOXIC_BLOWPIPE_ITEM_ID,
                        1,
                    );
                }
                svc.inventory.snapshotInventory(player);
                svc.messaging.sendGameMessage(player, `You add ${loaded} Zulrah's scales to the blowpipe.`);
            },
        );

        for (const dartId of DART_ITEM_IDS) {
            registry.registerItemOnItem(
                dartId,
                blowpipeId,
                ({ player, source, target, services: svc }) => {
                    const material = source.itemId === dartId ? source : target;
                    const inventory = svc.inventory.getInventoryItems(player);
                    const stack = inventory[material.slot];
                    if (!stack || stack.itemId !== dartId) return;

                    let state = player.equipment.getBlowpipeChargeState();
                    if (state.dartCount > 0 && state.dartId !== dartId) {
                        const returned = svc.inventory.addItemToInventory(
                            player,
                            state.dartId,
                            state.dartCount,
                        ).added;
                        if (returned !== state.dartCount) {
                            svc.messaging.sendGameMessage(
                                player,
                                "You do not have enough inventory space to swap darts.",
                            );
                            return;
                        }
                        state = Object.freeze({
                            ...state,
                            dartId: -1,
                            dartCount: 0,
                        });
                    }
                    const loaded = Math.min(
                        stack.quantity,
                        Math.max(0, MAX_BLOWPIPE_CHARGES - state.dartCount),
                    );
                    if (loaded <= 0) {
                        svc.messaging.sendGameMessage(player, "Your toxic blowpipe cannot hold any more darts.");
                        return;
                    }

                    player.equipment.setBlowpipeChargeState({
                        ...state,
                        dartId,
                        dartCount: state.dartCount + loaded,
                    });
                    const remaining = stack.quantity - loaded;
                    svc.inventory.setInventorySlot(
                        player,
                        material.slot,
                        remaining > 0 ? dartId : -1,
                        remaining,
                    );
                    svc.inventory.snapshotInventory(player);
                    svc.messaging.sendGameMessage(player, `You load ${loaded} darts into the blowpipe.`);
                },
            );
        }
    }

    registry.registerItemAction(
        TOXIC_BLOWPIPE_ITEM_ID,
        ({ player, services: svc }) => {
            reportCharges(player, svc);
        },
        "check",
    );
    registry.registerEquipmentAction(
        TOXIC_BLOWPIPE_ITEM_ID,
        ({ player, services: svc }) => reportCharges(player, svc),
        "check",
    );

    registry.registerItemAction(
        TOXIC_BLOWPIPE_ITEM_ID,
        ({ player, services: svc }) => {
            const state = player.equipment.getBlowpipeChargeState();
            if (state.dartCount <= 0 || state.dartId <= 0) {
                svc.messaging.sendGameMessage(player, "Your toxic blowpipe contains no darts.");
                return;
            }
            const returned = svc.inventory.addItemToInventory(
                player,
                state.dartId,
                state.dartCount,
            ).added;
            if (returned <= 0) {
                svc.messaging.sendGameMessage(player, "You do not have enough inventory space.");
                return;
            }
            player.equipment.setBlowpipeChargeState({
                ...state,
                dartCount: state.dartCount - returned,
                dartId: state.dartCount - returned > 0 ? state.dartId : -1,
            });
            svc.inventory.snapshotInventory(player);
        },
        "unload",
    );

    registry.registerItemAction(
        TOXIC_BLOWPIPE_ITEM_ID,
        ({ player, source, services: svc }) => {
            const state = player.equipment.getBlowpipeChargeState();
            const inventory = svc.inventory.getInventoryItems(player);
            const occupiedSlots = inventory.filter((entry) => entry.itemId > 0).length;
            let requiredSlots = 0;
            if (
                state.scales > 0 &&
                !inventory.some((entry) => entry.itemId === ZULRAHS_SCALES_ITEM_ID)
            ) {
                requiredSlots++;
            }
            if (
                state.dartCount > 0 &&
                !inventory.some((entry) => entry.itemId === state.dartId)
            ) {
                requiredSlots++;
            }
            if (INVENTORY_SLOT_COUNT - occupiedSlots < requiredSlots) {
                svc.messaging.sendGameMessage(player, "You do not have enough inventory space.");
                return;
            }

            if (state.scales > 0) {
                svc.inventory.addItemToInventory(
                    player,
                    ZULRAHS_SCALES_ITEM_ID,
                    state.scales,
                );
            }
            if (state.dartCount > 0 && state.dartId > 0) {
                svc.inventory.addItemToInventory(player, state.dartId, state.dartCount);
            }
            player.equipment.setBlowpipeChargeState({
                scales: 0,
                dartId: -1,
                dartCount: 0,
            });
            svc.inventory.setInventorySlot(
                player,
                source.slot,
                TOXIC_BLOWPIPE_EMPTY_ITEM_ID,
                1,
            );
            svc.inventory.snapshotInventory(player);
            svc.messaging.sendGameMessage(player, "You uncharge the toxic blowpipe.");
        },
        "uncharge",
    );
}
