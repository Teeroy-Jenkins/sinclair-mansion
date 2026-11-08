import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import type { IScriptRegistry, NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage, takeQuestItems } from "../../QuestService";
import { run, sayNpc, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import { ITEM, LOC, NPC, STAGE } from "./constants";

function context(event: NpcInteractionEvent, npcName: string) {
    return { player: event.player, services: event.services, npcId: event.npc.typeId, npcName };
}

function has(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    return countCarriedItem(player, services, itemId) >= quantity;
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function take(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    return takeQuestItems(player, services, [{ itemId, quantity, journalLabel: "" }]);
}

function give(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function professorHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const { player, services } = event;
        const stage = getQuestStage(player, quest);
        const ctx = context(event, "Observatory professor");
        if (stage === STAGE.notStarted) {
            if (services.skills.getSkill(player, SkillId.Crafting).baseLevel < 10) {
                startConversation(ctx, [sayNpc("Repairing a telescope lens requires level 10 Crafting.")]);
                return;
            }
            startConversation(ctx, [
                sayNpc("The goblins damaged my telescope. I need three planks, a bronze bar and molten glass to repair it."),
                run(() => setQuestStage(player, quest, services, STAGE.planks)),
            ]);
            return;
        }
        if (stage === STAGE.planks) {
            if (!has(player, services, ITEM.plank, 3)) return void startConversation(ctx, [sayNpc("Please bring me three plain wooden planks.")]);
            startConversation(ctx, [sayNpc("Excellent. These will make a sturdy tripod. Now I need one bronze bar."), run(() => { if (take(player, services, ITEM.plank, 3)) setQuestStage(player, quest, services, STAGE.bronze); })]);
            return;
        }
        if (stage === STAGE.bronze) {
            if (!has(player, services, ITEM.bronzeBar)) return void startConversation(ctx, [sayNpc("The telescope tube needs one bronze bar.")]);
            startConversation(ctx, [sayNpc("Good. Finally, bring me some molten glass."), run(() => { if (take(player, services, ITEM.bronzeBar)) setQuestStage(player, quest, services, STAGE.glass); })]);
            return;
        }
        if (stage === STAGE.glass) {
            if (!has(player, services, ITEM.moltenGlass)) return void startConversation(ctx, [sayNpc("I still need molten glass for the lens.")]);
            startConversation(ctx, [sayNpc("The goblins stole my lens mould. Search their dungeon below the Observatory."), run(() => { if (take(player, services, ITEM.moltenGlass)) setQuestStage(player, quest, services, STAGE.mould); })]);
            return;
        }
        if (stage === STAGE.mould) {
            if (!has(player, services, ITEM.lensMould)) return void startConversation(ctx, [sayNpc("Search the goblins' dungeon chest for my lens mould.")]);
            startConversation(ctx, [sayNpc("Use the mould with this molten glass to cast the new lens."), run(() => { if (give(player, services, ITEM.moltenGlass)) setQuestStage(player, quest, services, STAGE.lens); })]);
            return;
        }
        if (stage === STAGE.lens) {
            if (!has(player, services, ITEM.observatoryLens)) return void startConversation(ctx, [sayNpc("Use the mould with the molten glass to finish the lens.")]);
            startConversation(ctx, [sayNpc("Wonderful! I will install it. Meet me upstairs at the telescope."), run(() => { if (!take(player, services, ITEM.observatoryLens)) return; take(player, services, ITEM.lensMould); setQuestStage(player, quest, services, STAGE.telescope); })]);
            return;
        }
        startConversation(ctx, [sayNpc(stage >= STAGE.complete ? "The stars hold many secrets, my friend." : "The telescope is ready. Look through it from the Observatory dome.")]);
    };
}

function grantConstellationReward(player: PlayerState, services: ScriptServices): void {
    const rewards = [
        () => services.skills.addSkillXp(player, SkillId.Strength, 875),
        () => services.skills.addSkillXp(player, SkillId.Defence, 875),
        () => give(player, services, 563, 3),
        () => give(player, services, 555, 25),
        () => give(player, services, 187, 1),
        () => services.skills.addSkillXp(player, SkillId.Hitpoints, 875),
        () => services.skills.addSkillXp(player, SkillId.Attack, 875),
        () => give(player, services, 851, 1),
        () => give(player, services, 1313, 1),
        () => give(player, services, 361, 3),
        () => give(player, services, 119, 1),
        () => give(player, services, 1725, 1),
    ];
    rewards[Math.floor(Math.random() * rewards.length)]();
}

export function registerObservatoryQuestInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const professor = professorHandler(quest);
    for (const npcId of NPC.professor) registry.registerNpcScript({ npcId, option: "talk-to", handler: professor });

    const assistant = (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE.mould && !owns(event.player, event.services, ITEM.goblinKitchenKey)) {
            startConversation(context(event, "Observatory assistant"), [sayNpc("The goblin kitchen key opens the way to their chest. Take it."), run(() => give(event.player, event.services, ITEM.goblinKitchenKey))]);
            return;
        }
        if (stage === STAGE.complete && !owns(event.player, event.services, ITEM.jugOfWine)) {
            startConversation(context(event, "Observatory assistant"), [sayNpc("You repaired the telescope! Please accept this jug of wine."), run(() => { if (give(event.player, event.services, ITEM.jugOfWine)) setQuestStage(event.player, quest, event.services, STAGE.claimedWine); })]);
            return;
        }
        startConversation(context(event, "Observatory assistant"), [sayNpc("The professor can tell you which part of the telescope he needs next.")]);
    };
    for (const npcId of NPC.assistant) registry.registerNpcScript({ npcId, option: "talk-to", handler: assistant });

    for (const locId of [LOC.closedDungeonChest, LOC.openDungeonChest]) {
        registry.registerLocScript({
            locId,
            action: "search",
            handler: ({ player, services }) => {
                if (getQuestStage(player, quest) !== STAGE.mould || owns(player, services, ITEM.lensMould)) return;
                if (!has(player, services, ITEM.goblinKitchenKey)) {
                    services.messaging.sendGameMessage(player, "The chest is locked. The Observatory assistant mentioned a key.");
                    return;
                }
                give(player, services, ITEM.lensMould);
                services.messaging.sendGameMessage(player, "You find the stolen lens mould inside the chest.");
            },
        });
    }

    registry.registerItemOnItem(ITEM.lensMould, ITEM.moltenGlass, ({ player, services }) => {
        if (getQuestStage(player, quest) !== STAGE.lens) return;
        if (services.skills.getSkill(player, SkillId.Crafting).baseLevel < 10) {
            services.messaging.sendGameMessage(player, "You need level 10 Crafting to cast the lens.");
            return;
        }
        if (!take(player, services, ITEM.moltenGlass)) return;
        give(player, services, ITEM.observatoryLens);
        services.skills.addSkillXp(player, SkillId.Crafting, 15);
        services.messaging.sendGameMessage(player, "You pour the glass into the mould and make an Observatory lens.");
    });

    registry.registerLocScript({
        locId: LOC.telescope,
        action: "look-through",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE.telescope) return;
            grantConstellationReward(player, services);
            completeQuest(player, services, quest);
            services.messaging.sendGameMessage(player, "A constellation fills the telescope. The professor explains its meaning.");
        },
    });
}
