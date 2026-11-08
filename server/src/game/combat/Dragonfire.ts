import { EquipmentSlot } from "../../../../client/rs/config/player/Equipment";
import type { PlayerState } from "../player";
import { OverheadType } from "../prayer/OverheadType";
import { ANTIFIRE_TIMER, SUPER_ANTIFIRE_TIMER } from "../model/timer/Timers";
import { AttackType } from "./AttackType";
import type { WeaponSpecialAttack } from "./plugins/WeaponCombatProfile";
import { CombatAttributes } from "./state/CombatAttributes";

const STANDARD_CHROMATIC_DRAGON_IDS = new Set([
    247, 248, 249, 250, 251, // Red dragons
    252, 253, 254, 255, 256, 257, 258, 259, 7861, // Black dragons
    260, 261, 262, 263, 264, 7868, 7869, 7870, // Green dragons
    265, 266, 267, 268, 269, 5878, 5879, 5880, 5881, 5882, // Blue dragons
]);

const DRAGONFIRE_SHIELD_IDS = new Set([
    1540, 11710, // Anti-dragon shields
    11283, 11284, 11285, // Dragonfire shields
    21633, 21634, // Ancient wyvern shields
    22002, 22003, // Dragonfire wards
]);

export const STANDARD_DRAGONFIRE_ATTACK: WeaponSpecialAttack = Object.freeze({
    energyCostPercent: 0,
    hitCount: 1,
    accuracyMultiplier: 1,
    damageMultiplier: 1,
    rollAttackType: AttackType.Magic,
    damageType: AttackType.Magic,
    ignoreProtectionPrayer: true,
    maxHitOverride: 50,
    attackAnimation: 81,
    castGraphic: Object.freeze({ id: 1 }),
    projectiles: Object.freeze([Object.freeze({ id: 54, lifeModel: "magic" as const })]),
    hitDelayTicks: Object.freeze([1]),
});

export function isStandardChromaticDragon(typeId: number): boolean {
    return STANDARD_CHROMATIC_DRAGON_IDS.has(typeId);
}

export function shouldUseStandardDragonfire(random: () => number = Math.random): boolean {
    return random() < 1 / 6;
}

export function getStandardDragonfireMaxHit(
    player: PlayerState,
    dragonWonAccuracyRoll: boolean,
): number {
    if (player.timers.has(SUPER_ANTIFIRE_TIMER)) return 0;

    const hasAntifire = player.timers.has(ANTIFIRE_TIMER);
    const shieldId = player.appearance.equip[EquipmentSlot.SHIELD] ?? -1;
    const hasShield = DRAGONFIRE_SHIELD_IDS.has(shieldId);
    const hasProtectMagic =
        player.combatAttributes.get(CombatAttributes.ACTIVE_OVERHEAD_PRAYER) ===
        OverheadType.MAGIC;

    if (hasAntifire && (hasShield || hasProtectMagic)) return 0;
    if (hasShield) return 5;
    if (hasProtectMagic) return 10;
    if (hasAntifire) return dragonWonAccuracyRoll ? 35 : 15;
    return dragonWonAccuracyRoll ? 50 : 30;
}

export function rollStandardDragonfireDamage(
    player: PlayerState,
    dragonWonAccuracyRoll: boolean,
    random: () => number = Math.random,
): { readonly damage: number; readonly maxHit: number } {
    const maxHit = getStandardDragonfireMaxHit(player, dragonWonAccuracyRoll);
    const damage = Math.floor(Math.max(0, Math.min(0.999999999, random())) * (maxHit + 1));
    return Object.freeze({ damage, maxHit });
}
