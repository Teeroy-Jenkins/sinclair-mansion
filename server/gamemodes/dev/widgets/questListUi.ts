import {
    QUEST_LIST_COMPLETED_UID,
    QUEST_LIST_ENTRY_EVENT_FLAGS,
    QUEST_LIST_ENTRY_LIST_UID,
    QUEST_LIST_QUEST_POINTS_UID,
} from "../../../../client/common/ui/sideJournal";
import {
    QUEST_LIST_STATUS_COMPLETE,
    QUEST_LIST_STATUS_IN_PROGRESS,
    QUEST_LIST_STATUS_NOT_STARTED,
    buildQuestListWidgetGroups,
    getQuestListWidgetMaxSlot,
    type QuestListConfigGroup,
    type QuestListConfigQuest,
    type QuestListStatus,
    type QuestListWidgetGroup,
} from "../../../../client/common/ui/questList";
import type {
    GamemodeQuestListGroup,
    GamemodeQuestListQuest,
    GamemodeUiBridge,
} from "../../../src/game/gamemodes/GamemodeDefinition";
import type { PlayerState } from "../../../src/game/player";
import type { WidgetAction } from "../../../src/widgets/WidgetManager";
import type { QuestDefinition } from "../quests/types";
import { getQuestStage } from "../quests/QuestService";
import {
    getQuestDefinitionByKey,
    getQuestDefinitionByName,
    normalizeQuestKey,
} from "../quests/QuestRegistry";
import { getQuestCompletionInfo } from "./questListData";

const VARBIT_QUESTS_COMPLETED_COUNT = 6347;
const VARBIT_QUESTS_TOTAL_COUNT = 11877;
const VARBIT_QUEST_POINTS_MAX = 1782;

type QuestListBridge = Pick<GamemodeUiBridge, "queueWidgetEvent"> &
    Partial<Pick<GamemodeUiBridge, "queueVarbit">>;
type QuestListWidgetQuest = QuestListWidgetGroup["quests"][number];

interface ResolvedQuestListQuest {
    key: string;
    displayName: string;
    definition?: QuestDefinition;
}

interface QuestListSummary {
    completed: number;
    total: number;
    questPoints: number;
    maxQuestPoints: number;
}

function getQuestRefKey(ref: string | GamemodeQuestListQuest): string {
    if (typeof ref === "string") return ref;
    return ref.key;
}

function resolveQuestListQuest(
    ref: string | GamemodeQuestListQuest,
): ResolvedQuestListQuest | undefined {
    const rawKey = getQuestRefKey(ref).trim();
    if (rawKey.length === 0) return undefined;

    const definition = getQuestDefinitionByKey(rawKey) ?? getQuestDefinitionByName(rawKey);
    if (definition) {
        return {
            key: definition.key,
            displayName: definition.name,
            definition,
        };
    }

    return {
        key: normalizeQuestKey(rawKey),
        displayName: rawKey,
    };
}

function getQuestStatus(player: PlayerState, quest: ResolvedQuestListQuest): QuestListStatus {
    const definition = quest.definition;
    if (definition) {
        const stage = getQuestStage(player, definition);
        if (stage >= definition.completionValue) return QUEST_LIST_STATUS_COMPLETE;
        if (stage >= definition.startedValue) return QUEST_LIST_STATUS_IN_PROGRESS;
        return QUEST_LIST_STATUS_NOT_STARTED;
    }

    const completionEntry = getQuestCompletionInfo(quest.displayName);
    if (!completionEntry) return QUEST_LIST_STATUS_NOT_STARTED;

    if (completionEntry.varpId >= 0) {
        const currentValue = player.varps.getVarpValue(completionEntry.varpId);
        return currentValue >= completionEntry.completionValue
            ? QUEST_LIST_STATUS_COMPLETE
            : QUEST_LIST_STATUS_NOT_STARTED;
    }

    if (completionEntry.varbitEntries) {
        for (const { varbitId, value } of completionEntry.varbitEntries) {
            if (player.varps.getVarbitValue(varbitId) < value) {
                return QUEST_LIST_STATUS_NOT_STARTED;
            }
        }
        return QUEST_LIST_STATUS_COMPLETE;
    }

    return QUEST_LIST_STATUS_NOT_STARTED;
}

function getConfiguredGroups(player: PlayerState): readonly GamemodeQuestListGroup[] {
    return player.gamemode.getQuestListGroups?.(player) ?? [];
}

export function buildPlayerQuestListWidgetGroups(
    player: PlayerState,
    configuredGroups: readonly GamemodeQuestListGroup[] = getConfiguredGroups(player),
): QuestListWidgetGroup[] {
    const groups: QuestListConfigGroup[] = [];
    for (const group of configuredGroups) {
        const quests = Array.isArray(group.quests) ? group.quests : [];
        const resolvedQuests: QuestListConfigQuest[] = [];
        for (const questRef of quests) {
            const quest = resolveQuestListQuest(questRef);
            if (!quest) continue;
            resolvedQuests.push({
                key: quest.key,
                displayName: quest.displayName,
                status: getQuestStatus(player, quest),
            });
        }
        groups.push({
            title: group.title,
            quests: resolvedQuests,
        });
    }
    return buildQuestListWidgetGroups(groups);
}

export function findPlayerQuestListQuestBySlot(
    player: PlayerState,
    slot: number | undefined,
): QuestListWidgetQuest | undefined {
    if (slot === undefined || slot < 0) return undefined;

    const groups = buildPlayerQuestListWidgetGroups(player);
    for (const group of groups) {
        for (const quest of group.quests) {
            if (quest.slot === slot) return quest;
        }
    }
    return undefined;
}

function getQuestPoints(quest: QuestListWidgetQuest): number {
    const definition =
        getQuestDefinitionByKey(quest.key) ?? getQuestDefinitionByName(quest.displayName);
    const questPoints = definition?.rewards.questPoints ?? 0;
    if (!Number.isFinite(questPoints)) return 0;
    return Math.max(0, Math.trunc(questPoints));
}

function buildQuestListSummary(groups: readonly QuestListWidgetGroup[]): QuestListSummary {
    let completed = 0;
    let total = 0;
    let questPoints = 0;
    let maxQuestPoints = 0;

    for (const group of groups) {
        for (const quest of group.quests) {
            const points = getQuestPoints(quest);
            total++;
            maxQuestPoints += points;
            if (quest.status === QUEST_LIST_STATUS_COMPLETE) {
                completed++;
                questPoints += points;
            }
        }
    }

    return { completed, total, questPoints, maxQuestPoints };
}

function formatQuestListCount(value: number): string {
    if (!Number.isFinite(value)) return "0";
    return Math.max(0, Math.trunc(value)).toLocaleString("en-US");
}

function queueQuestListSummaryVars(
    player: PlayerState,
    bridge: QuestListBridge,
    summary: QuestListSummary,
): void {
    bridge.queueVarbit?.(player.id, VARBIT_QUESTS_COMPLETED_COUNT, summary.completed);
    bridge.queueVarbit?.(player.id, VARBIT_QUESTS_TOTAL_COUNT, summary.total);
    bridge.queueVarbit?.(player.id, VARBIT_QUEST_POINTS_MAX, summary.maxQuestPoints);
}

function queueQuestListSummary(
    player: PlayerState,
    bridge: QuestListBridge,
    summary: QuestListSummary,
): void {
    bridge.queueWidgetEvent(player.id, {
        action: "set_text",
        uid: QUEST_LIST_QUEST_POINTS_UID,
        text: `Quest Points: ${formatQuestListCount(summary.questPoints)}/${formatQuestListCount(
            summary.maxQuestPoints,
        )}`,
    } satisfies WidgetAction);
    bridge.queueWidgetEvent(player.id, {
        action: "set_text",
        uid: QUEST_LIST_COMPLETED_UID,
        text: `Completed: ${formatQuestListCount(summary.completed)}/${formatQuestListCount(
            summary.total,
        )}`,
    } satisfies WidgetAction);
}

export function queuePlayerQuestListUi(
    player: PlayerState,
    bridge: QuestListBridge,
    configuredGroups?: readonly GamemodeQuestListGroup[],
): QuestListWidgetGroup[] {
    const groups = buildPlayerQuestListWidgetGroups(player, configuredGroups);
    const summary = buildQuestListSummary(groups);
    const maxSlot = getQuestListWidgetMaxSlot(groups);

    queueQuestListSummaryVars(player, bridge, summary);
    bridge.queueWidgetEvent(player.id, {
        action: "set_quest_list",
        groups,
    } satisfies WidgetAction);
    queueQuestListSummary(player, bridge, summary);

    if (maxSlot >= 0) {
        bridge.queueWidgetEvent(player.id, {
            action: "set_flags_range",
            uid: QUEST_LIST_ENTRY_LIST_UID,
            fromSlot: 0,
            toSlot: maxSlot,
            flags: QUEST_LIST_ENTRY_EVENT_FLAGS,
        });
    }

    return groups;
}
