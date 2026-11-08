import type { QuestDefinition } from "./types";

// ============================================================================
// Quest registry
//
// Maps quest display names (as stored in the cache quest DB) to their server
// definitions. The quest journal widget consults this to render stage-specific
// journal text for implemented quests.
// ============================================================================

const questsByKey = new Map<string, QuestDefinition>();
const questsByName = new Map<string, QuestDefinition>();
const questsByVarp = new Map<number, QuestDefinition>();

export function normalizeQuestKey(key: string): string {
    return String(key ?? "").trim().toLowerCase();
}

function normalizeQuestName(name: string): string {
    return String(name ?? "").trim().toLowerCase();
}

export function registerQuestDefinition(quest: QuestDefinition): void {
    const key = normalizeQuestKey(quest.key);
    const name = normalizeQuestName(quest.name);
    if (key.length === 0) throw new Error("Quest definition key cannot be empty");
    if (name.length === 0) throw new Error(`Quest definition name cannot be empty (key=${key})`);
    if (!Number.isInteger(quest.varpId) || quest.varpId < 0) {
        throw new Error(`Quest \"${quest.name}\" has an invalid varp id: ${quest.varpId}`);
    }
    if (quest.stageBits) {
        const { start, end } = quest.stageBits;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > 30) {
            throw new Error(
                `Quest \"${quest.name}\" has an invalid stage bit range: ${start}-${end}`,
            );
        }
        const maxStage = 2 ** (end - start + 1) - 1;
        if (quest.startedValue > maxStage || quest.completionValue > maxStage) {
            throw new Error(
                `Quest \"${quest.name}\" stage values exceed bit range ${start}-${end}`,
            );
        }
    }

    const duplicateKey = questsByKey.get(key);
    if (
        duplicateKey &&
        duplicateKey !== quest &&
        (normalizeQuestName(duplicateKey.name) !== name || duplicateKey.varpId !== quest.varpId)
    ) {
        throw new Error(`Duplicate quest key \"${quest.key}\" (${duplicateKey.name}, ${quest.name})`);
    }
    const duplicateName = questsByName.get(name);
    if (duplicateName && duplicateName !== quest && normalizeQuestKey(duplicateName.key) !== key) {
        throw new Error(`Duplicate quest name \"${quest.name}\" (${duplicateName.key}, ${quest.key})`);
    }
    const duplicateVarp = questsByVarp.get(quest.varpId);
    if (duplicateVarp && duplicateVarp !== quest && normalizeQuestKey(duplicateVarp.key) !== key) {
        throw new Error(
            `Duplicate quest varp ${quest.varpId} (${duplicateVarp.name}, ${quest.name})`,
        );
    }

    questsByKey.set(key, quest);
    questsByName.set(name, quest);
    questsByVarp.set(quest.varpId, quest);
}

export function getQuestDefinitionByKey(key: string): QuestDefinition | undefined {
    return questsByKey.get(normalizeQuestKey(key));
}

export function getQuestDefinitionByName(displayName: string): QuestDefinition | undefined {
    return questsByName.get(normalizeQuestName(displayName));
}

export function getQuestDefinition(ref: string): QuestDefinition | undefined {
    return getQuestDefinitionByKey(ref) ?? getQuestDefinitionByName(ref);
}

export function getRegisteredQuests(): QuestDefinition[] {
    return [...questsByName.values()];
}
