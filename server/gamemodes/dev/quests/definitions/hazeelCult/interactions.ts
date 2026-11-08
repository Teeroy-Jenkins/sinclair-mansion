import type { PlayerState } from "../../../../../src/game/player";
import {
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcInteractionEvent,
    type NpcPreDeathEvent,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    CULT_ZONE,
    ITEM,
    LOC,
    MANSION_ZONE,
    NPC,
    SIDE_CARNILLEAN,
    SIDE_HAZEEL,
    STAGE_CHOSEN_SIDE,
    STAGE_COMPLETE,
    STAGE_FINISHED_SIDE_TASK,
    STAGE_NOT_STARTED,
    STAGE_POISONED_FOOD,
    STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL,
    STAGE_SPOKEN_TO_CLIVET,
    STAGE_STARTED,
    TILE,
    VARP_HAZEEL_SIDE,
    VARP_HAZEEL_VALVES,
} from "./constants";

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function side(player: PlayerState): number {
    return player.varps.getVarpValue(VARP_HAZEEL_SIDE);
}

function setSide(player: PlayerState, services: ScriptServices, value: number): void {
    player.varps.setVarpValue(VARP_HAZEEL_SIDE, value);
    services.variables.sendVarp(player, VARP_HAZEEL_SIDE, value);
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function hasInventoryItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return countCarriedItem(player, services, itemId) > 0;
}

function removeItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    if (countCarriedItem(player, services, itemId) < quantity) return false;
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const amount = Math.min(remaining, entry.quantity);
        const left = entry.quantity - amount;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= amount;
        if (remaining === 0) break;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function giveItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    if (!hasInventoryItem(player, services, itemId) && !services.inventory.hasInventorySlot(player)) {
        services.messaging.sendGameMessage(player, "You need a free inventory space.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function givePoison(player: PlayerState, services: ScriptServices): void {
    if (owns(player, services, ITEM.poison)) return;
    if (giveItem(player, services, ITEM.poison)) {
        services.messaging.sendGameMessage(player, "Clivet gives you a bottle of poison.");
    }
}

function createCerilHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context(event, "Ceril Carnillean"), [
                sayNpc("Blooming, thieving cultists! Why don't they leave me alone?"),
                choose([
                    option("What's wrong?", [
                        sayPlayer("What's wrong?"),
                        sayNpc("Cultists from the south stole our family armour. Their cave is near the Clock Tower."),
                        sayNpc("If you return it, I will provide you with a modest cash reward."),
                        choose([
                            option("Yes, I'll help.", [
                                sayPlayer("Yes, of course. I'll help."),
                                sayNpc("Very noble! Find the cave south of the city and recover my armour."),
                                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED)),
                            ]),
                            option("No thanks.", [sayNpc("Then stop wasting a nobleman's time.")]),
                        ]),
                    ]),
                    option("You probably deserve it.", [sayNpc("Who are you to judge me, peasant?")]),
                ]),
            ]);
            return;
        }

        if (side(event.player) === SIDE_CARNILLEAN && stage === STAGE_FINISHED_SIDE_TASK) {
            if (!hasInventoryItem(event.player, event.services, ITEM.carnilleanArmour)) {
                startConversation(context(event, "Ceril Carnillean"), [sayNpc("You haven't recovered my armour yet.")]);
                return;
            }
            startConversation(context(event, "Ceril Carnillean"), [
                sayPlayer("Look! I've recovered your armour."),
                sayNpc("Well done! Come on, hand it over."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.carnilleanArmour)) return;
                    giveItem(player, services, ITEM.coins, 5);
                    setQuestStage(player, quest, services, STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL);
                    services.messaging.sendGameMessage(player, "Ceril pays you only 5 coins after believing Butler Jones's denial.");
                    services.messaging.sendGameMessage(player, "You need evidence of Jones's treachery.");
                }),
            ]);
            return;
        }

        if (side(event.player) === SIDE_CARNILLEAN && stage === STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL) {
            startConversation(context(event, "Ceril Carnillean"), [
                sayNpc("Don't darken my doorstep again unless you have proof against Jones!"),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context(event, "Ceril Carnillean"), [
                sayNpc(
                    side(event.player) === SIDE_CARNILLEAN
                        ? "It is good to see you. My family is in your debt."
                        : "Something terrible has happened to poor Scruffy. Leave me to grieve.",
                ),
            ]);
            return;
        }
        startConversation(context(event, "Ceril Carnillean"), [
            sayNpc("Shouldn't you be investigating the cult's cave near the Clock Tower?"),
        ]);
    };
}

function createClivetHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_STARTED) {
            startConversation(context(event, "Clivet"), [sayNpc("You have no business here. Leave.")]);
            return;
        }
        if (stage === STAGE_STARTED) {
            startConversation(context(event, "Clivet"), [
                sayNpc("The Carnilleans stole this mansion from Lord Hazeel after a bloody rebellion."),
                sayNpc("Hazeel survived, and his faithful followers are preparing his return."),
                sayNpc("Come back when you have decided whose cause you truly support."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_TO_CLIVET)),
            ]);
            return;
        }
        if (stage === STAGE_SPOKEN_TO_CLIVET) {
            startConversation(context(event, "Clivet"), [
                sayNpc("Will you help us restore Lord Hazeel, or remain Ceril's pawn?"),
                choose([
                    option("I'll help you.", [
                        sayPlayer("I'll help the cult."),
                        sayNpc("Prove your loyalty. Pour this poison into the Carnilleans' food."),
                        run(({ player, services }) => {
                            setSide(player, services, SIDE_HAZEEL);
                            setQuestStage(player, quest, services, STAGE_CHOSEN_SIDE);
                            givePoison(player, services);
                        }),
                    ]),
                    option("I will stop you.", [
                        sayPlayer("I won't help you resurrect Hazeel."),
                        sayNpc("Then you have made a grave mistake. Alomone will deal with you."),
                        run(({ player, services }) => {
                            setSide(player, services, SIDE_CARNILLEAN);
                            setQuestStage(player, quest, services, STAGE_CHOSEN_SIDE);
                        }),
                    ]),
                ]),
            ]);
            return;
        }
        if (side(event.player) === SIDE_CARNILLEAN) {
            startConversation(context(event, "Clivet"), [sayNpc("Leave this place before we are forced to make you!")]);
            return;
        }
        if (stage === STAGE_CHOSEN_SIDE) {
            givePoison(event.player, event.services);
            startConversation(context(event, "Clivet"), [sayNpc("Pour the poison into the range beneath the mansion.")]);
            return;
        }
        if (stage === STAGE_POISONED_FOOD) {
            if (!owns(event.player, event.services, ITEM.hazeelsMark)) {
                giveItem(event.player, event.services, ITEM.hazeelsMark);
            }
            startConversation(context(event, "Clivet"), [
                sayNpc("You have proven your loyalty. Follow the mark's valve pattern and take the raft to Alomone."),
            ]);
            return;
        }
        if (stage < STAGE_COMPLETE) {
            startConversation(context(event, "Clivet"), [sayNpc("Take the raft to Alomone and finish Lord Hazeel's restoration.")]);
            return;
        }
        startConversation(context(event, "Clivet"), [sayNpc("Lord Hazeel has returned. Glory to Zamorak!")]);
    };
}

function createAlomoneHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage >= STAGE_CHOSEN_SIDE && side(event.player) === SIDE_CARNILLEAN && stage < STAGE_FINISHED_SIDE_TASK) {
            startConversation(context(event, "Alomone"), [
                sayNpc("You will not recover the Carnillean armour. Die!"),
                run(() => event.npc.engageCombat(event.player.id, event.tick, {
                    tileX: event.player.tileX,
                    tileY: event.player.tileY,
                })),
            ]);
            return;
        }
        if (side(event.player) !== SIDE_HAZEEL) {
            startConversation(context(event, "Alomone"), [sayNpc("You have no place in our sanctuary.")]);
            return;
        }
        if (stage === STAGE_POISONED_FOOD) {
            startConversation(context(event, "Alomone"), [
                sayNpc("You have proven yourself. We require the scroll hidden in the Carnillean Mansion."),
                sayNpc("Search the kitchen crates for a key, then find the secret wall upstairs."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_FINISHED_SIDE_TASK)),
            ]);
            return;
        }
        if (stage === STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL) {
            if (!hasInventoryItem(event.player, event.services, ITEM.hazeelScroll)) {
                startConversation(context(event, "Alomone"), [sayNpc("Return with the Hazeel scroll.")]);
                return;
            }
            startConversation(context(event, "Alomone"), [
                sayPlayer("I have the scroll."),
                sayNpc("At last! Rise, Lord Hazeel, and take your rightful place!"),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.hazeelScroll)) return;
                    services.npc.spawnNpc({
                        id: NPC.hazeel,
                        x: TILE.hazeel.x,
                        y: TILE.hazeel.y,
                        level: TILE.hazeel.level,
                        worldViewId: player.worldViewId,
                        ownerPlayerId: player.id,
                        lifetimeTicks: 200,
                    });
                    services.messaging.sendGameMessage(player, "A dark shape rises from the coffin. Hazeel has returned.");
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context(event, "Alomone"), [sayNpc("Lord Hazeel walks among us once more.")]);
            return;
        }
        startConversation(context(event, "Alomone"), [sayNpc("Speak to Clivet before coming here.")]);
    };
}

function registerNpcDialogues(quest: QuestDefinition, registry: IScriptRegistry): void {
    const ceril = createCerilHandler(quest);
    for (const npcId of [NPC.legacyCeril, NPC.ceril]) registry.registerNpcScript({ npcId, option: "talk-to", handler: ceril });
    const clivet = createClivetHandler(quest);
    for (const npcId of [NPC.legacyClivet, NPC.clivet]) registry.registerNpcScript({ npcId, option: "talk-to", handler: clivet });
    const alomone = createAlomoneHandler(quest);
    for (const npcId of [NPC.legacyAlomone, NPC.alomone]) registry.registerNpcScript({ npcId, option: "talk-to", handler: alomone });

    const jones = (event: NpcInteractionEvent): void => {
        const evil = side(event.player) === SIDE_HAZEEL;
        const stage = getQuestStage(event.player, quest);
        startConversation(context(event, "Butler Jones"), [
            sayNpc(
                evil && stage >= STAGE_FINISHED_SIDE_TASK && stage < STAGE_COMPLETE
                    ? owns(event.player, event.services, ITEM.hazeelScroll)
                        ? "Waste no time. Return the scroll to Alomone."
                        : "The scroll is hidden somewhere in this house, beyond a secret wall."
                    : "I am, as always, a loyal servant of the Carnillean family.",
            ),
        ]);
    };
    for (const npcId of [NPC.legacyJones, NPC.jones]) registry.registerNpcScript({ npcId, option: "talk-to", handler: jones });

    registry.registerNpcScript({
        npcId: NPC.claus,
        option: "talk-to",
        handler: (event) => startConversation(context(event, "Claus the Chef"), [sayNpc("Sorry, I cannot stop. This family eats constantly!")]),
    });
    registry.registerNpcScript({
        npcId: NPC.philipe,
        option: "talk-to",
        handler: (event) => startConversation(context(event, "Philipe Carnillean"), [sayNpc("Have you brought me any toys?")]),
    });
    registry.registerNpcScript({
        npcId: NPC.henryeta,
        option: "talk-to",
        handler: (event) => startConversation(context(event, "Henryeta Carnillean"), [sayNpc("Those dreadful cultists have left me terribly worried.")]),
    });
    for (const npcId of [NPC.legacyGuard, NPC.guard]) {
        registry.registerNpcScript({
            npcId,
            option: "talk-to",
            handler: (event) => startConversation(context(event, "Guard"), [sayNpc("I am here to protect the Carnillean household.")]),
        });
    }
    for (const npcId of [NPC.legacyCultist, NPC.cultist]) {
        registry.registerNpcScript({
            npcId,
            option: "talk-to",
            handler: (event) => startConversation(context(event, "Hazeel Cultist"), [sayNpc("Leave now, before someone makes you!")]),
        });
    }
}

function registerAlomoneDeath(quest: QuestDefinition, registry: IScriptRegistry): void {
    const handler = (event: NpcPreDeathEvent) => {
        const player = event.killer;
        if (!player) return NpcPreDeathDecision.Allow;
        const stage = getQuestStage(player, quest);
        if (side(player) !== SIDE_CARNILLEAN || stage < STAGE_CHOSEN_SIDE || stage >= STAGE_FINISHED_SIDE_TASK) {
            return NpcPreDeathDecision.Allow;
        }
        setQuestStage(player, quest, event.services, STAGE_FINISHED_SIDE_TASK);
        event.services.groundItems.spawn(
            ITEM.carnilleanArmour,
            1,
            { x: event.npc.tileX, y: event.npc.tileY, level: event.npc.level },
            { ownerId: player.id, worldViewId: player.worldViewId, privateTicks: 250 },
        );
        event.services.messaging.sendGameMessage(player, "Alomone falls. The Carnillean armour is now unguarded.");
        return NpcPreDeathDecision.Allow;
    };
    registry.registerNpcPreDeath(NPC.legacyAlomone, handler);
    registry.registerNpcPreDeath(NPC.alomone, handler);
}

function setValve(player: PlayerState, services: ScriptServices, index: number): void {
    const before = player.varps.getVarpValue(VARP_HAZEEL_VALVES);
    const value = before ^ (1 << index);
    player.varps.setVarpValue(VARP_HAZEEL_VALVES, value);
    services.variables.sendVarp(player, VARP_HAZEEL_VALVES, value);
    const correct = (value & (1 << index)) !== 0;
    const left = index === 2 ? correct : !correct;
    services.messaging.sendGameMessage(player, `You turn the valve to the ${left ? "left" : "right"}.`);
    services.messaging.sendGameMessage(player, "Beneath your feet you hear the sudden sound of rushing water.");
}

function correctValvePrefix(player: PlayerState): number {
    const value = player.varps.getVarpValue(VARP_HAZEEL_VALVES);
    let count = 0;
    while (count < 5 && (value & (1 << count)) !== 0) count++;
    return count;
}

function registerTravel(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.caveEntrance,
        action: "enter",
        handler: ({ player, services }) => {
            services.messaging.sendGameMessage(player, "You squeeze through the cave entrance.");
            services.movement.teleportPlayer(player, TILE.caveEntrance.x, TILE.caveEntrance.y, TILE.caveEntrance.level);
        },
    });
    registry.registerLocScript({
        locId: LOC.caveStairs,
        action: "climb-up",
        handler: ({ player, services }) => services.movement.teleportPlayer(player, TILE.caveSurface.x, TILE.caveSurface.y, TILE.caveSurface.level),
    });
    LOC.valves.forEach((locId, index) => {
        for (const action of ["turn", "turn-left", "turn-right"] as const) {
            registry.registerLocScript({ locId, action, handler: ({ player, services }) => setValve(player, services, index) });
        }
    });
    registry.registerLocScript({
        locId: LOC.raft,
        action: "board",
        handler: ({ player, services, tile }) => {
            if (tile.x > 2570) {
                services.movement.teleportPlayer(player, TILE.raftEntrance.x, TILE.raftEntrance.y, TILE.raftEntrance.level);
                services.messaging.sendGameMessage(player, "The raft flows back to the cave entrance.");
                return;
            }
            if (getQuestStage(player, quest) < STAGE_CHOSEN_SIDE) {
                services.messaging.sendGameMessage(player, "Clivet stops you from using the raft.");
                return;
            }
            const correct = correctValvePrefix(player);
            if (correct === 0) {
                services.messaging.sendGameMessage(player, "The current is flowing against the raft. It will not move.");
                return;
            }
            if (correct === 5) {
                services.movement.teleportPlayer(player, TILE.hideout.x, TILE.hideout.y, TILE.hideout.level);
                services.messaging.sendGameMessage(player, "The raft carries you past the islands to the end of the sewer passage.");
                return;
            }
            const stop = TILE.raftStops[correct - 1];
            services.movement.teleportPlayer(player, stop.x, stop.y, stop.level);
            services.messaging.sendGameMessage(player, `The raft stops at island ${correct}. The valve combination is incomplete.`);
        },
    });
}

function registerQuestLocs(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerItemOnLoc(ITEM.poison, LOC.poisonRange, ({ player, services }) => {
        if (getQuestStage(player, quest) !== STAGE_CHOSEN_SIDE || side(player) !== SIDE_HAZEEL) {
            services.messaging.sendGameMessage(player, "You decide not to put poison in the food.");
            return;
        }
        if (!removeItem(player, services, ITEM.poison)) return;
        setQuestStage(player, quest, services, STAGE_POISONED_FOOD);
        services.messaging.sendGameMessage(player, "You pour the poison into the bubbling food. Poor Scruffy eats it instead.");
    });

    for (const locId of LOC.secretWall) {
        for (const action of ["knock-at", "search", "push", "open"] as const) {
            registry.registerLocScript({
                locId,
                action,
                handler: ({ player, services }) => {
                    if (side(player) !== SIDE_HAZEEL || getQuestStage(player, quest) < STAGE_FINISHED_SIDE_TASK) {
                        services.messaging.sendGameMessage(player, "You can hear that it is hollow behind this wall.");
                        return;
                    }
                    services.messaging.sendGameMessage(player, "You find a secret passageway.");
                    services.movement.teleportPlayer(player, player.tileX <= 2575 ? 2577 : 2575, 3268, 1);
                },
            });
        }
    }

    registry.registerLocScript({
        locId: LOC.keyCrate,
        action: "search",
        handler: ({ player, services }) => {
            if (side(player) !== SIDE_HAZEEL || getQuestStage(player, quest) < STAGE_FINISHED_SIDE_TASK) {
                services.messaging.sendGameMessage(player, "You find nothing of interest.");
                return;
            }
            if (owns(player, services, ITEM.chestKey)) {
                services.messaging.sendGameMessage(player, "The crate is empty.");
                return;
            }
            if (giveItem(player, services, ITEM.chestKey)) {
                services.messaging.sendGameMessage(player, "You find an old chest key beneath the food packages.");
            }
        },
    });

    const searchScrollChest = (player: PlayerState, services: ScriptServices): void => {
        if (side(player) !== SIDE_HAZEEL || getQuestStage(player, quest) < STAGE_FINISHED_SIDE_TASK) {
            services.messaging.sendGameMessage(player, "The chest is locked shut.");
            return;
        }
        if (!owns(player, services, ITEM.chestKey)) {
            services.messaging.sendGameMessage(player, "The chest is locked. It looks like it needs a key.");
            return;
        }
        if (owns(player, services, ITEM.hazeelScroll)) {
            services.messaging.sendGameMessage(player, "You already have the scroll from this chest.");
            return;
        }
        if (giveItem(player, services, ITEM.hazeelScroll)) {
            setQuestStage(player, quest, services, STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL);
            services.messaging.sendGameMessage(player, "You unlock the chest and find the Hazeel scroll.");
        }
    };
    for (const locId of LOC.scrollChest) {
        for (const action of ["open", "search"] as const) {
            registry.registerLocScript({ locId, action, handler: ({ player, services }) => searchScrollChest(player, services) });
        }
        registry.registerItemOnLoc(ITEM.chestKey, locId, ({ player, services }) => searchScrollChest(player, services));
    }

    registry.registerLocScript({
        locId: LOC.armourChest,
        action: "search",
        handler: ({ player, services }) => {
            const stage = getQuestStage(player, quest);
            if (side(player) !== SIDE_CARNILLEAN || stage < STAGE_FINISHED_SIDE_TASK || stage >= STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL) {
                services.messaging.sendGameMessage(player, "You find nothing you need.");
                return;
            }
            if (owns(player, services, ITEM.carnilleanArmour)) {
                services.messaging.sendGameMessage(player, "The chest is empty.");
                return;
            }
            if (giveItem(player, services, ITEM.carnilleanArmour)) {
                services.messaging.sendGameMessage(player, "You recover the Carnillean family armour from the chest.");
            }
        },
    });

    const searchEvidence = (player: PlayerState, services: ScriptServices): void => {
        if (side(player) !== SIDE_CARNILLEAN || getQuestStage(player, quest) !== STAGE_RETURNED_ARMOUR_OR_FOUND_SCROLL) {
            services.messaging.sendGameMessage(player, "You search the cupboard but find nothing of interest.");
            return;
        }
        services.messaging.sendGameMessage(player, "You find poison and a cult amulet, proving Butler Jones's treachery.");
        completeQuest(player, services, quest);
    };
    for (const locId of LOC.evidenceCupboard) {
        for (const action of ["open", "search"] as const) {
            registry.registerLocScript({ locId, action, handler: ({ player, services }) => searchEvidence(player, services) });
        }
    }
}

type ScopedSet = Map<number, Set<number>>;

function removeScoped(playerId: number, tracked: ScopedSet, services: ScriptServices): void {
    for (const npcId of tracked.get(playerId) ?? []) services.npc.removeNpc(npcId);
    tracked.delete(playerId);
}

function ensureScopedNpc(
    player: PlayerState,
    services: ScriptServices,
    tracked: ScopedSet,
    config: { id: number; x: number; y: number; level: number },
): void {
    if (services.npc.findNearbyNpc(player, config.id, 32)) return;
    const npc = services.npc.spawnNpc({
        ...config,
        worldViewId: player.worldViewId,
        ownerPlayerId: player.id,
        lifetimeTicks: 500,
    });
    if (!npc) return;
    let ids = tracked.get(player.id);
    if (!ids) {
        ids = new Set();
        tracked.set(player.id, ids);
    }
    ids.add(npc.id);
}

function registerScopedNpcZones(quest: QuestDefinition, registry: IScriptRegistry): void {
    const mansion = new Map<number, Set<number>>();
    const cult = new Map<number, Set<number>>();
    const ensureMansion = ({ player, services }: { player: PlayerState; services: ScriptServices }): void => {
        ensureScopedNpc(player, services, mansion, { id: NPC.ceril, x: 2573, y: 3268, level: 0 });
        ensureScopedNpc(player, services, mansion, { id: NPC.guard, x: 2570, y: 3275, level: 0 });
        ensureScopedNpc(player, services, mansion, { id: NPC.jones, x: 2573, y: 3269, level: 0 });
    };
    const ensureCult = ({ player, services }: { player: PlayerState; services: ScriptServices }): void => {
        ensureScopedNpc(player, services, cult, { id: NPC.clivet, x: 2566, y: 9683, level: 0 });
        const stage = getQuestStage(player, quest);
        if (stage >= STAGE_CHOSEN_SIDE && (side(player) === SIDE_HAZEEL || stage < STAGE_FINISHED_SIDE_TASK)) {
            ensureScopedNpc(player, services, cult, { ...TILE.alomone, id: NPC.alomone });
        }
    };
    registry.registerZone({ id: MANSION_ZONE.id, ...MANSION_ZONE.bounds, levels: MANSION_ZONE.levels }, {
        enter: ensureMansion,
        step: ensureMansion,
        exit: ({ player, services }) => removeScoped(player.id, mansion, services),
    });
    registry.registerZone({ id: CULT_ZONE.id, ...CULT_ZONE.bounds, levels: CULT_ZONE.levels }, {
        enter: ensureCult,
        step: ensureCult,
        exit: ({ player, services }) => removeScoped(player.id, cult, services),
    });
}

export function registerHazeelCultInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registerNpcDialogues(quest, registry);
    registerAlomoneDeath(quest, registry);
    registerTravel(quest, registry);
    registerQuestLocs(quest, registry);
    registerScopedNpcZones(quest, registry);
}
