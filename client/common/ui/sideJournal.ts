import { packWidgetUid } from "./widgetUid";

/**
 * Side journal (quest tab) UI constants shared between client and server.
 *
 * - Base interface group: 629 (side_journal)
 * - Tab content mounts into the tab-container (629:43).
 * - Selection is driven by varbit 8168 (packed into varp 1141 bits 4..6).
 */
export const SIDE_JOURNAL_GROUP_ID = 629;
export const SIDE_JOURNAL_ROOT_CHILD_ID = 0;
export const SIDE_JOURNAL_ROOT_UID = packWidgetUid(
    SIDE_JOURNAL_GROUP_ID,
    SIDE_JOURNAL_ROOT_CHILD_ID,
);
export const SIDE_JOURNAL_TAB_STRIP_CHILD_ID = 1;
export const SIDE_JOURNAL_TAB_STRIP_UID = packWidgetUid(
    SIDE_JOURNAL_GROUP_ID,
    SIDE_JOURNAL_TAB_STRIP_CHILD_ID,
);
export const SIDE_JOURNAL_TAB_CONTAINER_CHILD_ID = 43;
export const SIDE_JOURNAL_TAB_CONTAINER_UID = packWidgetUid(
    SIDE_JOURNAL_GROUP_ID,
    SIDE_JOURNAL_TAB_CONTAINER_CHILD_ID,
);

export const SIDE_JOURNAL_CHARACTER_SUMMARY_TAB = 0;
export const SIDE_JOURNAL_QUEST_TAB = 1;
export const SIDE_JOURNAL_ACHIEVEMENT_DIARY_TAB = 2;
export const SIDE_JOURNAL_ADVENTURE_LOG_TAB = 3;

// Side journal tab list widgets.
export const SIDE_JOURNAL_SUMMARY_LIST_CHILD_ID = 2;
export const SIDE_JOURNAL_QUEST_LIST_CHILD_ID = 10;
export const SIDE_JOURNAL_TASK_LIST_CHILD_ID = 18;
export const SIDE_JOURNAL_ADVENTURE_PATH_LIST_CHILD_ID = 26;

export const SIDE_JOURNAL_TAB_LIST_UIDS: ReadonlyArray<number> = Object.freeze([
    packWidgetUid(SIDE_JOURNAL_GROUP_ID, SIDE_JOURNAL_SUMMARY_LIST_CHILD_ID),
    packWidgetUid(SIDE_JOURNAL_GROUP_ID, SIDE_JOURNAL_QUEST_LIST_CHILD_ID),
    packWidgetUid(SIDE_JOURNAL_GROUP_ID, SIDE_JOURNAL_TASK_LIST_CHILD_ID),
    packWidgetUid(SIDE_JOURNAL_GROUP_ID, SIDE_JOURNAL_ADVENTURE_PATH_LIST_CHILD_ID),
]);

export const SIDE_JOURNAL_DEFAULT_TAB = SIDE_JOURNAL_CHARACTER_SUMMARY_TAB;

const SIDE_JOURNAL_TAB_VARP_SHIFT = 4;
const SIDE_JOURNAL_TAB_VARP_MASK = 7;

export function decodeSideJournalTabFromStateVarp(stateVarp: number): number {
    return ((stateVarp | 0) >>> SIDE_JOURNAL_TAB_VARP_SHIFT) & SIDE_JOURNAL_TAB_VARP_MASK;
}

export function encodeSideJournalTabInStateVarp(stateVarp: number, tab: number): number {
    const cleared = (stateVarp | 0) & ~(SIDE_JOURNAL_TAB_VARP_MASK << SIDE_JOURNAL_TAB_VARP_SHIFT);
    return cleared | (((tab | 0) & SIDE_JOURNAL_TAB_VARP_MASK) << SIDE_JOURNAL_TAB_VARP_SHIFT);
}

// Content interfaces mounted into SIDE_JOURNAL_TAB_CONTAINER_UID (629:43)
export const INTERFACE_CHARACTER_SUMMARY_ID = 712;
export const INTERFACE_QUEST_LIST_ID = 399;
export const INTERFACE_ACHIEVEMENT_DIARY_ID = 259;
export const INTERFACE_ADVENTURE_LOG_ID = 187;

// Quest list entry rows (cc-created children of 399:7).
// The client purges IF_SETEVENTS overrides when a content interface unmounts
// (journal subtab switch), so these flags must be re-sent on every quest tab open.
export const QUEST_LIST_ENTRY_LIST_CHILD_ID = 7;
export const QUEST_LIST_ENTRY_LIST_UID = packWidgetUid(
    INTERFACE_QUEST_LIST_ID,
    QUEST_LIST_ENTRY_LIST_CHILD_ID,
);
export const QUEST_LIST_QUEST_POINTS_CHILD_ID = 9;
export const QUEST_LIST_QUEST_POINTS_UID = packWidgetUid(
    INTERFACE_QUEST_LIST_ID,
    QUEST_LIST_QUEST_POINTS_CHILD_ID,
);
export const QUEST_LIST_COMPLETED_CHILD_ID = 10;
export const QUEST_LIST_COMPLETED_UID = packWidgetUid(
    INTERFACE_QUEST_LIST_ID,
    QUEST_LIST_COMPLETED_CHILD_ID,
);
export const QUEST_LIST_ENTRY_MAX_SLOT = 199;
// Ops 1-6 transmit (View info / Read journal / Show on map / wiki ops / Pin journal)
export const QUEST_LIST_ENTRY_EVENT_FLAGS = 0x7e;

// Achievement diary area rows (cc-created children 0-11 of 259:2, child index = area id).
// Same unmount-purge rule as the quest list: re-sent on every diary tab open.
export const DIARY_LIST_TASKBOX_CHILD_ID = 2;
export const DIARY_LIST_TASKBOX_UID = packWidgetUid(
    INTERFACE_ACHIEVEMENT_DIARY_ID,
    DIARY_LIST_TASKBOX_CHILD_ID,
);
export const DIARY_LIST_ENTRY_MAX_SLOT = 11;
// Ops 1-2 transmit (Open <Area> Journal / Wiki <Area> Journal)
export const DIARY_LIST_ENTRY_EVENT_FLAGS = 0x6;

/**
 * Maps side journal tab index -> interface group mounted into 629:43.
 * 0=Character Summary, 1=Quest List, 2=Achievement Diary, 3=Adventure Log
 */
export const SIDE_JOURNAL_CONTENT_GROUP_BY_TAB: Readonly<Record<number, number>> = Object.freeze({
    0: INTERFACE_CHARACTER_SUMMARY_ID,
    1: INTERFACE_QUEST_LIST_ID,
    2: INTERFACE_ACHIEVEMENT_DIARY_ID,
    3: INTERFACE_ADVENTURE_LOG_ID,
});
