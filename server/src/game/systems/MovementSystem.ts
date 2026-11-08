import { logger } from "../../utils/logger";
import { NpcManager } from "../npcManager";
import { PlayerManager } from "../player";

export class MovementSystem {
    constructor(
        private readonly players: PlayerManager,
        private readonly npcManager?: NpcManager,
    ) {}

    runPreMovement(tick: number): void {
        // Update follow positions BEFORE processing following logic
        // This stores where each player is NOW, so followers can path to their last position
        try {
            this.players.forEach((ws, player) => {
                player.followX = player.tileX;
                player.followZ = player.tileY;
            });
            this.players.forEachBot((bot) => {
                bot.followX = bot.tileX;
                bot.followZ = bot.tileY;
            });
        } catch (err) {
            logger.warn("[movement-system] failed to update follow positions", err);
        }

        try {
            this.players.updateFollowing(tick);
        } catch (err) {
            logger.warn("[movement-system] failed to update following", err);
        }
        try {
            this.players.updateNpcInteractions(tick, (npcId) => this.npcManager?.getById(npcId));
        } catch (err) {
            logger.warn("[movement-system] failed to update npc interactions (pre)", err);
        }
        try {
            this.players.updateLocInteractions(tick);
        } catch (err) {
            logger.warn("[movement-system] failed to update loc interactions", err);
        }
        try {
            this.players.updateGroundItemInteractions(tick);
        } catch (err) {
            logger.warn("[movement-system] failed to update ground item interactions (pre)", err);
        }
    }

    runPostMovement(tick: number): void {
        try {
            this.players.updateGroundItemInteractions(tick);
        } catch (err) {
            logger.warn("[movement-system] failed to update ground item interactions (post)", err);
        }
        try {
            this.players.updateNpcInteractions(tick, (npcId) => this.npcManager?.getById(npcId));
        } catch (err) {
            logger.warn("[movement-system] failed to update npc interactions (post)", err);
        }
    }
}
