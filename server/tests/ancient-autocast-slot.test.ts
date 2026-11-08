import assert from "node:assert/strict";

import { VARBIT_AUTOCAST_SPELL } from "../../client/common/vars";
import { applyAutocastState } from "../src/game/combat/AutocastState";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import { CombatAttributeStore } from "../src/game/combat/state/CombatAttributeStore";
import { MagicStaffValidator } from "../src/game/combat/plugins/MagicStaffValidator";
import type { PlayerState } from "../src/game/player";
import { resolveAutocastSlot } from "../src/game/spells/AutocastSlotResolver";
import {
    type SpellDataProvider,
    registerSpellDataProvider,
} from "../src/game/spells/SpellDataProvider";
import { SpellIds } from "../src/game/spells/SpellIds";
import { SpellbookType } from "../src/game/spells/SpellbookType";

const expectedSpellIds = [
    SpellIds.SMOKE_RUSH,
    SpellIds.SHADOW_RUSH,
    SpellIds.BLOOD_RUSH,
    SpellIds.ICE_RUSH,
    SpellIds.SMOKE_BURST,
    SpellIds.SHADOW_BURST,
    SpellIds.BLOOD_BURST,
    SpellIds.ICE_BURST,
    SpellIds.SMOKE_BLITZ,
    SpellIds.SHADOW_BLITZ,
    SpellIds.BLOOD_BLITZ,
    SpellIds.ICE_BLITZ,
    SpellIds.SMOKE_BARRAGE,
    SpellIds.SHADOW_BARRAGE,
    SpellIds.BLOOD_BARRAGE,
    SpellIds.ICE_BARRAGE,
] as const;

const indexBySpellId = new Map<number, number>(
    expectedSpellIds.map((spellId, slotId) => [spellId, 31 + slotId]),
);
const spellIdByIndex = new Map<number, number>(
    expectedSpellIds.map((spellId, slotId) => [31 + slotId, spellId]),
);
const surgeSpellIds = [21876, 21877, 21878, 21879] as const;
for (let offset = 0; offset < surgeSpellIds.length; offset++) {
    const spellId = surgeSpellIds[offset];
    const autocastIndex = 48 + offset;
    indexBySpellId.set(spellId, autocastIndex);
    spellIdByIndex.set(autocastIndex, spellId);
}
const spellProviderFixture = {
    getSpellData: (spellId: number) =>
        expectedSpellIds.includes(spellId as (typeof expectedSpellIds)[number])
            ? { id: spellId, baseMaxHit: 1, spellbook: "ancient" as const }
            : surgeSpellIds.includes(spellId as (typeof surgeSpellIds)[number])
              ? { id: spellId, baseMaxHit: 1, spellbook: "standard" as const }
              : undefined,
    getSpellDataByWidget: () => undefined,
    getAllSpellData: () => [],
    registerSpellData: () => undefined,
    hasSpellData: (spellId: number) => indexBySpellId.has(spellId),
    initSpellWidgetMapping: () => undefined,
    isSpellWidgetMappingInitialized: () => true,
    getSpellIdFromAutocastIndex: (autocastIndex: number) =>
        spellIdByIndex.get(autocastIndex),
    getAutocastIndexFromSpellId: (spellId: number) => indexBySpellId.get(spellId),
    isSpellAutocastable: (spellId: number) => indexBySpellId.has(spellId),
    buildVisibleAutocastIndices: () => [],
    canWeaponAutocastSpell: () => ({ compatible: true }),
    getAutocastCompatibilityMessage: () => "",
    getPoweredStaffSpellData: () => undefined,
    hasPoweredStaffSpellData: () => false,
    calculatePoweredStaffBaseDamage: () => 0,
} satisfies SpellDataProvider;

registerSpellDataProvider(spellProviderFixture);

assert.equal(MagicStaffValidator.isCompatible(1387, SpellbookType.NORMAL), true);
assert.equal(MagicStaffValidator.isCompatible(1387, SpellbookType.ANCIENT), false);
assert.equal(MagicStaffValidator.isCompatible(4675, SpellbookType.ANCIENT), true);
assert.equal(MagicStaffValidator.isCompatible(4675, SpellbookType.NORMAL), true);
assert.equal(
    MagicStaffValidator.isCompatible(
        4675,
        SpellbookType.NORMAL,
        SpellbookType.ANCIENT,
    ),
    false,
);
assert.equal(
    MagicStaffValidator.isCompatible(
        4675,
        SpellbookType.ANCIENT,
        SpellbookType.NORMAL,
    ),
    false,
);
assert.equal(
    MagicStaffValidator.resolveAutocastMenuSelector(4675, SpellbookType.NORMAL, true),
    -1,
);
assert.equal(
    MagicStaffValidator.resolveAutocastMenuSelector(4675, SpellbookType.ANCIENT, true),
    4675,
);
assert.equal(MagicStaffValidator.isCompatible(4675, SpellbookType.LUNAR), false);

for (let offset = 0; offset < expectedSpellIds.length; offset++) {
    const clientSlot = 31 + offset;
    const selection = resolveAutocastSlot(SpellbookType.ANCIENT, clientSlot, 4675);
    assert.ok(selection, `Ancient autocast slot ${clientSlot} should resolve`);
    assert.equal(selection.spellId, expectedSpellIds[offset]);
    assert.equal(selection.autocastIndex, clientSlot);
}

assert.equal(resolveAutocastSlot(SpellbookType.ANCIENT, -1, 4675), undefined);
assert.equal(resolveAutocastSlot(SpellbookType.ANCIENT, 0, 4675), undefined);
assert.equal(resolveAutocastSlot(SpellbookType.ANCIENT, 30, 4675), undefined);
assert.equal(resolveAutocastSlot(SpellbookType.ANCIENT, 47, 4675), undefined);

for (let offset = 0; offset < surgeSpellIds.length; offset++) {
    const clientSlot = 48 + offset;
    const selection = resolveAutocastSlot(SpellbookType.NORMAL, clientSlot, 1381);
    assert.ok(selection, `Normal autocast Surge slot ${clientSlot} should resolve`);
    assert.equal(selection.spellId, surgeSpellIds[offset]);
    assert.equal(selection.autocastIndex, clientSlot);
}

const synchronizedVarbits = new Map<number, number>();
const attributes = new CombatAttributeStore();
const player = {
    combat: {
        spellId: -1,
        autocastEnabled: false,
        autocastMode: null,
    },
    combatAttributes: attributes,
    varps: {
        setVarbitValue: (varbitId: number, value: number) => {
            synchronizedVarbits.set(varbitId, value);
        },
    },
    setCombatSpell: (spellId: number) => {
        player.combat.spellId = spellId;
    },
} as unknown as PlayerState;

applyAutocastState(player, SpellIds.ICE_BARRAGE, 1, false);

assert.equal(
    attributes.get(CombatAttributes.AUTOCAST_SPELL_ID),
    SpellIds.ICE_BARRAGE,
);
assert.equal(synchronizedVarbits.get(VARBIT_AUTOCAST_SPELL), 46);

console.log("ancient autocast slot regression test passed");
