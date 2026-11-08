import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import {
    ANY_ITEM_ID,
    NpcPreDeathDecision,
    type IScriptRegistry,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    BIT,
    ITEM,
    LOC,
    NPC,
    PICKAXES,
    TILE,
    VARP_ELEMENTAL_WORKSHOP,
} from "./constants";

function raw(player: PlayerState): number {
    return player.varps.getVarpValue(VARP_ELEMENTAL_WORKSHOP);
}

function has(player: PlayerState, bit: number): boolean {
    return (raw(player) & bit) !== 0;
}

function write(player: PlayerState, services: ScriptServices, value: number): void {
    player.varps.setVarpValue(VARP_ELEMENTAL_WORKSHOP, value);
    services.variables.sendVarp(player, VARP_ELEMENTAL_WORKSHOP, value);
}

function setBit(player: PlayerState, services: ScriptServices, bit: number, enabled = true): void {
    write(player, services, enabled ? raw(player) | bit : raw(player) & ~bit);
}

function toggleBit(player: PlayerState, services: ScriptServices, bit: number): void {
    setBit(player, services, bit, !has(player, bit));
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function hasInventoryItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return countCarriedItem(player, services, itemId) > 0;
}

function removeItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    if (countCarriedItem(player, services, itemId) < quantity) return false;
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const amount = Math.min(remaining, entry.quantity);
        const left = entry.quantity - amount;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= amount;
        if (remaining === 0) break;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function giveItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    const inInventory = hasInventoryItem(player, services, itemId);
    if (!inInventory && !services.inventory.hasInventorySlot(player)) {
        services.messaging.sendGameMessage(player, "You need a free inventory space.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function level(player: PlayerState, services: ScriptServices, skillId: number): number {
    const skill = services.skills.getSkill(player, skillId);
    return skill.baseLevel + skill.boost;
}

function registerBook(registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.bookcase,
        action: "search",
        handler: ({ player, services }) => {
            if (!has(player, BIT.readBook)) {
                if (!owns(player, services, ITEM.batteredBook) && giveItem(player, services, ITEM.batteredBook)) {
                    services.messaging.sendGameMessage(player, "You find a battered book titled 'The Elemental Shield'.");
                }
                return;
            }
            let recovered = false;
            if (!owns(player, services, ITEM.batteredBook)) {
                recovered = giveItem(player, services, ITEM.batteredBook) || recovered;
            }
            if (has(player, BIT.slashedBook) && !owns(player, services, ITEM.batteredKey)) {
                recovered = giveItem(player, services, ITEM.batteredKey) || recovered;
            }
            services.messaging.sendGameMessage(player, recovered ? "You recover the book and its hidden key." : "You find nothing else of interest.");
        },
    });
    registry.registerItemAction(
        ITEM.batteredBook,
        ({ player, services }) => {
            services.messaging.sendGameMessage(player, "The book describes a hidden workshop and the manufacture of elemental shields.");
            if (!has(player, BIT.readBook)) setBit(player, services, BIT.readBook);
        },
        "read",
    );
    registry.registerItemOnItem(ANY_ITEM_ID, ITEM.batteredBook, ({ player, services, source, target }) => {
        if (!has(player, BIT.readBook)) {
            services.messaging.sendGameMessage(player, "You should read the book before cutting it.");
            return;
        }
        const cuttingItemId = source.itemId === ITEM.batteredBook ? target.itemId : source.itemId;
        const definition = services.data.getObjType(cuttingItemId) as
            | { name?: unknown; bonuses?: unknown }
            | undefined;
        const name = String(definition?.name ?? "").toLowerCase();
        const bonuses = Array.isArray(definition?.bonuses) ? definition.bonuses : [];
        const slashBonus = Number(bonuses[2] ?? 0);
        if (
            cuttingItemId !== ITEM.knife &&
            slashBonus <= 0 &&
            !/(knife|sword|scimitar|dagger|machete|axe)/.test(name)
        ) {
            services.messaging.sendGameMessage(player, "You need a sharp blade to cut the binding.");
            return;
        }
        if (!owns(player, services, ITEM.batteredKey) && !giveItem(player, services, ITEM.batteredKey)) return;
        setBit(player, services, BIT.slashedBook);
        services.messaging.sendGameMessage(player, "You cut the spine and find a battered key hidden inside.");
    });
}

function crossOddWall(player: PlayerState, services: ScriptServices): void {
    if (!owns(player, services, ITEM.batteredKey)) {
        services.messaging.sendGameMessage(player, "You see a keyhole, but have no key that fits.");
        return;
    }
    const y = player.tileY >= 3495 ? 3494 : 3496;
    services.movement.teleportPlayer(player, player.tileX, y, player.level);
}

function registerEntrance(registry: IScriptRegistry): void {
    for (const locId of LOC.oddWalls) {
        registry.registerLocScript({ locId, action: "open", handler: ({ player, services }) => crossOddWall(player, services) });
        registry.registerItemOnLoc(ITEM.batteredKey, locId, ({ player, services }) => crossOddWall(player, services));
    }
    registry.registerLocScript({ locId: LOC.openOddWall, action: "pass", handler: ({ player, services }) => crossOddWall(player, services) });
    registry.registerLocScript({
        locId: LOC.surfaceStairs,
        action: "climb-down",
        handler: ({ player, services }) => {
            services.movement.teleportPlayer(player, TILE.workshopEntry.x, TILE.workshopEntry.y, TILE.workshopEntry.level);
            setBit(player, services, BIT.enteredWorkshop);
        },
    });
    registry.registerLocScript({
        locId: LOC.workshopStairs,
        action: "climb-up",
        handler: ({ player, services }) =>
            services.movement.teleportPlayer(player, TILE.surfaceEntry.x, TILE.surfaceEntry.y, TILE.surfaceEntry.level),
    });
}

function registerCrates(registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.bowlCrate,
        action: "search",
        handler: ({ player, services }) => {
            if (!owns(player, services, ITEM.emptyBowl) && !owns(player, services, ITEM.lavaBowl)) {
                if (giveItem(player, services, ITEM.emptyBowl)) services.messaging.sendGameMessage(player, "You find a stone bowl.");
                return;
            }
            services.messaging.sendGameMessage(player, "The crate is empty.");
        },
    });
    registry.registerLocScript({
        locId: LOC.needleCrate,
        action: "search",
        handler: ({ player, services }) => {
            if (has(player, BIT.needleFound) || owns(player, services, ITEM.needle)) {
                services.messaging.sendGameMessage(player, "The crate is empty.");
                return;
            }
            if (giveItem(player, services, ITEM.needle)) {
                setBit(player, services, BIT.needleFound);
                services.messaging.sendGameMessage(player, "You find a needle.");
            }
        },
    });
    registry.registerLocScript({
        locId: LOC.leatherCrate,
        action: "search",
        handler: ({ player, services }) => {
            if (has(player, BIT.leatherFound) || owns(player, services, ITEM.leather)) {
                services.messaging.sendGameMessage(player, "The boxes are empty.");
                return;
            }
            if (giveItem(player, services, ITEM.leather)) {
                setBit(player, services, BIT.leatherFound);
                services.messaging.sendGameMessage(player, "You find some leather.");
            }
        },
    });
}

function registerWater(registry: IScriptRegistry): void {
    const turnValve = ({ player, services, tile }: { player: PlayerState; services: ScriptServices; tile: { x: number; y: number } }) => {
        if (has(player, BIT.waterFlowing)) {
            services.messaging.sendGameMessage(player, "The controls are locked while the water wheel is running.");
            return;
        }
        const eastValve = tile.x >= 2720;
        if (eastValve) {
            if (!has(player, BIT.waterLeft)) toggleBit(player, services, BIT.waterRight);
        } else {
            toggleBit(player, services, BIT.waterLeft);
        }
        services.messaging.sendGameMessage(player, "You turn the water control.");
    };
    for (const locId of [...LOC.waterValveBases, ...LOC.waterValves]) {
        registry.registerLocScript({ locId, action: "turn", handler: turnValve });
    }
    registry.registerLocScript({
        locId: LOC.waterLever,
        action: "pull",
        handler: ({ player, services }) => {
            if (has(player, BIT.waterFlowing)) {
                setBit(player, services, BIT.waterFlowing, false);
                setBit(player, services, BIT.airBlowing, false);
                services.messaging.sendGameMessage(player, "The water wheel comes to a standstill.");
                return;
            }
            if (has(player, BIT.waterLeft) && has(player, BIT.waterRight)) {
                setBit(player, services, BIT.waterFlowing);
                services.messaging.sendGameMessage(player, "The water wheel starts turning.");
                return;
            }
            setBit(player, services, BIT.waterLeft, false);
            setBit(player, services, BIT.waterRight, false);
            services.messaging.sendGameMessage(player, "The flow gates reset; the wheel remains still.");
        },
    });
}

function registerBellows(registry: IScriptRegistry): void {
    const fix = ({ player, services }: { player: PlayerState; services: ScriptServices }) => {
        if (has(player, BIT.bellowsRepaired)) {
            services.messaging.sendGameMessage(player, "The bellows are already repaired.");
            return;
        }
        if (level(player, services, SkillId.Crafting) < 20) {
            services.messaging.sendGameMessage(player, "You need level 20 Crafting to repair the bellows.");
            return;
        }
        if (
            !hasInventoryItem(player, services, ITEM.needle) ||
            !hasInventoryItem(player, services, ITEM.thread) ||
            !hasInventoryItem(player, services, ITEM.leather)
        ) {
            services.messaging.sendGameMessage(player, "You need leather, thread and a needle.");
            return;
        }
        if (!removeItem(player, services, ITEM.thread) || !removeItem(player, services, ITEM.leather)) return;
        setBit(player, services, BIT.bellowsRepaired);
        services.messaging.sendGameMessage(player, "You stitch leather over the hole in the bellows.");
    };
    for (const locId of [LOC.bellowsBase, ...LOC.bellows]) {
        registry.registerLocScript({ locId, action: "fix", handler: fix });
    }
    registry.registerLocScript({
        locId: LOC.airLever,
        action: "pull",
        handler: ({ player, services }) => {
            if (has(player, BIT.airBlowing)) {
                setBit(player, services, BIT.airBlowing, false);
                services.messaging.sendGameMessage(player, "The bellows stop pumping.");
                return;
            }
            if (!has(player, BIT.waterFlowing) || !has(player, BIT.bellowsRepaired)) {
                services.messaging.sendGameMessage(player, "Nothing happens; the lever resets itself.");
                return;
            }
            setBit(player, services, BIT.airBlowing);
            services.messaging.sendGameMessage(player, "The bellows pump air down the pipe.");
        },
    });
}

function registerOre(registry: IScriptRegistry): void {
    registry.registerNpcScript({
        npcId: NPC.elementalRock,
        option: "mine",
        handler: ({ player, services, npc, tick }) => {
            if (level(player, services, SkillId.Mining) < 20) {
                services.messaging.sendGameMessage(player, "You need level 20 Mining to mine elemental ore.");
                return;
            }
            if (!PICKAXES.some((itemId) => owns(player, services, itemId))) {
                services.messaging.sendGameMessage(player, "You need a pickaxe to mine this rock.");
                return;
            }
            const active = services.npc.findNearbyNpc(player, NPC.earthElemental, 2);
            if (active?.ownerPlayerId === player.id) return;
            const elemental = services.npc.spawnNpc({
                id: NPC.earthElemental,
                x: npc.tileX,
                y: npc.tileY,
                level: npc.level,
                worldViewId: player.worldViewId,
                ownerPlayerId: player.id,
                lifetimeTicks: 500,
            });
            elemental?.engageCombat(player.id, tick, { tileX: player.tileX, tileY: player.tileY });
            services.messaging.sendGameMessage(player, "The rock springs to life as an earth elemental!");
        },
    });
    registry.registerNpcPreDeath(NPC.earthElemental, (event) => {
        if (event.npc.ownerPlayerId === undefined || event.npc.ownerPlayerId !== event.killerPlayerId) {
            return NpcPreDeathDecision.Allow;
        }
        const player = event.killer;
        if (player) {
            event.services.groundItems.spawn(
                ITEM.elementalOre,
                1,
                { x: event.npc.tileX, y: event.npc.tileY, level: event.npc.level },
                { ownerId: player.id, worldViewId: player.worldViewId, privateTicks: 250 },
            );
        }
        return NpcPreDeathDecision.Allow;
    });
}

function registerFurnace(registry: IScriptRegistry): void {
    for (const locId of LOC.lavaTroughs) {
        registry.registerItemOnLoc(ITEM.emptyBowl, locId, ({ player, services }) => {
            if (!removeItem(player, services, ITEM.emptyBowl)) return;
            giveItem(player, services, ITEM.lavaBowl);
            services.messaging.sendGameMessage(player, "You fill the stone bowl with lava.");
        });
    }
    for (const locId of [LOC.furnaceBase, ...LOC.furnaces]) {
        registry.registerItemOnLoc(ITEM.lavaBowl, locId, ({ player, services }) => {
            if (!removeItem(player, services, ITEM.lavaBowl)) return;
            giveItem(player, services, ITEM.emptyBowl);
            if (!has(player, BIT.furnaceLit)) {
                setBit(player, services, BIT.furnaceLit);
                services.messaging.sendGameMessage(player, "The furnace bursts into life.");
            } else {
                services.messaging.sendGameMessage(player, "The extra lava makes little difference.");
            }
        });
        registry.registerItemOnLoc(ITEM.elementalOre, locId, ({ player, services }) => {
            if (!has(player, BIT.furnaceLit) || !has(player, BIT.airBlowing)) {
                services.messaging.sendGameMessage(player, "The furnace is not hot enough to refine the ore.");
                return;
            }
            if (countCarriedItem(player, services, ITEM.coal) < 4) {
                services.messaging.sendGameMessage(player, "You need four coal to smelt elemental ore.");
                return;
            }
            if (!removeItem(player, services, ITEM.elementalOre) || !removeItem(player, services, ITEM.coal, 4)) return;
            if (!giveItem(player, services, ITEM.elementalMetal)) return;
            services.skills.addSkillXp(player, SkillId.Smithing, 8);
            services.messaging.sendGameMessage(player, "You retrieve a bar of elemental metal.");
        });
    }
}

function registerWorkbench(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerItemOnLoc(ITEM.elementalMetal, LOC.workbench, ({ player, services }) => {
        if (level(player, services, SkillId.Smithing) < 20) {
            services.messaging.sendGameMessage(player, "You need level 20 Smithing to work elemental metal.");
            return;
        }
        if (!hasInventoryItem(player, services, ITEM.hammer)) {
            services.messaging.sendGameMessage(player, "You need a hammer to work the metal.");
            return;
        }
        if (!hasInventoryItem(player, services, ITEM.batteredBook)) {
            services.messaging.sendGameMessage(player, "You need the battered book's instructions.");
            return;
        }
        if (!removeItem(player, services, ITEM.elementalMetal)) return;
        if (!giveItem(player, services, ITEM.elementalShield)) return;
        services.skills.addSkillXp(player, SkillId.Smithing, 20);
        services.messaging.sendGameMessage(player, "You make an elemental shield.");
        if (!has(player, BIT.complete)) {
            const machineState = raw(player);
            if (completeQuest(player, services, quest)) {
                write(player, services, machineState | BIT.complete);
            }
        }
    });
}

export function registerElementalWorkshopIInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registerBook(registry);
    registerEntrance(registry);
    registerCrates(registry);
    registerWater(registry);
    registerBellows(registry);
    registerOre(registry);
    registerFurnace(registry);
    registerWorkbench(quest, registry);
}
