import { ScriptVarTypeId } from "../../../../client/rs/config/db/ScriptVarType";
import type { ScriptServices } from "../../../src/game/scripts/types";

export interface QuestEntry {
    questId: number;
    dbrowId: number;
    displayName: string;
}

export interface QuestCompletionInfo {
    varpId: number;
    completionValue: number;
    varbitEntries?: Array<{ varbitId: number; value: number }>;
}

const QUEST_DB_TABLE_ID = 0;

export function buildQuestMap(services: ScriptServices): Map<number, QuestEntry> {
    const map = new Map<number, QuestEntry>();
    const dbRepo = services.data.getDbRepository();
    if (!dbRepo) return map;

    const rows = dbRepo.getRows(QUEST_DB_TABLE_ID);
    if (rows.length === 0) return map;

    const tableDef = dbRepo.getTables().get(QUEST_DB_TABLE_ID);
    if (!tableDef) return map;

    let idColumnId = -1;
    let nameColumnId = -1;

    for (const [colId, colDef] of tableDef.columns) {
        if (colDef.types.length !== 1) continue;
        if (colDef.types[0] === ScriptVarTypeId.INTEGER && idColumnId === -1) {
            idColumnId = colId;
        }
        if (colDef.types[0] === ScriptVarTypeId.STRING && nameColumnId === -1) {
            nameColumnId = colId;
        }
    }

    if (idColumnId === -1 || nameColumnId === -1) {
        services.system.logger.warn?.(
            `[quest-journal] Could not discover quest DB columns: id=${idColumnId} name=${nameColumnId}`,
        );
        return map;
    }

    for (const row of rows) {
        const idCol = row.getColumn(idColumnId);
        const nameCol = row.getColumn(nameColumnId);

        const questId = idCol?.values?.[0];
        const displayName = nameCol?.values?.[0];

        if (typeof questId === "number" && questId > 0 && typeof displayName === "string") {
            map.set(questId, {
                questId,
                dbrowId: row.id,
                displayName,
            });
        }
    }

    services.system.logger.info?.(
        `[quest-journal] Loaded ${map.size} quests from cache DB table ${QUEST_DB_TABLE_ID}`,
    );
    return map;
}

const QUEST_COMPLETION_DATA = new Map<string, QuestCompletionInfo>([
    ["desert treasure", { varpId: 440, completionValue: 15 }],
    ["desert treasure i", { varpId: 440, completionValue: 15 }],
    ["lunar diplomacy", { varpId: 823, completionValue: 190 }],
    ["legend's quest", { varpId: 139, completionValue: 180 }],
    ["underground pass", { varpId: 161, completionValue: 110 }],
    ["mage arena", { varpId: 267, completionValue: 8 }],
    [
        "mage arena ii",
        { varpId: -1, completionValue: 0, varbitEntries: [{ varbitId: 6067, value: 6 }] },
    ],
    ["eadgar's ruse", { varpId: 335, completionValue: 110 }],
    ["watchtower", { varpId: 212, completionValue: 13 }],
    ["plague city", { varpId: 165, completionValue: 29 }],
    ["biohazard", { varpId: 68, completionValue: 16 }],
    ["big chompy bird hunting", { varpId: 293, completionValue: 65 }],
    ["observatory quest", { varpId: 112, completionValue: 7 }],
    ["horror from the deep", { varpId: 351, completionValue: 10 }],
    ["shades of mort'ton", { varpId: 339, completionValue: 85 }],
    ["regicide", { varpId: 328, completionValue: 15 }],
    ["the fremennik trials", { varpId: 347, completionValue: 10 }],
    ["shilo village", { varpId: 116, completionValue: 15 }],
    ["tai bwo wannai trio", { varpId: 320, completionValue: 6 }],
    [
        "client of kourend",
        { varpId: -1, completionValue: 0, varbitEntries: [{ varbitId: 5619, value: 9 }] },
    ],
    [
        "dream mentor",
        { varpId: -1, completionValue: 0, varbitEntries: [{ varbitId: 3618, value: 28 }] },
    ],
    ["cook's assistant", { varpId: 29, completionValue: 2 }],
    ["demon slayer", { varpId: 2561, completionValue: 3 }],
    ["doric's quest", { varpId: 31, completionValue: 100 }],
    ["dwarf cannon", { varpId: 0, completionValue: 11 }],
    ["dragon slayer i", { varpId: 176, completionValue: 10 }],
    ["the grand tree", { varpId: 150, completionValue: 160 }],
    ["heroes' quest", { varpId: 188, completionValue: 15 }],
    ["elemental workshop i", { varpId: 244, completionValue: 1 << 20 }],
    ["hazeel cult", { varpId: 223, completionValue: 9 }],
    ["ernest the chicken", { varpId: 32, completionValue: 3 }],
    ["family crest", { varpId: 148, completionValue: 11 }],
    ["fight arena", { varpId: 17, completionValue: 14 }],
    ["goblin diplomacy", { varpId: 2378, completionValue: 6 }],
    ["holy grail", { varpId: 5, completionValue: 10 }],
    ["imp catcher", { varpId: 160, completionValue: 2 }],
    ["the knight's sword", { varpId: 122, completionValue: 7 }],
    ["lost city", { varpId: 147, completionValue: 6 }],
    ["merlin's crystal", { varpId: 14, completionValue: 7 }],
    ["murder mystery", { varpId: 192, completionValue: 2 }],
    ["nature spirit", { varpId: 307, completionValue: 110 }],
    ["pirate's treasure", { varpId: 71, completionValue: 4 }],
    ["prince ali rescue", { varpId: 273, completionValue: 110 }],
    ["the restless ghost", { varpId: 107, completionValue: 5 }],
    ["romeo & juliet", { varpId: 144, completionValue: 100 }],
    ["rune mysteries", { varpId: 63, completionValue: 6 }],
    ["sea slug", { varpId: 159, completionValue: 12 }],
    ["scorpion catcher", { varpId: 76, completionValue: 4 }],
    ["sheep herder", { varpId: 60, completionValue: 3 }],
    ["sheep shearer", { varpId: 179, completionValue: 21 }],
    ["shield of arrav", { varpId: 145, completionValue: 7 }],
    ["tribal totem", { varpId: 200, completionValue: 5 }],
    ["tree gnome village", { varpId: 111, completionValue: 9 }],
    ["vampyre slayer", { varpId: 178, completionValue: 3 }],
    ["witch's house", { varpId: 226, completionValue: 7 }],
    ["witch's potion", { varpId: 67, completionValue: 3 }],
    ["black knights' fortress", { varpId: 130, completionValue: 4 }],
    [
        "pandemonium",
        { varpId: -1, completionValue: 0, varbitEntries: [{ varbitId: 18314, value: 6 }] },
    ],
]);

export function getQuestCompletionInfo(displayName: string): QuestCompletionInfo | undefined {
    return QUEST_COMPLETION_DATA.get(displayName.toLowerCase());
}
