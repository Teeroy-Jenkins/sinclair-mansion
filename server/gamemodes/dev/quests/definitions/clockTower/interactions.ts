import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import type {
    GroundItemInteractionEvent,
    IScriptRegistry,
    ItemOnGroundEvent,
    LocInteractionEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BIT_BLACK_COG_COOLED,
    BIT_FIRST_RAT_GATE_OPEN,
    BIT_RAT_GATE_OPEN,
    BROTHER_KOJO_NPC_ID,
    COG_ITEM_IDS,
    COGS,
    ICE_GLOVE_ITEM_IDS,
    IMBUED_SMITHS_GLOVE_ITEM_IDS,
    ITEM,
    LOC,
    STAGE_ALL_COGS_PLACED,
    STAGE_COMPLETE,
    STAGE_NOT_STARTED,
    STAGE_PLACE_COGS,
    VARP_CLOCK_TOWER,
    VARP_CLOCK_TOWER_BITS,
} from "./constants";

function isBitSet(value: number, bit: number): boolean {
    return (value & (1 << bit)) !== 0;
}

function setBit(player: GroundItemInteractionEvent["player"], services: ScriptServices, varpId: number, bit: number, enabled = true): void {
    const current = player.varps.getVarpValue(varpId);
    const next = enabled ? current | (1 << bit) : current & ~(1 << bit);
    player.varps.setVarpValue(varpId, next);
    services.variables.sendVarp(player, varpId, next);
}

function hasAnyCog(event: GroundItemInteractionEvent | ItemOnGroundEvent): boolean {
    const carried = event.services.inventory.collectCarriedItemIds(event.player);
    return COG_ITEM_IDS.some((itemId) => carried.includes(itemId));
}

function canPickUpCog(event: GroundItemInteractionEvent | ItemOnGroundEvent): boolean {
    const stage = event.player.varps.getVarpValue(VARP_CLOCK_TOWER) & 0xf;
    if (stage === STAGE_NOT_STARTED) {
        event.services.messaging.sendGameMessage(event.player, "You must speak to Brother Kojo to begin this quest.");
        return false;
    }
    if (stage >= STAGE_COMPLETE) {
        event.services.messaging.sendGameMessage(event.player, "You have already completed this quest.");
        return false;
    }
    if (hasAnyCog(event)) {
        event.services.messaging.sendGameMessage(event.player, "The cogs are too heavy to carry more than one at a time.");
        return false;
    }
    return true;
}

function hasCoolingGloves(event: GroundItemInteractionEvent): boolean {
    const gloves = event.services.equipment.getEquippedItem(event.player, EquipmentSlot.GLOVES);
    return ICE_GLOVE_ITEM_IDS.some((itemId) => itemId === gloves) ||
        IMBUED_SMITHS_GLOVE_ITEM_IDS.some((itemId) => itemId === gloves);
}

function takeCog(event: GroundItemInteractionEvent): void {
    if (!canPickUpCog(event)) return;
    if (event.target.itemId === ITEM.blackCog) {
        const cooled = isBitSet(
            event.player.varps.getVarpValue(VARP_CLOCK_TOWER_BITS),
            BIT_BLACK_COG_COOLED,
        );
        if (!cooled && !hasCoolingGloves(event)) {
            event.services.messaging.sendGameMessage(
                event.player,
                "The cog is red hot from the flames. You cannot pick it up.",
            );
            return;
        }
        if (!cooled) {
            setBit(event.player, event.services, VARP_CLOCK_TOWER_BITS, BIT_BLACK_COG_COOLED);
            event.services.messaging.sendGameMessage(event.player, "Your gloves cool the cog enough to carry it.");
        }
    }

    if (!event.services.inventory.canStoreItem(event.player, event.target.itemId)) {
        event.services.messaging.sendGameMessage(event.player, "You don't have enough inventory space.");
        return;
    }
    const added = event.services.inventory.addItemToInventory(event.player, event.target.itemId, 1);
    if (added.added !== 1) return;
    const removed = event.services.groundItems.remove(event.target.stackId, 1, event.player);
    if (removed?.removed !== 1) {
        event.services.inventory.setInventorySlot(event.player, added.slot, -1, 0);
        event.services.inventory.snapshotInventory(event.player);
        return;
    }
    event.services.inventory.snapshotInventory(event.player);
}

function coolBlackCog(event: ItemOnGroundEvent, emptyContainerId: number): void {
    if (!canPickUpCog(event)) return;
    if (isBitSet(event.player.varps.getVarpValue(VARP_CLOCK_TOWER_BITS), BIT_BLACK_COG_COOLED)) {
        event.services.messaging.sendGameMessage(event.player, "The black cog is already cool enough to carry.");
        return;
    }
    if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
    event.services.inventory.addItemToInventory(event.player, emptyContainerId, 1);
    event.services.inventory.snapshotInventory(event.player);
    setBit(event.player, event.services, VARP_CLOCK_TOWER_BITS, BIT_BLACK_COG_COOLED);
    event.services.messaging.sendGameMessage(
        event.player,
        "You pour water over the cog. It quickly cools down enough to take.",
    );
}

function crossLoc(event: LocInteractionEvent): void {
    const dx = event.player.tileX - event.tile.x;
    const dy = event.player.tileY - event.tile.y;
    if (Math.abs(dx) > Math.abs(dy)) {
        event.services.movement.teleportPlayer(
            event.player,
            event.tile.x - Math.sign(dx),
            event.player.tileY,
            event.level,
        );
        return;
    }
    event.services.movement.teleportPlayer(
        event.player,
        event.player.tileX,
        event.tile.y - Math.sign(dy),
        event.level,
    );
}

function createBrotherKojoTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const context = {
            player: event.player,
            services: event.services,
            npcId: BROTHER_KOJO_NPC_ID,
            npcName: "Brother Kojo",
        };
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context, [
                sayPlayer("Hello monk."),
                sayNpc(["Hello adventurer. My name is Brother Kojo.", "Do you happen to know the time?"]),
                sayPlayer("No, sorry, I don't."),
                sayNpc([
                    "Exactly! This clock tower has recently broken down.",
                    "I must fix it before the townspeople become too angry!",
                ]),
                sayNpc("Could you assist me in the repairs? I'll pay you for your help."),
                choose([
                    option("OK old monk, what can I do?", [
                        sayNpc([
                            "Oh, thank you! In the cellar below, you'll find four cogs.",
                            "They're too heavy for me, but you can carry them one at a time.",
                        ]),
                        sayNpc([
                            "One goes on each floor, on the matching coloured spindle.",
                            "I'm sure you can figure it out.",
                        ]),
                        sayPlayer("Well, I'll do my best."),
                        run(({ player, services }) =>
                            setQuestStage(player, quest, services, STAGE_PLACE_COGS),
                        ),
                        sayNpc("Thank you! Be careful; the cellar is full of strange beasts!"),
                    ]),
                    option("How much reward are we talking?", [
                        sayNpc([
                            "I'm only a monk, so I'm not exactly rich.",
                            "But I will give you a fair reward for your time.",
                        ]),
                    ]),
                    option("Not now old monk.", [
                        sayNpc("Come back and let me know if you change your mind."),
                    ]),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_ALL_COGS_PLACED) {
            startConversation(context, [
                sayPlayer("I have replaced all the cogs!"),
                sayNpc([
                    "Really? Wait, listen! Well done! You've done it!",
                    "The townsfolk will be able to know the correct time again.",
                ]),
                sayNpc("Thank you for all your help. As promised, here is your reward!"),
                run(({ player, services }) => completeQuest(player, services, quest)),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [
                sayPlayer("Hello again Brother Kojo."),
                sayNpc("You've done a grand job with the clock. It's just like new."),
            ]);
            return;
        }
        const placed = Math.max(0, stage - STAGE_PLACE_COGS);
        const response = placed === 0
            ? "The cogs are in the four rooms below us. Place each on its matching spindle."
            : placed === 1
              ? "That's great. Come see me when you've done the other three."
              : placed === 2
                ? "Two down, two to go."
                : "Only one cog left.";
        startConversation(context, [sayPlayer("Hello again."), sayNpc(response)]);
    };
}

export function registerClockTowerInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const kojoTalk = createBrotherKojoTalkHandler(quest);
    registry.registerNpcScript({ npcId: BROTHER_KOJO_NPC_ID, option: "talk-to", handler: kojoTalk });
    registry.registerNpcScript({ npcId: BROTHER_KOJO_NPC_ID, option: undefined, handler: kojoTalk });

    for (const cog of COGS) {
        registry.registerGroundItemInteraction(cog.itemId, takeCog, "take");
        registry.registerItemOnLoc(cog.itemId, cog.spindleLocId, (event) => {
            const stage = getQuestStage(event.player, quest);
            if (stage < STAGE_PLACE_COGS || stage >= STAGE_COMPLETE) {
                event.services.messaging.sendGameMessage(event.player, "You have no reason to place that cog here.");
                return;
            }
            const bits = event.player.varps.getVarpValue(VARP_CLOCK_TOWER_BITS);
            if (isBitSet(bits, cog.placedBit)) {
                event.services.messaging.sendGameMessage(event.player, "You have already placed a cog here.");
                return;
            }
            if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
            event.services.inventory.snapshotInventory(event.player);
            setBit(event.player, event.services, VARP_CLOCK_TOWER_BITS, cog.placedBit);
            setQuestStage(
                event.player,
                quest,
                event.services,
                Math.min(STAGE_ALL_COGS_PLACED, stage + 1),
            );
            startConversation(
                {
                    player: event.player,
                    services: event.services,
                    npcId: BROTHER_KOJO_NPC_ID,
                    npcName: "Brother Kojo",
                },
                [showItem(cog.itemId, "The cog fits perfectly.")],
            );
        });
    }

    const allSpindles = COGS.map((cog) => cog.spindleLocId);
    for (const cog of COGS) {
        for (const spindleLocId of allSpindles) {
            if (spindleLocId === cog.spindleLocId) continue;
            registry.registerItemOnLoc(cog.itemId, spindleLocId, (event) => {
                event.services.messaging.sendGameMessage(event.player, "The cog doesn't seem to fit.");
            });
        }
    }

    registry.registerItemOnGround(ITEM.bucketOfWater, ITEM.blackCog, (event) =>
        coolBlackCog(event, ITEM.bucket),
    );
    registry.registerItemOnGround(ITEM.jugOfWater, ITEM.blackCog, (event) =>
        coolBlackCog(event, ITEM.jug),
    );

    registry.registerItemOnLoc(ITEM.ratPoison, LOC.foodTrough, (event) => {
        if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
        event.services.inventory.snapshotInventory(event.player);
        setBit(event.player, event.services, VARP_CLOCK_TOWER, BIT_RAT_GATE_OPEN);
        event.services.messaging.sendGameMessage(event.player, "The rats devour the poisoned food and begin to panic.");
        event.services.messaging.sendGameMessage(event.player, "Their death throes shake the western gate loose.");
    });

    for (const locId of [LOC.leverA, LOC.leverAUp]) {
        registry.registerLocScript({
            locId,
            action: "pull",
            handler: (event) => {
                const open = !isBitSet(
                    event.player.varps.getVarpValue(VARP_CLOCK_TOWER_BITS),
                    BIT_FIRST_RAT_GATE_OPEN,
                );
                setBit(event.player, event.services, VARP_CLOCK_TOWER_BITS, BIT_FIRST_RAT_GATE_OPEN, open);
                event.services.messaging.sendGameMessage(event.player, open ? "The nearby gate opens." : "The nearby gate closes.");
            },
        });
    }
    for (const locId of [LOC.leverB, LOC.leverBDown]) {
        registry.registerLocScript({
            locId,
            action: "pull",
            handler: (event) => {
                event.services.messaging.sendGameMessage(event.player, "You pull the lever, but nothing useful happens.");
            },
        });
    }
    for (const locId of [LOC.ratGateA, LOC.ratGateB]) {
        registry.registerLocScript({
            locId,
            action: "open",
            handler: (event) => {
                if (!isBitSet(event.player.varps.getVarpValue(VARP_CLOCK_TOWER_BITS), BIT_FIRST_RAT_GATE_OPEN)) {
                    event.services.messaging.sendGameMessage(event.player, "The gate does not seem to be openable from here.");
                    return;
                }
                crossLoc(event);
            },
        });
    }
    registry.registerLocScript({
        locId: LOC.poisonedRatGate,
        action: "go-through",
        handler: (event) => {
            if (!isBitSet(event.player.varps.getVarpValue(VARP_CLOCK_TOWER), BIT_RAT_GATE_OPEN)) {
                event.services.messaging.sendGameMessage(event.player, "This gate does not seem to be openable.");
                return;
            }
            event.services.messaging.sendGameMessage(event.player, "The rats have shaken the gate loose. You go through.");
            crossLoc(event);
        },
    });
}
