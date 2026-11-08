import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    LocInteractionEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    DOOR_VARBITS,
    ITEM,
    LEVER_VARBITS,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_ODDENSTEIN,
    STAGE_STARTED,
    VARP_FOUNTAIN,
    VARP_LEVERS,
} from "./constants";

const DOOR_TILES = [
    [3105, 9765],
    [3100, 9765],
    [3105, 9760],
    [3100, 9760],
    [3100, 9755],
    [3102, 9763],
    [3097, 9763],
    [3108, 9758],
    [3102, 9758],
] as const;

function hasItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.playerHasItem(player, itemId);
}

function giveItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, 1);
    if (result.added !== 1) {
        services.messaging.sendGameMessage(player, "You need a free inventory slot.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function setVarp(
    player: PlayerState,
    services: ScriptServices,
    varpId: number,
    value: number,
): void {
    player.varps.setVarpValue(varpId, value);
    services.variables.sendVarp(player, varpId, value);
}

function poisonFishFood(event: ItemOnItemEvent): void {
    const poison = event.source.itemId === ITEM.poison ? event.source : event.target;
    const fishFood = event.source.itemId === ITEM.fishFood ? event.source : event.target;
    if (!event.services.inventory.consumeItem(event.player, poison.slot)) return;
    event.services.inventory.setInventorySlot(
        event.player,
        fishFood.slot,
        ITEM.poisonedFood,
        1,
    );
    event.services.inventory.snapshotInventory(event.player);
    event.services.messaging.sendGameMessage(
        event.player,
        "You pour the poison into the fish food.",
    );
}

export function getErnestPuzzleDoorStates(bits: number): boolean[] {
    const [a, b, c, d, e, f] = [0, 1, 2, 3, 4, 5].map(
        (index) => (bits & (1 << index)) !== 0,
    );
    return [
        !a && !b && d && e && f,
        !b && d && f,
        a && b && d,
        d,
        !e && f,
        !a && !b && c && d && !e && f,
        !b && d && !f,
        a && b && !c && !d && !e && !f,
        (!c && d) || (!a && !b && c && d && !e && f),
    ];
}

function syncPuzzle(player: PlayerState, services: ScriptServices, bits: number): void {
    setVarp(player, services, VARP_LEVERS, bits);
    LEVER_VARBITS.forEach((varbitId, index) => {
        const value = (bits >> index) & 1;
        player.varps.setVarbitValue(varbitId, value);
        services.variables.sendVarbit(player, varbitId, value);
    });
    getErnestPuzzleDoorStates(bits).forEach((open, index) => {
        const value = open ? 1 : 0;
        const varbitId = DOOR_VARBITS[index];
        player.varps.setVarbitValue(varbitId, value);
        services.variables.sendVarbit(player, varbitId, value);
    });
}

function crossDoor(
    player: PlayerState,
    services: ScriptServices,
    tile: { x: number; y: number },
    level: number,
): void {
    const dx = player.tileX - tile.x;
    const dy = player.tileY - tile.y;
    if (Math.abs(dx) > Math.abs(dy)) {
        services.movement.teleportPlayer(
            player,
            tile.x - Math.sign(dx),
            player.tileY,
            level,
        );
    } else {
        services.movement.teleportPlayer(
            player,
            player.tileX,
            tile.y - Math.sign(dy),
            level,
        );
    }
}

function createVeronicaHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: NPC.veronica,
            npcName: "Veronica",
        };
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [sayNpc("Thank you! Ernest is himself again.")]);
            return;
        }
        if (stage > 0) {
            startConversation(context, [
                sayNpc(
                    "Please find Professor Oddenstein upstairs in the manor. He must know what happened to Ernest.",
                ),
                choose([
                    option("What did Ernest look like?", [
                        sayNpc(
                            "Tall, dark and rather handsome. He certainly wasn't a chicken.",
                        ),
                    ]),
                    option("I'll keep looking."),
                ]),
            ]);
            return;
        }
        startConversation(context, [
            sayNpc("Can you help me? Ernest went into the manor and hasn't returned."),
            choose([
                option("Yes, I'll find him.", [
                    sayNpc("Thank you. Please be careful in there."),
                    run(({ player, services }) =>
                        setQuestStage(player, quest, services, STAGE_STARTED),
                    ),
                ]),
                option("Have you tried calling him?", [
                    sayNpc("For hours. Something dreadful must have happened."),
                    choose([
                        option("All right, I'll help.", [
                            run(({ player, services }) =>
                                setQuestStage(player, quest, services, STAGE_STARTED),
                            ),
                        ]),
                        option("Sorry, no."),
                    ]),
                ]),
                option("No, that place looks haunted.", [sayNpc("Please reconsider!")]),
            ]),
        ]);
    };
}

function createOddensteinHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: NPC.oddenstein,
            npcName: "Professor Oddenstein",
        };
        if (stage === 0) {
            startConversation(context, [sayNpc("I'm rather busy with an experiment.")]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [
                sayNpc("Ernest is safely human again. My machine worked perfectly... eventually."),
            ]);
            return;
        }
        if (stage === STAGE_STARTED) {
            startConversation(context, [
                sayPlayer("I'm looking for Ernest."),
                sayNpc("Ah. A slight accident with my pouletmorph machine turned him into a chicken."),
                sayNpc(
                    "Gremlins stole three parts: a pressure gauge, rubber tube and oil can. Bring them back and I can restore him.",
                ),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_ODDENSTEIN),
                ),
            ]);
            return;
        }

        const hasParts =
            hasItem(event.player, event.services, ITEM.gauge) &&
            hasItem(event.player, event.services, ITEM.tube) &&
            hasItem(event.player, event.services, ITEM.oilCan);
        startConversation(
            context,
            hasParts
                ? [
                      sayPlayer("I have all three machine parts."),
                      sayNpc("Excellent! Stand back while I repair the machine."),
                      run(({ player, services }) => {
                          if (
                              !takeQuestItems(player, services, [
                                  { itemId: ITEM.gauge, quantity: 1, journalLabel: "" },
                                  { itemId: ITEM.tube, quantity: 1, journalLabel: "" },
                                  { itemId: ITEM.oilCan, quantity: 1, journalLabel: "" },
                              ])
                          ) {
                              return;
                          }
                          completeQuest(player, services, quest);
                      }),
                  ]
                : [
                      sayNpc("I still need the pressure gauge, rubber tube and oil can."),
                      choose([
                          option("Where should I look?", [
                              sayNpc(
                                  "They were scattered throughout the manor. The oil can may be in the basement.",
                              ),
                          ]),
                          option("I'll keep searching."),
                      ]),
                  ],
        );
    };
}

function createPuzzleDoorHandler(): (event: LocInteractionEvent) => void {
    return (event) => {
        const index = DOOR_TILES.findIndex(
            ([x, y]) => x === event.tile.x && y === event.tile.y,
        );
        const states = getErnestPuzzleDoorStates(
            event.player.varps.getVarpValue(VARP_LEVERS),
        );
        if (index < 0 || !states[index]) {
            event.services.messaging.sendGameMessage(
                event.player,
                "The door is locked firmly in place.",
            );
            return;
        }
        crossDoor(event.player, event.services, event.tile, event.level);
    };
}

export function registerErnestTheChickenInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
): void {
    const veronica = createVeronicaHandler(quest);
    registry.registerNpcScript({ npcId: NPC.veronica, option: "talk-to", handler: veronica });
    registry.registerNpcScript({ npcId: NPC.veronica, option: undefined, handler: veronica });

    const oddenstein = createOddensteinHandler(quest);
    registry.registerNpcScript({ npcId: NPC.oddenstein, option: "talk-to", handler: oddenstein });
    registry.registerNpcScript({ npcId: NPC.oddenstein, option: undefined, handler: oddenstein });

    registry.registerItemOnItem(ITEM.poison, ITEM.fishFood, poisonFishFood);
    registry.registerLocScript({
        locId: LOC.compost,
        action: "search",
        handler: (event) => {
            event.services.messaging.sendGameMessage(
                event.player,
                "You find nothing but rotting vegetables. Perhaps a spade would help.",
            );
        },
    });
    registry.registerItemOnLoc(ITEM.spade, LOC.compost, (event) => {
        if (hasItem(event.player, event.services, ITEM.key)) {
            event.services.messaging.sendGameMessage(event.player, "You find nothing else.");
            return;
        }
        if (giveItem(event.player, event.services, ITEM.key)) {
            event.services.messaging.sendGameMessage(event.player, "You dig up a small key.");
        }
    });

    registry.registerLocScript({
        locId: LOC.fountain,
        action: "search",
        handler: (event) => {
            if (hasItem(event.player, event.services, ITEM.gauge)) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "There is nothing else in the fountain.",
                );
                return;
            }
            if (event.player.varps.getVarpValue(VARP_FOUNTAIN) !== 1) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "The piranhas bite your hand!",
                );
                event.services.combat.applyPlayerHitsplat(
                    event.player,
                    0,
                    1,
                    event.services.system.getCurrentTick(),
                );
                return;
            }
            if (giveItem(event.player, event.services, ITEM.gauge)) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "You retrieve the pressure gauge from the fountain.",
                );
            }
        },
    });
    registry.registerItemOnLoc(ITEM.poisonedFood, LOC.fountain, (event) => {
        if (event.player.varps.getVarpValue(VARP_FOUNTAIN) === 1) return;
        if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
        setVarp(event.player, event.services, VARP_FOUNTAIN, 1);
        event.services.messaging.sendGameMessage(
            event.player,
            "The piranhas eat the poisoned food and float to the surface.",
        );
    });

    registry.registerLocScript({
        locId: LOC.closetDoor,
        action: "open",
        handler: (event) => {
            if (!hasItem(event.player, event.services, ITEM.key)) {
                event.services.messaging.sendGameMessage(event.player, "The door is locked.");
                return;
            }
            crossDoor(event.player, event.services, event.tile, event.level);
        },
    });
    registry.registerItemOnLoc(ITEM.key, LOC.closetDoor, (event) => {
        crossDoor(event.player, event.services, event.target.tile, event.target.level);
    });

    for (const locId of LOC.bookcases) {
        registry.registerLocScript({
            locId,
            action: "search",
            handler: (event) => {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "You pull a book and the bookcase swings aside.",
                );
                event.services.movement.teleportPlayer(
                    event.player,
                    event.player.tileX < event.tile.x ? event.tile.x + 1 : event.tile.x - 1,
                    event.player.tileY,
                    event.level,
                );
            },
        });
    }

    registry.registerLocScript({
        locId: LOC.puzzleLadderDown,
        action: "climb-down",
        handler: (event) => {
            syncPuzzle(event.player, event.services, 0);
            event.services.movement.teleportPlayer(event.player, 3117, 9754, 0, true);
        },
    });
    registry.registerLocScript({
        locId: LOC.puzzleLadderUp,
        action: "climb-up",
        handler: (event) => {
            syncPuzzle(event.player, event.services, 0);
            event.services.movement.teleportPlayer(event.player, 3092, 3362, 0, true);
        },
    });

    LOC.levers.forEach((locId, index) => {
        const handler = (event: LocInteractionEvent): void => {
            const bits = event.player.varps.getVarpValue(VARP_LEVERS) ^ (1 << index);
            syncPuzzle(event.player, event.services, bits);
            event.services.messaging.sendGameMessage(
                event.player,
                `You pull lever ${String.fromCharCode(65 + index)} ${(bits & (1 << index)) !== 0 ? "down" : "up"}.`,
            );
        };
        for (const id of [locId, 11451 + index * 2, 11452 + index * 2]) {
            registry.registerLocScript({ locId: id, action: undefined, handler });
        }
    });

    const doorHandler = createPuzzleDoorHandler();
    for (const locId of LOC.doors) {
        registry.registerLocScript({ locId, action: undefined, handler: doorHandler });
    }
    registry.registerLocScript({ locId: 11450, action: "open", handler: doorHandler });
}
