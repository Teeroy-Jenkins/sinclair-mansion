import type { AttackType } from "../combat/AttackType";
import { type ChargeTracker, createChargeTracker } from "../combat/DegradationSystem";
import type { CombatEntityRef } from "../combat/model/CombatEntityRef";
import { CombatAttributes } from "../combat/state/CombatAttributes";
import type { CombatAttributeStore } from "../combat/state/CombatAttributeStore";
import type { NpcState } from "../npc";

/**
 * Combat-related fields for a player. Composed into PlayerState to reduce
 * the size of the player class while keeping all combat data co-located.
 *
 * Methods that depend on Actor base class (freeze, movement lock, etc.)
 * remain on PlayerState as thin delegates.
 */
export class PlayerCombatState {
    private combatAttributes?: CombatAttributeStore;
    private autoRetaliateFallback: boolean = true;

    get autoRetaliate(): boolean {
        return (
            this.combatAttributes?.get(CombatAttributes.AUTO_RETALIATE_ENABLED) ??
            this.autoRetaliateFallback
        );
    }

    set autoRetaliate(enabled: boolean) {
        const normalized = !!enabled;
        this.autoRetaliateFallback = normalized;
        this.combatAttributes?.set(CombatAttributes.AUTO_RETALIATE_ENABLED, normalized);
    }

    bindCombatAttributes(attributes: CombatAttributeStore): void {
        this.combatAttributes = attributes;
        if (!attributes.has(CombatAttributes.AUTO_RETALIATE_ENABLED)) {
            attributes.set(CombatAttributes.AUTO_RETALIATE_ENABLED, this.autoRetaliateFallback);
        }
    }

    weaponCategory: number = 0;
    weaponItemId: number = -1;
    /**
     * Attack reach in tiles derived from equipped weapon (ObjType param 13 when present).
     * some melee weapons (e.g. halberds) have reach > 1.
     */
    weaponRange: number = 0;
    styleSlot: number = 0;
    styleCategory?: number;
    spellId: number = -1;
    autocastEnabled: boolean = false;
    autocastMode: "autocast" | "defensive_autocast" | null = null;
    pendingAutocastDefensive?: boolean;
    pendingAutocastWeaponId?: number;
    lastSpellCastTick: number = Number.MIN_SAFE_INTEGER;
    /** Latest manual combat spell click waiting for the shared action timer. */
    pendingManualCombatSpell?: {
        spellId: number;
        target: { type: "npc"; npcId: number } | { type: "player"; playerId: number };
    };
    pendingPlayerSpellDamage?: { targetId: number };

    slayerTask?: {
        onTask?: boolean;
        active?: boolean;
        remaining?: number;
        amount?: number;
        monsterName?: string;
        monsterSpecies?: string[];
    };

    /** Current attack speed in ticks (e.g., 4 for most melee weapons) */
    attackDelay: number = 4;
    /** Last known wilderness level for change detection. */
    lastWildernessLevel: number = 0;
    /** Last known multi-combat state for change detection. */
    lastInMultiCombat: boolean = false;
    /** Last known PvP area state for change detection. */
    lastInPvPArea: boolean = false;
    /** Last known raid state for change detection. */
    lastInRaid: boolean = false;
    /** Last known LMS state for change detection. */
    lastInLMS: boolean = false;

    // Non-target interaction and hit history references. The active combat
    // target itself lives exclusively in PlayerState.combatAttributes.
    interactingNpc: WeakRef<NpcState> | null = null;
    interactingPlayer: WeakRef<PlayerCombatTargetRef> | null = null;
    lastHitBy: WeakRef<NpcState | PlayerCombatTargetRef> | null = null;
    lastHit: WeakRef<NpcState | PlayerCombatTargetRef> | null = null;

    // Combat style memory
    styleMemory: Map<number, number> = new Map();
    attackTypes?: AttackType[];
    meleeBonusIndices?: Array<number | undefined>;

    // Special attack regeneration and outbound synchronization metadata. The
    // current energy and active toggle live in CombatAttributeStore.
    nextSpecialRegenTick: number = 0;
    lastSpecialRegenUiStartTick: number = -1;
    lastSpecialRegenUiInterval: number = -1;
    specialEnergyDirty: boolean = true;

    /**
     * Offensive instant specials are packeted separately from the world combat
     * cycle. Keep each activation until the combat engine can prepare its own
     * immutable attack, rather than collapsing rapid clicks into one boolean.
     */
    private queuedInstantSpecialAttacks: Array<{
        weaponId: number;
        target: CombatEntityRef | null;
        queuedAtTick: number;
    }> = [];
    private instantSpecialInputTick: number = Number.MIN_SAFE_INTEGER;
    private unmatchedInstantSpecialVarpInputs: number = 0;
    private unmatchedInstantSpecialButtonInputs: number = 0;

    /**
     * The client changes the special varp and sends an IF_BUTTON for one click.
     * Pair those two packets while still allowing multiple real clicks in the
     * same tick to enqueue independently.
     */
    claimInstantSpecialActivationInput(
        source: "varp" | "button",
        currentTick: number,
    ): boolean {
        const tick = Math.trunc(currentTick);
        if (tick !== this.instantSpecialInputTick) {
            this.instantSpecialInputTick = tick;
            this.unmatchedInstantSpecialVarpInputs = 0;
            this.unmatchedInstantSpecialButtonInputs = 0;
        }

        if (source === "varp") {
            if (this.unmatchedInstantSpecialButtonInputs > 0) {
                this.unmatchedInstantSpecialButtonInputs--;
                return false;
            }
            this.unmatchedInstantSpecialVarpInputs++;
            return true;
        }

        if (this.unmatchedInstantSpecialVarpInputs > 0) {
            this.unmatchedInstantSpecialVarpInputs--;
            return false;
        }
        this.unmatchedInstantSpecialButtonInputs++;
        return true;
    }

    queueInstantSpecialAttack(
        weaponId: number,
        target: CombatEntityRef | null,
        currentTick: number,
    ): void {
        this.queuedInstantSpecialAttacks.push({
            weaponId: Math.trunc(weaponId),
            target,
            queuedAtTick: Math.trunc(currentTick),
        });
    }

    countQueuedInstantSpecialAttacks(weaponId: number): number {
        const normalizedWeaponId = Math.trunc(weaponId);
        return this.queuedInstantSpecialAttacks.reduce(
            (count, queued) => count + (queued.weaponId === normalizedWeaponId ? 1 : 0),
            0,
        );
    }

    hasQueuedInstantSpecialAttacks(): boolean {
        return this.queuedInstantSpecialAttacks.length > 0;
    }

    pruneExpiredInstantSpecialAttacks(currentTick: number, lifetimeTicks: number): number {
        const clock = Math.trunc(currentTick);
        const lifetime = Math.max(0, Math.trunc(lifetimeTicks));
        const previousCount = this.queuedInstantSpecialAttacks.length;
        this.queuedInstantSpecialAttacks = this.queuedInstantSpecialAttacks.filter(
            (queued) => clock - queued.queuedAtTick <= lifetime,
        );
        return previousCount - this.queuedInstantSpecialAttacks.length;
    }

    takeQueuedInstantSpecialAttacks(
        weaponId: number,
        target: CombatEntityRef,
    ): { count: number; includedUntargetedActivation: boolean } {
        const normalizedWeaponId = Math.trunc(weaponId);
        let count = 0;
        let includedUntargetedActivation = false;
        this.queuedInstantSpecialAttacks = this.queuedInstantSpecialAttacks.filter((queued) => {
            const targetMatches =
                queued.target === null ||
                (queued.target.type === target.type && queued.target.id === target.id);
            if (queued.weaponId !== normalizedWeaponId || !targetMatches) return true;
            count++;
            if (queued.target === null) includedUntargetedActivation = true;
            return false;
        });
        return { count, includedUntargetedActivation };
    }

    clearQueuedInstantSpecialAttacks(): number {
        const count = this.queuedInstantSpecialAttacks.length;
        this.queuedInstantSpecialAttacks = [];
        return count;
    }

    // Equipment degradation
    degradationCharges: ChargeTracker = createChargeTracker();
    degradationLastItemId: Map<number, number> = new Map();

    // Freeze query methods

    isFrozen(currentTick: number): boolean {
        return (
            this.combatAttributes?.get(CombatAttributes.FREEZE_UNTIL_CLOCK) ?? 0
        ) > Math.trunc(currentTick);
    }

    isFreezeImmune(currentTick: number): boolean {
        return (
            Math.trunc(currentTick) <
            (this.combatAttributes?.get(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK) ?? 0)
        );
    }

    getFreezeRemaining(currentTick: number): number {
        return Math.max(
            0,
            (this.combatAttributes?.get(CombatAttributes.FREEZE_UNTIL_CLOCK) ?? 0) -
                Math.trunc(currentTick),
        );
    }

    /**
     * Check freeze immunity and compute new expiry tick.
     * Returns the new expiry tick, or -1 if immune.
     * The caller (PlayerState) must apply Actor-level side effects.
     */
    tryApplyFreeze(durationTicks: number, currentTick: number): number {
        const attributes = this.combatAttributes;
        if (!attributes) return -1;

        const clock = Math.trunc(currentTick);
        if (clock < attributes.get(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK)) {
            return -1;
        }

        const expires = Math.max(
            attributes.get(CombatAttributes.FREEZE_UNTIL_CLOCK),
            clock + Math.max(1, Math.trunc(durationTicks)),
        );
        attributes.set(CombatAttributes.FREEZE_UNTIL_CLOCK, expires);
        attributes.set(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK, expires + 3);
        return expires;
    }

    getInteractingNpc(): NpcState | null {
        return this.interactingNpc?.deref() ?? null;
    }

    setInteractingNpc(npc: NpcState | null): void {
        this.interactingNpc = npc ? new WeakRef(npc) : null;
    }

    getInteractingPlayer(): PlayerCombatTargetRef | null {
        return this.interactingPlayer?.deref() ?? null;
    }

    setInteractingPlayer(player: PlayerCombatTargetRef | null): void {
        this.interactingPlayer = player ? new WeakRef(player) : null;
    }

    getLastHitBy(): NpcState | PlayerCombatTargetRef | null {
        return this.lastHitBy?.deref() ?? null;
    }

    setLastHitBy(pawn: NpcState | PlayerCombatTargetRef | null): void {
        this.lastHitBy = pawn ? new WeakRef(pawn) : null;
    }

    getLastHit(): NpcState | PlayerCombatTargetRef | null {
        return this.lastHit?.deref() ?? null;
    }

    setLastHit(pawn: NpcState | PlayerCombatTargetRef | null): void {
        this.lastHit = pawn ? new WeakRef(pawn) : null;
    }
}

/**
 * Minimal interface for PlayerState when referenced as a combat target.
 * Avoids circular dependency between PlayerCombatState and PlayerState.
 */
export interface PlayerCombatTargetRef {
    readonly id: number;
    readonly isPlayer: boolean;
    readonly tileX: number;
    readonly tileY: number;
    readonly level: number;
}
