import {
    PRAYER_DEACTIVATE_SOUND_ID,
    type PrayerName,
    getPrayerDefinition,
} from "../../../../../client/rs/prayer/prayers";
import { SkillId } from "../../../../../client/rs/skill/skills";
import { getItemDefinition } from "../../../data/items";
import type { ServerServices } from "../../ServerServices";
import type { PlayerState } from "../../player";
import { CombatAttributes } from "../../combat/state/CombatAttributes";
import { OverheadType } from "../OverheadType";
import type { PrayerSystemProvider, PrayerTickResult } from "../PrayerSystemProvider";

/** Owns prayer drain and depletion on the server's 600 ms game clock. */
export class PrayerDrainProcessor implements PrayerSystemProvider {
    constructor(private readonly services: ServerServices) {}

    processPlayer(player: PlayerState): PrayerTickResult | undefined {
        const activePrayers = player.prayer.getActivePrayers();
        let currentPoints = this.getCurrentPrayerPoints(player);
        this.setCurrentPrayerPoints(player, currentPoints);

        if (activePrayers.size === 0) {
            player.prayer.resetDrainAccumulator();
            player.prayer.consumeActivationTick();
            player.combatAttributes.set(
                CombatAttributes.ACTIVE_OVERHEAD_PRAYER,
                OverheadType.NONE,
            );
            return undefined;
        }

        if (currentPoints <= 0) {
            return this.deplete(player);
        }

        // Prayer activation takes effect immediately but is charged beginning
        // on the following tick, preserving authentic one-tick flicking.
        if (player.prayer.consumeActivationTick()) {
            return undefined;
        }

        const drainRate = this.computeDrainRate(activePrayers);
        if (!(drainRate > 0)) {
            player.prayer.resetDrainAccumulator();
            return undefined;
        }

        const resistance = Math.max(1, 60 + this.computePrayerBonus(player) * 2);
        let accumulator = player.prayer.getDrainAccumulator() + drainRate;
        let drainedPoints = 0;

        while (accumulator >= resistance && currentPoints > 0) {
            accumulator -= resistance;
            currentPoints--;
            drainedPoints++;
        }

        player.prayer.setDrainAccumulator(accumulator);
        if (drainedPoints <= 0) return undefined;

        player.skillSystem.adjustSkillBoost(SkillId.Prayer, -drainedPoints);
        currentPoints = this.getCurrentPrayerPoints(player);
        this.setCurrentPrayerPoints(player, currentPoints);

        return currentPoints <= 0 ? this.deplete(player) : undefined;
    }

    private deplete(player: PlayerState): PrayerTickResult {
        player.skillSystem.setSkillBoost(SkillId.Prayer, 0);
        player.prayer.resetDrainAccumulator();
        player.combatAttributes.set(CombatAttributes.PRAYER_POINTS_CURRENT, 0);
        player.combatAttributes.set(
            CombatAttributes.ACTIVE_OVERHEAD_PRAYER,
            OverheadType.NONE,
        );

        const hadActivePrayers = player.prayer.getActivePrayers().size > 0;
        if (hadActivePrayers) {
            player.prayer.clearActivePrayers();
            this.services.soundService.sendSound(player, PRAYER_DEACTIVATE_SOUND_ID);
            this.services.messagingService.queueChatMessage({
                messageType: "game",
                text: "You have run out of prayer points!",
                targetPlayerIds: [player.id],
            });
            this.services.queueCombatState(player);
        }

        return { prayerDepleted: hadActivePrayers };
    }

    private getCurrentPrayerPoints(player: PlayerState): number {
        const skill = player.skillSystem.getSkill(SkillId.Prayer);
        return Math.max(0, Math.floor(skill.baseLevel + skill.boost));
    }

    private setCurrentPrayerPoints(player: PlayerState, points: number): void {
        player.combatAttributes.set(
            CombatAttributes.PRAYER_POINTS_CURRENT,
            Math.max(0, Math.floor(points)),
        );
    }

    private computeDrainRate(activePrayers: ReadonlySet<PrayerName>): number {
        let rate = 0;
        for (const prayer of activePrayers) {
            rate += getPrayerDefinition(prayer).drainRate;
        }
        return rate;
    }

    private computePrayerBonus(player: PlayerState): number {
        const equipment = player.appearance?.equip;
        if (!equipment) return 0;

        let total = 0;
        for (const itemId of equipment) {
            if (!(itemId > 0)) continue;
            const bonuses = getItemDefinition(itemId)?.bonuses;
            if (!bonuses) continue;
            total += bonuses[13] ?? 0;
        }
        return total;
    }
}
