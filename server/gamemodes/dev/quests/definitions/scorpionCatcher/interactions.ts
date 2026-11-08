import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { registerBarCrawlInteractions } from "../barCrawl";
import {
    completeQuest,
    getQuestStage,
    meetsQuestRequirements,
    setQuestStage,
} from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { DialogueStep } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    CAGE_ITEMS,
    ITEM,
    LOC,
    NPC,
    STAGE_COMPLETE,
    STAGE_FIRST_HINT,
    STAGE_NOT_STARTED,
    STAGE_SECOND_HINT,
    STAGE_STARTED,
} from "./constants";

const CAGE_MASK_BY_ITEM = new Map<number, number>([
    [ITEM.emptyCage, 0],
    [ITEM.first, 1],
    [ITEM.second, 2],
    [ITEM.third, 4],
    [ITEM.firstSecond, 3],
    [ITEM.firstThird, 5],
    [ITEM.secondThird, 6],
    [ITEM.fullCage, 7],
]);

const CAGE_ITEM_BY_MASK = new Map<number, number>(
    [...CAGE_MASK_BY_ITEM].map(([itemId, mask]) => [mask, itemId]),
);

const SCORPION_BIT_BY_NPC = new Map<number, number>([
    [NPC.firstScorpion, 1],
    [NPC.secondScorpion, 2],
    [NPC.thirdScorpion, 4],
]);

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function ownsCage(player: PlayerState, services: ScriptServices): boolean {
    return CAGE_ITEMS.some(
        (itemId) => services.inventory.findOwnedItemLocation(player, itemId) !== undefined,
    );
}

function giveItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    if (!services.inventory.hasInventorySlot(player)) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function removeQuantity(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity: number,
): boolean {
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const taken = Math.min(remaining, entry.quantity);
        const left = entry.quantity - taken;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= taken;
        if (remaining === 0) break;
    }
    if (remaining !== 0) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function enchantStaff(
    player: PlayerState,
    services: ScriptServices,
    sourceItemId: number,
    resultItemId: number,
): void {
    if (!services.inventory.playerHasItem(player, sourceItemId)) {
        services.messaging.sendGameMessage(player, "You don't have that battlestaff.");
        return;
    }
    const coinEntry = services.inventory
        .getInventoryItems(player)
        .find((entry) => entry.itemId === ITEM.coins && entry.quantity >= 40_000);
    if (!coinEntry) {
        services.messaging.sendGameMessage(player, "You need 40,000 coins to pay Thormac.");
        return;
    }
    if (!removeQuantity(player, services, sourceItemId, 1)) return;
    removeQuantity(player, services, ITEM.coins, 40_000);
    const result = services.inventory.addItemToInventory(player, resultItemId, 1);
    if (result.added !== 1) {
        services.inventory.addItemToInventory(player, sourceItemId, 1);
        services.inventory.addItemToInventory(player, ITEM.coins, 40_000);
        services.inventory.snapshotInventory(player);
        return;
    }
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(player, "Thormac enchants your battlestaff.");
}

function postQuestThormac(event: NpcInteractionEvent): void {
    const staffOption = (label: string, source: number, result: number) =>
        option(label, [run(({ player, services }) => enchantStaff(player, services, source, result))]);
    startConversation(context(event, "Thormac"), [
        sayNpc("Thank you again for rescuing my scorpions."),
        choose([
            option("That's okay.", []),
            option("Enchant a battlestaff for me.", [
                sayNpc("The materials cost 40,000 coins. Which staff should I enchant?"),
                choose([
                    staffOption("Air battlestaff", ITEM.airBattlestaff, ITEM.mysticAirStaff),
                    staffOption("Water battlestaff", ITEM.waterBattlestaff, ITEM.mysticWaterStaff),
                    staffOption("Earth battlestaff", ITEM.earthBattlestaff, ITEM.mysticEarthStaff),
                    option("More choices...", [
                        choose([
                            staffOption("Fire battlestaff", ITEM.fireBattlestaff, ITEM.mysticFireStaff),
                            staffOption("Lava battlestaff", ITEM.lavaBattlestaff, ITEM.mysticLavaStaff),
                            option("Never mind.", []),
                        ]),
                    ]),
                ]),
            ]),
        ]),
    ]);
}

function createThormacHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage >= STAGE_COMPLETE) {
            postQuestThormac(event);
            return;
        }
        if (stage === STAGE_NOT_STARTED) {
            const accept = meetsQuestRequirements(event.player, event.services, quest)
                ? [
                      showItem(ITEM.emptyCage, "Thormac gives you a scorpion cage."),
                      run(({ player, services }) => {
                          if (!ownsCage(player, services) && !giveItem(player, services, ITEM.emptyCage)) {
                              return;
                          }
                          setQuestStage(player, quest, services, STAGE_STARTED);
                      }),
                      sayNpc("A Seer in the village north of here can locate them for you."),
                  ]
                : [sayNpc("You need level 31 Prayer before you can handle my Kharid scorpions.")];
            startConversation(context(event, "Thormac"), [
                sayNpc([
                    "I've lost my three pet Kharid scorpions.",
                    "Could you find them and bring them home?",
                ]),
                choose([
                    option("Okay, I will help you.", accept),
                    option("I'm a little busy.", [sayNpc("Blast! I'll have to find someone else.")]),
                ]),
            ]);
            return;
        }
        if (event.services.inventory.playerHasItem(event.player, ITEM.fullCage)) {
            startConversation(context(event, "Thormac"), [
                sayPlayer("I have retrieved all your scorpions."),
                sayNpc("Aha, my little scorpions home at last!"),
                run(({ player, services }) => {
                    removeQuantity(player, services, ITEM.fullCage, 1);
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        const steps: DialogueStep[] = [sayNpc("How goes your quest?")];
        if (!ownsCage(event.player, event.services)) {
            steps.push(
                sayPlayer("I've lost my cage."),
                sayNpc("Here's another one. Try not to lose this cage too."),
                run(({ player, services }) => {
                    giveItem(player, services, ITEM.emptyCage);
                }),
            );
        } else {
            steps.push(
                sayPlayer("I've not caught all the scorpions yet."),
                sayNpc("Speak to the Seers north of here if you need another clue."),
            );
        }
        startConversation(context(event, "Thormac"), steps);
    };
}

function cageContainsFirst(player: PlayerState, services: ScriptServices): boolean {
    return [ITEM.first, ITEM.firstSecond, ITEM.firstThird, ITEM.fullCage].some((itemId) =>
        services.inventory.playerHasItem(player, itemId),
    );
}

function createSeerHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_STARTED) {
            startConversation(context(event, "Seer"), [
                sayNpc("Many greetings."),
                sayPlayer("I need to locate Thormac's Kharid scorpions."),
                sayNpc([
                    "I see one near nasty spiders and two coffins.",
                    "It slipped through a crack into a secret room.",
                ]),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_FIRST_HINT)),
            ]);
            return;
        }
        if (stage === STAGE_FIRST_HINT && cageContainsFirst(event.player, event.services)) {
            startConversation(context(event, "Seer"), [
                sayPlayer("I retrieved the scorpion near the spiders."),
                sayNpc([
                    "The second was found by a merchant in a village of warriors.",
                    "He sent it to a barbarian outpost north-west of Camelot.",
                    "The last is upstairs beside brown clothing laid on a table.",
                ]),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SECOND_HINT)),
            ]);
            return;
        }
        if (stage === STAGE_FIRST_HINT) {
            startConversation(context(event, "Seer"), [
                sayNpc("The first scorpion is in a secret room near nasty spiders and two coffins."),
            ]);
            return;
        }
        if (stage >= STAGE_SECOND_HINT && stage < STAGE_COMPLETE) {
            startConversation(context(event, "Seer"), [
                sayNpc([
                    "One scorpion is at the Barbarian Outpost north-west of Camelot.",
                    "The other is upstairs near brown clothing on a table.",
                ]),
            ]);
            return;
        }
        startConversation(context(event, "Seer"), [
            sayNpc("Many greetings. Knowledge comes from experience, and power from battleaxes."),
        ]);
    };
}

function createPeksaHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) !== STAGE_SECOND_HINT) {
            startConversation(context(event, "Peksa"), [
                sayNpc("Are you interested in buying or selling a helmet?"),
            ]);
            return;
        }
        startConversation(context(event, "Peksa"), [
            sayPlayer("I've heard you had a small scorpion in your possession."),
            sayNpc([
                "I gave it to my brother Ivor.",
                "I hid it in his bed at the Barbarian Outpost north-west of Camelot.",
            ]),
        ]);
    };
}

function requiredStageForScorpion(npcTypeId: number): number {
    return npcTypeId === NPC.firstScorpion ? STAGE_FIRST_HINT : STAGE_SECOND_HINT;
}

function registerScorpions(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const [npcTypeId, scorpionBit] of SCORPION_BIT_BY_NPC) {
        registry.registerNpcScript({
            npcId: npcTypeId,
            option: "pick-up",
            handler: ({ player, services }) => {
                if (getQuestStage(player, quest) < requiredStageForScorpion(npcTypeId)) {
                    services.messaging.sendGameMessage(player, "The scorpion stings you!");
                    services.combat.applyPlayerHitsplat(
                        player,
                        0,
                        3,
                        services.system.getCurrentTick(),
                    );
                    return;
                }
                services.messaging.sendGameMessage(player, "You need to use your cage on the scorpion.");
            },
        });
        for (const cageItemId of CAGE_ITEMS) {
            registry.registerItemOnNpc(cageItemId, npcTypeId, (event) => {
                if (getQuestStage(event.player, quest) < requiredStageForScorpion(npcTypeId)) {
                    event.services.messaging.sendGameMessage(event.player, "You do not know where this scorpion belongs.");
                    return;
                }
                const currentMask = CAGE_MASK_BY_ITEM.get(event.source.itemId);
                if (currentMask === undefined) return;
                if ((currentMask & scorpionBit) !== 0) {
                    event.services.messaging.sendGameMessage(event.player, "You've already caught this scorpion.");
                    return;
                }
                const nextItemId = CAGE_ITEM_BY_MASK.get(currentMask | scorpionBit);
                if (nextItemId === undefined) return;
                event.services.inventory.setInventorySlot(event.player, event.source.slot, nextItemId, 1);
                event.services.inventory.snapshotInventory(event.player);
                event.services.npc.stopNpcMovement(event.target, 2);
                event.services.messaging.sendGameMessage(event.player, "You catch a scorpion!");
            });
        }
    }
}

export function registerScorpionCatcherInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerBarCrawlInteractions(registry, services);

    registry.registerNpcScript({
        npcId: NPC.thormac,
        option: "talk-to",
        handler: createThormacHandler(quest),
    });
    registry.registerNpcScript({
        npcId: NPC.seer,
        option: "talk-to",
        handler: createSeerHandler(quest),
    });
    registry.registerNpcScript({
        npcId: NPC.peksa,
        option: "talk-to",
        handler: createPeksaHandler(quest),
    });

    registerScorpions(quest, registry);
    registry.registerLocScript({
        locId: LOC.secretWall,
        action: undefined,
        handler: (event) => {
            if (getQuestStage(event.player, quest) < STAGE_FIRST_HINT) {
                event.services.messaging.sendGameMessage(event.player, "It looks like an ordinary wall.");
                return;
            }
            const nextX = event.player.tileX < event.tile.x ? event.tile.x + 1 : event.tile.x - 1;
            event.services.movement.teleportPlayer(event.player, nextX, event.tile.y, event.level);
            event.services.messaging.sendGameMessage(event.player, "You've found a secret door.");
        },
    });
}
