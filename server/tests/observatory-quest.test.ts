import assert from "node:assert/strict";

import type { PlayerState } from "../src/game/player";
import type { IScriptRegistry, ItemOnItemHandler, ScriptServices } from "../src/game/scripts/types";
import { observatoryQuest } from "../gamemodes/dev/quests/definitions/observatoryQuest";
import { ITEM, LOC, NPC, STAGE, VARP_OBSERVATORY_QUEST } from "../gamemodes/dev/quests/definitions/observatoryQuest/constants";

assert.equal(observatoryQuest.varpId, 112);
assert.equal(observatoryQuest.completionValue, 7);
assert.equal(observatoryQuest.rewards.questPoints, 2);
assert.equal(observatoryQuest.rewards.xp?.[0].amount, 2_250);
assert.equal(observatoryQuest.rewards.items?.[0].itemId, ITEM.uncutSapphire);
assert.equal(observatoryQuest.requirements?.skills?.[0].level, 10);

const registrations: string[] = [];
let makeLens: ItemOnItemHandler | undefined;
const registry = new Proxy(
    {},
    {
        get: (_target, property) => (...args: unknown[]) => {
            if (property === "registerNpcScript") registrations.push(`npc:${(args[0] as { npcId: number }).npcId}`);
            if (property === "registerLocScript") registrations.push(`loc:${(args[0] as { locId: number }).locId}:${(args[0] as { action?: string }).action}`);
            if (property === "registerItemOnItem") {
                registrations.push(`item:${args[0]}:${args[1]}`);
                makeLens = args[2] as ItemOnItemHandler;
            }
            return { dispose() {} };
        },
    },
) as unknown as IScriptRegistry;
observatoryQuest.register(registry, {} as ScriptServices);

assert(registrations.includes(`npc:${NPC.professor[0]}`));
assert(registrations.includes(`npc:${NPC.assistant[0]}`));
assert(registrations.includes(`loc:${LOC.closedDungeonChest}:search`));
assert(registrations.includes(`loc:${LOC.telescope}:look-through`));
assert(registrations.includes(`item:${ITEM.lensMould}:${ITEM.moltenGlass}`));

const quantities = new Map<number, number>([
    [ITEM.lensMould, 1],
    [ITEM.moltenGlass, 1],
]);
const player = {
    id: 1,
    varps: { getVarpValue: (id: number) => id === VARP_OBSERVATORY_QUEST ? STAGE.lens : 0 },
} as unknown as PlayerState;
const granted: number[] = [];
const services = {
    skills: {
        getSkill: () => ({ baseLevel: 10 }),
        addSkillXp: () => undefined,
    },
    inventory: {
        getInventoryItems: () => [...quantities].filter(([, quantity]) => quantity > 0).map(([itemId, quantity], slot) => ({ itemId, quantity, slot })),
        setInventorySlot: (_player: PlayerState, slot: number, itemId: number, quantity: number) => {
            const entry = [...quantities].filter(([, count]) => count > 0)[slot];
            if (entry) quantities.set(entry[0], itemId === -1 ? 0 : quantity);
        },
        snapshotInventory: () => undefined,
        addItemToInventory: (_player: PlayerState, itemId: number, quantity: number) => {
            granted.push(itemId);
            quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
            return { slot: 0, added: quantity };
        },
    },
    messaging: { sendGameMessage: () => undefined },
} as unknown as ScriptServices;

makeLens?.({ player, services } as Parameters<ItemOnItemHandler>[0]);
assert.deepEqual(granted, [ITEM.observatoryLens]);
assert.equal(quantities.get(ITEM.moltenGlass), 0);

console.log("Observatory Quest tests passed.");
