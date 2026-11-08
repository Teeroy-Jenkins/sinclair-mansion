import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import type { PlayerState } from "../../../../../src/game/player";
import {
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcInteractionEvent,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_DEFEATED_BOUNCER,
    STAGE_DEFEATED_SCORPION,
    STAGE_FREED_SERVILS,
    STAGE_GUARD_DRUNK,
    STAGE_NOT_STARTED,
    STAGE_OBTAINED_ARMOUR,
    STAGE_OGRE_FIGHT,
    STAGE_SCORPION_FIGHT,
    STAGE_SPOKEN_GUARD,
    STAGE_STARTED,
} from "./constants";

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function hasItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function freeSlots(player: PlayerState, services: ScriptServices): number {
    return services.inventory
        .getInventoryItems(player)
        .filter((entry) => entry.itemId <= 0 || entry.quantity <= 0).length;
}

function giveItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    if (!services.inventory.hasInventorySlot(player)) {
        services.messaging.sendGameMessage(player, "You need a free inventory space.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, itemId, 1);
    if (result.added !== 1) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function removeQuantity(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity: number,
): boolean {
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const taken = Math.min(remaining, entry.quantity);
        const left = entry.quantity - taken;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= taken;
        if (remaining === 0) break;
    }
    if (remaining !== 0) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function wearingDisguise(player: PlayerState, services: ScriptServices): boolean {
    return (
        services.equipment.getEquippedItem(player, EquipmentSlot.HEAD) === ITEM.khazardHelmet &&
        services.equipment.getEquippedItem(player, EquipmentSlot.BODY) === ITEM.khazardArmour
    );
}

function createLadyHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context(event, "Lady Servil"), [
                sayNpc("General Khazard has kidnapped my husband and son and forced them into his fight arena."),
                choose([
                    option("Can I help you?", [
                        sayNpc("Please bring them home. My family will reward you handsomely."),
                        run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED)),
                    ]),
                    option("I hope you find them.", []),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_FREED_SERVILS) {
            startConversation(context(event, "Lady Servil"), [
                sayNpc("My son and husband are safe because of you. Please accept this reward."),
                run(({ player, services }) => completeQuest(player, services, quest)),
            ]);
            return;
        }
        startConversation(context(event, "Lady Servil"), [
            sayNpc(
                stage >= STAGE_COMPLETE
                    ? "My family is resting safely at home. Thank you again."
                    : "Please hurry and rescue my family from the arena.",
            ),
        ]);
    };
}

function registerArmourChest(quest: QuestDefinition, registry: IScriptRegistry): void {
    const search = (player: PlayerState, services: ScriptServices): void => {
        if (getQuestStage(player, quest) === STAGE_NOT_STARTED) {
            services.messaging.sendGameMessage(player, "You find nothing useful.");
            return;
        }
        const missing = [ITEM.khazardHelmet, ITEM.khazardArmour].filter(
            (itemId) => !hasItem(player, services, itemId),
        );
        if (missing.length === 0) {
            services.messaging.sendGameMessage(player, "You already have a complete Khazard disguise.");
            return;
        }
        if (freeSlots(player, services) < missing.length) {
            services.messaging.sendGameMessage(player, `You need ${missing.length} free inventory spaces.`);
            return;
        }
        for (const itemId of missing) giveItem(player, services, itemId);
        if (getQuestStage(player, quest) === STAGE_STARTED) {
            setQuestStage(player, quest, services, STAGE_OBTAINED_ARMOUR);
        }
        services.messaging.sendGameMessage(player, "You find a Khazard guard's helmet and armour in the chest.");
    };
    registry.registerLocScript({
        locId: LOC.armourChest,
        action: "search",
        handler: ({ player, services }) => search(player, services),
    });
    registry.registerLocScript({
        locId: LOC.armourChestOpen,
        action: undefined,
        handler: ({ player, services }) => search(player, services),
    });
}

function createBarmanHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_SPOKEN_GUARD) {
            startConversation(context(event, "Khazard barman"), [sayNpc("We serve the finest brews in Khazard.")]);
            return;
        }
        startConversation(context(event, "Khazard barman"), [
            sayPlayer("I'd like a Khali brew please."),
            sayNpc("That will be five coins."),
            run(({ player, services }) => {
                if (hasItem(player, services, ITEM.khaliBrew)) return;
                if (!removeQuantity(player, services, ITEM.coins, 5)) {
                    services.messaging.sendGameMessage(player, "You need five coins.");
                    return;
                }
                giveItem(player, services, ITEM.khaliBrew);
            }),
        ]);
    };
}

function createDrunkGuardHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (!wearingDisguise(event.player, event.services)) {
            startConversation(context(event, "Khazard Guard"), [sayNpc("This area is restricted. Leave now!")]);
            return;
        }
        if (stage === STAGE_OBTAINED_ARMOUR) {
            startConversation(context(event, "Khazard Guard"), [
                sayNpc("Guard duty is so dull. I would give anything for a decent Khali brew."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_GUARD)),
            ]);
            return;
        }
        if (stage === STAGE_SPOKEN_GUARD && hasItem(event.player, event.services, ITEM.khaliBrew)) {
            startConversation(context(event, "Khazard Guard"), [
                sayPlayer("Would you still like that drink?"),
                sayNpc("Yessh... I'll rest. You take the cell keys and watch the prisoners."),
                run(({ player, services }) => {
                    if (!removeQuantity(player, services, ITEM.khaliBrew, 1)) return;
                    if (!hasItem(player, services, ITEM.cellKeys) && !giveItem(player, services, ITEM.cellKeys)) return;
                    setQuestStage(player, quest, services, STAGE_GUARD_DRUNK);
                }),
            ]);
            return;
        }
        startConversation(context(event, "Khazard Guard"), [sayNpc("Leave me alone. The walls will not stop swaying.")]);
    };
}

function registerCells(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const locId of LOC.jeremyGate) {
        registry.registerItemOnLoc(ITEM.cellKeys, locId, ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_GUARD_DRUNK) {
                services.messaging.sendGameMessage(player, "There is nobody here to release now.");
                return;
            }
            setQuestStage(player, quest, services, STAGE_OGRE_FIGHT);
            services.messaging.sendGameMessage(player, "You free Jeremy, but he runs into the arena to help his father. The Khazard Ogre attacks!");
        });
    }
    for (const locId of LOC.prisonGate) {
        registry.registerItemOnLoc(ITEM.cellKeys, locId, ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_DEFEATED_BOUNCER) {
                services.messaging.sendGameMessage(player, "The prisoners cannot escape while the arena guards are watching.");
                return;
            }
            setQuestStage(player, quest, services, STAGE_FREED_SERVILS);
            services.messaging.sendGameMessage(player, "You unlock the gate and the Servil family escapes from the arena.");
        });
    }
}

function registerArenaFights(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerNpcPreDeath(NPC.khazardOgre, (event) => {
        if (!event.killer || getQuestStage(event.killer, quest) !== STAGE_OGRE_FIGHT) {
            return NpcPreDeathDecision.Allow;
        }
        setQuestStage(event.killer, quest, event.services, STAGE_SCORPION_FIGHT);
        event.services.messaging.sendGameMessage(event.killer, "The ogre falls. General Khazard orders his giant scorpion into the arena.");
        return NpcPreDeathDecision.Allow;
    });
    registry.registerNpcPreDeath(NPC.khazardScorpion, (event) => {
        if (!event.killer || getQuestStage(event.killer, quest) !== STAGE_SCORPION_FIGHT) {
            return NpcPreDeathDecision.Allow;
        }
        setQuestStage(event.killer, quest, event.services, STAGE_DEFEATED_SCORPION);
        event.services.messaging.sendGameMessage(event.killer, "The scorpion dies. Khazard releases Bouncer, his most fearsome pet.");
        return NpcPreDeathDecision.Allow;
    });
    registry.registerNpcPreDeath(NPC.bouncer, (event) => {
        if (!event.killer || getQuestStage(event.killer, quest) !== STAGE_DEFEATED_SCORPION) {
            return NpcPreDeathDecision.Allow;
        }
        setQuestStage(event.killer, quest, event.services, STAGE_DEFEATED_BOUNCER);
        event.services.messaging.sendGameMessage(event.killer, "Bouncer is defeated. Now free the Servils and escape.");
        return NpcPreDeathDecision.Allow;
    });
}

export function registerFightArenaInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registry.registerNpcScript({ npcId: NPC.ladyServil, option: "talk-to", handler: createLadyHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.barman, option: "talk-to", handler: createBarmanHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.drunkGuard, option: "talk-to", handler: createDrunkGuardHandler(quest) });
    registry.registerNpcScript({
        npcId: NPC.generalKhazard,
        option: "talk-to",
        handler: (event) => startConversation(context(event, "General Khazard"), [sayNpc("Nobody defies General Khazard in his own arena!")]),
    });
    registerArmourChest(quest, registry);
    registerCells(quest, registry);
    registerArenaFights(quest, registry);
}
