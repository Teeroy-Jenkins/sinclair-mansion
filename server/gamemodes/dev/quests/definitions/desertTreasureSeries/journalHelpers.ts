import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";

export function completedJournal(lines: string[]): string[] {
    return [
        ...lines.map((line) => (line.length > 0 ? `<str>${line}</str>` : line)),
        "",
        "<col=ff0000>QUEST COMPLETE!</col>",
    ];
}

export function journalRequirement(label: string, met: boolean): string {
    return met ? `<str>${label}</str>` : `<col=800000>${label}</col>`;
}

export function journalSkillLevel(
    player: PlayerState,
    services: ScriptServices,
    skillId: number,
): number {
    return services.skills.getSkill(player, skillId).baseLevel;
}
