import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import {
    ALL_BARS_MASK,
    BARCRAWL_CARD,
    BARCRAWL_COMPLETE,
    BARCRAWL_NOT_STARTED,
    BARCRAWL_STARTED,
    BARS,
    COINS,
    OUTPOST_GATES,
    OUTPOST_GUARD_NPCS,
    VARP_BARCRAWL,
} from "./constants";

type BarDefinition = (typeof BARS)[number];

export function getBarCrawlState(player: PlayerState): number {
    return player.varps.getVarpValue(VARP_BARCRAWL) | 0;
}

export function setBarCrawlState(
    player: PlayerState,
    services: ScriptServices,
    value: number,
): void {
    player.varps.setVarpValue(VARP_BARCRAWL, value | 0);
    services.variables.sendVarp(player, VARP_BARCRAWL, value | 0);
}

export function hasVisitedAllBars(player: PlayerState): boolean {
    return (getBarCrawlState(player) & ALL_BARS_MASK) === ALL_BARS_MASK;
}

function hasInventoryItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.playerHasItem(player, itemId);
}

function giveCard(player: PlayerState, services: ScriptServices): boolean {
    if (!services.inventory.hasInventorySlot(player)) {
        services.messaging.sendGameMessage(player, "You need a free inventory space for the card.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, BARCRAWL_CARD, 1);
    if (result.added !== 1) return false;
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(player, "The guard hands you a Barcrawl card.");
    return true;
}

function removeInventoryCards(player: PlayerState, services: ScriptServices): void {
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== BARCRAWL_CARD || entry.quantity <= 0) continue;
        for (let count = 0; count < entry.quantity; count++) {
            services.inventory.consumeItem(player, entry.slot);
        }
    }
    services.inventory.snapshotInventory(player);
}

function createGuardHandler() {
    return (event: NpcInteractionEvent): void => {
        const { player, services } = event;
        const state = getBarCrawlState(player);
        const context = {
            player,
            services,
            npcId: event.npc.typeId,
            npcName: "Barbarian guard",
        };
        if (state === BARCRAWL_COMPLETE) {
            startConversation(context, [sayNpc("'Ello friend.")]);
            return;
        }
        if (state === BARCRAWL_NOT_STARTED) {
            startConversation(context, [
                sayNpc("Oi, whaddya want?"),
                choose([
                    option("I want to come through this gate.", [
                        sayNpc("Barbarians only. You don't look like one."),
                        choose([
                            option("Hmm, yep you've got me there.", []),
                            option("Looks can be deceiving. I am a barbarian.", [
                                sayNpc([
                                    "Then you need to drink like one.",
                                    "Complete Alfred Grimhand's Barcrawl and I'll let you through.",
                                ]),
                                run(({ player: choicePlayer, services: choiceServices }) => {
                                    if (!giveCard(choicePlayer, choiceServices)) return;
                                    setBarCrawlState(
                                        choicePlayer,
                                        choiceServices,
                                        BARCRAWL_STARTED,
                                    );
                                }),
                            ]),
                        ]),
                    ]),
                    option("I want some money.", [sayNpc("Do I look like a bank to you?")]),
                ]),
            ]);
            return;
        }
        if (!hasInventoryItem(player, services, BARCRAWL_CARD)) {
            const owned = services.inventory.findOwnedItemLocation(player, BARCRAWL_CARD);
            if (owned) {
                startConversation(context, [
                    sayNpc("You need to bring your Barcrawl card with you while visiting the bars."),
                ]);
                return;
            }
            startConversation(context, [
                sayPlayer("I've lost my Barcrawl card."),
                sayNpc("You'll have to start over. Try not to lose this one."),
                run(({ player: choicePlayer, services: choiceServices }) => {
                    if (!giveCard(choicePlayer, choiceServices)) return;
                    setBarCrawlState(choicePlayer, choiceServices, BARCRAWL_STARTED);
                }),
            ]);
            return;
        }
        if (hasVisitedAllBars(player)) {
            startConversation(context, [
                sayPlayer("I tink I jusht 'bout done dem all..."),
                run(({ player: choicePlayer, services: choiceServices }) => {
                    removeInventoryCards(choicePlayer, choiceServices);
                    setBarCrawlState(choicePlayer, choiceServices, BARCRAWL_COMPLETE);
                }),
                sayNpc("You look like you've drunk plenty. You can come in now."),
            ]);
            return;
        }
        startConversation(context, [
            sayNpc("So, how's the Barcrawl coming along?"),
            sayPlayer("I haven't finished it yet."),
            sayNpc("Come back when you have, you lightweight."),
        ]);
    };
}

function drainBarCrawlStats(player: PlayerState, bar: BarDefinition): void {
    const byBit: Partial<Record<number, SkillId[]>> = {
        3: [SkillId.Attack, SkillId.Defence, SkillId.Strength, SkillId.Smithing],
        5: [SkillId.Attack, SkillId.Defence, SkillId.Prayer, SkillId.Cooking, SkillId.Herblore],
        6: [SkillId.Attack, SkillId.Defence],
        8: [SkillId.Attack, SkillId.Defence, SkillId.Woodcutting, SkillId.Fletching, SkillId.Firemaking],
        9: [SkillId.Attack, SkillId.Defence, SkillId.Magic, SkillId.Crafting, SkillId.Mining],
        11: [SkillId.Attack, SkillId.Defence, SkillId.Ranged, SkillId.Fishing],
    };
    for (const skill of byBit[bar.bit] ?? []) player.skillSystem.adjustSkillBoost(skill, -5);
}

function signBarCrawlCard(player: PlayerState, services: ScriptServices, bar: BarDefinition): void {
    const state = getBarCrawlState(player);
    if (state === BARCRAWL_NOT_STARTED || state === BARCRAWL_COMPLETE) {
        services.messaging.sendGameMessage(player, "The bartender is not interested in that card.");
        return;
    }
    if (!hasInventoryItem(player, services, BARCRAWL_CARD)) return;
    if ((state & (1 << bar.bit)) !== 0) {
        services.messaging.sendGameMessage(player, `${bar.name} has already signed your card.`);
        return;
    }
    const coinSlot = services.inventory.findInventorySlotWithItem(player, COINS);
    const coins = services.inventory
        .getInventoryItems(player)
        .find((entry) => entry.slot === coinSlot && entry.itemId === COINS)?.quantity ?? 0;
    if (coinSlot === undefined || coins < bar.cost) {
        services.messaging.sendGameMessage(player, `You need ${bar.cost} coins for the ${bar.drink}.`);
        return;
    }
    for (let count = 0; count < bar.cost; count++) services.inventory.consumeItem(player, coinSlot);
    services.inventory.snapshotInventory(player);
    drainBarCrawlStats(player, bar);
    setBarCrawlState(player, services, state | (1 << bar.bit));
    services.messaging.sendGameMessage(player, `You drink the ${bar.drink}.`);
    services.messaging.sendGameMessage(player, `${bar.name} signs your Barcrawl card.`);
}

function readCard(player: PlayerState, services: ScriptServices): void {
    if (hasVisitedAllBars(player)) {
        services.messaging.sendGameMessage(player, "You are too drunk to read the Barcrawl card.");
        return;
    }
    const state = getBarCrawlState(player);
    for (const bar of BARS) {
        const signed = (state & (1 << bar.bit)) !== 0;
        services.messaging.sendGameMessage(player, `${signed ? "Signed" : "Unsigned"}: ${bar.name}`);
    }
}

export function registerBarCrawlInteractions(
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const guardHandler = createGuardHandler();
    for (const npcId of OUTPOST_GUARD_NPCS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: guardHandler });
    }
    for (const locId of OUTPOST_GATES) {
        registry.registerLocScript({
            locId,
            action: undefined,
            handler: (event) => {
                if (getBarCrawlState(event.player) !== BARCRAWL_COMPLETE) {
                    guardHandler({
                        player: event.player,
                        services: event.services,
                        npc: { typeId: OUTPOST_GUARD_NPCS[0] },
                        option: "talk-to",
                    } as NpcInteractionEvent);
                    return;
                }
                const nextX = event.player.tileX > event.tile.x ? event.tile.x - 1 : event.tile.x + 1;
                event.services.movement.teleportPlayer(event.player, nextX, event.tile.y, event.level);
            },
        });
    }
    registry.registerItemAction(BARCRAWL_CARD, ({ player, services }) => readCard(player, services), "read");
    for (const bar of BARS) {
        for (const npcId of bar.npcIds) {
            registry.registerItemOnNpc(BARCRAWL_CARD, npcId, ({ player, services }) =>
                signBarCrawlCard(player, services, bar),
            );
        }
    }
}
