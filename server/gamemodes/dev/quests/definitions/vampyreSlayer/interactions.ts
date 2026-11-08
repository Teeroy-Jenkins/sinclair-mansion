import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnNpcEvent,
    LocInteractionEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    COUNT_TILE,
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_HARLOW,
    STAGE_STARTED,
} from "./constants";

type HarlowEvent = NpcInteractionEvent | ItemOnNpcEvent;

const knownPlayers = new Map<number, PlayerState>();
const countByPlayer = new Map<number, number>();
const registeredEventBuses = new WeakSet<object>();

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

function createMorganHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: NPC.morgan,
            npcName: "Morgan",
        };
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [
                sayNpc("Thank you again for ridding us of Count Draynor."),
            ]);
            return;
        }
        if (stage > 0) {
            startConversation(context, [
                sayNpc(
                    "Please hurry. Dr Harlow is usually drinking in the Blue Moon Inn in Varrock.",
                ),
                choose([
                    option("Where is the vampyre?", [
                        sayNpc(
                            "In the crypt beneath Draynor Manor. Take garlic; vampyres cannot stand it.",
                        ),
                    ]),
                    option("I'll find Dr Harlow."),
                ]),
            ]);
            return;
        }
        startConversation(context, [
            sayNpc("Please, please help us! A vampyre is threatening our village."),
            choose([
                option("How can I help?", [
                    sayNpc(
                        "Seek my old friend Dr Harlow. He knows how to defeat vampyres and drinks at the Blue Moon Inn in Varrock.",
                    ),
                    run(({ player, services }) =>
                        setQuestStage(player, quest, services, STAGE_STARTED),
                    ),
                ]),
                option("No, vampyres sound dangerous.", [
                    sayNpc("They are, but someone must save us!"),
                ]),
            ]),
        ]);
    };
}

function createHarlowHandler(quest: QuestDefinition): (event: HarlowEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: NPC.harlow,
            npcName: "Dr Harlow",
        };
        if (stage === 0) {
            startConversation(context, [sayNpc("Buy me a drink sometime, friend.")]);
            return;
        }
        if (stage >= STAGE_HARLOW) {
            startConversation(
                context,
                hasItem(event.player, event.services, ITEM.stake)
                    ? [
                          sayNpc(
                              "Remember: a hammer and stake for the final blow. Garlic will weaken him.",
                          ),
                      ]
                    : [
                          sayNpc("Lost your stake? I can carve another."),
                          run(({ player, services }) => {
                              giveItem(player, services, ITEM.stake);
                          }),
                      ],
            );
            return;
        }
        const hasBeer = hasItem(event.player, event.services, ITEM.beer);
        startConversation(context, [
            sayNpc("Morgan sent you? I might remember how to kill a vampyre... but first, a beer."),
            choose([
                option(
                    "Here's a beer.",
                    hasBeer
                        ? [
                              sayNpc(
                                  "Excellent! Take this stake. Weaken Count Draynor with garlic, then drive the stake through his heart using a hammer.",
                              ),
                              run(({ player, services }) => {
                                  if (
                                      !takeQuestItems(player, services, [
                                          {
                                              itemId: ITEM.beer,
                                              quantity: 1,
                                              journalLabel: "",
                                          },
                                      ])
                                  ) {
                                      return;
                                  }
                                  if (giveItem(player, services, ITEM.stake)) {
                                      setQuestStage(player, quest, services, STAGE_HARLOW);
                                  }
                              }),
                          ]
                        : [
                              sayPlayer("I don't actually have one."),
                              sayNpc("Then buy one from the barman."),
                          ],
                ),
                option("Tell me first.", [sayNpc("No beer, no secrets.")]),
            ]),
        ]);
    };
}

function searchGarlicCupboard(event: LocInteractionEvent): void {
    if (!event.services.inventory.hasInventorySlot(event.player)) {
        event.services.messaging.sendGameMessage(
            event.player,
            "The cupboard contains garlic, but you have no room for it.",
        );
        return;
    }
    if (giveItem(event.player, event.services, ITEM.garlic)) {
        event.services.messaging.sendGameMessage(
            event.player,
            "You take a clove of garlic from the cupboard.",
        );
    }
}

function spawnCount(player: PlayerState, services: ScriptServices): void {
    const existingId = countByPlayer.get(player.id);
    if (existingId !== undefined && services.combat.getNpc(existingId)) {
        services.messaging.sendGameMessage(player, "Count Draynor has already risen from the coffin.");
        return;
    }
    const count = services.npc.spawnNpc({
        id: NPC.count,
        name: "Count Draynor",
        ...COUNT_TILE,
        wanderRadius: 1,
    });
    if (!count) return;

    countByPlayer.set(player.id, count.id);
    knownPlayers.set(player.id, player);
    if (hasItem(player, services, ITEM.garlic)) {
        count.applyDamage(10);
        count.drainCombatStat("attack", 10);
        count.drainCombatStat("strength", 10);
        count.drainCombatStat("defence", 40);
        services.messaging.sendGameMessage(player, "The vampyre seems to weaken.");
    } else {
        services.messaging.sendGameMessage(player, "Count Draynor rises from his coffin!");
    }
}

function registerCountDeathHandler(quest: QuestDefinition, services: ScriptServices): void {
    const eventBus = services.system.eventBus;
    if (!eventBus || registeredEventBuses.has(eventBus)) return;
    registeredEventBuses.add(eventBus);

    eventBus.on("player:login", ({ player }) => knownPlayers.set(player.id, player));
    eventBus.on("player:logout", ({ playerId }) => {
        knownPlayers.delete(playerId);
        countByPlayer.delete(playerId);
    });
    eventBus.on("npc:death", ({ npc, npcTypeId, killerPlayerId }) => {
        if (
            npcTypeId !== NPC.count ||
            killerPlayerId === undefined ||
            countByPlayer.get(killerPlayerId) !== npc.id
        ) {
            return;
        }
        countByPlayer.delete(killerPlayerId);
        const player = knownPlayers.get(killerPlayerId);
        if (!player || getQuestStage(player, quest) >= STAGE_COMPLETE) return;

        const canStake =
            hasItem(player, services, ITEM.stake) && hasItem(player, services, ITEM.hammer);
        if (!canStake) {
            services.messaging.sendGameMessage(
                player,
                "Without a stake and hammer, Count Draynor regenerates!",
            );
            spawnCount(player, services);
            return;
        }
        takeQuestItems(player, services, [
            { itemId: ITEM.stake, quantity: 1, journalLabel: "" },
        ]);
        completeQuest(player, services, quest);
    });
}

export function registerVampyreSlayerInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const morgan = createMorganHandler(quest);
    registry.registerNpcScript({ npcId: NPC.morgan, option: "talk-to", handler: morgan });
    registry.registerNpcScript({ npcId: NPC.morgan, option: undefined, handler: morgan });

    const harlow = createHarlowHandler(quest);
    registry.registerNpcScript({ npcId: NPC.harlow, option: "talk-to", handler: harlow });
    registry.registerNpcScript({ npcId: NPC.harlow, option: undefined, handler: harlow });
    registry.registerItemOnNpc(ITEM.beer, NPC.harlow, harlow);

    for (const locId of LOC.garlicCupboard) {
        registry.registerLocScript({ locId, action: "search", handler: searchGarlicCupboard });
        registry.registerLocScript({ locId, action: "open", handler: searchGarlicCupboard });
    }
    for (const locId of LOC.coffin) {
        registry.registerLocScript({
            locId,
            action: "open",
            handler: (event) => {
                const stage = getQuestStage(event.player, quest);
                if (stage === 0) {
                    event.services.messaging.sendGameMessage(event.player, "The coffin is sealed shut.");
                    return;
                }
                if (stage >= STAGE_COMPLETE) {
                    event.services.messaging.sendGameMessage(event.player, "The coffin is empty.");
                    return;
                }
                event.services.messaging.sendGameMessage(event.player, "You open the coffin.");
                spawnCount(event.player, event.services);
            },
        });
        registry.registerLocScript({
            locId,
            action: "search",
            handler: (event) => {
                const stage = getQuestStage(event.player, quest);
                if (stage > 0 && stage < STAGE_COMPLETE) {
                    spawnCount(event.player, event.services);
                } else {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "You find nothing in the coffin.",
                    );
                }
            },
        });
    }

    registerCountDeathHandler(quest, services);
}
