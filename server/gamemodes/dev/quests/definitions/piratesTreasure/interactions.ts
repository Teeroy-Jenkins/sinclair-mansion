import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnNpcEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage, takeQuestItems } from "../../QuestService";
import {
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
    showItem,
    startConversation,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_KEY,
    STAGE_NOTE,
    STAGE_STARTED,
    TREASURE_TILE,
    VARP_PIRATES_BANANAS,
    VARP_PIRATES_EMPLOYMENT,
    VARP_PIRATES_RUM,
} from "./constants";

type FrankEvent = NpcInteractionEvent | ItemOnNpcEvent;

function setVarp(
    player: PlayerState,
    services: ScriptServices,
    varpId: number,
    value: number,
): void {
    player.varps.setVarpValue(varpId, value);
    services.variables.sendVarp(player, varpId, value);
}

function hasItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.playerHasItem(player, itemId);
}

function giveItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) {
        services.messaging.sendGameMessage(player, "You need more inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function createFrankHandler(quest: QuestDefinition): (event: FrankEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: NPC.frank,
            npcName: "Redbeard Frank",
        };

        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [sayNpc("Arr, enjoy the treasure, matey.")]);
            return;
        }
        if (stage === STAGE_STARTED && hasItem(event.player, event.services, ITEM.rum)) {
            startConversation(context, [
                sayPlayer("I have some Karamjan rum."),
                sayNpc(
                    "Now that be fine rum! The treasure is in Varrock. In the Blue Moon Inn is a chest upstairs.",
                ),
                sayNpc("This key will open it. Inside is a message telling you where to dig."),
                run(({ player, services }) => {
                    if (
                        !takeQuestItems(player, services, [
                            { itemId: ITEM.rum, quantity: 1, journalLabel: "" },
                        ])
                    ) {
                        return;
                    }
                    if (giveItem(player, services, ITEM.key)) {
                        setQuestStage(player, quest, services, STAGE_KEY);
                    }
                }),
            ]);
            return;
        }
        if (stage === STAGE_KEY) {
            const stillHasClue =
                hasItem(event.player, event.services, ITEM.key) ||
                hasItem(event.player, event.services, ITEM.message);
            startConversation(
                context,
                stillHasClue
                    ? [sayNpc("The chest is upstairs in Varrock's Blue Moon Inn.")]
                    : [
                          sayNpc("Lost the key? Luckily I kept a spare."),
                          run(({ player, services }) => {
                              giveItem(player, services, ITEM.key);
                          }),
                      ],
            );
            return;
        }
        if (stage === STAGE_NOTE) {
            startConversation(context, [
                sayNpc("Follow the message. X marks the spot in Falador Park."),
            ]);
            return;
        }
        if (stage === STAGE_STARTED) {
            startConversation(context, [
                sayNpc("Have you brought me a bottle of Karamjan rum?"),
                choose([
                    option("Not yet. Where can I get it?", [
                        sayNpc(
                            "Buy it on Karamja. Customs won't let you carry it aboard, so hide it in Luthas's banana crate.",
                        ),
                    ]),
                    option("I'm still working on it.", [sayNpc("Arr, hurry along then.")]),
                ]),
            ]);
            return;
        }

        startConversation(context, [
            sayNpc("Arr, matey! What can I do for ye?"),
            choose([
                option("I'm in search of treasure.", [
                    sayNpc(
                        "Treasure, eh? Bring me a bottle of Karamjan rum and I will tell you where some is buried.",
                    ),
                    choose([
                        option("Aye, I'll get the rum.", [
                            run(({ player, services }) =>
                                setQuestStage(player, quest, services, STAGE_STARTED),
                            ),
                        ]),
                        option("No thanks."),
                    ]),
                ]),
                option("Arr!", [sayNpc("Arr! That's the spirit.")]),
                option("Do you have anything to trade?", [sayNpc("Nothing today, matey.")]),
            ]),
        ]);
    };
}

function createLuthasHandler(): (event: NpcInteractionEvent) => void {
    return (event) => {
        const employment = event.player.varps.getVarpValue(VARP_PIRATES_EMPLOYMENT);
        const employed = (employment & 1) !== 0;
        const bananas = event.player.varps.getVarpValue(VARP_PIRATES_BANANAS);
        const context = {
            player: event.player,
            services: event.services,
            npcId: NPC.luthas,
            npcName: "Luthas",
        };

        if (employed && bananas >= 10) {
            startConversation(context, [
                sayNpc("That crate is full. I'll have it loaded on the next ship."),
                run(({ player, services }) => {
                    if (!giveItem(player, services, ITEM.coins, 30)) return;
                    setVarp(player, services, VARP_PIRATES_BANANAS, 0);
                    if (player.varps.getVarpValue(VARP_PIRATES_RUM) === 1) {
                        setVarp(player, services, VARP_PIRATES_RUM, 2);
                    }
                }),
                sayNpc("Here are your thirty coins. Come back if you want more work."),
            ]);
            return;
        }
        if (employed) {
            startConversation(context, [
                sayNpc(
                    "Fill the crate outside with ten bananas, then tell me when it is ready for shipping.",
                ),
                choose([
                    option("Where is it shipped?", [
                        sayNpc("To Wydin's food shop in Port Sarim."),
                    ]),
                    option("What was the task again?", [
                        sayNpc("Pick ten bananas and put them in the crate by my house."),
                    ]),
                    option("I'll get back to work."),
                ]),
            ]);
            return;
        }
        startConversation(context, [
            sayNpc("Hello. Could you help me collect bananas?"),
            choose([
                option("Yes, I'll help.", [
                    sayNpc("Put ten bananas in the crate outside. I pay thirty coins."),
                    run(({ player, services }) =>
                        setVarp(player, services, VARP_PIRATES_EMPLOYMENT, employment | 1),
                    ),
                ]),
                option("No thanks."),
            ]),
        ]);
    };
}

function createWydinHandler(): (event: NpcInteractionEvent) => void {
    return (event) => {
        const employment = event.player.varps.getVarpValue(VARP_PIRATES_EMPLOYMENT);
        const employed = (employment & 2) !== 0;
        const wearingApron = event.services.inventory
            .collectCarriedItemIds(event.player)
            .includes(ITEM.apron);
        const context = {
            player: event.player,
            services: event.services,
            npcId: NPC.wydin,
            npcName: "Wydin",
        };

        if (employed) {
            startConversation(context, [
                sayNpc(
                    "You're an employee now. You may enter the stock room, but don't touch anything.",
                ),
            ]);
            return;
        }
        startConversation(context, [
            sayNpc("Can I help you?"),
            choose([
                option(
                    "Can I get a job here?",
                    wearingApron
                        ? [
                              sayNpc("You look the part. Very well, you're hired."),
                              run(({ player, services }) =>
                                  setVarp(
                                      player,
                                      services,
                                      VARP_PIRATES_EMPLOYMENT,
                                      employment | 2,
                                  ),
                              ),
                          ]
                        : [
                              sayNpc(
                                  "You don't look smart enough. Employees must wear a white apron.",
                              ),
                          ],
                ),
                option("What do you sell?", [
                    sayNpc("Fresh food from all over Gielinor."),
                ]),
            ]),
        ]);
    };
}

export function registerPiratesTreasureInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const frank = createFrankHandler(quest);
    registry.registerNpcScript({ npcId: NPC.frank, option: "talk-to", handler: frank });
    registry.registerNpcScript({ npcId: NPC.frank, option: undefined, handler: frank });
    registry.registerItemOnNpc(ITEM.rum, NPC.frank, frank);

    const luthas = createLuthasHandler();
    registry.registerNpcScript({ npcId: NPC.luthas, option: "talk-to", handler: luthas });

    for (const locId of LOC.plantationCrate) {
        registry.registerItemOnLoc(ITEM.banana, locId, (event) => {
            const bananas = event.player.varps.getVarpValue(VARP_PIRATES_BANANAS);
            if (bananas >= 10) {
                event.services.messaging.sendGameMessage(event.player, "The crate is already full.");
                return;
            }
            if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
            setVarp(event.player, event.services, VARP_PIRATES_BANANAS, bananas + 1);
            event.services.messaging.sendGameMessage(
                event.player,
                `You put a banana in the crate. (${bananas + 1}/10)`,
            );
        });
        registry.registerItemOnLoc(ITEM.rum, locId, (event) => {
            if (getQuestStage(event.player, quest) !== STAGE_STARTED) return;
            if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
            setVarp(event.player, event.services, VARP_PIRATES_RUM, 1);
            event.services.messaging.sendGameMessage(
                event.player,
                "You hide the rum beneath the bananas.",
            );
        });
        registry.registerLocScript({
            locId,
            action: "search",
            handler: (event) => {
                const bananas = event.player.varps.getVarpValue(VARP_PIRATES_BANANAS);
                const hasRum = event.player.varps.getVarpValue(VARP_PIRATES_RUM) !== 0;
                event.services.messaging.sendGameMessage(
                    event.player,
                    `The crate contains ${bananas} bananas${hasRum ? " and a hidden bottle" : ""}.`,
                );
            },
        });
    }

    const wydin = createWydinHandler();
    registry.registerNpcScript({ npcId: NPC.wydin, option: "talk-to", handler: wydin });
    registry.registerLocScript({
        locId: LOC.stockRoomDoor,
        action: "open",
        handler: (event) => {
            const entering = event.player.tileX > event.tile.x;
            const employed =
                (event.player.varps.getVarpValue(VARP_PIRATES_EMPLOYMENT) & 2) !== 0;
            if (entering && !employed) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "Wydin won't let you into the stock room.",
                );
                return;
            }
            event.services.movement.teleportPlayer(
                event.player,
                event.tile.x + (entering ? -1 : 1),
                event.player.tileY,
                event.level,
            );
        },
    });

    for (const locId of LOC.storeCrate) {
        registry.registerLocScript({
            locId,
            action: "search",
            handler: (event) => {
                const employed =
                    (event.player.varps.getVarpValue(VARP_PIRATES_EMPLOYMENT) & 2) !== 0;
                if (!employed) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "Wydin won't let you into the stock room.",
                    );
                    return;
                }
                if (event.player.varps.getVarpValue(VARP_PIRATES_RUM) < 1) {
                    event.services.messaging.sendGameMessage(event.player, "You find only bananas.");
                    return;
                }
                if (
                    hasItem(event.player, event.services, ITEM.rum) ||
                    giveItem(event.player, event.services, ITEM.rum)
                ) {
                    setVarp(event.player, event.services, VARP_PIRATES_RUM, 0);
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "You find your bottle of rum in the crate.",
                    );
                }
            },
        });
    }

    for (const locId of LOC.chest) {
        registry.registerItemOnLoc(ITEM.key, locId, (event) => {
            if (getQuestStage(event.player, quest) !== STAGE_KEY) return;
            if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
            if (giveItem(event.player, event.services, ITEM.message)) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "The key breaks, but you find a message inside the chest.",
                );
            }
        });
        registry.registerLocScript({
            locId,
            action: "open",
            handler: (event) => {
                event.services.messaging.sendGameMessage(
                    event.player,
                    getQuestStage(event.player, quest) === STAGE_KEY
                        ? "The chest is locked."
                        : "The chest is empty.",
                );
            },
        });
    }

    registry.registerItemAction(
        ITEM.message,
        (event) => {
            if (getQuestStage(event.player, quest) === STAGE_KEY) {
                setQuestStage(event.player, quest, event.services, STAGE_NOTE);
            }
            startConversation(
                {
                    player: event.player,
                    services: event.services,
                    npcId: NPC.frank,
                    npcName: "Pirate's message",
                },
                [
                    showItem(ITEM.message, [
                        "Visit the city of the White Knights.",
                        "In the park, Saradomin points to the X that marks the spot.",
                    ]),
                ],
            );
        },
        "read",
    );
    registry.registerItemAction(
        ITEM.spade,
        (event) => {
            const player = event.player;
            const distance = Math.max(
                Math.abs(player.tileX - TREASURE_TILE.x),
                Math.abs(player.tileY - TREASURE_TILE.y),
            );
            if (
                getQuestStage(player, quest) !== STAGE_NOTE ||
                distance > 1 ||
                player.level !== TREASURE_TILE.level
            ) {
                return;
            }
            const gardener = event.services.npc.spawnNpc({
                id: 3275,
                name: "Gardener",
                x: 2996,
                y: 3381,
                level: 0,
                wanderRadius: 3,
            });
            if (gardener) {
                event.services.npc.queueNpcForcedChat(gardener, "Hey, leave off my flowers!");
                gardener.engageCombat(player.id, event.tick, {
                    tileX: player.tileX,
                    tileY: player.tileY,
                });
            }
            event.services.messaging.sendGameMessage(
                player,
                "You dig a hole and find a little bag of treasure.",
            );
            completeQuest(player, event.services, quest);
        },
        "dig",
    );
}
