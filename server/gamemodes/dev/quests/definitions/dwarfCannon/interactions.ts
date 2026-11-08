import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    CANNON_REPAIR_MASK,
    CURRENT_RAILING_TILES,
    ITEM,
    LOC,
    NPC,
    RAIL_MASK,
    STAGE_CANNON_REPAIRED,
    STAGE_CHECK_WATCHTOWER,
    STAGE_COMPLETE,
    STAGE_FIND_CAVE,
    STAGE_FIND_LOLLK,
    STAGE_INSPECTED_CANNON,
    STAGE_NOT_STARTED,
    STAGE_REPAIR_CANNON,
    STAGE_REPAIR_RAILINGS,
    STAGE_RETURN_NOTES,
    STAGE_RETURN_TO_LAWGOF,
    STAGE_SPEAK_TO_NULODION,
    TILE,
    VARP_DWARF_CANNON_MULTI,
} from "./constants";

function npcContext(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function setMulti(player: PlayerState, services: ScriptServices, value: number): void {
    player.varps.setVarpValue(VARP_DWARF_CANNON_MULTI, value);
    services.variables.sendVarp(player, VARP_DWARF_CANNON_MULTI, value);
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function removeItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    if (countCarriedItem(player, services, itemId) < quantity) return false;
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const amount = Math.min(entry.quantity, remaining);
        const left = entry.quantity - amount;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= amount;
        if (remaining === 0) break;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function freeSlots(player: PlayerState, services: ScriptServices): number {
    return services.inventory
        .getInventoryItems(player)
        .filter((entry) => entry.itemId < 0 || entry.quantity <= 0).length;
}

function giveItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function unfinishedRailCount(player: PlayerState): number {
    const bits = (player.varps.getVarpValue(VARP_DWARF_CANNON_MULTI) & RAIL_MASK) >>> 5;
    let fixed = 0;
    for (let index = 0; index < 6; index++) fixed += (bits >>> index) & 1;
    return 6 - fixed;
}

function supplyRailMaterials(player: PlayerState, services: ScriptServices): boolean {
    const neededRails = Math.max(0, unfinishedRailCount(player) - countCarriedItem(player, services, ITEM.railing));
    const needsHammer = !owns(player, services, ITEM.hammer);
    if (freeSlots(player, services) < neededRails + (needsHammer ? 1 : 0)) {
        services.messaging.sendGameMessage(
            player,
            `You need ${neededRails + (needsHammer ? 1 : 0)} free inventory spaces for the repair equipment.`,
        );
        return false;
    }
    if (neededRails > 0 && !giveItem(player, services, ITEM.railing, neededRails)) return false;
    if (needsHammer && !giveItem(player, services, ITEM.hammer)) return false;
    return true;
}

function ensureRemains(player: PlayerState, services: ScriptServices): void {
    services.location.replaceTemporaryLoc(
        { worldViewId: player.worldViewId, ownerPlayerId: player.id },
        LOC.dwarfRemains[0],
        LOC.dwarfRemains[1],
        TILE.remains,
        TILE.remains.level,
        { oldShape: 10, newShape: 10 },
    );
}

function ensureBrokenCannon(player: PlayerState, services: ScriptServices): void {
    services.location.replaceTemporaryLoc(
        { worldViewId: player.worldViewId, ownerPlayerId: player.id },
        LOC.currentCannonParts[0],
        LOC.brokenCannon,
        TILE.cannonWest,
        TILE.cannonWest.level,
        { oldShape: 10, newShape: 10 },
    );
}

function createLawgofHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = npcContext(event, "Captain Lawgof");
        if (stage === STAGE_NOT_STARTED) {
            startConversation(ctx, [
                sayNpc("What are you doing here, human? This is a Black Guard outpost."),
                choose([
                    option("Can I help?", [
                        sayNpc("Goblins keep smashing our perimeter railings. Repair all six and I may make you an honorary member."),
                        run(({ player, services }) => {
                            if (!supplyRailMaterials(player, services)) return;
                            setMulti(player, services, 0);
                            setQuestStage(player, quest, services, STAGE_REPAIR_RAILINGS);
                        }),
                    ]),
                    option("I'll be going now.", [sayNpc("A wise decision.")]),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_REPAIR_RAILINGS) {
            if ((event.player.varps.getVarpValue(VARP_DWARF_CANNON_MULTI) & RAIL_MASK) !== RAIL_MASK) {
                supplyRailMaterials(event.player, event.services);
                startConversation(ctx, [sayNpc("Repair all six broken railings. I can replace any rails or hammer you lost.")]);
                return;
            }
            startConversation(ctx, [
                sayNpc("Excellent work. But the southern watchtower has stopped reporting."),
                sayNpc("Climb it and find out what happened to my guards."),
                run(({ player, services }) => {
                    setQuestStage(player, quest, services, STAGE_CHECK_WATCHTOWER);
                    ensureRemains(player, services);
                }),
            ]);
            return;
        }
        if (stage === STAGE_CHECK_WATCHTOWER) {
            ensureRemains(event.player, event.services);
            startConversation(ctx, [sayNpc("Search the top of the southern watchtower. Two guards, Gilob and Lollk, are missing.")]);
            return;
        }
        if (stage === STAGE_FIND_CAVE || stage === STAGE_FIND_LOLLK) {
            startConversation(ctx, [sayNpc("The goblins have a cave south-east of here. Find Lollk before it is too late.")]);
            return;
        }
        if (stage === STAGE_RETURN_TO_LAWGOF) {
            startConversation(ctx, [
                sayPlayer("I found Lollk. He's shaken, but alive."),
                sayNpc("Thank Guthix! One last problem: the goblins damaged our multicannon."),
                sayNpc("Take this toolkit. Inspect the cannon, then repair its mechanisms."),
                run(({ player, services }) => {
                    if (!owns(player, services, ITEM.toolkit) && !giveItem(player, services, ITEM.toolkit)) return;
                    setQuestStage(player, quest, services, STAGE_REPAIR_CANNON);
                    setMulti(player, services, player.varps.getVarpValue(VARP_DWARF_CANNON_MULTI) & RAIL_MASK);
                    ensureBrokenCannon(player, services);
                }),
            ]);
            return;
        }
        if (stage === STAGE_REPAIR_CANNON || stage === STAGE_INSPECTED_CANNON) {
            if (!owns(event.player, event.services, ITEM.toolkit)) giveItem(event.player, event.services, ITEM.toolkit);
            ensureBrokenCannon(event.player, event.services);
            startConversation(ctx, [sayNpc("Use the toolkit on the multicannon and repair all three damaged mechanisms.")]);
            return;
        }
        if (stage === STAGE_CANNON_REPAIRED) {
            startConversation(ctx, [
                sayNpc("The cannon works, but we have no ammunition knowledge here."),
                sayNpc("Speak to Nulodion at the dwarven mine by Ice Mountain. Tell him I sent you."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPEAK_TO_NULODION)),
            ]);
            return;
        }
        if (stage === STAGE_SPEAK_TO_NULODION) {
            startConversation(ctx, [sayNpc("Nulodion works at the dwarven mine entrance south of Ice Mountain.")]);
            return;
        }
        if (stage === STAGE_RETURN_NOTES) {
            if (!owns(event.player, event.services, ITEM.nulodionsNotes)) {
                startConversation(ctx, [sayNpc("Nulodion's notes are what I need. Ask him for another copy.")]);
                return;
            }
            if (!owns(event.player, event.services, ITEM.ammoMould)) {
                startConversation(ctx, [sayNpc("You should also bring the ammo mould Nulodion promised you.")]);
                return;
            }
            startConversation(ctx, [
                sayPlayer("Nulodion gave me the notes and this ammunition mould."),
                sayNpc("Splendid. The Black Guard owes you a great debt."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.nulodionsNotes)) return;
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        startConversation(ctx, [sayNpc("Honorary Black Guard member! Nulodion can sell you your own multicannon.")]);
    };
}

function createNulodionHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const ctx = npcContext(event, "Nulodion");
        if (stage === STAGE_SPEAK_TO_NULODION) {
            startConversation(ctx, [
                sayPlayer("Captain Lawgof needs instructions for ammunition."),
                sayNpc("Then take him these notes. Keep this mould; a steel bar makes four cannonballs."),
                run(({ player, services }) => {
                    const needs = Number(!owns(player, services, ITEM.nulodionsNotes)) + Number(!owns(player, services, ITEM.ammoMould));
                    if (freeSlots(player, services) < needs) {
                        services.messaging.sendGameMessage(player, `You need ${needs} free inventory spaces.`);
                        return;
                    }
                    if (!owns(player, services, ITEM.nulodionsNotes) && !giveItem(player, services, ITEM.nulodionsNotes)) return;
                    if (!owns(player, services, ITEM.ammoMould) && !giveItem(player, services, ITEM.ammoMould)) return;
                    setQuestStage(player, quest, services, STAGE_RETURN_NOTES);
                }),
            ]);
            return;
        }
        if (stage === STAGE_RETURN_NOTES) {
            startConversation(ctx, [
                sayNpc("Lost something? I can replace the notes and mould."),
                run(({ player, services }) => {
                    const missing = [ITEM.nulodionsNotes, ITEM.ammoMould].filter((itemId) => !owns(player, services, itemId));
                    if (freeSlots(player, services) < missing.length) {
                        services.messaging.sendGameMessage(player, `You need ${missing.length} free inventory spaces.`);
                        return;
                    }
                    for (const itemId of missing) giveItem(player, services, itemId);
                }),
            ]);
            return;
        }
        if (stage < STAGE_COMPLETE) {
            startConversation(ctx, [sayNpc("Captain Lawgof has not authorised me to help you.")]);
            return;
        }
        startConversation(ctx, [
            sayNpc("Would you like to buy a complete dwarf multicannon for 750,000 coins?"),
            choose([
                option("Yes, give me the complete set.", [
                    run(({ player, services }) => {
                        const parts = [
                            ITEM.cannonBase,
                            ITEM.cannonStand,
                            ITEM.cannonBarrels,
                            ITEM.cannonFurnace,
                            ITEM.ammoMould,
                            ITEM.instructionManual,
                        ];
                        if (countCarriedItem(player, services, ITEM.coins) < 750_000) {
                            services.messaging.sendGameMessage(player, "You need 750,000 coins.");
                            return;
                        }
                        if (freeSlots(player, services) < parts.length) {
                            services.messaging.sendGameMessage(player, "You need six free inventory spaces.");
                            return;
                        }
                        if (!removeItem(player, services, ITEM.coins, 750_000)) return;
                        for (const itemId of parts) giveItem(player, services, itemId);
                        services.messaging.sendGameMessage(player, "Nulodion hands you a complete dwarf multicannon set.");
                    }),
                ]),
                option("Tell me how multicannons work.", [
                    sayNpc("Set down the base, add the stand, barrels and furnace, then load cannonballs."),
                    showItem(ITEM.ammoMould, "Use this mould with a steel bar at a furnace to make four cannonballs."),
                ]),
                option("No thanks."),
            ]),
        ]);
    };
}

function railIndex(event: LocInteractionEvent): number | undefined {
    const legacy = LOC.legacyRailings.indexOf(event.locId as (typeof LOC.legacyRailings)[number]);
    if (legacy >= 0) return legacy;
    if (event.locId !== LOC.currentRailing) return undefined;
    const current = CURRENT_RAILING_TILES.findIndex((tile) => tile.x === event.tile.x && tile.y === event.tile.y);
    return current >= 0 ? current : undefined;
}

function registerLocActions(
    registry: IScriptRegistry,
    locId: number,
    actions: readonly (string | undefined)[],
    handler: (event: LocInteractionEvent) => void,
): void {
    for (const action of actions) registry.registerLocScript({ locId, action, handler });
}

function registerRailings(quest: QuestDefinition, registry: IScriptRegistry): void {
    const repair = (event: LocInteractionEvent): void => {
        if (getQuestStage(event.player, quest) !== STAGE_REPAIR_RAILINGS) {
            event.services.messaging.sendGameMessage(event.player, "The railing looks sturdy enough.");
            return;
        }
        const index = railIndex(event);
        if (index === undefined) {
            event.services.messaging.sendGameMessage(event.player, "This section is not damaged.");
            return;
        }
        const bit = 1 << (index + 5);
        const multi = event.player.varps.getVarpValue(VARP_DWARF_CANNON_MULTI);
        if ((multi & bit) !== 0) {
            event.services.messaging.sendGameMessage(event.player, "You have already repaired this railing.");
            return;
        }
        if (!owns(event.player, event.services, ITEM.hammer) || countCarriedItem(event.player, event.services, ITEM.railing) < 1) {
            event.services.messaging.sendGameMessage(event.player, "You need a hammer and a replacement railing.");
            return;
        }
        const crafting = event.services.skills.getSkill(event.player, SkillId.Crafting).baseLevel;
        const chance = Math.min(95, 50 + crafting);
        if ((event.tick * 17 + event.player.id * 13 + index * 7) % 100 >= chance) {
            event.services.messaging.sendGameMessage(event.player, "The railing slips and pinches your fingers. Try again.");
            return;
        }
        removeItem(event.player, event.services, ITEM.railing);
        setMulti(event.player, event.services, multi | bit);
        event.services.messaging.sendGameMessage(event.player, "You hammer the replacement railing firmly into place.");
        if (((multi | bit) & RAIL_MASK) === RAIL_MASK) {
            event.services.messaging.sendGameMessage(event.player, "All six railings are repaired. Report to Captain Lawgof.");
        }
    };
    for (const locId of [...LOC.legacyRailings, LOC.currentRailing]) {
        registerLocActions(registry, locId, ["repair", "fix", "inspect", undefined], repair);
    }
}

function registerTowerAndCave(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const locId of LOC.towerLadderUp) {
        registerLocActions(registry, locId, ["climb-up", "climb", undefined], ({ player, services }) =>
            services.movement.teleportPlayer(player, TILE.towerTop.x, TILE.towerTop.y, TILE.towerTop.level),
        );
    }
    for (const locId of LOC.towerLadderDown) {
        registerLocActions(registry, locId, ["climb-down", "climb", undefined], ({ player, services }) =>
            services.movement.teleportPlayer(player, TILE.towerGround.x, TILE.towerGround.y, TILE.towerGround.level),
        );
    }
    for (const locId of LOC.dwarfRemains) {
        const handler = ({ player, services }: LocInteractionEvent) => {
                if (getQuestStage(player, quest) !== STAGE_CHECK_WATCHTOWER) {
                    services.messaging.sendGameMessage(player, "There is nothing here that you need.");
                    return;
                }
                if (owns(player, services, ITEM.dwarfRemains)) {
                    services.messaging.sendGameMessage(player, "You already recovered the dwarf's remains.");
                    return;
                }
                if (!giveItem(player, services, ITEM.dwarfRemains)) return;
                setQuestStage(player, quest, services, STAGE_FIND_CAVE);
                services.location.clearTemporaryLoc(
                    { worldViewId: player.worldViewId, ownerPlayerId: player.id },
                    LOC.dwarfRemains[0],
                    TILE.remains,
                    TILE.remains.level,
                );
                services.messaging.sendGameMessage(player, "You recover Gilob's remains. Lollk is nowhere to be seen.");
            };
        registerLocActions(registry, locId, ["take", "search", undefined], handler);
    }
    const enterCave = ({ player, services }: LocInteractionEvent) => {
            if (getQuestStage(player, quest) === STAGE_FIND_CAVE) {
                setQuestStage(player, quest, services, STAGE_FIND_LOLLK);
            }
            services.movement.teleportPlayer(player, TILE.caveInside.x, TILE.caveInside.y, TILE.caveInside.level);
        };
    registerLocActions(registry, LOC.caveEntrance, ["enter", "climb-into", undefined], enterCave);
    registerLocActions(registry, LOC.mudPile, ["climb-out", "exit", "climb", undefined], ({ player, services }) =>
        services.movement.teleportPlayer(player, TILE.caveOutside.x, TILE.caveOutside.y, TILE.caveOutside.level),
    );
    const searchCrate = ({ player, services }: LocInteractionEvent) => {
            if (getQuestStage(player, quest) !== STAGE_FIND_LOLLK) {
                services.messaging.sendGameMessage(player, "The crate is empty.");
                return;
            }
            services.npc.spawnNpc({
                id: NPC.lollk,
                x: TILE.lollkSpawn.x,
                y: TILE.lollkSpawn.y,
                level: TILE.lollkSpawn.level,
                worldViewId: player.worldViewId,
                ownerPlayerId: player.id,
                lifetimeTicks: 50,
            });
            setQuestStage(player, quest, services, STAGE_RETURN_TO_LAWGOF);
            services.messaging.sendGameMessage(player, "Lollk tumbles out of the crate. He thanks you and runs home.");
        };
    registerLocActions(registry, LOC.lollkCrate, ["search", "open", undefined], searchCrate);
}

function registerCannon(quest: QuestDefinition, registry: IScriptRegistry): void {
    const cannonLocs = [LOC.brokenCannon, ...LOC.currentCannonParts];
    for (const locId of cannonLocs) {
        const inspect = ({ player, services }: LocInteractionEvent) => {
                const stage = getQuestStage(player, quest);
                if (stage === STAGE_REPAIR_CANNON) {
                    setQuestStage(player, quest, services, STAGE_INSPECTED_CANNON);
                    services.messaging.sendGameMessage(player, "The cannon's safety switch, spring and gear mechanism are damaged.");
                    return;
                }
                services.messaging.sendGameMessage(player, stage === STAGE_CANNON_REPAIRED ? "The multicannon is fully repaired." : "It is a badly damaged dwarf multicannon.");
            };
        registerLocActions(registry, locId, ["inspect", "repair", undefined], inspect);
        registry.registerItemOnLoc(ITEM.toolkit, locId, ({ player, services }) => {
            const stage = getQuestStage(player, quest);
            if (stage !== STAGE_REPAIR_CANNON && stage !== STAGE_INSPECTED_CANNON) {
                services.messaging.sendGameMessage(player, "You do not need to repair this cannon now.");
                return;
            }
            if (stage === STAGE_REPAIR_CANNON) setQuestStage(player, quest, services, STAGE_INSPECTED_CANNON);
            const multi = player.varps.getVarpValue(VARP_DWARF_CANNON_MULTI);
            const repairs = multi & CANNON_REPAIR_MASK;
            let index = 0;
            while (index < 3 && (repairs & (1 << index)) !== 0) index++;
            if (index >= 3) {
                setQuestStage(player, quest, services, STAGE_CANNON_REPAIRED);
                return;
            }
            const next = multi | (1 << index);
            setMulti(player, services, next);
            const names = ["safety switch", "spring", "gear mechanism"];
            services.messaging.sendGameMessage(player, `You repair the ${names[index]}.`);
            if ((next & CANNON_REPAIR_MASK) === CANNON_REPAIR_MASK) {
                setQuestStage(player, quest, services, STAGE_CANNON_REPAIRED);
                services.messaging.sendGameMessage(player, "The multicannon is fully operational again.");
            }
        });
    }
}

function registerNulodionDoor(quest: QuestDefinition, registry: IScriptRegistry): void {
    const handler = (event: LocInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_SPEAK_TO_NULODION) {
            event.services.messaging.sendGameMessage(event.player, "The workshop door is locked.");
            return;
        }
        const x = event.player.tileX <= event.tile.x ? event.tile.x + 1 : event.tile.x - 1;
        event.services.movement.teleportPlayer(event.player, x, event.tile.y, event.level);
    };
    registerLocActions(registry, LOC.nulodionDoorClosed, ["open", undefined], handler);
    registerLocActions(registry, LOC.nulodionDoorOpen, ["close", "open", undefined], handler);
}

export function registerDwarfCannonInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registry.registerNpcScript({ npcId: NPC.lawgof, option: "talk-to", handler: createLawgofHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.nulodion, option: "talk-to", handler: createNulodionHandler(quest) });
    registry.registerNpcScript({
        npcId: NPC.lollk,
        option: "talk-to",
        handler: (event) => startConversation(npcContext(event, "Lollk"), [sayNpc("Thank you for rescuing me! Please tell Captain Lawgof that I am safe.")]),
    });
    for (const npcId of NPC.guards) {
        registry.registerNpcScript({
            npcId,
            option: "talk-to",
            handler: (event) => startConversation(npcContext(event, "Black Guard"), [sayNpc("Captain Lawgof is in command here.")]),
        });
    }
    registerRailings(quest, registry);
    registerTowerAndCave(quest, registry);
    registerCannon(quest, registry);
    registerNulodionDoor(quest, registry);
}
