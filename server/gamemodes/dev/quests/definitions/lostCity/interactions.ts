import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import {
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcInteractionEvent,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage } from "../../QuestService";
import { sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    AXES,
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_SPIRIT_DEFEATED,
    STAGE_SPOKEN_SHAMUS,
    STAGE_STAFF_MADE,
    STAGE_STARTED,
    STAGE_TREE_CHOPPED,
    TILE,
} from "./constants";

const shamusByPlayer = new Map<number, number>();
const spiritByPlayer = new Map<number, number>();

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function hasAxe(player: PlayerState, services: ScriptServices): boolean {
    return AXES.some((itemId) => services.inventory.findOwnedItemLocation(player, itemId) !== undefined);
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

function createWarriorHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 0) {
            startConversation(context(event, "Warrior"), [
                sayPlayer("What are you camped here for?"),
                sayNpc("We're looking for Zanaris... I mean, no particular reason at all."),
                sayPlayer("A hidden city? How do you plan to find it?"),
                sayNpc("We know exactly what we're doing. We just haven't found which tree the leprechaun is hiding in!"),
                sayPlayer("So a leprechaun knows where Zanaris is. Thanks for the help!"),
            ]);
            setQuestStage(event.player, quest, event.services, STAGE_STARTED);
            return;
        }
        startConversation(context(event, "Warrior"), [
            sayNpc(
                stage >= STAGE_COMPLETE
                    ? "Please don't tell the others that I helped you find Zanaris."
                    : "I definitely did not tell you to search these trees for a leprechaun.",
            ),
        ]);
    };
}

function createShamusHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_STARTED) {
            startConversation(context(event, "Shamus"), [
                sayNpc("Ay, yer big elephant! What would yer be wanting with old Shamus?"),
                sayPlayer("I want to find Zanaris."),
                sayNpc([
                    "The shed in Lumbridge Swamp is the doorway, but only while yer carry a Dramen staff.",
                    "Cut a branch from the Dramen tree in the cave on Entrana and carve it into a staff.",
                ]),
            ]);
            setQuestStage(event.player, quest, event.services, STAGE_SPOKEN_SHAMUS);
        } else {
            startConversation(context(event, "Shamus"), [
                sayNpc(
                    stage > STAGE_STARTED
                        ? "Enter the swamp shed while wielding a Dramen staff, yer great elephant!"
                        : "Catch me again when yer know what yer want!",
                ),
            ]);
        }
        event.services.npc.removeNpc(event.npc.id);
        shamusByPlayer.delete(event.player.id);
    };
}

function registerAdventurers(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerNpcScript({ npcId: NPC.warrior, option: "talk-to", handler: createWarriorHandler(quest) });
    const simple = (name: string) => (event: NpcInteractionEvent) => {
        startConversation(context(event, name), [
            sayNpc(
                getQuestStage(event.player, quest) === STAGE_STARTED
                    ? "We know nothing about a leprechaun. Now go away."
                    : "Our adventure is none of your business.",
            ),
        ]);
    };
    registry.registerNpcScript({ npcId: NPC.archer, option: "talk-to", handler: simple("Archer") });
    registry.registerNpcScript({ npcId: NPC.monk, option: "talk-to", handler: simple("Monk") });
    registry.registerNpcScript({ npcId: NPC.wizard, option: "talk-to", handler: simple("Wizard") });
    registry.registerNpcScript({ npcId: NPC.shamus, option: "talk-to", handler: createShamusHandler(quest) });
}

function registerLeprechaunTree(quest: QuestDefinition, registry: IScriptRegistry): void {
    const chop = (player: PlayerState, services: ScriptServices): void => {
        if (!hasAxe(player, services)) {
            services.messaging.sendGameMessage(player, "You need an axe to chop this tree.");
            return;
        }
        if (getQuestStage(player, quest) !== STAGE_STARTED) {
            services.messaging.sendGameMessage(player, "It looks like an ordinary tree.");
            return;
        }
        const tracked = shamusByPlayer.get(player.id);
        if (tracked !== undefined && services.combat.getNpc(tracked)) {
            services.messaging.sendGameMessage(player, "Shamus shouts at you not to chop down his house.");
            return;
        }
        const shamus = services.npc.spawnNpc({
            id: NPC.shamus,
            name: "Shamus",
            ...TILE.shamus,
            wanderRadius: 5,
            ownerPlayerId: player.id,
            worldViewId: player.worldViewId,
        });
        if (shamus) shamusByPlayer.set(player.id, shamus.id);
        services.messaging.sendGameMessage(player, "A leprechaun jumps out of the tree!");
    };
    registry.registerLocScript({
        locId: LOC.leprechaunTree,
        action: "chop",
        handler: ({ player, services }) => chop(player, services),
    });
    for (const axe of AXES) {
        registry.registerItemOnLoc(axe, LOC.leprechaunTree, ({ player, services }) => chop(player, services));
    }
}

function registerDramenTree(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.dramenTree,
        action: "chop down",
        handler: ({ player, services }) => {
            const stage = getQuestStage(player, quest);
            if (stage < STAGE_SPOKEN_SHAMUS) {
                services.messaging.sendGameMessage(player, "The tree has an ominous aura. You cannot bring yourself to chop it.");
                return;
            }
            if (!hasAxe(player, services)) {
                services.messaging.sendGameMessage(player, "You need an axe to chop this tree.");
                return;
            }
            if (services.skills.getSkill(player, SkillId.Woodcutting).baseLevel < 36) {
                services.messaging.sendGameMessage(player, "You need level 36 Woodcutting to chop this tree.");
                return;
            }
            if (stage === STAGE_SPOKEN_SHAMUS) {
                const tracked = spiritByPlayer.get(player.id);
                if (tracked !== undefined && services.combat.getNpc(tracked)) {
                    services.messaging.sendGameMessage(player, "You must defeat the Tree spirit first.");
                    return;
                }
                const spirit = services.npc.spawnNpc({
                    id: NPC.treeSpirit,
                    name: "Tree spirit",
                    ...TILE.treeSpirit,
                    ownerPlayerId: player.id,
                    worldViewId: player.worldViewId,
                });
                if (spirit) spiritByPlayer.set(player.id, spirit.id);
                services.messaging.sendGameMessage(player, "A Tree spirit appears: 'You must defeat me before touching the tree!'");
                return;
            }
            if (!giveItem(player, services, ITEM.dramenBranch)) return;
            if (stage === STAGE_SPIRIT_DEFEATED) {
                setQuestStage(player, quest, services, STAGE_TREE_CHOPPED);
            }
            services.messaging.sendGameMessage(player, "You cut a branch from the Dramen tree.");
        },
    });
    registry.registerNpcPreDeath(NPC.treeSpirit, (event) => {
        if (
            !event.killer ||
            getQuestStage(event.killer, quest) !== STAGE_SPOKEN_SHAMUS ||
            (event.npc.ownerPlayerId !== undefined && event.npc.ownerPlayerId !== event.killer.id)
        ) {
            return NpcPreDeathDecision.Allow;
        }
        setQuestStage(event.killer, quest, event.services, STAGE_SPIRIT_DEFEATED);
        spiritByPlayer.delete(event.killer.id);
        event.services.messaging.sendGameMessage(event.killer, "With the Tree spirit defeated, you may now chop the tree.");
        return NpcPreDeathDecision.Allow;
    });
}

function registerStaffAndDoor(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerItemOnItem(ITEM.knife, ITEM.dramenBranch, (event) => {
        if (event.services.skills.getSkill(event.player, SkillId.Crafting).baseLevel < 31) {
            event.services.messaging.sendGameMessage(event.player, "You need level 31 Crafting to carve a Dramen staff.");
            return;
        }
        const branchSlot = event.source.itemId === ITEM.dramenBranch ? event.source.slot : event.target.slot;
        event.services.inventory.setInventorySlot(event.player, branchSlot, ITEM.dramenStaff, 1);
        event.services.inventory.snapshotInventory(event.player);
        if (getQuestStage(event.player, quest) === STAGE_TREE_CHOPPED) {
            setQuestStage(event.player, quest, event.services, STAGE_STAFF_MADE);
        }
        event.services.messaging.sendGameMessage(event.player, "You carve the branch into a Dramen staff.");
    });

    const previousDoor = registry.findLocInteraction(LOC.zanarisDoor, "open");
    registry.registerLocScript({
        locId: LOC.zanarisDoor,
        action: "open",
        handler: (event) => {
            if (
                event.services.equipment.getEquippedItem(event.player, EquipmentSlot.WEAPON) !==
                ITEM.dramenStaff
            ) {
                previousDoor?.(event);
                return;
            }
            const stage = getQuestStage(event.player, quest);
            if (stage < STAGE_STAFF_MADE) {
                event.services.messaging.sendGameMessage(event.player, "The staff does not yet respond to this doorway.");
                return;
            }
            event.services.messaging.sendGameMessage(event.player, "The world starts to shimmer...");
            event.services.movement.teleportPlayer(
                event.player,
                TILE.zanaris.x,
                TILE.zanaris.y,
                TILE.zanaris.level,
            );
            if (stage === STAGE_STAFF_MADE) completeQuest(event.player, event.services, quest);
        },
    });
}

export function registerLostCityInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerAdventurers(quest, registry);
    registerLeprechaunTree(quest, registry);
    registerDramenTree(quest, registry);
    registerStaffAndDoor(quest, registry);
    services.system.eventBus?.on("player:logout", ({ playerId }) => {
        shamusByPlayer.delete(playerId);
        spiritByPlayer.delete(playerId);
    });
}
