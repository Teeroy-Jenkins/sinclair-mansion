import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_COMPETING,
    STAGE_GARLIC,
    STAGE_STARTED,
    STAGE_WON,
    TUNNEL_DESTINATION,
    VARP_COMPETITION_CATCHES,
    VARP_PIPE_STASHED,
} from "./constants";

function setVarp(
    player: PlayerState,
    services: ScriptServices,
    id: number,
    value: number,
): void {
    player.varps.setVarpValue(id, value);
    services.variables.sendVarp(player, id, value);
}

function has(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.playerHasItem(player, itemId);
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function give(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, 1);
    if (result.added !== 1) {
        services.messaging.sendGameMessage(player, "You need a free inventory slot.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function createDwarfHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: event.npc.typeId,
            npcName: event.npc.name ?? "Mountain dwarf",
        };
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [
                sayNpc("Welcome, great Fishing Champion! The tunnel is open to you."),
            ]);
            return;
        }
        if (stage === STAGE_WON && has(event.player, event.services, ITEM.trophy)) {
            startConversation(context, [
                sayPlayer("I won, and I have the trophy here."),
                sayNpc("Well done! You have earned our friendship and use of the tunnel."),
                run(({ player, services }) => {
                    const handedOver = takeQuestItems(player, services, [
                        { itemId: ITEM.trophy, quantity: 1, journalLabel: "" },
                    ]);
                    if (handedOver) completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        if (stage > 0) {
            const lines = has(event.player, event.services, ITEM.pass)
                ? [sayNpc("Have you won the Hemenster competition yet?")]
                : [
                      sayNpc("Lost your pass? Take this spare and be more careful."),
                      run(({ player, services }) => {
                          give(player, services, ITEM.pass);
                      }),
                  ];
            startConversation(context, lines);
            return;
        }
        const fishing = event.services.skills.getSkill(event.player, SkillId.Fishing).baseLevel;
        const friendship =
            fishing < 10
                ? [sayNpc("Not until you have at least level 10 Fishing.")]
                : [
                      sayNpc(
                          "Win the Hemenster Fishing Contest and bring us its golden trophy.",
                      ),
                      choose([
                          option("I'll win it for you.", [
                              sayNpc("Take this competition pass and do us proud."),
                              run(({ player, services }) => {
                                  if (!give(player, services, ITEM.pass)) return;
                                  setQuestStage(player, quest, services, STAGE_STARTED);
                              }),
                          ]),
                          option("I'm not much of a fisherman."),
                      ]),
                  ];
        startConversation(context, [
            sayNpc("This tunnel is private. Dwarves only."),
            choose([
                option("Could we become friends?", friendship),
                option("I was only saying hello.", [sayNpc("Hello then.")]),
            ]),
        ]);
    };
}

function createBonzoHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: NPC.bonzo,
            npcName: "Bonzo",
        };
        if (stage === STAGE_WON) {
            if (owns(event.player, event.services, ITEM.trophy)) {
                startConversation(context, [
                    sayNpc("Take your trophy to the mountain dwarves. They'll be delighted."),
                ]);
            } else {
                startConversation(context, [
                    sayNpc("Lost the winner's trophy? Here is a replacement."),
                    run(({ player, services }) => {
                        give(player, services, ITEM.trophy);
                    }),
                ]);
            }
            return;
        }
        if (stage === STAGE_STARTED) {
            startConversation(context, [
                sayNpc("Roll up! Only five coins to enter the fishing competition."),
                choose([
                    option("I'll enter.", [
                        run(({ player, services }) => {
                            const paid = takeQuestItems(player, services, [
                                { itemId: ITEM.coins, quantity: 5, journalLabel: "" },
                            ]);
                            if (!paid) {
                                services.messaging.sendGameMessage(
                                    player,
                                    "You need 5 coins to enter.",
                                );
                                return;
                            }
                            setVarp(player, services, VARP_COMPETITION_CATCHES, 0);
                            const garlicStashed =
                                player.varps.getVarpValue(VARP_PIPE_STASHED) !== 0;
                            setQuestStage(
                                player,
                                quest,
                                services,
                                garlicStashed ? STAGE_GARLIC : STAGE_COMPETING,
                            );
                        }),
                        sayNpc(
                            "Your spot is beside the willow tree. The stranger has the spot by the pipes.",
                        ),
                    ]),
                    option("No thanks."),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_COMPETING || stage === STAGE_GARLIC) {
            const catches = event.player.varps.getVarpValue(VARP_COMPETITION_CATCHES);
            if (catches < 3) {
                startConversation(context, [
                    sayNpc("Keep fishing. I need three fish before judging."),
                ]);
                return;
            }
            if (has(event.player, event.services, ITEM.carp)) {
                startConversation(context, [
                    sayNpc("Time's up! That giant carp is the biggest fish here. You win!"),
                    run(({ player, services }) => {
                        takeQuestItems(player, services, [
                            { itemId: ITEM.carp, quantity: 1, journalLabel: "" },
                        ]);
                        if (give(player, services, ITEM.trophy)) {
                            setQuestStage(player, quest, services, STAGE_WON);
                        }
                    }),
                ]);
            } else {
                startConversation(context, [
                    sayNpc("The stranger caught a bigger fish. Better luck next time."),
                    run(({ player, services }) => {
                        setQuestStage(player, quest, services, STAGE_STARTED);
                        setVarp(player, services, VARP_COMPETITION_CATCHES, 0);
                    }),
                ]);
            }
            return;
        }
        startConversation(context, [sayNpc("Hello, champ!")]);
    };
}

export function registerFishingContestInteractions(quest: QuestDefinition, registry: IScriptRegistry): void {
    const dwarf = createDwarfHandler(quest);
    for (const npcId of [NPC.austri, NPC.vestri]) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: dwarf });
        registry.registerNpcScript({ npcId, option: undefined, handler: dwarf });
    }
    const bonzo = createBonzoHandler(quest);
    registry.registerNpcScript({ npcId: NPC.bonzo, option: "talk-to", handler: bonzo });
    registry.registerNpcScript({ npcId: NPC.bonzo, option: undefined, handler: bonzo });
    registry.registerNpcScript({
        npcId: NPC.morris,
        option: "talk-to",
        handler: (event) => {
            startConversation(
                {
                    player: event.player,
                    services: event.services,
                    npcId: NPC.morris,
                    npcName: "Morris",
                },
                has(event.player, event.services, ITEM.pass)
                    ? [sayNpc("Your pass is in order. Move on through.")]
                    : [sayNpc("Competition pass, please.")],
            );
        },
    });

    const registerTunnel = (
        locId: number,
        destination: { readonly x: number; readonly y: number; readonly level: number },
        requiresCompletion: boolean,
    ): void => {
        registry.registerLocScript({
            locId,
            action: undefined,
            handler: (event) => {
                if (requiresCompletion && getQuestStage(event.player, quest) < STAGE_COMPLETE) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "A mountain dwarf stops you from using the private tunnel.",
                    );
                    return;
                }
                event.services.movement.teleportPlayer(
                    event.player,
                    destination.x,
                    destination.y,
                    destination.level,
                );
            },
        });
    };
    registerTunnel(LOC.westTunnelOutside, TUNNEL_DESTINATION.westInside, true);
    registerTunnel(LOC.eastTunnelOutside, TUNNEL_DESTINATION.eastInside, true);
    registerTunnel(LOC.westTunnelInside, TUNNEL_DESTINATION.westOutside, false);
    registerTunnel(LOC.eastTunnelInside, TUNNEL_DESTINATION.eastOutside, false);

    const digRedVine = (event: {
        player: PlayerState;
        services: ScriptServices;
    }): void => {
        if (!has(event.player, event.services, ITEM.spade)) {
            event.services.messaging.sendGameMessage(
                event.player,
                "You need a spade to dig amongst the vines.",
            );
            return;
        }
        event.services.animation.playPlayerSeq(event.player, 830);
        if (give(event.player, event.services, ITEM.worm)) {
            event.services.messaging.sendGameMessage(
                event.player,
                "You dig amongst the vines and find a red vine worm.",
            );
        }
    };
    for (const locId of LOC.redVine) {
        registry.registerLocScript({ locId, action: "check", handler: digRedVine });
        registry.registerItemOnLoc(ITEM.spade, locId, digRedVine);
    }

    for (const locId of LOC.gate) {
        registry.registerLocScript({
            locId,
            action: undefined,
            handler: (event) => {
                if (!has(event.player, event.services, ITEM.pass)) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "Morris stops you: competition pass, please.",
                    );
                    return;
                }
                const west = event.player.tileX <= event.tile.x;
                event.services.movement.teleportPlayer(
                    event.player,
                    event.tile.x + (west ? 1 : -1),
                    event.player.tileY,
                    event.level,
                );
            },
        });
    }
    registry.registerItemOnLoc(ITEM.garlic, LOC.pipe, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_STARTED || stage >= STAGE_WON) return;
        if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
        setVarp(event.player, event.services, VARP_PIPE_STASHED, 1);
        if (stage >= STAGE_COMPETING) {
            setQuestStage(event.player, quest, event.services, STAGE_GARLIC);
        }
        event.services.messaging.sendGameMessage(
            event.player,
            "You stash the garlic in the pipe. The sinister stranger moves away.",
        );
    });

    for (const npcId of [NPC.normalSpot, NPC.pipeSpot]) {
        registry.registerNpcScript({
            npcId,
            option: undefined,
            handler: (event) => {
                const stage = getQuestStage(event.player, quest);
                if (stage !== STAGE_COMPETING && stage !== STAGE_GARLIC) return;
                const fishing = event.services.skills.getSkill(
                    event.player,
                    SkillId.Fishing,
                ).baseLevel;
                if (fishing < 10) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "You need at least level 10 Fishing to lure these fish.",
                    );
                    return;
                }
                if (!has(event.player, event.services, ITEM.rod)) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "You need a fishing rod.",
                    );
                    return;
                }
                const baitId = has(event.player, event.services, ITEM.worm)
                    ? ITEM.worm
                    : ITEM.bait;
                const slot = event.services.inventory.findInventorySlotWithItem(
                    event.player,
                    baitId,
                );
                if (slot === undefined) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "You need some bait.",
                    );
                    return;
                }
                const baitStack = event.services.inventory
                    .getInventoryItems(event.player)
                    .find((entry) => entry.slot === slot);
                if (!event.services.inventory.hasInventorySlot(event.player) &&
                    (baitStack?.quantity ?? 0) > 1) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "You can't carry any more fish.",
                    );
                    return;
                }
                event.services.inventory.consumeItem(event.player, slot);
                const winningSpot =
                    npcId === NPC.pipeSpot && stage === STAGE_GARLIC && baitId === ITEM.worm;
                if (!give(event.player, event.services, winningSpot ? ITEM.carp : ITEM.sardine)) {
                    return;
                }
                const catchCount =
                    event.player.varps.getVarpValue(VARP_COMPETITION_CATCHES) + 1;
                setVarp(
                    event.player,
                    event.services,
                    VARP_COMPETITION_CATCHES,
                    Math.min(3, catchCount),
                );
                event.services.messaging.sendGameMessage(
                    event.player,
                    winningSpot ? "You catch a giant carp." : "You catch a sardine.",
                );
            },
        });
    }
}
