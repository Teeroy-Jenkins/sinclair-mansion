/** Values stored by VARBIT_ACTIVE_SPELLBOOK (4070). */
export enum SpellbookType {
    NORMAL = 0,
    ANCIENT = 1,
    LUNAR = 2,
    ARCEUUS = 3,
}

export function normalizeSpellbookType(value: number): SpellbookType {
    switch (Math.trunc(value)) {
        case SpellbookType.ANCIENT:
            return SpellbookType.ANCIENT;
        case SpellbookType.LUNAR:
            return SpellbookType.LUNAR;
        case SpellbookType.ARCEUUS:
            return SpellbookType.ARCEUUS;
        case SpellbookType.NORMAL:
        default:
            return SpellbookType.NORMAL;
    }
}

