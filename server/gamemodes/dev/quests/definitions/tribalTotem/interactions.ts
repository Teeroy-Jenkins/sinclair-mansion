import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    getQuestStage,
    meetsQuestRequirements,
    setQuestStage,
} from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOC,
    NPC,
    STAIRS_DISABLED_BIT,
    STAGE_COMPLETE,
    STAGE_CRATE_DELIVERED,
    STAGE_CRATE_MARKED,
    STAGE_NOT_STARTED,
    STAGE_STARTED,
    STAGE_TELEPORTED,
    TILE,
    TRAP_COMBINATION_SOLVED_BIT,
    VARP_HANDELMORT_TRAPS,
} from "./constants";

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function hasOwned(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
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

function removeItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    const entry = services.inventory
        .getInventoryItems(player)
        .find((candidate) => candidate.itemId === itemId && candidate.quantity > 0);
    if (!entry) return false;
    const remaining = entry.quantity - 1;
    services.inventory.setInventorySlot(player, entry.slot, remaining > 0 ? itemId : -1, remaining);
    services.inventory.snapshotInventory(player);
    return true;
}

function trapState(player: PlayerState): number {
    return player.varps.getVarpValue(VARP_HANDELMORT_TRAPS);
}

function setTrapBit(player: PlayerState, services: ScriptServices, bit: number): void {
    const next = trapState(player) | bit;
    player.varps.setVarpValue(VARP_HANDELMORT_TRAPS, next);
    services.variables.sendVarp(player, VARP_HANDELMORT_TRAPS, next);
}

function createKangaiHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            const accept = meetsQuestRequirements(event.player, event.services, quest)
                ? [
                      sayPlayer("I'll get your totem back."),
                      sayNpc("Lord Handelmort keeps it in his mansion in East Ardougne."),
                      run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED)),
                  ]
                : [sayNpc("This needs an experienced thief. Come back with level 21 Thieving.")];
            startConversation(context(event, "Kangai Mau"), [
                sayNpc([
                    "Lord Handelmort stole our sacred tribal totem.",
                    "Will you recover it for the Rantuki tribe?",
                ]),
                choose([
                    option("Yes, I'll help you.", accept),
                    option("No, that sounds too dangerous.", [sayNpc("Then our tribe must wait for another thief.")]),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_TELEPORTED && hasOwned(event.player, event.services, ITEM.tribalTotem)) {
            startConversation(context(event, "Kangai Mau"), [
                sayPlayer("I have recovered your tribal totem."),
                sayNpc("You have earned the friendship of the Rantuki tribe."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.tribalTotem)) return;
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context(event, "Kangai Mau"), [sayNpc("The Rantuki tribe will always remember your help.")]);
            return;
        }
        startConversation(context(event, "Kangai Mau"), [
            sayNpc("Handelmort Mansion is in East Ardougne. Find a way past its security.")
        ]);
    };
}

function createEmployeeHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) === STAGE_CRATE_MARKED) {
            startConversation(context(event, "G.P.D.T. employee"), [
                sayPlayer("That crate is labelled for Lord Handelmort."),
                sayNpc("So it is. We'll deliver it to his mansion immediately."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_CRATE_DELIVERED)),
            ]);
            return;
        }
        startConversation(context(event, "G.P.D.T. employee"), [
            sayNpc("Gielinor Parcel Delivery, at your service. We deliver anything, anywhere."),
        ]);
    };
}

function createHoracioHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const active = getQuestStage(event.player, quest) >= STAGE_STARTED &&
            getQuestStage(event.player, quest) < STAGE_COMPLETE;
        if (!active) {
            startConversation(context(event, "Horacio"), [sayNpc("Good day. I am Lord Handelmort's gardener.")]);
            return;
        }
        startConversation(context(event, "Horacio"), [
            sayPlayer("Do you know anything about the mansion's security system?"),
            sayNpc([
                "The door combination is Lord Handelmort's middle name.",
                "This old guide to Ardougne should tell you his full name.",
            ]),
            run(({ player, services }) => {
                if (!hasOwned(player, services, ITEM.guideBook)) giveItem(player, services, ITEM.guideBook);
            }),
        ]);
    };
}

function registerCrates(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.hornCrate,
        action: undefined,
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) < STAGE_STARTED) {
                services.messaging.sendGameMessage(player, "The crate contains a shipment of wind instruments.");
                return;
            }
            if (hasOwned(player, services, ITEM.addressLabel)) {
                services.messaging.sendGameMessage(player, "You already took an address label from the crate.");
                return;
            }
            if (giveItem(player, services, ITEM.addressLabel)) {
                services.messaging.sendGameMessage(player, "You peel a spare address label from the crate.");
            }
        },
    });
    for (const action of ["search", "investigate"]) {
        registry.registerLocScript({
            locId: LOC.hornCrate,
            action,
            handler: (event) => registry.findLocInteraction(LOC.hornCrate)?.(event),
        });
    }
    registry.registerItemOnLoc(ITEM.addressLabel, LOC.teleportCrate, (event) => {
        if (getQuestStage(event.player, quest) !== STAGE_STARTED) {
            event.services.messaging.sendGameMessage(event.player, "You have no reason to relabel this crate.");
            return;
        }
        if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
        event.services.inventory.snapshotInventory(event.player);
        setQuestStage(event.player, quest, event.services, STAGE_CRATE_MARKED);
        event.services.messaging.sendGameMessage(event.player, "You stick Handelmort's address over the crate's old label.");
    });
}

function registerMansion(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.combinationDoor,
        action: undefined,
        handler: (event) => {
            if ((trapState(event.player) & TRAP_COMBINATION_SOLVED_BIT) !== 0) {
                const nextY = event.player.tileY <= event.tile.y ? event.tile.y + 1 : event.tile.y - 1;
                event.services.movement.teleportPlayer(event.player, event.tile.x, nextY, event.level);
                return;
            }
            startConversation({ player: event.player, services: event.services, npcId: -1, npcName: "Combination lock" }, [
                sayPlayer("The lock requires a four-letter name."),
                choose([
                    option("Enter KURT.", [
                        run(({ player, services }) => {
                            setTrapBit(player, services, TRAP_COMBINATION_SOLVED_BIT);
                            services.messaging.sendGameMessage(player, "The security door clicks open.");
                        }),
                    ]),
                    option("Enter BRAD.", [sayPlayer("Nothing happens.")]),
                    option("Enter HANS.", [sayPlayer("Nothing happens.")]),
                ]),
            ]);
        },
    });
    registry.registerLocScript({
        locId: LOC.mansionDoor,
        action: undefined,
        handler: (event) => {
            if (event.player.tileX > event.tile.x) {
                event.services.movement.teleportPlayer(event.player, event.tile.x - 1, event.tile.y, event.level);
                return;
            }
            event.services.messaging.sendGameMessage(event.player, "The front door is securely locked from the inside.");
        },
    });
    registry.registerLocScript({
        locId: LOC.combinationDoor,
        action: "open",
        handler: (event) => registry.findLocInteraction(LOC.combinationDoor)?.(event),
    });
    registry.registerLocScript({
        locId: LOC.mansionDoor,
        action: "open",
        handler: (event) => registry.findLocInteraction(LOC.mansionDoor)?.(event),
    });

    registry.registerLocScript({
        locId: LOC.trapStairs,
        action: "investigate",
        handler: (event) => {
            if (event.services.skills.getSkill(event.player, SkillId.Thieving).baseLevel < 21) {
                event.services.messaging.sendGameMessage(event.player, "You need level 21 Thieving to understand this trap.");
                return;
            }
            setTrapBit(event.player, event.services, STAIRS_DISABLED_BIT);
            event.services.messaging.sendGameMessage(event.player, "You find and disable a pressure switch beneath the stairs.");
        },
    });
    registry.registerLocScript({
        locId: LOC.trapStairs,
        action: "climb-up",
        handler: (event) => {
            if ((trapState(event.player) & STAIRS_DISABLED_BIT) !== 0) {
                event.services.movement.teleportPlayer(event.player, TILE.stairsTop.x, TILE.stairsTop.y, TILE.stairsTop.level);
                return;
            }
            const hitpoints = event.services.skills.getSkill(event.player, SkillId.Hitpoints);
            const damage = Math.max(1, Math.floor(hitpoints.baseLevel * 0.2) + 1);
            event.services.combat.applyPlayerHitsplat(
                event.player,
                0,
                damage,
                event.services.system.getCurrentTick(),
            );
            event.services.movement.teleportPlayer(event.player, TILE.trapFall.x, TILE.trapFall.y, TILE.trapFall.level);
            event.services.messaging.sendGameMessage(event.player, "The stairs collapse and drop you into the basement!");
        },
    });

    const searchChest = (event: LocInteractionEvent): void => {
        if (getQuestStage(event.player, quest) !== STAGE_TELEPORTED) {
            event.services.messaging.sendGameMessage(event.player, "The chest is empty.");
            return;
        }
        if (hasOwned(event.player, event.services, ITEM.tribalTotem)) {
            event.services.messaging.sendGameMessage(event.player, "You have already taken the tribal totem.");
            return;
        }
        if (!giveItem(event.player, event.services, ITEM.tribalTotem)) return;
        event.services.location.replaceTemporaryLoc(
            { worldViewId: event.player.worldViewId, ownerPlayerId: event.player.id },
            LOC.closedChest,
            LOC.openChest,
            event.tile,
            event.level,
            { lifetimeTicks: 5 },
        );
        event.services.messaging.sendGameMessage(event.player, "You open the chest and take the Rantuki tribal totem.");
    };
    registry.registerLocScript({ locId: LOC.closedChest, action: undefined, handler: searchChest });
    registry.registerLocScript({ locId: LOC.openChest, action: undefined, handler: searchChest });
    registry.registerLocScript({ locId: LOC.closedChest, action: "open", handler: searchChest });
    registry.registerLocScript({ locId: LOC.openChest, action: "search", handler: searchChest });
}

export function registerTribalTotemInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registry.registerNpcScript({
        npcId: NPC.kangaiMau,
        option: "talk-to",
        handler: createKangaiHandler(quest),
    });
    registry.registerNpcScript({
        npcId: NPC.gpdtEmployee,
        option: "talk-to",
        handler: createEmployeeHandler(quest),
    });
    registry.registerNpcScript({
        npcId: NPC.horacio,
        option: "talk-to",
        handler: createHoracioHandler(quest),
    });
    for (const npcId of NPC.wizardCromperty) {
        registry.registerNpcScript({
            npcId,
            option: "teleport",
            handler: ({ player, services }) => {
                const stage = getQuestStage(player, quest);
                if (stage < STAGE_CRATE_DELIVERED || stage >= STAGE_COMPLETE) {
                    services.messaging.sendGameMessage(player, "Cromperty cannot teleport you there yet.");
                    return;
                }
                if (stage === STAGE_CRATE_DELIVERED) {
                    setQuestStage(player, quest, services, STAGE_TELEPORTED);
                }
                services.movement.teleportPlayer(
                    player,
                    TILE.mansionTeleport.x,
                    TILE.mansionTeleport.y,
                    TILE.mansionTeleport.level,
                );
                services.messaging.sendGameMessage(player, "Cromperty teleports you into Handelmort Mansion.");
            },
        });
    }
    registry.registerItemAction(ITEM.guideBook, ({ player, services }) => {
        services.messaging.sendGameMessage(
            player,
            "The guide lists the owner as Lord Francis Kurt Handelmort. His middle name is Kurt.",
        );
    }, "read");
    registerCrates(quest, registry);
    registerMansion(quest, registry);
}
