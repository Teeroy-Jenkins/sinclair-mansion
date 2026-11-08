import {
    WEBWEAVER_BOW_ACTIVATION_ETHER,
    WEBWEAVER_BOW_ITEM_ID,
    WEBWEAVER_BOW_MAX_AMMO_ETHER,
    WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID,
    WEBWEAVER_BOW_UNCHARGED_ITEM_ID,
    getWebweaverEtherCharges,
} from "../../../../src/game/combat/plugins/special-attacks/WebweaverBowSpec";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../../../../src/game/scripts/types";

const INVENTORY_SLOT_COUNT = 28;

function reportCharges(player: PlayerState, services: ScriptServices): void {
    const ammoCharges = getWebweaverEtherCharges(player);
    services.messaging.sendGameMessage(
        player,
        `Your Webweaver bow has ${ammoCharges} revenant ether available as ammunition.`,
    );
}

export function registerWebweaverBowHandlers(
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    void services;

    registry.registerItemOnItem(
        WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID,
        WEBWEAVER_BOW_UNCHARGED_ITEM_ID,
        ({ player, source, target, services: svc }) => {
            const ether = source.itemId === WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID ? source : target;
            const bow = ether === source ? target : source;
            const inventory = svc.inventory.getInventoryItems(player);
            const etherStack = inventory[ether.slot];
            if (!etherStack || etherStack.itemId !== WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID) {
                return;
            }
            if (etherStack.quantity < WEBWEAVER_BOW_ACTIVATION_ETHER) {
                svc.messaging.sendGameMessage(
                    player,
                    `You need at least ${WEBWEAVER_BOW_ACTIVATION_ETHER} revenant ether to activate the bow.`,
                );
                return;
            }

            const maximumTotalEther = WEBWEAVER_BOW_ACTIVATION_ETHER + WEBWEAVER_BOW_MAX_AMMO_ETHER;
            const loaded = Math.min(etherStack.quantity, maximumTotalEther);
            const ammunition = loaded - WEBWEAVER_BOW_ACTIVATION_ETHER;
            player.equipment.setCharges(WEBWEAVER_BOW_ITEM_ID, ammunition);
            svc.inventory.setInventorySlot(player, bow.slot, WEBWEAVER_BOW_ITEM_ID, 1);
            const remaining = etherStack.quantity - loaded;
            svc.inventory.setInventorySlot(
                player,
                ether.slot,
                remaining > 0 ? WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID : -1,
                remaining,
            );
            svc.inventory.snapshotInventory(player);
            svc.messaging.sendGameMessage(
                player,
                ammunition > 0
                    ? `You activate the Webweaver bow and add ${ammunition} ether as ammunition.`
                    : "You activate the Webweaver bow. It still needs ether as ammunition before it can fire.",
            );
        },
    );

    registry.registerItemOnItem(
        WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID,
        WEBWEAVER_BOW_ITEM_ID,
        ({ player, source, target, services: svc }) => {
            const ether = source.itemId === WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID ? source : target;
            const inventory = svc.inventory.getInventoryItems(player);
            const etherStack = inventory[ether.slot];
            if (!etherStack || etherStack.itemId !== WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID) {
                return;
            }

            const current = getWebweaverEtherCharges(player);
            const loaded = Math.min(
                etherStack.quantity,
                Math.max(0, WEBWEAVER_BOW_MAX_AMMO_ETHER - current),
            );
            if (loaded <= 0) {
                svc.messaging.sendGameMessage(
                    player,
                    "Your Webweaver bow cannot hold any more revenant ether.",
                );
                return;
            }

            player.equipment.setCharges(WEBWEAVER_BOW_ITEM_ID, current + loaded);
            const remaining = etherStack.quantity - loaded;
            svc.inventory.setInventorySlot(
                player,
                ether.slot,
                remaining > 0 ? WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID : -1,
                remaining,
            );
            svc.inventory.snapshotInventory(player);
            svc.messaging.sendGameMessage(
                player,
                `You add ${loaded} revenant ether to the Webweaver bow.`,
            );
        },
    );

    registry.registerItemAction(
        WEBWEAVER_BOW_ITEM_ID,
        ({ player, services: svc }) => reportCharges(player, svc),
        "check",
    );
    registry.registerEquipmentAction(
        WEBWEAVER_BOW_ITEM_ID,
        ({ player, services: svc }) => reportCharges(player, svc),
        "check",
    );

    registry.registerItemAction(
        WEBWEAVER_BOW_ITEM_ID,
        ({ player, source, services: svc }) => {
            const inventory = svc.inventory.getInventoryItems(player);
            const hasEtherStack = inventory.some(
                (entry) => entry.itemId === WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID,
            );
            const occupiedSlots = inventory.filter((entry) => entry.itemId > 0).length;
            if (!hasEtherStack && occupiedSlots >= INVENTORY_SLOT_COUNT) {
                svc.messaging.sendGameMessage(
                    player,
                    "You do not have enough inventory space to uncharge the bow.",
                );
                return;
            }

            const ammunition = getWebweaverEtherCharges(player);
            const returnedEther = WEBWEAVER_BOW_ACTIVATION_ETHER + ammunition;
            svc.inventory.setInventorySlot(player, source.slot, WEBWEAVER_BOW_UNCHARGED_ITEM_ID, 1);
            const returned = svc.inventory.addItemToInventory(
                player,
                WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID,
                returnedEther,
            ).added;
            if (returned !== returnedEther) {
                svc.inventory.setInventorySlot(player, source.slot, WEBWEAVER_BOW_ITEM_ID, 1);
                if (returned > 0) {
                    const etherSlot = svc.inventory
                        .getInventoryItems(player)
                        .findIndex(
                            (entry) => entry.itemId === WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID,
                        );
                    if (etherSlot >= 0) {
                        const stack = svc.inventory.getInventoryItems(player)[etherSlot];
                        svc.inventory.setInventorySlot(
                            player,
                            etherSlot,
                            stack.quantity > returned ? WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID : -1,
                            Math.max(0, stack.quantity - returned),
                        );
                    }
                }
                svc.messaging.sendGameMessage(
                    player,
                    "You do not have enough inventory space to uncharge the bow.",
                );
                svc.inventory.snapshotInventory(player);
                return;
            }

            player.equipment.setCharges(WEBWEAVER_BOW_ITEM_ID, 0);
            svc.inventory.snapshotInventory(player);
            svc.messaging.sendGameMessage(
                player,
                `You uncharge the Webweaver bow and recover ${returnedEther} revenant ether.`,
            );
        },
        "uncharge",
    );
}
