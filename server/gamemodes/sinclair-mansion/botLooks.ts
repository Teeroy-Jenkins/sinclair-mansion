// How each household bot looks: picked from the same identity kits and colours the character
// designer offers, seeded by name so Anna always looks like Anna.

/** Colour choices per recolourable part (hair, torso, legs, feet, skin), kept to the designer's ranges. */
const COLOURS = [12, 16, 16, 6, 8];

/** A small deterministic generator (mulberry32) seeded from the name. */
function seeded(name: string): () => number {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
    return () => {
        h = (h + 0x6d2b79f5) | 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** `kits[part]` lists the selectable identity kits for each of the 7 body parts. */
export function botLook(
    name: string,
    female: boolean,
    kits: number[][],
): { gender: number; kits: number[]; colors: number[] } {
    const rand = seeded(name);
    const pick = (list: number[]) => (list.length ? list[Math.floor(rand() * list.length)] : -1);
    return {
        gender: female ? 1 : 0,
        kits: kits.map(pick),
        colors: COLOURS.map((n) => Math.floor(rand() * n)),
    };
}
