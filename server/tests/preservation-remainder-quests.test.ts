import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    NpcInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import {
    eadgarsRuseQuest,
    fremennikTrialsQuest,
    horrorFromTheDeepQuest,
    legendsQuest,
    preservationRemainderQuests,
    regicideQuest,
    shadesOfMorttonQuest,
    shiloVillageQuest,
    taiBwoWannaiTrioQuest,
    undergroundPassQuest,
    watchtowerQuest,
} from "../gamemodes/dev/quests/definitions/preservationRemainder";
import type { QuestDefinition } from "../gamemodes/dev/quests/types";
import { getSpinningRecipeById } from "../gamemodes/dev/skills/crafting/spinningData";

assert.equal(preservationRemainderQuests.length, 10);
assert.deepEqual(
    preservationRemainderQuests.map((quest) => [quest.varpId, quest.completionValue, quest.rewards.questPoints]),
    [
        [335, 110, 1],
        [351, 10, 2],
        [212, 13, 4],
        [339, 85, 3],
        [161, 110, 5],
        [328, 15, 3],
        [347, 10, 3],
        [116, 15, 2],
        [320, 6, 2],
        [139, 180, 4],
    ],
);

assert.equal(eadgarsRuseQuest.requirements?.skills?.[0].level, 31);
assert.equal(horrorFromTheDeepQuest.requirements?.skills?.[0].level, 35);
assert.equal(watchtowerQuest.rewards.xp?.[0].amount, 15_250);
assert.equal(watchtowerQuest.rewards.items?.find((item) => item.itemId === 995)?.quantity, 5_000);
assert.equal(shadesOfMorttonQuest.rewards.xp?.[0].amount, 2_000);
assert.equal(undergroundPassQuest.requirements?.quests?.[0].varpId, 68);
assert.equal(regicideQuest.requirements?.quests?.[0].minValue, 110);
assert.equal(fremennikTrialsQuest.rewards.xp?.length, 5);
assert.equal(shiloVillageQuest.requirements?.quests?.[0].varpId, 175);
assert.equal(taiBwoWannaiTrioQuest.rewards.items?.[0].quantity, 5_000);
assert.equal(legendsQuest.requirements?.questPoints, 107);
assert.equal(legendsQuest.requirements?.skills?.find((skill) => skill.skillId === SkillId.Magic)?.level, 56);
assert.equal(getSpinningRecipeById("spin_golden_fleece")?.inputItemId, 3693);
assert.equal(getSpinningRecipeById("spin_golden_fleece")?.productItemId, 3694);

function journalAt(quest: QuestDefinition, stage: number): string {
    const player = { varps: { getVarpValue: () => stage } } as unknown as PlayerState;
    return quest.buildJournal(player, {} as ScriptServices).join("\n");
}

assert.match(journalAt(eadgarsRuseQuest, 30), /parrot/i);
assert.match(journalAt(horrorFromTheDeepQuest, 4), /Jossik/i);
assert.match(journalAt(watchtowerQuest, 10), /shamans/i);
assert.match(journalAt(shadesOfMorttonQuest, 70), /cremate/i);
assert.match(journalAt(undergroundPassQuest, 7), /Doll of Iban/i);
assert.match(journalAt(regicideQuest, 11), /barrel bomb/i);
assert.match(journalAt(shiloVillageQuest, 12), /Nazastarool/i);
assert.match(journalAt(legendsQuest, 180), /QUEST COMPLETE/);

function registrations(quest: QuestDefinition): string[] {
    const calls: string[] = [];
    const registry = new Proxy(
        {},
        {
            get: (_target, property) => {
                if (property === "findNpcInteractionDirect") return () => undefined;
                return (...args: unknown[]) => {
                    if (property === "registerNpcScript") calls.push(`npc:${(args[0] as { npcId: number }).npcId}`);
                    if (property === "registerNpcPreDeath") calls.push(`death:${args[0]}`);
                    if (property === "registerNpcAttack") calls.push(`attack:${args[0]}`);
                    if (property === "registerItemOnNpc") calls.push(`item-npc:${args[0]}:${args[1]}`);
                    if (property === "registerItemOnLoc") calls.push(`item-loc:${args[0]}:${args[1]}`);
                    if (property === "registerLocScript") calls.push(`loc:${(args[0] as { locId: number; action?: string }).locId}:${(args[0] as { action?: string }).action}`);
                    if (property === "registerItemAction") calls.push(`item:${args[0]}:${args[2]}`);
                    return { dispose() {} };
                };
            },
        },
    ) as unknown as IScriptRegistry;
    quest.register(registry, {} as ScriptServices);
    return calls;
}

assert(registrations(eadgarsRuseQuest).includes("npc:5044"));
assert(registrations(horrorFromTheDeepQuest).includes("death:6361"));
assert(registrations(horrorFromTheDeepQuest).includes("death:979"));
assert(registrations(watchtowerQuest).includes("death:4393"));
assert(registrations(watchtowerQuest).includes("item-npc:2395:4393"));
assert(registrations(watchtowerQuest).includes("loc:2816:mine"));
assert(registrations(shadesOfMorttonQuest).includes("death:1277"));
assert(registrations(undergroundPassQuest).includes("item-loc:1492:3359"));
assert(registrations(undergroundPassQuest).includes("loc:3333:open"));
assert(registrations(regicideQuest).includes("npc:8758"));
assert(registrations(regicideQuest).includes("item-loc:3219:3976"));
assert(registrations(fremennikTrialsQuest).includes("npc:8048"));
assert(registrations(fremennikTrialsQuest).includes("npc:8402"));
assert(registrations(fremennikTrialsQuest).includes("item-npc:1917:3921"));
assert(registrations(fremennikTrialsQuest).includes("item-loc:3714:4162"));
assert(registrations(fremennikTrialsQuest).includes("loc:4142:cut-branch"));
assert(registrations(fremennikTrialsQuest).includes("death:3922"));
assert(registrations(fremennikTrialsQuest).includes("loc:4158:climb-down"));
assert(registrations(fremennikTrialsQuest).includes("loc:4165:open"));
assert(registrations(fremennikTrialsQuest).includes("item-loc:3745:4166"));
assert(registrations(shiloVillageQuest).includes("death:5355"));
assert(registrations(shiloVillageQuest).includes("item-loc:526:2246"));
assert(registrations(shiloVillageQuest).includes("loc:2246:search"));
assert(registrations(taiBwoWannaiTrioQuest).includes("npc:4707"));
assert(registrations(legendsQuest).includes("item:716:swing"));
assert(registrations(legendsQuest).includes("attack:3962"));

// A later quest sharing an NPC must delegate while its own prerequisites are unmet.
{
    let fallbackCalls = 0;
    let lathasHandler: NpcInteractionHandler | undefined;
    const registry = new Proxy(
        {},
        {
            get: (_target, property) => {
                if (property === "findNpcInteractionDirect") return () => () => { fallbackCalls++; };
                return (...args: unknown[]) => {
                    if (property === "registerNpcScript" && (args[0] as { npcId: number }).npcId === 8046) {
                        lathasHandler = (args[0] as { handler: NpcInteractionHandler }).handler;
                    }
                    return { dispose() {} };
                };
            },
        },
    ) as unknown as IScriptRegistry;
    regicideQuest.register(registry, {} as ScriptServices);

    const values = new Map<number, number>();
    const player = {
        id: 1,
        varps: { getVarpValue: (id: number) => values.get(id) ?? 0 },
    } as unknown as PlayerState;
    const services = {
        skills: { getSkill: () => ({ baseLevel: 99 }) },
    } as unknown as ScriptServices;
    lathasHandler?.({ player, services, npc: { typeId: 8046 } } as NpcInteractionEvent);
    assert.equal(fallbackCalls, 1);
}

console.log("Preservation remainder quest tests passed.");
