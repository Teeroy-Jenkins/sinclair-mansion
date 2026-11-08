import type { PlayerCombatState } from "./PlayerCombatState";
import { CombatAttributes } from "../combat/state/CombatAttributes";
import type { CombatAttributeStore } from "../combat/state/CombatAttributeStore";

const SPECIAL_ENERGY_MAX = 100;
const SPECIAL_ENERGY_REGEN_CHUNK = 10;
const SPECIAL_ENERGY_REGEN_INTERVAL_TICKS = 50;

export class PlayerSpecialEnergyState {
    constructor(
        private readonly combat: PlayerCombatState,
        private readonly attributes: CombatAttributeStore,
    ) {}

    getUnits(): number {
        return Math.max(
            0,
            Math.min(
                SPECIAL_ENERGY_MAX,
                Math.floor(this.attributes.get(CombatAttributes.SPECIAL_ATTACK_ENERGY)),
            ),
        );
    }

    getPercent(): number {
        return Math.floor((this.getUnits() / SPECIAL_ENERGY_MAX) * 100);
    }

    setPercent(percent: number): void {
        const normalized = Math.max(0, Math.min(SPECIAL_ENERGY_MAX, Math.floor(percent)));
        if (normalized === this.getUnits()) return;
        this.attributes.set(CombatAttributes.SPECIAL_ATTACK_ENERGY, normalized);
        this.combat.specialEnergyDirty = true;
        if (normalized === 0) {
            this.attributes.set(CombatAttributes.SPECIAL_ATTACK_ACTIVE, false);
        }
    }

    setActivated(on: boolean): boolean {
        const normalized = !!on;
        if (normalized && this.getUnits() <= 0) {
            return false;
        }
        if (this.attributes.get(CombatAttributes.SPECIAL_ATTACK_ACTIVE) === normalized) {
            return true;
        }
        this.attributes.set(CombatAttributes.SPECIAL_ATTACK_ACTIVE, normalized);
        this.combat.specialEnergyDirty = true;
        return true;
    }

    isActivated(): boolean {
        return this.attributes.get(CombatAttributes.SPECIAL_ATTACK_ACTIVE);
    }

    consume(costPercent: number): boolean {
        const cost = Math.max(0, Math.min(SPECIAL_ENERGY_MAX, Math.floor(costPercent)));
        if (cost <= 0) return true;
        if (this.getUnits() < cost) {
            this.attributes.set(CombatAttributes.SPECIAL_ATTACK_ACTIVE, false);
            return false;
        }
        this.attributes.set(
            CombatAttributes.SPECIAL_ATTACK_ENERGY,
            Math.max(0, this.getUnits() - cost),
        );
        this.attributes.set(CombatAttributes.SPECIAL_ATTACK_ACTIVE, false);
        this.combat.specialEnergyDirty = true;
        return true;
    }

    tick(currentTick: number): boolean {
        // The regen cycle runs continuously and is NOT reset by spending energy
        // or sitting at full — the first chunk after a spec arrives in 1-50 ticks.
        if (this.combat.nextSpecialRegenTick <= 0) {
            this.combat.nextSpecialRegenTick = currentTick + SPECIAL_ENERGY_REGEN_INTERVAL_TICKS;
            return false;
        }
        if (currentTick < this.combat.nextSpecialRegenTick) {
            return false;
        }
        this.combat.nextSpecialRegenTick = currentTick + SPECIAL_ENERGY_REGEN_INTERVAL_TICKS;
        if (this.getUnits() >= SPECIAL_ENERGY_MAX) {
            return false;
        }
        this.attributes.set(
            CombatAttributes.SPECIAL_ATTACK_ENERGY,
            Math.min(SPECIAL_ENERGY_MAX, this.getUnits() + SPECIAL_ENERGY_REGEN_CHUNK),
        );
        this.combat.specialEnergyDirty = true;
        return true;
    }

    takeRegenTimerSync(
        currentTick: number,
    ): { intervalTicks: number; startTick: number } | undefined {
        if (this.combat.nextSpecialRegenTick <= 0) {
            this.combat.nextSpecialRegenTick = currentTick + SPECIAL_ENERGY_REGEN_INTERVAL_TICKS;
        }

        const startTick = Math.max(
            0,
            this.combat.nextSpecialRegenTick - SPECIAL_ENERGY_REGEN_INTERVAL_TICKS,
        );
        if (
            this.combat.lastSpecialRegenUiStartTick >= 0 &&
            this.combat.lastSpecialRegenUiInterval === SPECIAL_ENERGY_REGEN_INTERVAL_TICKS
        ) {
            return undefined;
        }

        this.combat.lastSpecialRegenUiStartTick = startTick;
        this.combat.lastSpecialRegenUiInterval = SPECIAL_ENERGY_REGEN_INTERVAL_TICKS;
        return { intervalTicks: SPECIAL_ENERGY_REGEN_INTERVAL_TICKS, startTick };
    }

    hasUpdate(): boolean {
        return this.combat.specialEnergyDirty;
    }

    markSynced(): void {
        this.combat.specialEnergyDirty = false;
    }
}
