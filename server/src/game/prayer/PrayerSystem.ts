import {
    PRAYER_NAME_SET,
    PrayerDefinition,
    PrayerName,
    getPrayerDefinition,
} from "../../../../client/rs/prayer/prayers";
import { SkillId } from "../../../../client/rs/skill/skills";
import { PlayerState } from "../player";
import { CombatAttributes } from "../combat/state/CombatAttributes";

export type PrayerSelectionError = { prayer: PrayerName; message: string };

export type PrayerSelectionResult = {
    changed: boolean;
    activePrayers: PrayerName[];
    activated: PrayerName[];
    deactivated: PrayerName[];
    errors: PrayerSelectionError[];
};

const PROTECTION_PRAYER_NAMES = new Set<PrayerName>([
    "protect_from_magic",
    "protect_from_missiles",
    "protect_from_melee",
]);

export class PrayerSystem {
    applySelection(player: PlayerState, requested: Iterable<string>): PrayerSelectionResult {
        const normalized = this.normalizeRequest(requested);
        const errors: PrayerSelectionError[] = [];
        const skill = player.skillSystem.getSkill(SkillId.Prayer);
        const currentLevel = Math.max(0, skill.baseLevel + skill.boost);
        player.combatAttributes.set(CombatAttributes.PRAYER_POINTS_CURRENT, currentLevel);
        if (currentLevel <= 0 && normalized.length > 0) {
            errors.push({
                prayer: normalized[0],
                message: "You need to recharge your Prayer at an altar before using that prayer.",
            });
            return {
                changed: false,
                activePrayers: Array.from(player.prayer.getActivePrayers()),
                activated: [],
                deactivated: [],
                errors,
            };
        }
        const next: PrayerName[] = [];
        for (const prayer of normalized) {
            if (
                PROTECTION_PRAYER_NAMES.has(prayer) &&
                player.prayer.areProtectionPrayersLocked()
            ) {
                errors.push({
                    prayer,
                    message: "Your protection prayers have been disabled.",
                });
                continue;
            }
            const def = getPrayerDefinition(prayer);
            if (!this.meetsLevel(skill.baseLevel, def)) {
                errors.push({
                    prayer,
                    message: `You need a Prayer level of ${def.level} to use ${def.name}.`,
                });
                continue;
            }
            const unlock = this.checkUnlock(player, def);
            if (!unlock.ok) {
                errors.push({
                    prayer,
                    message:
                        unlock.message ??
                        `You must unlock ${def.name} before you can activate that prayer.`,
                });
                continue;
            }
            this.removeConflicts(next, def);
            next.push(prayer);
        }
        const previous = new Set(player.prayer.getActivePrayers());
        const changed = player.prayer.setActivePrayers(next);
        const current = player.prayer.getActivePrayers();
        const activated: PrayerName[] = [];
        for (const prayer of current) {
            if (!previous.has(prayer)) activated.push(prayer);
        }
        const deactivated: PrayerName[] = [];
        for (const prayer of previous) {
            if (!current.has(prayer)) deactivated.push(prayer);
        }
        return {
            changed,
            activePrayers: Array.from(current),
            activated,
            deactivated,
            errors,
        };
    }

    private normalizeRequest(requested: Iterable<string>): PrayerName[] {
        const seen = new Set<PrayerName>();
        const out: PrayerName[] = [];
        for (const entry of requested) {
            const name = entry as PrayerName;
            if (!PRAYER_NAME_SET.has(name)) continue;
            if (seen.has(name)) continue;
            seen.add(name);
            out.push(name);
        }
        return out;
    }

    private meetsLevel(basePrayerLevel: number, def: PrayerDefinition): boolean {
        return basePrayerLevel >= def.level;
    }

    private removeConflicts(active: PrayerName[], def: PrayerDefinition): void {
        if (!def.groups && def.exclusiveGroups.length === 0) return;
        for (let i = active.length - 1; i >= 0; i--) {
            const candidate = getPrayerDefinition(active[i]);
            if (!candidate.groups) continue;
            const sameGroup = def.groups !== undefined && candidate.groups === def.groups;
            // Treat conflict declarations as a relationship, not a one-way
            // instruction. This keeps old/save data and future prayers from
            // bypassing exclusivity when only one definition lists the other.
            const conflicts =
                def.exclusiveGroups.includes(candidate.groups) ||
                (def.groups !== undefined && candidate.exclusiveGroups.includes(def.groups));
            if (sameGroup || conflicts) {
                active.splice(i, 1);
            }
        }
    }

    private checkUnlock(
        player: PlayerState,
        def: PrayerDefinition,
    ): { ok: boolean; message?: string } {
        if (def.unlockVarbit !== undefined) {
            const value = player.varps.getVarbitValue(def.unlockVarbit);
            if (!(value > 0)) {
                return {
                    ok: false,
                    message: `You must read the scroll to unlock ${def.name}.`,
                };
            }
        }
        if (def.questRequirement) {
            const current = player.varps.getVarbitValue(def.questRequirement.varbit);
            if (current < def.questRequirement.minValue) {
                return {
                    ok: false,
                    message: def.questRequirement.hint,
                };
            }
        }
        return { ok: true };
    }

}
