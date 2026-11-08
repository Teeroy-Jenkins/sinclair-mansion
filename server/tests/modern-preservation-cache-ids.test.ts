import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getCacheLoaderFactory } from "../../client/rs/cache/loader/CacheLoaderFactory";
import { initCacheEnv } from "../src/world/CacheEnv";

const env = initCacheEnv("./caches", "osrs-237_2026-03-25");
const factory = getCacheLoaderFactory(env.info, env.cacheSystem);
const npcs = factory.getNpcTypeLoader();
const locs = factory.getLocTypeLoader();
const items = factory.getObjTypeLoader();

const npcNames = new Map<number, RegExp>([
    [2153, /^Gunnjorn$/i],
    [4423, /^Jossik$/i],
    [4424, /^Jossik$/i],
    [4425, /^Larrissa$/i],
    [979, /^Dagannoth$/i],
    ...[6361, 6362, 6363, 6364, 6365, 6366].map((id) => [id, /^Dagannoth mother$/i] as const),
    ...[4382, 4383, 4387, 4389, 4391, 4393].map((id) => [id, /^Ogre shaman$/i] as const),
    [1287, /Ulsquire/i],
    [1288, /Ulsquire/i],
    [1289, /Razmire/i],
    [1290, /Razmire/i],
    [3413, /^Koftik$/i],
    [8976, /^Koftik$/i],
    [8758, /^Lord Iorwerth$/i],
    [3432, /^Arianwyn$/i],
    [9014, /^Arianwyn$/i],
    [8991, /^Kardia$/i],
    [8997, /^Disciple of Iban$/i],
    [8998, /^Iban$/i],
    [3953, /^Radimus Erkle$/i],
    [3962, /^Nezikchened$/i],
    [8048, /^Brundt the Chieftain$/i],
    [3894, /^Sigmund the Merchant$/i],
    [3895, /^Peer the Seer$/i],
    [3896, /^Thorvald the Warrior$/i],
    [3920, /^Manni the Reveller$/i],
    [3921, /^Council workman$/i],
    [3922, /^The Draugen$/i],
    [3924, /^Sigli the Huntsman$/i],
    [3925, /^Swensen the Navigator$/i],
    [3932, /^Thora the Barkeep$/i],
    [3933, /^Yrsa$/i],
    [3934, /^Fisherman$/i],
    [3935, /^Skulgrimen$/i],
    [3936, /^Sailor$/i],
    [4227, /^Poison Salesman$/i],
    [802, /^Olaf the Bard$/i],
    [803, /^Lalli$/i],
    [808, /^Fossegrimen$/i],
    [8402, /^Askeladden$/i],
    ...[3897, 3898, 3899, 3900].map((id) => [id, /^Koschei the deathless$/i] as const),
    [5340, /^Mosol Rei$/i],
    [8696, /^Mosol Rei$/i],
    ...[5353, 5354, 5355].map((id) => [id, /^Nazastarool$/i] as const),
    [4699, /^Tiadeche$/i],
    [4701, /^Tinsay$/i],
    [4703, /^Tamayu$/i],
]);
for (const [id, expected] of npcNames) {
    const name = String(npcs.load(id)?.name ?? "");
    assert.match(name, expected, `modern NPC ${id} resolved as ${JSON.stringify(name)}`);
}

const locNames = new Map<number, RegExp>([
    [4577, /^Doorway$/i],
    [4615, /^Broken bridge$/i],
    [4616, /^Broken bridge$/i],
    [4587, /^Lighting mechanism$/i],
    [4543, /^Strange wall$/i],
    [4412, /^Iron ladder$/i],
    [4413, /^Iron ladder$/i],
    [4187, /^Ladder$/i],
    [4188, /^Ladder$/i],
    [4141, /^Strange altar$/i],
    [4142, /^Swaying tree$/i],
    [4149, /^Lalli's Stew$/i],
    [4150, /^Portal$/i],
    [4157, /^Portal$/i],
    [4158, /^Ladder$/i],
    [4162, /^Pipe$/i],
    [4165, /^Door$/i],
    [4166, /^Door$/i],
    [4169, /^Frozen table$/i],
    [4170, /^Chest$/i],
    [4172, /^Cooking range$/i],
    [4179, /^Abstract mural$/i],
    [4181, /^Unicorn's head$/i],
    [2246, /^Tomb doors$/i],
    [2247, /^Tomb doors$/i],
    [2258, /^Tomb dolmen$/i],
    [2816, /^Rock of Dalgroth$/i],
    [3976, /^Catapult$/i],
    [3977, /^Catapult-winch$/i],
    [3978, /^Catapult-lever$/i],
    [3333, /^Door$/i],
    [3334, /^Door$/i],
    [3359, /^Well$/i],
    [3984, /^Tent$/i],
    [3997, /^Tent wall$/i],
    [4000, /^Tent roof$/i],
]);
for (const [id, expected] of locNames) {
    const name = String(locs.load(id)?.name ?? "");
    assert.match(name, expected, `modern loc ${id} resolved as ${JSON.stringify(name)}`);
}

const itemNames = new Map<number, RegExp>([
    [3848, /lighthouse key/i],
    [3849, /casket/i],
    [3839, /damaged book/i],
    [3841, /damaged book/i],
    [3843, /damaged book/i],
    [3757, /Fremennik blade/i],
    [3688, /^Unstrung lyre$/i],
    [3689, /^Lyre$/i],
    [3690, /^Enchanted lyre$/i],
    [3692, /^Branch$/i],
    [3693, /^Golden fleece$/i],
    [3694, /^Golden wool$/i],
    [3695, /^Pet rock$/i],
    [3696, /^Hunters' talisman$/i],
    [3697, /^Hunters' talisman$/i],
    [3698, /^Exotic flower$/i],
    [3699, /^Fremennik ballad$/i],
    [3700, /^Sturdy boots$/i],
    [3701, /^Tracking map$/i],
    [3702, /^Custom bow string$/i],
    [3703, /^Unusual fish$/i],
    [3704, /^Sea fishing map$/i],
    [3705, /^Weather forecast$/i],
    [3706, /^Champions token$/i],
    [3707, /^Legendary cocktail$/i],
    [3708, /^Fiscal statement$/i],
    [3709, /^Promissory note$/i],
    [3710, /^Warriors' contract$/i],
    [3711, /^Keg of beer$/i],
    [3712, /^Low alcohol keg$/i],
    [3713, /^Strange object$/i],
    [3714, /^Lit strange object$/i],
    [3723, /^4\/5ths full bucket$/i],
    [3734, /^Vase$/i],
    [3740, /^Sealed vase$/i],
    [3741, /^Frozen key$/i],
    [3742, /^Red herring$/i],
    [3743, /^Red disk$/i],
    [3744, /^Wooden disk$/i],
    [3745, /^Seer's key$/i],
    [3746, /^Sticky red goop$/i],
    [616, /Beads of the dead/i],
    [609, /Rashiliyia corpse/i],
    [1492, /Doll of iban/i],
    [1496, /Iban's dove/i],
    [1500, /Iban's shadow/i],
    [1502, /Iban's ashes/i],
    [2394, /^Potion$/i],
    [2395, /^Magic ogre potion$/i],
    ...[2380, 2381, 2382, 2383].map((id) => [id, /^Crystal$/i] as const),
    [3219, /barrel bomb/i],
]);
for (const [id, expected] of itemNames) {
    const name = String(items.load(id)?.name ?? "");
    assert.match(name, expected, `modern item ${id} resolved as ${JSON.stringify(name)}`);
}

const spawns = JSON.parse(readFileSync("./data/npc-spawns.json", "utf8")) as Array<{ id: number; x: number; y: number }>;
assert.equal(spawns.find((spawn) => spawn.x === 2659 && spawn.y === 3669)?.id, 8048, "Rellekka Brundt must use a live modern type");
assert.equal(spawns.find((spawn) => spawn.x === 2658 && spawn.y === 3660)?.id, 8402, "Rellekka Askeladden must use a live modern type");

console.log("modern-preservation-cache-ids.test.ts: all assertions passed");
