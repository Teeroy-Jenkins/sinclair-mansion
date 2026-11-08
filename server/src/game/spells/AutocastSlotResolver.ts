import { getSpellIdFromAutocastIndex } from "./SpellDataProvider";
import { SpellbookType } from "./SpellbookType";

export interface AutocastSlotSelection {
    readonly spellId: number;
    readonly autocastIndex: number;
}

/**
 * Resolves the dynamic child index emitted by the cache's autocast chooser.
 *
 * Client script 2098 creates every spell icon under interface 201:1 using the
 * canonical autocast index as its CC_CREATE childIndex. The value is therefore
 * already the protocol/config index (1..58); it is not a zero-based position in
 * a filtered list of visible spells.
 */
export function resolveAutocastSlot(
    spellbook: SpellbookType,
    slotId: number,
    _weaponItemId: number,
): AutocastSlotSelection | undefined {
    if (!Number.isSafeInteger(slotId) || slotId < 1 || slotId > 58) return undefined;

    const spellId = getSpellIdFromAutocastIndex(slotId);
    if (spellId === undefined) return undefined;

    if (!isAutocastIndexForSpellbook(spellbook, slotId)) return undefined;

    return Object.freeze({ spellId, autocastIndex: slotId });
}

function isAutocastIndexForSpellbook(
    spellbook: SpellbookType,
    autocastIndex: number,
): boolean {
    switch (spellbook) {
        case SpellbookType.NORMAL:
            return (
                (autocastIndex >= 1 && autocastIndex <= 20) ||
                (autocastIndex >= 47 && autocastIndex <= 52)
            );
        case SpellbookType.ANCIENT:
            return autocastIndex >= 31 && autocastIndex <= 46;
        case SpellbookType.LUNAR:
            return false;
        case SpellbookType.ARCEUUS:
            return autocastIndex >= 53 && autocastIndex <= 58;
        default:
            return false;
    }
}
