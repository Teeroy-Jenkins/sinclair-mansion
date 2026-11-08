import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import {
    ANY_ITEM_ID,
    ANY_LOC_ID,
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcInteractionEvent,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    countCarriedItem,
    getQuestStage,
    setQuestStage,
} from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    AUX_BIT,
    ITEM,
    LOC,
    NPC,
    PERFECT_GOLD_TILES,
    PICKAXES,
    SPELL,
    STAGE_AVAN_PIECE,
    STAGE_CALEB_PIECE,
    STAGE_COMPLETE,
    STAGE_CURED_JOHNATHON,
    STAGE_NOT_STARTED,
    STAGE_SEEKING_AVAN,
    STAGE_SPOKEN_AVAN,
    STAGE_SPOKEN_BOOT,
    STAGE_SPOKEN_CALEB,
    STAGE_SPOKEN_DIMINTHEIS,
    STAGE_SPOKEN_GEM_TRADER,
    STAGE_SPOKEN_JOHNATHON,
    VARP_FAMILY_CREST_AUX,
} from "./constants";

const FISH = [ITEM.shrimps, ITEM.salmon, ITEM.tuna, ITEM.bass, ITEM.swordfish] as const;
const CREST_PARTS = [ITEM.calebCrest, ITEM.avanCrest, ITEM.johnathonCrest] as const;

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function removeItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    if (countCarriedItem(player, services, itemId) < quantity) return false;
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const taken = Math.min(entry.quantity, remaining);
        const left = entry.quantity - taken;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= taken;
        if (remaining === 0) break;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function giveItem(
    player: PlayerState,
    services: ScriptServices,
    itemId: number,
    quantity = 1,
): boolean {
    if (!services.inventory.hasInventorySlot(player)) {
        services.messaging.sendGameMessage(player, "You need a free inventory space.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function getAux(player: PlayerState): number {
    return player.varps.getVarpValue(VARP_FAMILY_CREST_AUX);
}

function setAux(player: PlayerState, services: ScriptServices, value: number): void {
    player.varps.setVarpValue(VARP_FAMILY_CREST_AUX, value);
    services.variables.sendVarp(player, VARP_FAMILY_CREST_AUX, value);
}

function setAuxBit(player: PlayerState, services: ScriptServices, bit: number, enabled: boolean): void {
    const mask = 1 << bit;
    setAux(player, services, enabled ? getAux(player) | mask : getAux(player) & ~mask);
}

function hasAuxBit(player: PlayerState, bit: number): boolean {
    return (getAux(player) & (1 << bit)) !== 0;
}

function boostedLevel(player: PlayerState, services: ScriptServices, skillId: number): number {
    const skill = services.skills.getSkill(player, skillId);
    return skill.baseLevel + skill.boost;
}

function replaceItem(
    player: PlayerState,
    services: ScriptServices,
    sourceId: number,
    replacementId: number,
): boolean {
    if (!removeItem(player, services, sourceId, 1)) return false;
    if (giveItem(player, services, replacementId)) return true;
    giveItem(player, services, sourceId);
    return false;
}

function createDimintheisHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context(event, "Dimintheis"), [
                sayNpc("My three sons took our family crest, and without it the King seized my estate."),
                choose([
                    option("I will restore your crest.", [
                        sayNpc("Thank you. Begin with Caleb, a chef beyond White Wolf Mountain."),
                        run(({ player, services }) =>
                            setQuestStage(player, quest, services, STAGE_SPOKEN_DIMINTHEIS),
                        ),
                    ]),
                    option("I am not interested.", []),
                ]),
            ]);
            return;
        }
        if (stage < STAGE_COMPLETE && owns(event.player, event.services, ITEM.familyCrest)) {
            startConversation(context(event, "Dimintheis"), [
                sayPlayer("I have restored your family crest."),
                sayNpc("You have restored my family's honour. Please accept these mystical gauntlets."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, ITEM.familyCrest)) return;
                    setAux(player, services, 0);
                    completeQuest(player, services, quest);
                }),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            const chosen = hasAuxBit(event.player, AUX_BIT.cookingGauntlets)
                ? ITEM.cookingGauntlets
                : hasAuxBit(event.player, AUX_BIT.goldsmithGauntlets)
                  ? ITEM.goldsmithGauntlets
                  : hasAuxBit(event.player, AUX_BIT.chaosGauntlets)
                    ? ITEM.chaosGauntlets
                    : ITEM.steelGauntlets;
            startConversation(context(event, "Dimintheis"), [
                sayNpc("You have my eternal gratitude for restoring our family honour."),
                run(({ player, services }) => {
                    if (!owns(player, services, chosen)) giveItem(player, services, chosen);
                }),
            ]);
            return;
        }
        startConversation(context(event, "Dimintheis"), [
            sayNpc("Please continue searching for my sons and the three pieces of our crest."),
        ]);
    };
}

function createCalebHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_SPOKEN_DIMINTHEIS) {
            startConversation(context(event, "Caleb"), [
                sayPlayer("Your father sent me to restore the Fitzharmon crest."),
                sayNpc("Bring me cooked shrimp, salmon, tuna, bass and swordfish for my salad."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_CALEB)),
            ]);
            return;
        }
        if (stage === STAGE_SPOKEN_CALEB) {
            if (!FISH.every((itemId) => countCarriedItem(event.player, event.services, itemId) > 0)) {
                startConversation(context(event, "Caleb"), [
                    sayNpc("I still need cooked shrimp, salmon, tuna, bass and swordfish."),
                ]);
                return;
            }
            startConversation(context(event, "Caleb"), [
                sayNpc("Excellent. Here is my piece of the crest."),
                run(({ player, services }) => {
                    for (const itemId of FISH) removeItem(player, services, itemId);
                    if (!giveItem(player, services, ITEM.calebCrest)) return;
                    setQuestStage(player, quest, services, STAGE_CALEB_PIECE);
                }),
            ]);
            return;
        }
        if (stage === STAGE_CALEB_PIECE) {
            startConversation(context(event, "Caleb"), [
                sayNpc("Avan was searching for treasure in the desert. Ask around Al Kharid."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SEEKING_AVAN)),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            enchantGauntlets(event, ITEM.cookingGauntlets, AUX_BIT.cookingGauntlets, "Cooking");
            return;
        }
        if (stage > STAGE_CALEB_PIECE && !owns(event.player, event.services, ITEM.calebCrest) &&
            !owns(event.player, event.services, ITEM.familyCrest)) {
            giveItem(event.player, event.services, ITEM.calebCrest);
            event.services.messaging.sendGameMessage(event.player, "Caleb replaces the crest piece you lost.");
            return;
        }
        startConversation(context(event, "Caleb"), [sayNpc("How is your search for the other crest pieces going?")]);
    };
}

function createGemTraderHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) === STAGE_SEEKING_AVAN) {
            startConversation(context(event, "Gem trader"), [
                sayNpc("Avan asked about perfect gold. I sent him to the Al Kharid mine."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_SPOKEN_GEM_TRADER),
                ),
            ]);
            return;
        }
        startConversation(context(event, "Gem trader"), [sayNpc("Would you be interested in buying some gems?")]);
    };
}

function createAvanHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_SPOKEN_GEM_TRADER) {
            startConversation(context(event, "Avan"), [
                sayNpc("Bring me a ruby ring and necklace made from perfect gold. Boot the dwarf may know where to find it."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_AVAN)),
            ]);
            return;
        }
        if (stage >= STAGE_SPOKEN_BOOT && stage < STAGE_AVAN_PIECE) {
            if (!owns(event.player, event.services, ITEM.perfectRing) ||
                !owns(event.player, event.services, ITEM.perfectNecklace)) {
                startConversation(context(event, "Avan"), [sayNpc("I still need the perfect ruby ring and necklace.")]);
                return;
            }
            startConversation(context(event, "Avan"), [
                sayNpc("These are exquisite. Take my piece, and seek Johnathon at the Jolly Boar Inn."),
                run(({ player, services }) => {
                    removeItem(player, services, ITEM.perfectRing);
                    removeItem(player, services, ITEM.perfectNecklace);
                    if (!giveItem(player, services, ITEM.avanCrest)) return;
                    setQuestStage(player, quest, services, STAGE_AVAN_PIECE);
                }),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            enchantGauntlets(event, ITEM.goldsmithGauntlets, AUX_BIT.goldsmithGauntlets, "Goldsmithing");
            return;
        }
        if (stage > STAGE_AVAN_PIECE && !owns(event.player, event.services, ITEM.avanCrest) &&
            !owns(event.player, event.services, ITEM.familyCrest)) {
            giveItem(event.player, event.services, ITEM.avanCrest);
            event.services.messaging.sendGameMessage(event.player, "Avan replaces the crest piece you lost.");
            return;
        }
        startConversation(context(event, "Avan"), [sayNpc("I am rather busy with my search for perfect gold.")]);
    };
}

function createBootHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) === STAGE_SPOKEN_AVAN) {
            startConversation(context(event, "Boot"), [
                sayNpc("The finest gold lies in the Witchaven Dungeon, east of Ardougne."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_BOOT)),
            ]);
            return;
        }
        startConversation(context(event, "Boot"), [sayNpc("Hello tall person.")]);
    };
}

function createJohnathonHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_AVAN_PIECE) {
            startConversation(context(event, "Johnathon"), [
                sayNpc("A poison spider bit me... I can barely think..."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_SPOKEN_JOHNATHON),
                ),
            ]);
            return;
        }
        if (stage === STAGE_SPOKEN_JOHNATHON) {
            startConversation(context(event, "Johnathon"), [sayNpc("Please... find something to cure this poison...")]);
            return;
        }
        if (stage === STAGE_CURED_JOHNATHON) {
            startConversation(context(event, "Johnathon"), [
                sayNpc("Chronozon has my crest. Hit him with Wind, Water, Earth and Fire Blast before killing him."),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            enchantGauntlets(event, ITEM.chaosGauntlets, AUX_BIT.chaosGauntlets, "Chaos");
            return;
        }
        startConversation(context(event, "Johnathon"), [sayNpc("I am so very tired. Leave me to rest.")]);
    };
}

function enchantGauntlets(
    event: NpcInteractionEvent,
    resultItemId: number,
    choiceBit: number,
    label: string,
): void {
    const choiceMask =
        (1 << AUX_BIT.cookingGauntlets) |
        (1 << AUX_BIT.goldsmithGauntlets) |
        (1 << AUX_BIT.chaosGauntlets);
    if ((getAux(event.player) & choiceMask) !== 0) {
        startConversation(context(event, event.npc.typeId === NPC.caleb ? "Caleb" : event.npc.typeId === NPC.avan ? "Avan" : "Johnathon"), [
            sayNpc("The gauntlets have already received their permanent enchantment."),
        ]);
        return;
    }
    if (!owns(event.player, event.services, ITEM.steelGauntlets)) {
        event.services.messaging.sendGameMessage(event.player, "Bring me the steel gauntlets first.");
        return;
    }
    startConversation(context(event, event.npc.typeId === NPC.caleb ? "Caleb" : event.npc.typeId === NPC.avan ? "Avan" : "Johnathon"), [
        sayNpc(`I can permanently enchant the gauntlets with ${label} power.`),
        choose([
            option("Enchant them.", [
                run(({ player, services }) => {
                    if (!replaceItem(player, services, ITEM.steelGauntlets, resultItemId)) return;
                    setAuxBit(player, services, choiceBit, true);
                }),
            ]),
            option("Not yet.", []),
        ]),
    ]);
}

function isFurnace(services: ScriptServices, locId: number): boolean {
    const definition = services.data.getLocDefinition(locId) as { name?: unknown } | undefined;
    return String(definition?.name ?? "").toLowerCase().includes("furnace");
}

function registerPerfectGoldProduction(registry: IScriptRegistry): void {
    registry.registerItemOnLoc(ITEM.perfectGoldOre, ANY_LOC_ID, ({ player, services, target }) => {
        if (!isFurnace(services, target.locId)) {
            services.messaging.sendGameMessage(player, "The ore must be smelted in a furnace.");
            return;
        }
        if (boostedLevel(player, services, SkillId.Smithing) < 40) {
            services.messaging.sendGameMessage(player, "You need level 40 Smithing to smelt this ore.");
            return;
        }
        if (!replaceItem(player, services, ITEM.perfectGoldOre, ITEM.perfectGoldBar)) return;
        services.skills.addSkillXp(player, SkillId.Smithing, 22.5);
        services.messaging.sendGameMessage(player, "You smelt the ore into a bar of perfect gold.");
    });
    registry.registerItemOnLoc(ITEM.perfectGoldBar, ANY_LOC_ID, ({ player, services, target }) => {
        if (!isFurnace(services, target.locId)) {
            services.messaging.sendGameMessage(player, "You need a furnace to craft this jewellery.");
            return;
        }
        if (boostedLevel(player, services, SkillId.Crafting) < 40) {
            services.messaging.sendGameMessage(player, "You need level 40 Crafting to make perfect jewellery.");
            return;
        }
        if (!owns(player, services, ITEM.ruby)) {
            services.messaging.sendGameMessage(player, "You need a cut ruby.");
            return;
        }
        const makeRing = owns(player, services, ITEM.ringMould) && !owns(player, services, ITEM.perfectRing);
        const makeNecklace = owns(player, services, ITEM.necklaceMould) && !owns(player, services, ITEM.perfectNecklace);
        if (!makeRing && !makeNecklace) {
            services.messaging.sendGameMessage(player, "You need a ring or necklace mould.");
            return;
        }
        const product = makeRing ? ITEM.perfectRing : ITEM.perfectNecklace;
        if (!removeItem(player, services, ITEM.perfectGoldBar) || !removeItem(player, services, ITEM.ruby)) return;
        if (!giveItem(player, services, product)) return;
        services.skills.addSkillXp(player, SkillId.Crafting, makeRing ? 70 : 75);
        services.messaging.sendGameMessage(player, makeRing ? "You make a perfect ruby ring." : "You make a perfect ruby necklace.");
    });
}

function registerPerfectGoldMining(
    quest: QuestDefinition,
    registry: IScriptRegistry,
): void {
    const previous = registry.findLocInteraction(LOC.perfectGoldRock, "mine");
    registry.registerLocScript({
        locId: LOC.perfectGoldRock,
        action: "mine",
        handler: (event) => {
            const key = `${event.tile.x}:${event.tile.y}`;
            if (!PERFECT_GOLD_TILES.has(key)) {
                previous?.(event);
                return;
            }
            if (getQuestStage(event.player, quest) < STAGE_SPOKEN_BOOT) {
                event.services.messaging.sendGameMessage(event.player, "This gold does not look special to you.");
                return;
            }
            if (boostedLevel(event.player, event.services, SkillId.Mining) < 40) {
                event.services.messaging.sendGameMessage(event.player, "You need level 40 Mining to mine this rock.");
                return;
            }
            if (!PICKAXES.some((itemId) => owns(event.player, event.services, itemId))) {
                event.services.messaging.sendGameMessage(event.player, "You need a pickaxe to mine this rock.");
                return;
            }
            if (!giveItem(event.player, event.services, ITEM.perfectGoldOre)) return;
            event.services.skills.addSkillXp(event.player, SkillId.Mining, 65);
            event.services.messaging.sendGameMessage(event.player, "You mine some perfect gold ore.");
        },
    });
}

function registerLeverPuzzle(quest: QuestDefinition, registry: IScriptRegistry): void {
    const registerLever = (ids: readonly number[], bit: number): void => {
        for (const locId of ids) {
            registry.registerLocScript({
                locId,
                action: "pull",
                handler: ({ player, services }) => {
                    const next = !hasAuxBit(player, bit);
                    setAuxBit(player, services, bit, next);
                    services.messaging.sendGameMessage(player, `The lever is now ${next ? "up" : "down"}.`);
                },
            });
        }
    };
    registerLever(LOC.northLever, AUX_BIT.northLever);
    registerLever(LOC.southLever, AUX_BIT.southLever);
    registerLever(LOC.northRoomLever, AUX_BIT.northRoomLever);

    const canOpen = (player: PlayerState, locId: number): boolean => {
        const north = hasAuxBit(player, AUX_BIT.northLever);
        const south = hasAuxBit(player, AUX_BIT.southLever);
        if (locId === 2427) return north && south;
        if (locId === 2429) return north && !south;
        if (locId === 2430)
            return getQuestStage(player, quest) >= STAGE_COMPLETE ||
                (north && !south && hasAuxBit(player, AUX_BIT.northRoomLever));
        return !north && south;
    };
    for (const locId of LOC.doors) {
        registry.registerLocScript({
            locId,
            action: "open",
            handler: ({ player, services, tile, level }) => {
                if (!canOpen(player, locId)) {
                    services.messaging.sendGameMessage(player, "This door is locked by an unknown mechanism.");
                    return;
                }
                const dx = player.tileX - tile.x;
                const dy = player.tileY - tile.y;
                services.movement.teleportPlayer(player, tile.x - dx, tile.y - dy, level);
            },
        });
    }
}

function registerJohnathonCure(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerItemOnNpc(ANY_ITEM_ID, NPC.johnathon, ({ player, services, source }) => {
        const definition = services.data.getObjType(source.itemId) as { name?: unknown } | undefined;
        const name = String(definition?.name ?? "").toLowerCase();
        if (!/(antipoison|superantipoison|antidote|sanfew)/.test(name)) {
            services.messaging.sendGameMessage(player, "That will not cure Johnathon's poison.");
            return;
        }
        if (getQuestStage(player, quest) !== STAGE_SPOKEN_JOHNATHON) {
            services.messaging.sendGameMessage(player, "Johnathon does not need that now.");
            return;
        }
        if (!services.inventory.consumeItem(player, source.slot)) return;
        services.inventory.snapshotInventory(player);
        setQuestStage(player, quest, services, STAGE_CURED_JOHNATHON);
        services.messaging.sendGameMessage(player, "Johnathon drinks the potion and is completely cured.");
    });
}

function registerChronozon(quest: QuestDefinition, registry: IScriptRegistry): void {
    const spellBits = new Map<number, number>();
    for (const id of SPELL.windBlast) spellBits.set(id, AUX_BIT.windBlast);
    for (const id of SPELL.waterBlast) spellBits.set(id, AUX_BIT.waterBlast);
    for (const id of SPELL.earthBlast) spellBits.set(id, AUX_BIT.earthBlast);
    for (const id of SPELL.fireBlast) spellBits.set(id, AUX_BIT.fireBlast);

    registry.registerNpcMagicHit(NPC.chronozon, ({ player, services, spellId }) => {
        if (getQuestStage(player, quest) !== STAGE_CURED_JOHNATHON) return;
        const bit = spellBits.get(spellId);
        if (bit === undefined) return;
        setAuxBit(player, services, bit, true);
        services.messaging.sendGameMessage(player, "Chronozon weakens...");
    });
    registry.registerNpcPreDeath(NPC.chronozon, (event) => {
        const player = event.killer;
        if (!player || getQuestStage(player, quest) !== STAGE_CURED_JOHNATHON) {
            return NpcPreDeathDecision.Allow;
        }
        if ((getAux(player) & 0xf) !== 0xf) {
            event.npc.heal(10_000);
            event.services.messaging.sendGameMessage(player, "Chronozon regenerates...");
            return NpcPreDeathDecision.Prevent;
        }
        if (!owns(player, event.services, ITEM.johnathonCrest) &&
            !owns(player, event.services, ITEM.familyCrest)) {
            event.services.groundItems.spawn(
                ITEM.johnathonCrest,
                1,
                { x: event.npc.tileX, y: event.npc.tileY, level: event.npc.level },
                { ownerId: player.id, worldViewId: player.worldViewId },
            );
        }
        return NpcPreDeathDecision.Allow;
    });
}

function registerCrestAssembly(registry: IScriptRegistry): void {
    const combine = ({ player, services }: { player: PlayerState; services: ScriptServices }): void => {
        if (!CREST_PARTS.every((itemId) => countCarriedItem(player, services, itemId) > 0)) {
            services.messaging.sendGameMessage(player, "You still need one more piece of the crest.");
            return;
        }
        for (const itemId of CREST_PARTS) removeItem(player, services, itemId);
        if (!giveItem(player, services, ITEM.familyCrest)) return;
        services.messaging.sendGameMessage(player, "You have restored the Family Crest.");
    };
    registry.registerItemOnItem(ITEM.calebCrest, ITEM.avanCrest, combine);
    registry.registerItemOnItem(ITEM.calebCrest, ITEM.johnathonCrest, combine);
    registry.registerItemOnItem(ITEM.avanCrest, ITEM.johnathonCrest, combine);
}

export function registerFamilyCrestInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registry.registerNpcScript({ npcId: NPC.dimintheis, option: "talk-to", handler: createDimintheisHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.caleb, option: "talk-to", handler: createCalebHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.gemTrader, option: "talk-to", handler: createGemTraderHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.avan, option: "talk-to", handler: createAvanHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.boot, option: "talk-to", handler: createBootHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.johnathon, option: "talk-to", handler: createJohnathonHandler(quest) });
    registerPerfectGoldProduction(registry);
    registerPerfectGoldMining(quest, registry);
    registerLeverPuzzle(quest, registry);
    registerJohnathonCure(quest, registry);
    registerChronozon(quest, registry);
    registerCrestAssembly(registry);
}
