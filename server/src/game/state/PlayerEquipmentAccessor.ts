/**
 * Equipment charge tracking and equipped-item queries.
 * Composed into PlayerState to decouple equipment logic from the main class.
 */
import type { EquipmentSlot } from "../../../../client/rs/config/player/Equipment";
import type { PlayerAppearance } from "../player";

const TOXIC_BLOWPIPE_ITEM_ID = 12926;
const BLOWPIPE_FIELD_CAP = 16_383;
const BLOWPIPE_DART_COUNT_FACTOR = 16;
const BLOWPIPE_SCALE_COUNT_FACTOR = 262_144;

const BLOWPIPE_DART_TYPES = Object.freeze([
    -1,
    806,
    807,
    808,
    3093,
    809,
    810,
    811,
    25849,
    11230,
]);

export interface BlowpipeChargeState {
    readonly scales: number;
    readonly dartId: number;
    readonly dartCount: number;
}

export class PlayerEquipmentAccessor {
    private chargeMap = new Map<number, number>();

    getCharges(itemId: number): number {
        return Math.max(0, this.chargeMap.get(itemId) ?? 0);
    }

    setCharges(itemId: number, charges: number): void {
        if (!Number.isFinite(charges) || charges <= 0) {
            this.chargeMap.delete(itemId);
        } else {
            this.chargeMap.set(itemId, charges);
        }
    }

    getBlowpipeChargeState(): BlowpipeChargeState {
        const packed = Math.max(0, Math.floor(this.chargeMap.get(TOXIC_BLOWPIPE_ITEM_ID) ?? 0));
        const dartType = packed % BLOWPIPE_DART_COUNT_FACTOR;
        const dartCount =
            Math.floor(packed / BLOWPIPE_DART_COUNT_FACTOR) % (BLOWPIPE_FIELD_CAP + 1);
        const scales =
            Math.floor(packed / BLOWPIPE_SCALE_COUNT_FACTOR) % (BLOWPIPE_FIELD_CAP + 1);
        return Object.freeze({
            scales,
            dartId: BLOWPIPE_DART_TYPES[dartType] ?? -1,
            dartCount,
        });
    }

    setBlowpipeChargeState(state: BlowpipeChargeState): void {
        const scales = Math.max(0, Math.min(BLOWPIPE_FIELD_CAP, Math.floor(state.scales)));
        const dartCount = Math.max(0, Math.min(BLOWPIPE_FIELD_CAP, Math.floor(state.dartCount)));
        const dartType = dartCount > 0 ? BLOWPIPE_DART_TYPES.indexOf(Math.floor(state.dartId)) : 0;
        if (dartType < 0) {
            throw new RangeError(`Unsupported toxic blowpipe dart item: ${state.dartId}`);
        }
        const packed =
            dartType +
            dartCount * BLOWPIPE_DART_COUNT_FACTOR +
            scales * BLOWPIPE_SCALE_COUNT_FACTOR;
        this.setCharges(TOXIC_BLOWPIPE_ITEM_ID, packed);
    }

    hasEquippedItem(appearance: PlayerAppearance, slot: EquipmentSlot, itemId: number): boolean {
        const equip = appearance.equip;
        if (!equip) return false;
        return equip[slot] === itemId;
    }

    /** Serialize charge data for persistence. */
    serializeCharges(): Array<{ itemId: number; charges: number }> | undefined {
        if (this.chargeMap.size === 0) return undefined;
        const entries: Array<{ itemId: number; charges: number }> = [];
        for (const [itemId, charges] of this.chargeMap.entries()) {
            if (charges > 0) entries.push({ itemId, charges });
        }
        return entries.length > 0 ? entries : undefined;
    }

    /** Deserialize charge data from persistence. */
    deserializeCharges(data?: Array<{ itemId: number; charges: number }>): void {
        this.chargeMap.clear();
        if (!Array.isArray(data)) return;
        for (const entry of data) {
            if (entry?.itemId > 0 && entry?.charges > 0) {
                this.chargeMap.set(entry.itemId, entry.charges);
            }
        }
    }
}
