import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { PlayerState } from "../../../player";
import type {
    WeaponCombatContext,
    WeaponGraphicProfile,
    WeaponProjectileProfile,
} from "../WeaponCombatProfile";

export const BALLISTA_STANDARD_ATTACK_ANIMATION_ID = 7555;
export const BALLISTA_SPECIAL_ATTACK_ANIMATION_ID = 7556;
export const BALLISTA_SPECIAL_ATTACK_SOUND_ID = 3739;

const CLIENT_CYCLES_PER_GAME_TICK = 30;
const JAVELIN_RELEASE_DELAY_TICKS = 42 / CLIENT_CYCLES_PER_GAME_TICK;

const JAVELIN_PROJECTILE_BY_ITEM_ID = new Map<number, number>([
    [825, 200], [831, 200], [5642, 200], [5648, 200],
    [826, 201], [832, 201], [5643, 201], [5649, 201],
    [827, 202], [833, 202], [5644, 202], [5650, 202],
    [828, 203], [834, 203], [5645, 203], [5651, 203],
    [829, 204], [835, 204], [5646, 204], [5652, 204],
    [830, 205], [836, 205], [5647, 205], [5653, 205],
    [19484, 1301], [19486, 1301], [19488, 1301], [19490, 1301], [23648, 1301],
    [21318, 1386], [21320, 1386], [21322, 1386], [21324, 1386],
]);

export const BALLISTA_JAVELIN_IMPACT_GRAPHIC: WeaponGraphicProfile = Object.freeze({
    id: 344,
    height: 146,
});

/** Resolves the cache projectile matching the equipped javelin's metal tier. */
export function resolveBallistaJavelinProjectile(
    context: WeaponCombatContext,
): WeaponProjectileProfile | undefined {
    if (!(context.attacker instanceof PlayerState)) return undefined;
    const ammoId = context.attacker.appearance.equip[EquipmentSlot.AMMO] ?? -1;
    const projectileId = JAVELIN_PROJECTILE_BY_ITEM_ID.get(ammoId);
    if (projectileId === undefined) return undefined;
    return {
        id: projectileId,
        startHeight: 38,
        endHeight: 36,
        slope: 1,
        steepness: 120,
        startDelayTicks: JAVELIN_RELEASE_DELAY_TICKS,
        lifeModel: "javelin",
    };
}

/** Javelins start after 42 client cycles and travel for `distance * 3 + 2`. */
export function resolveBallistaJavelinHitDelay(distanceTiles: number): number {
    const distance = Math.max(1, Math.trunc(distanceTiles));
    return 1 + Math.floor((42 + distance * 3 + 2) / CLIENT_CYCLES_PER_GAME_TICK);
}
