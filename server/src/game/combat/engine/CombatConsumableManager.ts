import type { PlayerState } from "../../player";
import { CombatAttributes } from "../state/CombatAttributes";

const STANDARD_CONSUMABLE_DELAY_TICKS = 3;
const COMBO_FOOD_ATTACK_DELAY_TICKS = 2;

/**
 * Owns the absolute map-clock deadlines for food and potion consumption.
 *
 * These deadlines are intentionally independent. Drinking a potion does not
 * consume the food delay, and neither deadline is represented by a counter
 * that must be decremented by the game loop.
 */
export class CombatConsumableManager {
    canEatFood(player: PlayerState, currentMapClock: number): boolean {
        const clock = this.mapClock(currentMapClock);
        return clock >= player.combatAttributes.get(CombatAttributes.FOOD_DELAY);
    }

    canDrinkPotion(player: PlayerState, currentMapClock: number): boolean {
        const clock = this.mapClock(currentMapClock);
        return clock >= player.combatAttributes.get(CombatAttributes.POTION_DELAY);
    }

    applyFoodDelay(player: PlayerState, currentMapClock: number): void {
        const clock = this.mapClock(currentMapClock);
        const store = player.combatAttributes;
        const existingAttackDelay = store.get(CombatAttributes.ATTACK_DELAY);

        store.set(CombatAttributes.FOOD_DELAY, clock + STANDARD_CONSUMABLE_DELAY_TICKS);
        store.set(
            CombatAttributes.ATTACK_DELAY,
            Math.max(existingAttackDelay, clock) + STANDARD_CONSUMABLE_DELAY_TICKS,
        );
    }

    applyPotionDelay(player: PlayerState, currentMapClock: number): void {
        const clock = this.mapClock(currentMapClock);
        player.combatAttributes.set(
            CombatAttributes.POTION_DELAY,
            clock + STANDARD_CONSUMABLE_DELAY_TICKS,
        );
    }

    /** Preserves the shorter attack penalty used by combo food such as karambwan. */
    applyComboFoodAttackDelay(player: PlayerState, currentMapClock: number): void {
        const clock = this.mapClock(currentMapClock);
        const store = player.combatAttributes;
        store.set(
            CombatAttributes.ATTACK_DELAY,
            Math.max(store.get(CombatAttributes.ATTACK_DELAY), clock) +
                COMBO_FOOD_ATTACK_DELAY_TICKS,
        );
    }

    private mapClock(value: number): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Current map clock must be finite; received ${value}`);
        }
        return Math.trunc(value);
    }
}

export const combatConsumableManager = new CombatConsumableManager();
