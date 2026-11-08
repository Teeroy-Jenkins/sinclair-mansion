/**
 * Air altar Runecraft loop (LostCity runecraft.rs2 air path, soft).
 * Enter ruins with talisman/tiara → craft on altar → exit portal.
 */
import { EquipmentSlot } from "../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocEvent,
    LocInteractionEvent,
    ScriptServices,
} from "../../../../src/game/scripts/types";

const AIR_RUINS = [28914, 29090] as const;
const AIR_ALTAR = 34760;
const AIR_EXIT_PORTAL = 34748;

const AIR_TALISMAN = 1438;
const AIR_TIARA = 5527;
const RUNE_ESSENCE = 1436;
const PURE_ESSENCE = 7936;
const AIR_RUNE = 556;

const ALTAR_ENTER = { x: 2841, y: 4830, level: 0 } as const;
const RUINS_EXIT = { x: 2983, y: 3288, level: 0 } as const;

const LEVEL_REQ = 1;
const XP_PER_ESS = 5;
/** OSRS air: 1 + floor(level / 11) runes per essence. */
const MULTIPLIER_DIV = 11;

function rcLevel(player: PlayerState, services: ScriptServices): number {
    return services.skills.getSkill(player, SkillId.Runecraft)?.baseLevel ?? 1;
}

function wearsAirTiara(player: PlayerState, services: ScriptServices): boolean {
    const equip = services.equipment.getEquipArray(player) ?? [];
    return (equip[EquipmentSlot.HEAD] ?? 0) === AIR_TIARA;
}

function enterAirAltar(player: PlayerState, services: ScriptServices): void {
    services.messaging.sendGameMessage(
        player,
        "You hold the Air Talisman towards the mysterious ruins.",
    );
    services.messaging.sendGameMessage(player, "You feel a powerful force take hold of you...");
    services.movement.teleportPlayer(
        player,
        ALTAR_ENTER.x,
        ALTAR_ENTER.y,
        ALTAR_ENTER.level,
        true,
    );
}

function tryEnterFromClick(event: LocInteractionEvent): void {
    if (!wearsAirTiara(event.player, event.services)) {
        event.services.messaging.sendGameMessage(event.player, "Nothing interesting happens.");
        return;
    }
    enterAirAltar(event.player, event.services);
}

function tryEnterWithTalisman(event: ItemOnLocEvent): void {
    if (event.source.itemId !== AIR_TALISMAN) {
        event.services.messaging.sendGameMessage(event.player, "Nothing interesting happens.");
        return;
    }
    enterAirAltar(event.player, event.services);
}

function craftAirRunes(player: PlayerState, services: ScriptServices): void {
    const level = rcLevel(player, services);
    if (level < LEVEL_REQ) {
        services.messaging.sendGameMessage(
            player,
            `You need a Runecrafting level of at least ${LEVEL_REQ} to craft Air Runes.`,
        );
        return;
    }

    const runeEss = player.items.getItemCount(RUNE_ESSENCE);
    const pureEss = player.items.getItemCount(PURE_ESSENCE);
    const totalEss = runeEss + pureEss;
    if (totalEss <= 0) {
        services.messaging.sendGameMessage(player, "You do not have any essence to bind.");
        return;
    }

    const perEss = 1 + Math.floor(level / MULTIPLIER_DIV);
    const craftCount = totalEss * perEss;

    if (runeEss > 0) player.items.removeItem(RUNE_ESSENCE, runeEss, { assureFullRemoval: true });
    if (pureEss > 0) player.items.removeItem(PURE_ESSENCE, pureEss, { assureFullRemoval: true });
    player.items.addItem(AIR_RUNE, craftCount);
    services.inventory.snapshotInventory(player);
    services.skills.addSkillXp(player, SkillId.Runecraft, totalEss * XP_PER_ESS);
    services.messaging.sendGameMessage(player, "You bind the temple's power into Air Runes.");
}

function exitAltar(event: LocInteractionEvent): void {
    const { player, services } = event;
    services.messaging.sendGameMessage(player, "You step through the portal...");
    services.movement.teleportPlayer(player, RUINS_EXIT.x, RUINS_EXIT.y, RUINS_EXIT.level, true);
}

export function register(registry: IScriptRegistry): void {
    for (const ruinsId of AIR_RUINS) {
        registry.registerLocInteraction(ruinsId, tryEnterFromClick, "enter");
        registry.registerLocInteraction(ruinsId, tryEnterFromClick, undefined);
        registry.registerItemOnLoc(AIR_TALISMAN, ruinsId, tryEnterWithTalisman);
    }

    const craftFromLoc = (event: LocInteractionEvent) =>
        craftAirRunes(event.player, event.services);
    const craftFromItem = (event: ItemOnLocEvent) => craftAirRunes(event.player, event.services);

    registry.registerLocInteraction(AIR_ALTAR, craftFromLoc, "craft-rune");
    registry.registerLocInteraction(AIR_ALTAR, craftFromLoc, "craft rune");
    registry.registerLocInteraction(AIR_ALTAR, craftFromLoc, undefined);
    registry.registerItemOnLoc(RUNE_ESSENCE, AIR_ALTAR, craftFromItem);
    registry.registerItemOnLoc(PURE_ESSENCE, AIR_ALTAR, craftFromItem);

    registry.registerLocInteraction(AIR_EXIT_PORTAL, exitAltar, "use");
    registry.registerLocInteraction(AIR_EXIT_PORTAL, exitAltar, "exit");
    registry.registerLocInteraction(AIR_EXIT_PORTAL, exitAltar, undefined);
}
