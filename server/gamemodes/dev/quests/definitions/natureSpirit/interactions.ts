import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import {
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcInteractionEvent,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ITEM,
    LOC,
    NATURE_STONE_BIT,
    NPC,
    SPIRIT_STONE_BIT,
    STAGE_ADDED_POUCH,
    STAGE_BLESSED,
    STAGE_BLESSED_SICKLE,
    STAGE_CAST_SICKLE_BLOOM,
    STAGE_CAST_SPELL,
    STAGE_COMPLETE,
    STAGE_ENTERED_GROTTO,
    STAGE_ENTERED_SWAMP,
    STAGE_FAILED_TALK,
    STAGE_FULL_TRANSFORM,
    STAGE_GIVEN_JOURNAL,
    STAGE_KILLED_GHAST_1,
    STAGE_KILLED_GHAST_2,
    STAGE_KILLED_GHAST_3,
    STAGE_PERFORMED_RITUAL,
    STAGE_PICKED_FUNGI,
    STAGE_PICKED_SICKLE_BLOOM,
    STAGE_RECEIVED_SPELL,
    STAGE_SHOWN_MIRROR,
    STAGE_SPOKEN_FILLIMAN,
    STAGE_SPOKEN_FILLIMAN_2,
    STAGE_STARTED,
    TILE,
    VARP_NATURE_SPIRIT_BITS,
} from "./constants";

function context(event: NpcInteractionEvent, name: string) {
    return { player: event.player, services: event.services, npcId: event.npc.typeId, npcName: name };
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function freeSlots(player: PlayerState, services: ScriptServices): number {
    return services.inventory.getInventoryItems(player).filter((entry) => entry.itemId < 0 || entry.quantity <= 0).length;
}

function give(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function remove(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    if (countCarriedItem(player, services, itemId) < quantity) return false;
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const amount = Math.min(remaining, entry.quantity);
        const left = entry.quantity - amount;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= amount;
        if (!remaining) break;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function replace(player: PlayerState, services: ScriptServices, oldId: number, newId: number): boolean {
    if (!remove(player, services, oldId)) return false;
    return give(player, services, newId);
}

function setBits(player: PlayerState, services: ScriptServices, bits: number): void {
    player.varps.setVarpValue(VARP_NATURE_SPIRIT_BITS, bits);
    services.variables.sendVarp(player, VARP_NATURE_SPIRIT_BITS, bits);
}

function wearingGhostspeak(player: PlayerState, services: ScriptServices): boolean {
    return services.equipment.getEquippedItem(player, EquipmentSlot.AMULET) === ITEM.ghostspeakAmulet;
}

function spawnQuestGhast(player: PlayerState, services: ScriptServices): void {
    if (services.npc.findNearbyNpc(player, NPC.visibleGhast[0], 24)) return;
    services.npc.spawnNpc({
        id: NPC.visibleGhast[0],
        x: player.tileX + 2,
        y: player.tileY,
        level: player.level,
        worldViewId: player.worldViewId,
        ownerPlayerId: player.id,
        lifetimeTicks: 1_000,
    });
}

function createDrezelHandler(quest: QuestDefinition, fallback?: (event: NpcInteractionEvent) => void) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 0 && event.player.varps.getVarpValue(302) < 60) {
            fallback?.(event);
            return;
        }
        if (stage === 0) {
            startConversation(context(event, "Drezel"), [
                sayNpc("A druid named Filliman Tarlock has not returned from Mort Myre. Please find him beyond the swamp gate."),
                choose([
                    option("I'll find him.", [run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED))]),
                    option("Not now."),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_RECEIVED_SPELL) {
            startConversation(context(event, "Drezel"), [
                sayPlayer("Filliman says I must be blessed to cast his Bloom spell."),
                sayNpc("Then receive the blessing of Saradomin, and use it to restore balance to the swamp."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_BLESSED)),
            ]);
            return;
        }
        startConversation(context(event, "Drezel"), [sayNpc(stage >= STAGE_COMPLETE ? "The Nature Spirit strengthens the River Salve." : "Filliman waits in Mort Myre swamp.")]);
    };
}

function createFillimanHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const name = event.npc.typeId === NPC.natureSpirit ? "Nature Spirit" : "Filliman Tarlock";
        if (stage >= STAGE_ENTERED_SWAMP && stage < STAGE_SPOKEN_FILLIMAN) {
            if (!wearingGhostspeak(event.player, event.services)) {
                setQuestStage(event.player, quest, event.services, STAGE_FAILED_TALK);
                startConversation(context(event, name), [sayNpc("Ahhrs... oooh... arhhhh!"), sayPlayer("I cannot understand this ghost.")]);
                return;
            }
            startConversation(context(event, name), [
                sayNpc("At last, someone I can understand! But why do you insist that I am a ghost?"),
                sayPlayer("I will find proof that you are dead."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_FILLIMAN)),
            ]);
            return;
        }
        if (stage === STAGE_SPOKEN_FILLIMAN) {
            startConversation(context(event, name), [sayNpc("You will need conclusive proof before I believe such a claim.")]);
            return;
        }
        if (stage === STAGE_SHOWN_MIRROR) {
            startConversation(context(event, name), [sayNpc("My journal may explain why my spirit remains here. I hid it in a knot in the grotto tree.")]);
            return;
        }
        if (stage === STAGE_GIVEN_JOURNAL) {
            startConversation(context(event, name), [
                sayNpc("I was Filliman Tarlock, a druid. Help me become a nature spirit."),
                sayNpc("We need something from nature, something with faith, and something freely given by the spirit-to-become."),
                run(({ player, services }) => {
                    if (!owns(player, services, ITEM.bloomSpell) && !give(player, services, ITEM.bloomSpell)) return;
                    setQuestStage(player, quest, services, STAGE_RECEIVED_SPELL);
                }),
                sayNpc("Ask Drezel to bless you, then cast this spell in Mort Myre and harvest the fungus it grows."),
            ]);
            return;
        }
        if (stage === STAGE_PICKED_FUNGI) {
            startConversation(context(event, name), [
                sayNpc("The fungus is something from nature. Place it on the nature stone."),
                sayNpc("Place the used spell on the spirit stone; you must represent faith yourself."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_SPOKEN_FILLIMAN_2)),
            ]);
            return;
        }
        if (stage === STAGE_SPOKEN_FILLIMAN_2) {
            const bits = event.player.varps.getVarpValue(VARP_NATURE_SPIRIT_BITS);
            if ((bits & (NATURE_STONE_BIT | SPIRIT_STONE_BIT)) !== (NATURE_STONE_BIT | SPIRIT_STONE_BIT)) {
                startConversation(context(event, name), [sayNpc("Both offerings must be placed on their correct stones.")]);
                return;
            }
            startConversation(context(event, name), [
                sayNpc("Everything is in place. The ritual has worked! Enter the grotto for the final transformation."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_PERFORMED_RITUAL)),
            ]);
            return;
        }
        if (stage === STAGE_ENTERED_GROTTO) {
            startConversation(context(event, name), [
                sayNpc("The transformation is complete. I am now a Nature Spirit."),
                sayNpc("Bring me a silver sickle so I can bless it against the Ghasts."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_FULL_TRANSFORM)),
            ]);
            return;
        }
        if (stage === STAGE_FULL_TRANSFORM) {
            if (!owns(event.player, event.services, ITEM.silverSickle)) {
                startConversation(context(event, "Nature Spirit"), [sayNpc("Bring me a silver sickle. A mould can be bought in Al Kharid.")]);
                return;
            }
            if (freeSlots(event.player, event.services) < 1) {
                event.services.messaging.sendGameMessage(event.player, "You need a free inventory space for the druid pouch.");
                return;
            }
            startConversation(context(event, "Nature Spirit"), [
                sayNpc("I bless this sickle with the power to make Mort Myre bloom."),
                run(({ player, services }) => {
                    if (!replace(player, services, ITEM.silverSickle, ITEM.silverSickleBlessed)) return;
                    if (!give(player, services, ITEM.druidPouchEmpty)) return;
                    setQuestStage(player, quest, services, STAGE_BLESSED_SICKLE);
                }),
                showItem(ITEM.silverSickleBlessed, "Your silver sickle has been blessed."),
                sayNpc("Fill the pouch with swamp produce, then release three Ghasts from their torment."),
            ]);
            return;
        }
        if (stage >= STAGE_ADDED_POUCH && stage < STAGE_COMPLETE) {
            if (stage === STAGE_KILLED_GHAST_3) {
                startConversation(context(event, "Nature Spirit"), [
                    sayNpc("You released all three Ghasts. This grotto can now become an Altar of Nature."),
                    run(({ player, services }) => completeQuest(player, services, quest)),
                ]);
                return;
            }
            spawnQuestGhast(event.player, event.services);
            startConversation(context(event, "Nature Spirit"), [sayNpc("Use the charged druid pouch and defeat three Ghasts.")]);
            return;
        }
        startConversation(context(event, name), [sayNpc(stage >= STAGE_COMPLETE ? "The swamp is safer because of you." : "Continue the ritual described in my journal.")]);
    };
}

function registerItems(quest: QuestDefinition, registry: IScriptRegistry): void {
    const findMirror = ({ player, services }: { player: PlayerState; services: ScriptServices }) => {
        if (getQuestStage(player, quest) < STAGE_FAILED_TALK || owns(player, services, ITEM.mirror)) return;
        if (give(player, services, ITEM.mirror)) services.messaging.sendGameMessage(player, "You find a small mirror beneath the washing bowl.");
    };
    registry.registerGroundItemInteraction(ITEM.washingBowl, findMirror as never, "search");
    registry.registerItemAction(ITEM.washingBowl, findMirror as never, "search");
    registry.registerItemOnNpc(ITEM.mirror, NPC.filliman, ({ player, services }) => {
        if (getQuestStage(player, quest) !== STAGE_SPOKEN_FILLIMAN || !wearingGhostspeak(player, services)) return;
        setQuestStage(player, quest, services, STAGE_SHOWN_MIRROR);
        services.messaging.sendGameMessage(player, "Filliman sees no reflection and finally accepts that he is dead.");
    });
    registry.registerItemOnNpc(ITEM.journal, NPC.filliman, ({ player, services }) => {
        if (getQuestStage(player, quest) !== STAGE_SHOWN_MIRROR) return;
        if (!remove(player, services, ITEM.journal)) return;
        setQuestStage(player, quest, services, STAGE_GIVEN_JOURNAL);
        services.messaging.sendGameMessage(player, "Filliman reads his journal and remembers his purpose.");
    });
    registry.registerItemAction(ITEM.journal, ({ player, services }) => services.messaging.sendGameMessage(player, "The journal calls for something from nature, faith, and the spirit-to-become."), "read");

    registry.registerItemAction(ITEM.bloomSpell, ({ player, services }) => {
        if (getQuestStage(player, quest) !== STAGE_BLESSED) return services.messaging.sendGameMessage(player, "The spell has no effect yet.");
        if (!replace(player, services, ITEM.bloomSpell, ITEM.usedBloomSpell)) return;
        setQuestStage(player, quest, services, STAGE_CAST_SPELL);
        services.messaging.sendGameMessage(player, "The Bloom spell makes fungi erupt from the rotting logs.");
    }, "cast");

    const castSickleBloom = ({ player, services }: { player: PlayerState; services: ScriptServices }) => {
        if (getQuestStage(player, quest) !== STAGE_BLESSED_SICKLE) return;
        setQuestStage(player, quest, services, STAGE_CAST_SICKLE_BLOOM);
        services.messaging.sendGameMessage(player, "The blessed sickle makes the swamp plants bloom.");
    };
    registry.registerItemAction(ITEM.silverSickleBlessed, castSickleBloom as never, "cast bloom");
    registry.registerEquipmentAction(ITEM.silverSickleBlessed, castSickleBloom as never, "cast bloom");

    const fillPouch = ({ player, services }: { player: PlayerState; services: ScriptServices }) => {
        const produce = [
            { id: ITEM.mortMyreFungus, points: 1 },
            { id: ITEM.mortMyreStem, points: 2 },
            { id: ITEM.mortMyrePear, points: 3 },
        ];
        const points = produce.reduce((sum, entry) => sum + countCarriedItem(player, services, entry.id) * entry.points, 0);
        if (!points) return services.messaging.sendGameMessage(player, "You need Mort myre fungus, stems, or pears to fill the pouch.");
        const empty = countCarriedItem(player, services, ITEM.druidPouchEmpty) > 0;
        for (const entry of produce) remove(player, services, entry.id, countCarriedItem(player, services, entry.id));
        if (empty) remove(player, services, ITEM.druidPouchEmpty);
        give(player, services, ITEM.druidPouch, points);
        if (getQuestStage(player, quest) === STAGE_PICKED_SICKLE_BLOOM) {
            setQuestStage(player, quest, services, STAGE_ADDED_POUCH);
            spawnQuestGhast(player, services);
        }
        services.messaging.sendGameMessage(player, `You add ${points} charge${points === 1 ? "" : "s"} to the druid pouch.`);
    };
    registry.registerItemAction(ITEM.druidPouchEmpty, fillPouch as never, "fill");
    registry.registerItemAction(ITEM.druidPouch, fillPouch as never, "fill");
    for (const ghastId of NPC.invisibleGhast) {
        registry.registerItemOnNpc(ITEM.druidPouch, ghastId, ({ player, services, target: npc }) => {
            if (!remove(player, services, ITEM.druidPouch)) return;
            services.npc.removeNpc(npc.id);
            services.npc.spawnNpc({ id: NPC.visibleGhast[0], x: npc.tileX, y: npc.tileY, level: npc.level, worldViewId: player.worldViewId, ownerPlayerId: player.id, lifetimeTicks: 500 });
        });
    }
}

function registerLocations(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const locId of LOC.swampGates) {
        registry.registerLocScript({
            locId,
            action: "open",
            handler: ({ player, services, tile, level }) => {
                const stage = getQuestStage(player, quest);
                if (stage === 0) return services.messaging.sendGameMessage(player, "You have no reason to enter Mort Myre swamp.");
                if (stage === STAGE_STARTED) {
                    setQuestStage(player, quest, services, STAGE_ENTERED_SWAMP);
                    services.groundItems.spawn(ITEM.washingBowl, 1, TILE.washingBowl, { ownerId: player.id, worldViewId: player.worldViewId, privateTicks: 10_000 });
                }
                services.movement.teleportPlayer(player, player.tileY >= tile.y ? tile.x : tile.x, player.tileY >= tile.y ? tile.y - 1 : tile.y + 1, level);
            },
        });
    }
    registry.registerLocScript({
        locId: LOC.grottoTree,
        action: "search",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) < STAGE_SHOWN_MIRROR || getQuestStage(player, quest) >= STAGE_GIVEN_JOURNAL || owns(player, services, ITEM.journal)) return services.messaging.sendGameMessage(player, "You find nothing in the knot hole.");
            give(player, services, ITEM.journal);
        },
    });
    registry.registerLocScript({
        locId: LOC.fungiLog,
        action: "pick",
        handler: ({ player, services }) => {
            const stage = getQuestStage(player, quest);
            if (stage !== STAGE_CAST_SPELL && stage !== STAGE_CAST_SICKLE_BLOOM) return services.messaging.sendGameMessage(player, "There is no harvestable fungus here.");
            if (!give(player, services, ITEM.mortMyreFungus)) return;
            setQuestStage(player, quest, services, stage === STAGE_CAST_SPELL ? STAGE_PICKED_FUNGI : STAGE_PICKED_SICKLE_BLOOM);
        },
    });
    registry.registerLocScript({ locId: LOC.buddingBranch, action: "take-cutting", handler: ({ player, services }) => { give(player, services, ITEM.mortMyreStem); } });
    registry.registerLocScript({ locId: LOC.pearBush, action: "pick", handler: ({ player, services }) => { give(player, services, ITEM.mortMyrePear); } });
    registry.registerItemOnLoc(ITEM.mortMyreFungus, LOC.natureStone, ({ player, services }) => {
        if (getQuestStage(player, quest) !== STAGE_SPOKEN_FILLIMAN_2 || !remove(player, services, ITEM.mortMyreFungus)) return;
        setBits(player, services, player.varps.getVarpValue(VARP_NATURE_SPIRIT_BITS) | NATURE_STONE_BIT);
    });
    for (const spellId of [ITEM.bloomSpell, ITEM.usedBloomSpell]) {
        registry.registerItemOnLoc(spellId, LOC.spiritStone, ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_SPOKEN_FILLIMAN_2 || !remove(player, services, spellId)) return;
            setBits(player, services, player.varps.getVarpValue(VARP_NATURE_SPIRIT_BITS) | SPIRIT_STONE_BIT);
        });
    }
    registry.registerLocScript({
        locId: LOC.grottoEntrance,
        action: "enter",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) < STAGE_PERFORMED_RITUAL) return services.messaging.sendGameMessage(player, "The grotto is sealed by an ancient force.");
            if (getQuestStage(player, quest) === STAGE_PERFORMED_RITUAL) setQuestStage(player, quest, services, STAGE_ENTERED_GROTTO);
            services.movement.teleportPlayer(player, TILE.grottoInside.x, TILE.grottoInside.y, TILE.grottoInside.level);
            services.npc.spawnNpc({ id: NPC.natureSpirit, x: TILE.grottoInside.x + 1, y: TILE.grottoInside.y, level: 0, worldViewId: player.worldViewId, ownerPlayerId: player.id, lifetimeTicks: 10_000 });
        },
    });
    for (const locId of LOC.grottoExit) registry.registerLocScript({ locId, action: "exit", handler: ({ player, services }) => services.movement.teleportPlayer(player, TILE.grottoOutside.x, TILE.grottoOutside.y, TILE.grottoOutside.level) });
    for (const locId of [LOC.undergroundGrotto, LOC.natureAltar]) {
        registry.registerItemOnLoc(ITEM.silverSickle, locId, ({ player, services }) => {
            if (getQuestStage(player, quest) < STAGE_BLESSED_SICKLE) return;
            if (replace(player, services, ITEM.silverSickle, ITEM.silverSickleBlessed)) services.messaging.sendGameMessage(player, "You dip the sickle into the grotto water and bless it.");
        });
    }
    registry.registerLocScript({ locId: LOC.bridge, action: "jump", handler: ({ player, services, tile, level }) => { services.movement.teleportPlayer(player, tile.x + (player.tileX <= tile.x ? 1 : -1), tile.y, level); services.skills.addSkillXp(player, SkillId.Agility, 15); } });
}

function registerGhastDeaths(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const ghastId of NPC.visibleGhast) {
        registry.registerNpcPreDeath(ghastId, (event) => {
            const player = event.killer;
            if (!player) return NpcPreDeathDecision.Allow;
            const stage = getQuestStage(player, quest);
            if (stage < STAGE_ADDED_POUCH || stage >= STAGE_KILLED_GHAST_3) return NpcPreDeathDecision.Allow;
            const next = stage === STAGE_ADDED_POUCH ? STAGE_KILLED_GHAST_1 : stage === STAGE_KILLED_GHAST_1 ? STAGE_KILLED_GHAST_2 : STAGE_KILLED_GHAST_3;
            setQuestStage(player, quest, event.services, next);
            event.services.skills.addSkillXp(player, SkillId.Prayer, 30);
            event.services.messaging.sendGameMessage(player, "The Ghast's tormented soul is released.");
            if (next < STAGE_KILLED_GHAST_3) {
                event.services.npc.spawnNpc({
                    id: NPC.visibleGhast[0],
                    x: event.npc.tileX + 3,
                    y: event.npc.tileY,
                    level: event.npc.level,
                    worldViewId: player.worldViewId,
                    ownerPlayerId: player.id,
                    lifetimeTicks: 1_000,
                });
            }
            return NpcPreDeathDecision.Allow;
        });
    }
}

export function registerNatureSpiritInteractions(quest: QuestDefinition, registry: IScriptRegistry, _services: ScriptServices): void {
    for (const drezelId of NPC.drezel) {
        const fallback = registry.findNpcInteractionDirect(drezelId, "talk-to");
        registry.registerNpcScript({ npcId: drezelId, option: "talk-to", handler: createDrezelHandler(quest, fallback) });
    }
    const filliman = createFillimanHandler(quest);
    registry.registerNpcScript({ npcId: NPC.filliman, option: "talk-to", handler: filliman });
    registry.registerNpcScript({ npcId: NPC.natureSpirit, option: "talk-to", handler: filliman });
    registry.registerNpcScript({ npcId: NPC.ulizius, option: "talk-to", handler: (event) => startConversation(context(event, "Ulizius"), [sayNpc(getQuestStage(event.player, quest) ? "Drezel said you may pass. Beware the Ghasts." : "The swamp is too dangerous for travellers.")]) });
    registerItems(quest, registry);
    registerLocations(quest, registry);
    registerGhastDeaths(quest, registry);
}
