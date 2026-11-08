import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import {
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcInteractionEvent,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    countCarriedItem,
    getQuestStage,
    meetsQuestRequirements,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BOUGHT_FEATHERS_BIT,
    BOUGHT_TOOLS_BIT,
    BUGS_FLAVOUR_SHIFT,
    CHOMPY_HAT_REWARDS,
    FYCIE_FLAVOUR_SHIFT,
    ITEM,
    LOC,
    MADE_ARROWS_BIT,
    NPC,
    QUEST_HUNT_ZONE,
    RANTZ_ONION_BIT,
    STAGE_CHOMPY_COOKED,
    STAGE_CHOMPY_SPAWNED,
    STAGE_COMPLETE,
    STAGE_DROPPED_TOAD,
    STAGE_GIVEN_ARROWS,
    STAGE_GIVEN_BOW,
    STAGE_KIDS_EXPLAINED_TOADS,
    STAGE_KILLED_CHOMPY,
    STAGE_OPENED_CHEST,
    STAGE_RANTZ_MISSED,
    STAGE_SHOWN_TOAD,
    STAGE_STARTED,
    STAGE_TOLD_TO_COOK,
    TILE,
    VARP_CHOMPY_KILLS,
} from "./constants";

function context(event: NpcInteractionEvent, npcName: string) {
    return { player: event.player, services: event.services, npcId: event.npc.typeId, npcName };
}

function has(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    return countCarriedItem(player, services, itemId) >= quantity;
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function give(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function take(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    return takeQuestItems(player, services, [{ itemId, quantity, journalLabel: "" }]);
}

function replace(player: PlayerState, services: ScriptServices, oldId: number, newId: number, quantity = 1): boolean {
    if (!take(player, services, oldId, quantity)) return false;
    return give(player, services, newId, quantity);
}

function setAux(player: PlayerState, services: ScriptServices, value: number): void {
    player.varps.setVarpValue(VARP_CHOMPY_KILLS, value);
    services.variables.sendVarp(player, VARP_CHOMPY_KILLS, value);
}

function setRange(value: number, shift: number, rangeValue: number): number {
    return (value & ~(3 << shift)) | ((rangeValue & 3) << shift);
}

function getRange(value: number, shift: number): number {
    return (value >>> shift) & 3;
}

function spawnChompy(player: PlayerState, services: ScriptServices): void {
    if (services.npc.findNearbyNpc(player, NPC.livingChompy, 24)) return;
    services.npc.spawnNpc({
        id: NPC.livingChompy,
        x: player.tileX + 2,
        y: player.tileY,
        level: player.level,
        worldViewId: player.worldViewId,
        ownerPlayerId: player.id,
        lifetimeTicks: 100,
    });
}

function createRantzHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = context(event, "Rantz");
        if (stage === 0) {
            if (!meetsQuestRequirements(event.player, event.services, quest)) {
                startConversation(ctx, [sayNpc("You's too weedy. Come back with 5 Fletching and 30 Ranged and Cooking.")]);
                return;
            }
            startConversation(ctx, [
                sayNpc("Hey creature! Rantz needs da stabbers to hunt da chompy."),
                sayNpc("Make sticksies from an achey tree, stabbies from wolf bones, and add flufsies."),
                choose([
                    option("I'll make your stabbers.", [run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED))]),
                    option("No thanks."),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_STARTED) {
            if (!has(event.player, event.services, ITEM.ogreArrow, 6)) {
                startConversation(ctx, [sayNpc("Bring more than fingers on hand: six ogre arrows you made yourself.")]);
                return;
            }
            if (!(event.player.varps.getVarpValue(VARP_CHOMPY_KILLS) & MADE_ARROWS_BIT)) {
                startConversation(ctx, [sayNpc("Dese stabbers no good! You's must make dem yourself.")]);
                return;
            }
            startConversation(ctx, [
                sayPlayer("Here are six ogre arrows."),
                sayNpc("Goodly! Now get a fatsy toady. Chompys love da toadies full of swamp gas."),
                run(({ player, services }) => {
                    if (!take(player, services, ITEM.ogreArrow, 6)) return;
                    setQuestStage(player, quest, services, STAGE_GIVEN_ARROWS);
                }),
            ]);
            return;
        }
        if (stage === STAGE_GIVEN_ARROWS) {
            startConversation(ctx, [
                sayNpc("Fycie and Bugs use da blower on toadies. The blower is in our cave chest."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_KIDS_EXPLAINED_TOADS)),
            ]);
            return;
        }
        if (stage >= STAGE_KIDS_EXPLAINED_TOADS && stage < STAGE_SHOWN_TOAD) {
            if (!has(event.player, event.services, ITEM.bloatedToad)) {
                startConversation(ctx, [sayNpc("Get da ogre bellows, fill it at swamp bubbles, and blow up a toady.")]);
                return;
            }
            startConversation(ctx, [
                showItem(ITEM.bloatedToad, "You show Rantz the bloated toad."),
                sayNpc("Dat's a good fatsy toady. Put it in da clearing just south of here."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SHOWN_TOAD)),
            ]);
            return;
        }
        if (stage === STAGE_DROPPED_TOAD || stage === STAGE_CHOMPY_SPAWNED) {
            if (stage === STAGE_DROPPED_TOAD) {
                spawnChompy(event.player, event.services);
                setQuestStage(event.player, quest, event.services, STAGE_CHOMPY_SPAWNED);
            }
            startConversation(ctx, [
                sayNpc("Dere's da chompy! Rantz keeps missing because your stabbers fly worserer than a dead dog."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_RANTZ_MISSED)),
            ]);
            return;
        }
        if (stage === STAGE_RANTZ_MISSED) {
            startConversation(ctx, [
                sayPlayer("Let me have a go."),
                sayNpc("Oh, okay. Rantz lend you other stabbie chucker."),
                run(({ player, services }) => {
                    if (!owns(player, services, ITEM.ogreBow) && !give(player, services, ITEM.ogreBow)) return;
                    if (!has(player, services, ITEM.ogreArrow)) give(player, services, ITEM.ogreArrow, 6);
                    setQuestStage(player, quest, services, STAGE_GIVEN_BOW);
                    spawnChompy(player, services);
                }),
                showItem(ITEM.ogreBow, "Rantz lends you a huge ogre bow."),
            ]);
            return;
        }
        if (stage === STAGE_GIVEN_BOW) {
            spawnChompy(event.player, event.services);
            startConversation(ctx, [sayNpc("Shoot da chompy with da ogre bow!")]);
            return;
        }
        if (stage === STAGE_KILLED_CHOMPY) {
            if (!has(event.player, event.services, ITEM.rawChompy)) {
                startConversation(ctx, [sayNpc("Pluck da chompy and bring its yumms here.")]);
                return;
            }
            const aux = event.player.varps.getVarpValue(VARP_CHOMPY_KILLS);
            startConversation(ctx, [
                showItem(ITEM.rawChompy, "You show Rantz the freshly plucked chompy."),
                sayNpc(aux & RANTZ_ONION_BIT ? "Cook it with onion. Ask Bugs and Fycie what dey wants." : "Cook it with potato. Ask Bugs and Fycie what dey wants."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_TOLD_TO_COOK)),
            ]);
            return;
        }
        if (stage === STAGE_TOLD_TO_COOK) {
            startConversation(ctx, [sayNpc("Cook da chompy on my spit, with everybody's flavours.")]);
            return;
        }
        if (stage === STAGE_CHOMPY_COOKED) {
            if (!has(event.player, event.services, ITEM.seasonedChompy)) {
                startConversation(ctx, [sayNpc("Where is da seasoned chompy?")]);
                return;
            }
            startConversation(ctx, [
                sayPlayer("Here is your seasoned chompy."),
                sayNpc("Scrumbly! Fycie and Bugs likes da chompy yumms!"),
                run(({ player, services }) => {
                    if (!take(player, services, ITEM.seasonedChompy)) return;
                    if (completeQuest(player, services, quest)) setAux(player, services, 0);
                }),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            const kills = event.player.varps.getVarpValue(VARP_CHOMPY_KILLS);
            const available = CHOMPY_HAT_REWARDS.filter((hat) => kills >= hat.kills && !owns(event.player, event.services, hat.itemId));
            startConversation(ctx, available.length === 0 ? [sayNpc(`You's scratched up ${kills} chompy kills. No new hatsies yet.`)] : [
                sayNpc(`You's scratched up ${kills} kills. Rantz has hatsies for you!`),
                run(({ player, services }) => {
                    for (const hat of available) {
                        if (!give(player, services, hat.itemId)) break;
                        services.messaging.sendGameMessage(player, `Rantz awards you the ${hat.title} hat.`);
                    }
                }),
            ]);
        }
    };
}

function createChildHandler(quest: QuestDefinition, child: "Bugs" | "Fycie") {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = context(event, child);
        let aux = event.player.varps.getVarpValue(VARP_CHOMPY_KILLS);
        if (stage === STAGE_STARTED && child === "Bugs" && !(aux & BOUGHT_TOOLS_BIT)) {
            startConversation(ctx, [
                sayNpc("Bugs sell creature a knife and chisel for ten bright pretties."),
                choose([
                    option("Pay 10 coins.", [run(({ player, services }) => {
                        if (!take(player, services, ITEM.coins, 10)) {
                            services.messaging.sendGameMessage(player, "You need 10 coins.");
                            return;
                        }
                        if (!owns(player, services, ITEM.knife)) give(player, services, ITEM.knife);
                        if (!owns(player, services, ITEM.chisel)) give(player, services, ITEM.chisel);
                        setAux(player, services, player.varps.getVarpValue(VARP_CHOMPY_KILLS) | BOUGHT_TOOLS_BIT);
                    })]),
                    option("No thanks."),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_STARTED && child === "Fycie" && !(aux & BOUGHT_FEATHERS_BIT)) {
            startConversation(ctx, [
                sayNpc("Fycie sell creature 25 flufsies for 50 bright pretties."),
                choose([
                    option("Pay 50 coins.", [run(({ player, services }) => {
                        if (!take(player, services, ITEM.coins, 50)) {
                            services.messaging.sendGameMessage(player, "You need 50 coins.");
                            return;
                        }
                        if (!give(player, services, ITEM.feather, 25)) return;
                        setAux(player, services, player.varps.getVarpValue(VARP_CHOMPY_KILLS) | BOUGHT_FEATHERS_BIT);
                    })]),
                    option("No thanks."),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_TOLD_TO_COOK) {
            const shift = child === "Bugs" ? BUGS_FLAVOUR_SHIFT : FYCIE_FLAVOUR_SHIFT;
            let flavour = getRange(aux, shift);
            if (!flavour) {
                flavour = (event.player.id + shift) % 2 === 0 ? 1 : 2;
                aux = setRange(aux, shift, flavour);
                setAux(event.player, event.services, aux);
            }
            const requested = child === "Bugs" ? (flavour === 1 ? "equa leaves" : "cabbage") : (flavour === 1 ? "tomato" : "doogle leaves");
            startConversation(ctx, [sayNpc(`Me's wants ${requested} wiv my chompy!`)]);
            return;
        }
        startConversation(ctx, [sayNpc(stage >= STAGE_COMPLETE ? "Thanks for da deloverly chompy!" : "You's better talk to Dad.")]);
    };
}

function registerCrafting(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerItemOnItem(ITEM.knife, ITEM.acheyLogs, ({ player, services }) => {
        if (getQuestStage(player, quest) < STAGE_STARTED) return;
        if (services.skills.getSkill(player, SkillId.Fletching).baseLevel < 5) return;
        if (!take(player, services, ITEM.acheyLogs)) return;
        give(player, services, ITEM.ogreArrowShaft, 6);
        services.skills.addSkillXp(player, SkillId.Fletching, 10.8);
        services.messaging.sendGameMessage(player, "You carefully cut the achey logs into six ogre arrow shafts.");
    });
    registry.registerItemOnItem(ITEM.chisel, ITEM.wolfBones, ({ player, services }) => {
        if (getQuestStage(player, quest) < STAGE_STARTED) return;
        if (!take(player, services, ITEM.wolfBones)) return;
        give(player, services, ITEM.wolfboneArrowtips, 6);
        services.skills.addSkillXp(player, SkillId.Fletching, 15);
        services.skills.addSkillXp(player, SkillId.Crafting, 15);
        services.messaging.sendGameMessage(player, "You chisel six wolfbone arrowtips.");
    });
    registry.registerItemOnItem(ITEM.feather, ITEM.ogreArrowShaft, ({ player, services }) => {
        if (getQuestStage(player, quest) < STAGE_STARTED) return;
        const amount = Math.min(countCarriedItem(player, services, ITEM.ogreArrowShaft), Math.floor(countCarriedItem(player, services, ITEM.feather) / 4), 6);
        if (amount < 1 || !take(player, services, ITEM.feather, amount * 4) || !take(player, services, ITEM.ogreArrowShaft, amount)) return;
        give(player, services, ITEM.flightedOgreArrow, amount);
        services.skills.addSkillXp(player, SkillId.Fletching, amount * 1.5);
    });
    registry.registerItemOnItem(ITEM.wolfboneArrowtips, ITEM.flightedOgreArrow, ({ player, services }) => {
        if (getQuestStage(player, quest) < STAGE_STARTED) return;
        const amount = Math.min(countCarriedItem(player, services, ITEM.wolfboneArrowtips), countCarriedItem(player, services, ITEM.flightedOgreArrow), 6);
        if (amount < 1 || !take(player, services, ITEM.wolfboneArrowtips, amount) || !take(player, services, ITEM.flightedOgreArrow, amount)) return;
        give(player, services, ITEM.ogreArrow, amount);
        setAux(player, services, player.varps.getVarpValue(VARP_CHOMPY_KILLS) | MADE_ARROWS_BIT);
        services.skills.addSkillXp(player, SkillId.Fletching, amount);
        services.messaging.sendGameMessage(player, `You make ${amount} ogre arrow${amount === 1 ? "" : "s"}.`);
    });
}

function registerBellowsAndHunt(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const locId of LOC.swampBubbles) {
        for (const bellows of [ITEM.ogreBellows, ITEM.ogreBellows1, ITEM.ogreBellows2]) {
            registry.registerItemOnLoc(bellows, locId, ({ player, services }) => {
                if (!replace(player, services, bellows, ITEM.ogreBellows3)) return;
                services.messaging.sendGameMessage(player, "You fill the ogre bellows with thick swamp gas.");
            });
        }
    }
    for (const [bellows, next] of [[ITEM.ogreBellows3, ITEM.ogreBellows2], [ITEM.ogreBellows2, ITEM.ogreBellows1], [ITEM.ogreBellows1, ITEM.ogreBellows]] as const) {
        registry.registerItemOnNpc(bellows, NPC.swampToad, ({ player, services, target: npc }) => {
            if (countCarriedItem(player, services, ITEM.bloatedToad) >= 3) {
                services.messaging.sendGameMessage(player, "You cannot hold more than three bloated toads.");
                return;
            }
            if (!replace(player, services, bellows, next)) return;
            if (!give(player, services, ITEM.bloatedToad)) return;
            services.npc.removeNpc(npc.id);
            services.messaging.sendGameMessage(player, "You catch the toad and inflate it with swamp gas.");
        });
    }
    registry.registerItemAction(ITEM.bloatedToad, ({ player, services }) => {
        const stage = getQuestStage(player, quest);
        if (stage < STAGE_SHOWN_TOAD) {
            services.messaging.sendGameMessage(player, "You should ask Rantz where to place this toad.");
            return;
        }
        const inside = player.tileX >= QUEST_HUNT_ZONE.minX && player.tileX <= QUEST_HUNT_ZONE.maxX && player.tileY >= QUEST_HUNT_ZONE.minY && player.tileY <= QUEST_HUNT_ZONE.maxY;
        if (stage < STAGE_COMPLETE && !inside) {
            services.messaging.sendGameMessage(player, "This is too far away for Rantz to shoot the chompy bird.");
            return;
        }
        if (!take(player, services, ITEM.bloatedToad)) return;
        if (stage === STAGE_SHOWN_TOAD) setQuestStage(player, quest, services, STAGE_DROPPED_TOAD);
        spawnChompy(player, services);
        if (getQuestStage(player, quest) < STAGE_GIVEN_BOW) setQuestStage(player, quest, services, STAGE_CHOMPY_SPAWNED);
        services.messaging.sendGameMessage(player, "You carefully place the bloated toad bait. A chompy swoops down!");
    }, "release");
}

function registerCooking(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerItemOnLoc(ITEM.rawChompy, LOC.spitRoastEmpty, ({ player, services }) => {
        const stage = getQuestStage(player, quest);
        if (stage < STAGE_TOLD_TO_COOK) {
            services.messaging.sendGameMessage(player, "You should show the raw chompy to Rantz first.");
            return;
        }
        const aux = player.varps.getVarpValue(VARP_CHOMPY_KILLS);
        const bugs = getRange(aux, BUGS_FLAVOUR_SHIFT);
        const fycie = getRange(aux, FYCIE_FLAVOUR_SHIFT);
        if (!bugs || !fycie) {
            services.messaging.sendGameMessage(player, "Ask both Bugs and Fycie which flavours they want.");
            return;
        }
        const ingredients = [aux & RANTZ_ONION_BIT ? ITEM.onion : ITEM.potato, bugs === 1 ? ITEM.equaLeaves : ITEM.cabbage, fycie === 1 ? ITEM.tomato : ITEM.doogleLeaves];
        if (ingredients.some((itemId) => !has(player, services, itemId))) {
            services.messaging.sendGameMessage(player, "You do not have all three requested seasonings.");
            return;
        }
        if (!take(player, services, ITEM.rawChompy)) return;
        for (const itemId of ingredients) take(player, services, itemId);
        if (!give(player, services, ITEM.seasonedChompy)) return;
        services.skills.addSkillXp(player, SkillId.Cooking, 14.2);
        setQuestStage(player, quest, services, STAGE_CHOMPY_COOKED);
        services.messaging.sendGameMessage(player, "You add all three ingredients and cook a seasoned chompy.");
    });
}

function registerWorld(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({ locId: LOC.chestClosed, action: "open", handler: ({ player, services }) => {
        if (getQuestStage(player, quest) < STAGE_KIDS_EXPLAINED_TOADS) {
            services.messaging.sendGameMessage(player, "Perhaps you should ask permission before opening this.");
            return;
        }
        if (services.skills.getSkill(player, SkillId.Strength).baseLevel < 30) {
            services.messaging.sendGameMessage(player, "You need level 30 Strength to lift the huge rock.");
            return;
        }
        if (getQuestStage(player, quest) === STAGE_KIDS_EXPLAINED_TOADS) setQuestStage(player, quest, services, STAGE_OPENED_CHEST);
        if (!owns(player, services, ITEM.ogreBellows)) give(player, services, ITEM.ogreBellows);
        services.messaging.sendGameMessage(player, "You lift the rock and find a pair of ogre bellows in the chest.");
    }});
    registry.registerLocScript({ locId: LOC.chestClosed, action: undefined, handler: registry.findLocInteraction(LOC.chestClosed, "open")! });
    registry.registerLocScript({ locId: LOC.chestOpen, action: "search", handler: ({ player, services }) => {
        if (!owns(player, services, ITEM.ogreBellows)) give(player, services, ITEM.ogreBellows);
        else services.messaging.sendGameMessage(player, "You search but find nothing else in the ogre chest.");
    }});
    registry.registerLocScript({ locId: LOC.caveEntrance, action: "enter", handler: ({ player, services }) => services.movement.teleportPlayer(player, TILE.caveInside.x, TILE.caveInside.y, TILE.caveInside.level) });
    for (const locId of LOC.caveExits) registry.registerLocScript({ locId, action: undefined, handler: ({ player, services }) => services.movement.teleportPlayer(player, TILE.caveOutside.x, TILE.caveOutside.y, TILE.caveOutside.level) });
}

function registerChompyCombat(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerNpcPreDeath(NPC.livingChompy, (event) => {
        const player = event.killer;
        if (!player || event.npc.ownerPlayerId !== player.id) return NpcPreDeathDecision.Prevent;
        if (event.services.equipment.getEquippedItem(player, EquipmentSlot.WEAPON) !== ITEM.ogreBow) {
            event.services.messaging.sendGameMessage(player, "Only an ogre bow is powerful enough to hunt this chompy.");
            return NpcPreDeathDecision.Prevent;
        }
        const stage = getQuestStage(player, quest);
        event.services.npc.spawnNpc({ id: NPC.deadChompy, x: event.npc.tileX, y: event.npc.tileY, level: event.npc.level, worldViewId: player.worldViewId, ownerPlayerId: player.id, lifetimeTicks: 100 });
        if (stage === STAGE_GIVEN_BOW) setQuestStage(player, quest, event.services, STAGE_KILLED_CHOMPY);
        else if (stage >= STAGE_COMPLETE) {
            const kills = player.varps.getVarpValue(VARP_CHOMPY_KILLS) + 1;
            setAux(player, event.services, kills);
            event.services.messaging.sendGameMessage(player, "You scratch another notch onto your ogre bow.");
            if (kills === 4_000) event.services.skills.addSkillXp(player, SkillId.Ranged, 30_000);
        }
        return NpcPreDeathDecision.Allow;
    });
    const pluck = (event: NpcInteractionEvent): void => {
        if (event.npc.ownerPlayerId !== event.player.id) return;
        if (!give(event.player, event.services, ITEM.rawChompy)) return;
        give(event.player, event.services, ITEM.feather, 10);
        event.services.npc.removeNpc(event.npc.id);
        event.services.messaging.sendGameMessage(event.player, "You pluck the chompy and take its meat and feathers.");
    };
    registry.registerNpcScript({ npcId: NPC.deadChompy, option: "pluck", handler: pluck });
    registry.registerNpcScript({ npcId: NPC.deadChompy, option: undefined, handler: pluck });
}

export function registerBigChompyBirdHuntingInteractions(quest: QuestDefinition, registry: IScriptRegistry, _services: ScriptServices): void {
    const rantz = createRantzHandler(quest);
    for (const npcId of NPC.rantz) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: rantz });
        registry.registerNpcScript({ npcId, option: undefined, handler: rantz });
        for (const itemId of [ITEM.ogreArrow, ITEM.bloatedToad, ITEM.rawChompy, ITEM.seasonedChompy]) {
            registry.registerItemOnNpc(itemId, npcId, (event) => rantz({ ...event, npc: event.target }));
        }
    }
    const bugs = createChildHandler(quest, "Bugs");
    const fycie = createChildHandler(quest, "Fycie");
    registry.registerNpcScript({ npcId: NPC.bugs, option: "talk-to", handler: bugs });
    registry.registerNpcScript({ npcId: NPC.bugs, option: undefined, handler: bugs });
    registry.registerNpcScript({ npcId: NPC.fycie, option: "talk-to", handler: fycie });
    registry.registerNpcScript({ npcId: NPC.fycie, option: undefined, handler: fycie });
    registerCrafting(quest, registry);
    registerBellowsAndHunt(quest, registry);
    registerCooking(quest, registry);
    registerWorld(quest, registry);
    registerChompyCombat(quest, registry);
    registry.registerItemAction(ITEM.ogreBow, ({ player, services }) => services.messaging.sendGameMessage(player, `You've scratched up ${player.varps.getVarpValue(VARP_CHOMPY_KILLS)} chompy bird kills.`), "check-kills");
}
