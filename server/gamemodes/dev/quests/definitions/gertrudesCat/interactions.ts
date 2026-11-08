import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnNpcEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    KITTEN_CRATES,
    LOC,
    NPC,
    REJECTED_FISH,
    STAGE_COMPLETE,
    STAGE_GAVE_MILK,
    STAGE_GAVE_SARDINE,
    STAGE_PAID_BOY,
    STAGE_RESCUED,
    STAGE_STARTED,
    VARP_KITTEN_CRATE,
} from "./constants";

type CatEvent = NpcInteractionEvent | ItemOnNpcEvent;

function setVarp(player: PlayerState, services: ScriptServices, id: number, value: number): void {
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

function createGertrudeHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: NPC.gertrude,
            npcName: "Gertrude",
        };
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [
                sayNpc("Fluffs and the kittens are doing wonderfully. Thank you again."),
            ]);
            return;
        }
        if (stage === STAGE_RESCUED) {
            startConversation(context, [
                sayPlayer("Fluffs ran home with her kitten."),
                sayNpc(
                    "She just arrived! Thank you. Please take one of her kittens and some food.",
                ),
                run(({ player, services }) => completeQuest(player, services, quest)),
            ]);
            return;
        }
        if (stage === 0) {
            startConversation(context, [
                sayNpc("I've lost my beloved cat, Fluffs. Could you search for her?"),
                choose([
                    option("Well, I suppose I could.", [
                        sayNpc(
                            "Thank you! My sons Shilop and Wilough saw her last. They're at the marketplace.",
                        ),
                        run(({ player, services }) =>
                            setQuestStage(player, quest, services, STAGE_STARTED),
                        ),
                    ]),
                    option("What's in it for me?", [
                        sayNpc("I am poor, but I can offer a warm meal and my gratitude."),
                    ]),
                    option("Sorry, I'm too busy."),
                ]),
            ]);
            return;
        }
        const lines =
            stage === STAGE_STARTED
                ? [sayNpc("Have you found Shilop? He should be at Varrock marketplace.")]
                : stage === STAGE_GAVE_MILK
                  ? [
                        sayNpc(
                            "Fluffs may be hungry. She loves raw sardines seasoned with doogle leaves.",
                        ),
                    ]
                  : [sayNpc("Please bring Fluffs home safely.")];
        startConversation(context, lines);
    };
}

function createBoyHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: event.npc.typeId,
            npcName: event.npc.name ?? "Boy",
        };
        if (stage === 0) {
            startConversation(context, [sayNpc("We don't talk to strange old people.")]);
            return;
        }
        if (stage >= STAGE_PAID_BOY) {
            startConversation(context, [
                sayNpc(
                    "Fluffs was at our abandoned lumber yard north-east of the Jolly Boar Inn.",
                ),
            ]);
            return;
        }
        startConversation(context, [
            sayPlayer("Where did you last see Fluffs?"),
            sayNpc("At our secret play area, but that information costs 100 coins."),
            choose([
                option("Okay then, I'll pay.", [
                    run(({ player, services }) => {
                        const paid = takeQuestItems(player, services, [
                            { itemId: ITEM.coins, quantity: 100, journalLabel: "" },
                        ]);
                        if (!paid) {
                            services.messaging.sendGameMessage(player, "You need 100 coins.");
                            return;
                        }
                        setQuestStage(player, quest, services, STAGE_PAID_BOY);
                    }),
                    sayNpc(
                        "It's the abandoned lumber yard beyond the Jolly Boar Inn. Find the broken fence.",
                    ),
                ]),
                option("I'm not paying you a penny."),
                option("Tell me or I'll hurt you.", [
                    sayNpc("You wouldn't! I'd have you behind bars!"),
                ]),
            ]),
        ]);
    };
}

function createCatHandler(quest: QuestDefinition): (event: CatEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage >= STAGE_RESCUED) {
            event.services.messaging.sendGameMessage(event.player, "Fluffs has already run home.");
            return;
        }
        if ("source" in event) {
            if (event.source.itemId === ITEM.milk) {
                if (stage !== STAGE_PAID_BOY) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "The cat doesn't seem to be thirsty.",
                    );
                    return;
                }
                if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
                give(event.player, event.services, ITEM.bucket);
                setQuestStage(event.player, quest, event.services, STAGE_GAVE_MILK);
                event.services.messaging.sendGameMessage(
                    event.player,
                    "Fluffs drinks the milk and mews.",
                );
                return;
            }
            if (event.source.itemId === ITEM.seasonedSardine) {
                if (stage !== STAGE_GAVE_MILK) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "The cat doesn't seem to be hungry.",
                    );
                    return;
                }
                if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
                const crate = ((event.player.id + event.tick) % KITTEN_CRATES.length) + 1;
                setVarp(event.player, event.services, VARP_KITTEN_CRATE, crate);
                setQuestStage(event.player, quest, event.services, STAGE_GAVE_SARDINE);
                event.services.messaging.sendGameMessage(
                    event.player,
                    "Fluffs eats the seasoned sardine, but still seems afraid.",
                );
                return;
            }
            if (event.source.itemId === ITEM.fluffsKitten) {
                if (stage !== STAGE_GAVE_SARDINE) {
                    event.services.messaging.sendGameMessage(
                        event.player,
                        "Fluffs is not ready to leave yet.",
                    );
                    return;
                }
                if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
                setQuestStage(event.player, quest, event.services, STAGE_RESCUED);
                event.services.messaging.sendGameMessage(
                    event.player,
                    "Fluffs purrs and runs home with her kitten.",
                );
                return;
            }
        }
        const hint =
            stage < STAGE_PAID_BOY
                ? "The cat hisses and scratches you."
                : stage === STAGE_PAID_BOY
                  ? "Maybe the cat is thirsty?"
                  : stage === STAGE_GAVE_MILK
                    ? "Maybe the cat is hungry?"
                    : "You hear kittens mewing in the distance.";
        event.services.messaging.sendGameMessage(event.player, hint);
        event.services.combat.applyPlayerHitsplat(
            event.player,
            0,
            3,
            event.services.system.getCurrentTick(),
        );
    };
}

export function registerGertrudesCatInteractions(quest: QuestDefinition, registry: IScriptRegistry): void {
    const gertrude = createGertrudeHandler(quest);
    registry.registerNpcScript({ npcId: NPC.gertrude, option: "talk-to", handler: gertrude });
    registry.registerNpcScript({ npcId: NPC.gertrude, option: undefined, handler: gertrude });
    const boy = createBoyHandler(quest);
    for (const npcId of [NPC.shilop, NPC.wilough]) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: boy });
        registry.registerNpcScript({ npcId, option: undefined, handler: boy });
    }
    const cat = createCatHandler(quest);
    registry.registerNpcScript({ npcId: NPC.cat, option: "talk-to", handler: cat });
    registry.registerNpcScript({ npcId: NPC.cat, option: undefined, handler: cat });
    for (const itemId of [ITEM.milk, ITEM.seasonedSardine, ITEM.fluffsKitten]) {
        registry.registerItemOnNpc(itemId, NPC.cat, cat);
    }
    for (const itemId of REJECTED_FISH) {
        registry.registerItemOnNpc(itemId, NPC.cat, (event) => {
            event.services.messaging.sendGameMessage(
                event.player,
                "The cat doesn't want that fish. It seems to be very fussy!",
            );
        });
    }

    registry.registerItemOnItem(ITEM.doogleLeaves, ITEM.rawSardine, (event) => {
        const leaves = event.source.itemId === ITEM.doogleLeaves ? event.source : event.target;
        const sardine = event.source.itemId === ITEM.rawSardine ? event.source : event.target;
        if (!event.services.inventory.consumeItem(event.player, leaves.slot)) return;
        event.services.inventory.setInventorySlot(
            event.player,
            sardine.slot,
            ITEM.seasonedSardine,
            1,
        );
        event.services.inventory.snapshotInventory(event.player);
        event.services.messaging.sendGameMessage(
            event.player,
            "You rub the doogle leaves over the sardine.",
        );
    });
    registry.registerLocScript({
        locId: LOC.fence,
        action: undefined,
        handler: (event) => {
            const upstairs = event.player.level < event.level;
            event.services.movement.teleportPlayer(
                event.player,
                event.tile.x,
                event.tile.y,
                upstairs ? event.level : Math.max(0, event.level - 1),
            );
        },
    });
    for (const locId of [LOC.barrel, LOC.crate]) {
        registry.registerLocScript({
            locId,
            action: "search",
            handler: (event) =>
                event.services.messaging.sendGameMessage(
                    event.player,
                    "You search it. You can hear kittens mewing close by.",
                ),
        });
    }
    registry.registerNpcScript({
        npcId: NPC.crate,
        option: undefined,
        handler: (event) => {
            const wanted = event.player.varps.getVarpValue(VARP_KITTEN_CRATE) - 1;
            const tile = KITTEN_CRATES[wanted];
            const isChosenCrate =
                tile !== undefined &&
                event.npc.spawnX === tile[0] &&
                event.npc.spawnY === tile[1];
            const canFindKitten =
                getQuestStage(event.player, quest) === STAGE_GAVE_SARDINE &&
                isChosenCrate &&
                !owns(event.player, event.services, ITEM.fluffsKitten);
            if (!canFindKitten) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "You search the crate but find nothing.",
                );
                return;
            }
            if (give(event.player, event.services, ITEM.fluffsKitten)) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "You find Fluffs' kitten!",
                );
            }
        },
    });
}
