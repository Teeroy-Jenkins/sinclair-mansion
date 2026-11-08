import { canWeaponAutocastSpell } from "../../spells/SpellDataProvider";
import { SpellIds } from "../../spells/SpellIds";
import { SpellbookType } from "../../spells/SpellbookType";

const WIND_STRIKE_SPELL_ID = 3273;

/** Weapons explicitly supported by the cache/content layer for Ancient autocasting. */
export const ANCIENT_AUTOCAST_STAFF_IDS: ReadonlySet<number> = new Set<number>([
    4675, // Ancient staff
    4710, // Ahrim's staff
    6914, // Master wand
    8841, // Void knight mace
    11791, // Staff of the dead
    12904, // Toxic staff of the dead
    21006, // Kodai wand
    22296, // Staff of balance
    24422, // Nightmare staff
    24423, // Harmonised nightmare staff
    24424, // Eldritch nightmare staff
    24425, // Volatile nightmare staff
]);

/**
 * Validates whether a weapon can open and use the autocast chooser for the
 * player's active spellbook.
 */
export class MagicStaffValidator {
    private constructor() {}

    public static isCompatible(
        weaponId: number,
        activeSpellbook: SpellbookType,
        requestedMenuSpellbook: SpellbookType = activeSpellbook,
    ): boolean {
        if (!Number.isSafeInteger(weaponId) || weaponId <= 0) return false;
        // A staff may support spells from both books, but the chooser layout
        // must always correspond to the player's currently active spellbook.
        if (requestedMenuSpellbook !== activeSpellbook) return false;

        switch (activeSpellbook) {
            case SpellbookType.NORMAL:
                return canWeaponAutocastSpell(weaponId, WIND_STRIKE_SPELL_ID).compatible;
            case SpellbookType.ANCIENT:
                return (
                    ANCIENT_AUTOCAST_STAFF_IDS.has(weaponId) &&
                    canWeaponAutocastSpell(weaponId, SpellIds.SMOKE_RUSH).compatible
                );
            case SpellbookType.LUNAR:
            case SpellbookType.ARCEUUS:
            default:
                return false;
        }
    }

    /**
     * Resolves the value supplied to the autocast chooser's spellpos varp.
     * `-1` requests the generic Normal spell layout; an item ID requests that
     * weapon's cache-defined layout, including the Ancient layout.
     */
    public static resolveAutocastMenuSelector(
        weaponId: number,
        activeSpellbook: SpellbookType,
        hasItemSpecificNormalMenu: boolean,
    ): number | null {
        if (!this.isCompatible(weaponId, activeSpellbook, activeSpellbook)) {
            return null;
        }

        if (activeSpellbook === SpellbookType.ANCIENT) {
            return weaponId;
        }

        if (activeSpellbook === SpellbookType.NORMAL) {
            // Ancient-capable staves can cast standard spells on the Normal
            // book, but their item selector would incorrectly open Ancients.
            if (ANCIENT_AUTOCAST_STAFF_IDS.has(weaponId)) return -1;
            return hasItemSpecificNormalMenu ? weaponId : -1;
        }

        return null;
    }
}
