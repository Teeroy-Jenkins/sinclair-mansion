import { WebSocket } from "ws";

import {
    VARBIT_IN_LMS,
    VARBIT_IN_RAID,
    VARBIT_IN_WILDERNESS,
    VARBIT_MULTICOMBAT_AREA,
    VARBIT_PVP_SPEC_ORB,
    VARBIT_RAID_STATE,
    VARP_SPECIAL_ENERGY,
} from "../../../../client/common/vars";
import { EquipmentSlot } from "../../../../client/rs/config/player/Equipment";
import { faceAngleRs } from "../../../../client/rs/utils/rotation";
import { NpcSyncSession } from "../../network/NpcSyncSession";
import { PlayerSyncSession } from "../../network/PlayerSyncSession";
import type { BroadcastContext } from "../../network/broadcast/BroadcastDomain";
import type { PlayerTickFrameData } from "../../network/encoding";
import { encodeMessage } from "../../network/messages";
import { logger } from "../../utils/logger";
import {
    SCRIPT_HEALTH_REGEN_TIMER,
    SCRIPT_HITPOINTS_CAPE_REGEN_TIMER,
    SCRIPT_HITPOINTS_CAPE_REGEN_TIMER_OFF,
    SCRIPT_ORBS_REDRAW,
    SCRIPT_SPEC_REGEN_TIMER,
    VARP_MAP_CLOCK,
} from "../../widgets/minimapOrbs";
import {
    SCRIPT_WORLDMAP_TRANSMIT_DATA,
    WORLD_MAP_GROUP_ID,
    getWorldMapTransmitDataArgs,
    packWorldMapPlayerCoord,
} from "../../widgets/worldMapInterfaces";
import type { ServerServices } from "../ServerServices";
import { DEBUG_PLAYER_IDS } from "../actor";
import { AttackType } from "../combat/AttackType";
import {
    getWildernessLevel,
    isInLMS,
    isInPvPArea,
    isInRaid,
    isInWilderness,
    multiCombatSystem,
} from "../combat/MultiCombatZones";
import { getAttackStyle as getWeaponAttackStyle } from "../combat/WeaponDataProvider";
import { CombatHitProcessor } from "../combat/engine/CombatHitProcessor";
import { interceptFrozenCombatMovement } from "../combat/engine/CombatMovementInterceptor";
import { CombatRetaliationEngine } from "../combat/engine/CombatRetaliationEngine";
import type { CombatEntity } from "../combat/engine/CombatTargetResolver";
import { CombatTickEngine } from "../combat/engine/CombatTickEngine";
import { CombatAttackStyle, type CombatAttackTraits } from "../combat/model/CombatAttack";
import { CombatAttributes } from "../combat/state/CombatAttributes";
import { hasHitpointsCapeRegenPerk } from "../equipment";
import { deriveInteractionIndex } from "../interactions/InteractionViewBuilder";
import { NpcState, type NpcUpdateDelta } from "../npc";
import { MovementProcessor } from "../movement/engine/MovementProcessor";
import { PlayerState } from "../player";
import { PrayerDrainProcessor } from "../prayer/engine/PrayerDrainProcessor";
import { ZoneTriggerService } from "../scripts/ZoneTriggerService";
import type { TickFrame } from "../tick/TickPhaseOrchestrator";
import { EQUIPMENT_STATS_GROUP_ID } from "./EquipmentStatsUiService";

type StepRecord = {
    x: number;
    y: number;
    level: number;
    rot: number;
    running: boolean;
    traversal?: number;
    seq?: number;
    orientation?: number;
    direction?: number;
};

/**
 * Summarized step data returned by summarizeSteps.
 */
interface StepSummary {
    subX: number;
    subY: number;
    level: number;
    finalRot: number;
    finalOrientation: number;
    ran: boolean;
    runSteps: number;
    finalSeq: number | undefined;
    directions: number[];
    traversals: number[];
}

/**
 * NPC simulation radius - must match wsServer constant.
 */
const NPC_STREAM_RADIUS_TILES = 15;
const NPC_STREAM_EXIT_RADIUS_TILES = NPC_STREAM_RADIUS_TILES + 2;
const NPC_SIM_RADIUS_TILES = NPC_STREAM_EXIT_RADIUS_TILES + 12;
const DEFAULT_NPC_RANGED_RANGE = 7;
const DEFAULT_NPC_MAGIC_RANGE = 10;
const DEFAULT_PLAYER_MAGIC_RANGE = 10;

/**
 * Extracts tick phase logic from wsServer into a standalone service.
 * The TickPhaseOrchestrator drives these phases in order each tick.
 */
export class TickPhaseService {
    private readonly lastWorldMapCoordByPlayer = new WeakMap<PlayerState, number>();
    private combatTickEngine?: CombatTickEngine;
    private combatHitProcessor?: CombatHitProcessor;
    private combatRetaliationEngine?: CombatRetaliationEngine;
    private movementProcessor?: MovementProcessor;
    private prayerDrainProcessor?: PrayerDrainProcessor;
    private zoneTriggerService?: ZoneTriggerService;

    constructor(private readonly svc: ServerServices) {}

    private getMovementProcessor(): MovementProcessor {
        if (this.movementProcessor) return this.movementProcessor;
        if (!this.svc.pathService) {
            throw new Error("MovementProcessor requires PathService initialization.");
        }
        this.movementProcessor = new MovementProcessor(this.svc.pathService);
        return this.movementProcessor;
    }

    private getPrayerDrainProcessor(): PrayerDrainProcessor {
        this.prayerDrainProcessor ??= new PrayerDrainProcessor(this.svc);
        return this.prayerDrainProcessor;
    }

    private getZoneTriggerService(): ZoneTriggerService {
        this.zoneTriggerService ??= new ZoneTriggerService(this.svc.scriptRuntime);
        return this.zoneTriggerService;
    }

    private playerHasHitpointsCapeRegen(player: PlayerState): boolean {
        const equip =
            this.svc.equipmentService?.ensureEquipArray(player) ?? player.appearance.equip;
        const capeId = equip?.[EquipmentSlot.CAPE] ?? -1;
        return hasHitpointsCapeRegenPerk(capeId);
    }

    runPreMovementPhase(frame: TickFrame): void {
        const { npcManager, players, followerManager, followerCombatManager, npcSyncManager } =
            this.svc;

        players?.shufflePidsIfDue(frame.tick);

        if (npcManager) {
            try {
                const activeNpcIds = new Set<number>();
                if (players) {
                    players.forEach((_client, player) => {
                        npcManager.collectNearbyIds(
                            player.tileX,
                            player.tileY,
                            player.level,
                            NPC_SIM_RADIUS_TILES,
                            activeNpcIds,
                        );
                    });
                }
                followerManager?.addActiveNpcIds(activeNpcIds);
                followerManager?.tick(frame.tick);
                followerCombatManager?.tick(frame.tick);

                if (players) {
                    players.forEach((_client, player) => {
                        const inWilderness = isInWilderness(player.tileX, player.tileY);
                        player.aggression.updateAggressionState(
                            frame.tick,
                            player.tileX,
                            player.tileY,
                            inWilderness,
                        );
                    });
                }

                const getNearbyPlayers = (
                    tileX: number,
                    tileY: number,
                    level: number,
                    radius: number,
                ) => {
                    const nearbyPlayers: Array<{
                        id: number;
                        x: number;
                        y: number;
                        level: number;
                        combatLevel: number;
                        inCombat: boolean;
                        aggressionState: {
                            entryTick: number;
                            aggressionExpired: boolean;
                            tile1: { x: number; y: number };
                            tile2: { x: number; y: number };
                        };
                    }> = [];
                    if (players) {
                        players.forEach((_client, player) => {
                            if (player.level !== level) return;
                            const dx = Math.abs(player.tileX - tileX);
                            const dy = Math.abs(player.tileY - tileY);
                            const distance = Math.max(dx, dy);
                            if (distance > radius) return;
                            nearbyPlayers.push({
                                id: player.id,
                                x: player.tileX,
                                y: player.tileY,
                                level: player.level,
                                combatLevel: player.skillSystem.combatLevel,
                                inCombat: player.isAttacking() || player.isBeingAttacked(),
                                aggressionState: player.aggression.getAggressionState(
                                    frame.tick,
                                    player.tileX,
                                    player.tileY,
                                ),
                            });
                        });
                    }
                    return nearbyPlayers;
                };

                // Deferred NPC deaths run before NPC turns so a dying NPC
                // cannot move or attack on its death tick.
                for (const death of npcManager.consumeDueDeathProcessing(frame.tick)) {
                    this.svc.combatActionHandler?.processScheduledNpcDeath(
                        death.npcId,
                        death.killerPlayerId,
                        frame.tick,
                    );
                }

                const npcTickResult = npcManager.tick(
                    frame.tick,
                    activeNpcIds,
                    getNearbyPlayers,
                );
                frame.npcEffectEvents = npcTickResult.statusEvents;

                const emittedNpcUpdates = npcManager.consumeUpdates();
                if (frame.npcUpdates.length === 0) {
                    frame.npcUpdates = emittedNpcUpdates;
                } else if (emittedNpcUpdates.length > 0) {
                    const mergedByNpcId = new Map<number, NpcUpdateDelta>();
                    for (const update of emittedNpcUpdates) {
                        mergedByNpcId.set(update.id, { ...update });
                    }
                    for (const pending of frame.npcUpdates) {
                        const existing = mergedByNpcId.get(pending.id);
                        if (!existing) {
                            mergedByNpcId.set(pending.id, { ...pending });
                            continue;
                        }
                        mergedByNpcId.set(pending.id, {
                            ...existing,
                            ...pending,
                            directions:
                                pending.directions !== undefined
                                    ? pending.directions
                                    : existing.directions,
                            traversals:
                                pending.traversals !== undefined
                                    ? pending.traversals
                                    : existing.traversals,
                        });
                    }
                    frame.npcUpdates = Array.from(mergedByNpcId.values());
                }

                npcManager.forEach((npc) => {
                    if (npc.consumeColorOverrideDirty()) {
                        const co = npc.getColorOverride();
                        if (co && co.amount > 0) {
                            frame.npcColorOverrides.set(npc.id, co);
                        }
                    }
                });

                if (players) {
                    players.forEach((_client, player) => {
                        npcSyncManager!.updateNpcViewForPlayer(player);
                    });
                }
            } catch (err) {
                logger.warn("[NpcManager] tick error", err);
            }
        }
        if (!players) return;
        this.flushPendingWalkCommands(frame.tick, "pre");
        this.svc.movementSystem?.runPreMovement(frame.tick);
    }

    runMovementPhase(frame: TickFrame): void {
        const { players, npcManager } = this.svc;
        if (!players) return;
        const movementProcessor = this.getMovementProcessor();
        this.flushPendingWalkCommands(frame.tick, "movement");
        const playerLookup = (id: number) => players.getById(id);
        const npcLookup = (npcId: number) => npcManager?.getById(npcId);
        const entries: Array<{ sock: WebSocket; player: PlayerState }> = [];
        players.forEach((sock, player) => entries.push({ sock, player }));

        entries.sort((a, b) => a.player.getPidPriority() - b.player.getPidPriority());
        // Each player's turn-start tile, before anyone moves (see PlayerState.markTurnStart).
        for (const { player } of entries) player.markTurnStart(frame.tick);
        players.forEachBot((bot) => bot.markTurnStart(frame.tick));
        const zoneTriggers = this.getZoneTriggerService();
        for (const { player } of entries) {
            zoneTriggers.observeBeforeMovement(player);
        }

        for (const { sock, player } of entries) {
            players.applyInteractionFacing(sock, player, npcLookup, frame.tick);

            player.processDeferredMovement();
            player.processTimersAndQueue();
            try {
                this.getCombatTickEngine()?.routeBeforeMovement(player, frame.tick);
            } catch (err) {
                logger.warn("Failed to route combat chase", err);
            }
            const movementFrozen = interceptFrozenCombatMovement(player, frame.tick);

            try {
                const hadPath = movementFrozen ? false : player.hasPath();
                const walkUpdate = movementFrozen
                    ? undefined
                    : players.continueWalkToDestination(player, frame.tick);
                if (walkUpdate?.pathDestination) {
                    const corrected = walkUpdate.pathDestination;
                    this.svc.networkLayer.withDirectSendBypass("destination_repath", () =>
                        this.svc.networkLayer.sendWithGuard(
                            sock,
                            encodeMessage({
                                type: "destination",
                                payload: {
                                    worldX: corrected.x,
                                    worldY: corrected.y,
                                },
                            }),
                            "destination_repath",
                        ),
                    );
                }
                if (!hadPath && player.hasPath() && DEBUG_PLAYER_IDS.has(player.id)) {
                    try {
                        const dest = player.getWalkDestination();
                        const steps = player.getPathQueue() as {
                            x: number;
                            y: number;
                        }[];
                        const message = dest
                            ? `walk segment (repath) dest=(${dest.x},${dest.y}) run=${!!dest.run}`
                            : "walk segment (repath)";
                        const debugMsg = encodeMessage({
                            type: "path",
                            payload: {
                                id: -2000 - player.id,
                                ok: true,
                                waypoints: Array.isArray(steps)
                                    ? steps.map((t) => ({ x: t.x, y: t.y }))
                                    : [],
                                message,
                            },
                        });
                        this.svc.broadcastService.queueDirectSend(
                            sock,
                            debugMsg,
                            "walk_path_debug_repath",
                        );
                    } catch (err) {
                        logger.warn("Failed to send walk path debug repath", err);
                    }
                }
            } catch (err) {
                logger.warn("Failed to process player movement phase", err);
            }

            const hasHitpointsCapeRegen = this.playerHasHitpointsCapeRegen(player);
            const statusHits = this.svc.statusEffects.processPlayer(
                player,
                frame.tick,
                hasHitpointsCapeRegen,
            );
            if (statusHits && statusHits.length > 0) {
                for (const event of statusHits) {
                    if (!(event.amount > 0)) continue;
                    frame.hitsplats.push({
                        targetType: "player",
                        targetId: player.id,
                        damage: event.amount,
                        style: event.style,
                        sourceType: "status",
                        hpCurrent: event.hpCurrent,
                        hpMax: event.hpMax,
                    });
                }
            }
            const regenTimer = player.skillSystem.takeHitpointRegenTimerSync(frame.tick);
            if (regenTimer) {
                this.svc.variableService.queueVarp(player.id, VARP_MAP_CLOCK, frame.tick);
                this.svc.broadcastService.queueClientScript(
                    player.id,
                    SCRIPT_HEALTH_REGEN_TIMER,
                    regenTimer.intervalTicks,
                    regenTimer.startTick,
                );
            }
            const capeRegenTimer = player.skillSystem.takeHitpointCapeRegenTimerSync(
                frame.tick,
                hasHitpointsCapeRegen,
            );
            if (capeRegenTimer) {
                this.svc.variableService.queueVarp(player.id, VARP_MAP_CLOCK, frame.tick);
                if ("clear" in capeRegenTimer) {
                    this.svc.broadcastService.queueClientScript(
                        player.id,
                        SCRIPT_HITPOINTS_CAPE_REGEN_TIMER_OFF,
                    );
                } else {
                    this.svc.broadcastService.queueClientScript(
                        player.id,
                        SCRIPT_HITPOINTS_CAPE_REGEN_TIMER,
                        capeRegenTimer.intervalTicks,
                        capeRegenTimer.startTick,
                    );
                }
            }
            player.prayer.advancePrayerLocks();
            this.getPrayerDrainProcessor().processPlayer(player);
        }

        players.forEachBot((bot) => bot.processDeferredMovement());
        players.resolveMoveReservations();

        for (const { player } of entries) {
            interceptFrozenCombatMovement(player, frame.tick);
        }
        const movementResults = new Map(
            movementProcessor
                .processMovementTicks(
                    entries.map(({ player }) => player),
                    frame.tick,
                )
                .map((result) => [result.entity.id, result.moved] as const),
        );

        for (const { sock, player } of entries) {
            zoneTriggers.processAfterMovement(player, frame.tick);
            const moved = movementResults.get(player.id) ?? false;
            const steps = player.drainStepPositions() as StepRecord[] | undefined;

            if (steps && steps.length > 0) {
                frame.playerSteps.set(player.id, steps);
            }
            const summary = this.svc.movementService.summarizeSteps(player, steps);
            const interactionState = players.getInteractionState(sock);
            const interactionIndex = deriveInteractionIndex({
                player,
                interaction: interactionState,
                playerLookup,
                npcLookup,
            });
            frame.interactionIndices.set(player.id, interactionIndex);

            if (player.consumeColorOverrideDirty()) {
                const co = player.getColorOverride();
                if (co && co.amount > 0) {
                    frame.colorOverrides.set(player.id, co);
                }
            }

            this.svc.movementService.updateRunEnergy(
                player,
                { ran: summary.ran, moved, runSteps: summary.runSteps },
                frame.tick,
            );

            if (player.energy.hasRunEnergyUpdate()) {
                this.svc.movementService.queueRunEnergySnapshot(player);
            }
            this.queueWorldMapTransmitData(player);

            const tileX = player.x / 128;
            const tileY = player.y / 128;
            const currentWildyLevel = getWildernessLevel(tileX, tileY);
            const previousWildyLevel = player.combat.lastWildernessLevel ?? 0;

            if (currentWildyLevel !== previousWildyLevel) {
                player.combat.lastWildernessLevel = currentWildyLevel;

                const PVP_INTERFACE_ID = 90;
                const PVP_ICONS_CONTAINER_UID = (161 << 16) | 3;
                const WILDERNESS_LEVEL_WIDGET_UID = (90 << 16) | 50;

                if (currentWildyLevel > 0 && previousWildyLevel === 0) {
                    this.svc.queueWidgetEvent(player.id, {
                        action: "open_sub",
                        targetUid: PVP_ICONS_CONTAINER_UID,
                        groupId: PVP_INTERFACE_ID,
                        type: 1,
                    });
                    this.svc.variableService.queueVarbit(player.id, VARBIT_IN_WILDERNESS, 1);
                } else if (currentWildyLevel === 0 && previousWildyLevel > 0) {
                    this.svc.queueWidgetEvent(player.id, {
                        action: "close_sub",
                        targetUid: PVP_ICONS_CONTAINER_UID,
                    });
                    this.svc.variableService.queueVarbit(player.id, VARBIT_IN_WILDERNESS, 0);
                }

                if (currentWildyLevel > 0) {
                    this.svc.broadcastService.queueClientScript(
                        player.id,
                        388,
                        WILDERNESS_LEVEL_WIDGET_UID,
                    );
                }
            }

            const currentInMulti = multiCombatSystem.isMultiCombat(tileX, tileY, player.level);
            const previousInMulti = player.combat.lastInMultiCombat ?? false;

            if (currentInMulti !== previousInMulti) {
                player.combat.lastInMultiCombat = currentInMulti;
                this.svc.variableService.queueVarbit(
                    player.id,
                    VARBIT_MULTICOMBAT_AREA,
                    currentInMulti ? 1 : 0,
                );
            }

            const currentInPvP = isInPvPArea(tileX, tileY, player.level);
            const previousInPvP = player.combat.lastInPvPArea ?? false;

            if (currentInPvP !== previousInPvP) {
                player.combat.lastInPvPArea = currentInPvP;
                this.svc.variableService.queueVarbit(
                    player.id,
                    VARBIT_PVP_SPEC_ORB,
                    currentInPvP ? 1 : 0,
                );
            }

            const currentInRaid = isInRaid(tileX, tileY, player.level);
            const previousInRaid = player.combat.lastInRaid ?? false;

            if (currentInRaid !== previousInRaid) {
                player.combat.lastInRaid = currentInRaid;
                this.svc.variableService.queueVarbit(
                    player.id,
                    VARBIT_IN_RAID,
                    currentInRaid ? 1 : 0,
                );
                if (!currentInRaid) {
                    this.svc.variableService.queueVarbit(player.id, VARBIT_RAID_STATE, 0);
                }
            }

            const currentInLMS = isInLMS(tileX, tileY, player.level);
            const previousInLMS = player.combat.lastInLMS ?? false;

            if (currentInLMS !== previousInLMS) {
                player.combat.lastInLMS = currentInLMS;
                this.svc.variableService.queueVarbit(
                    player.id,
                    VARBIT_IN_LMS,
                    currentInLMS ? 1 : 0,
                );
            }

            player.skillSystem.tickSkillRestoration(frame.tick);
            let specialUpdated = player.specEnergy.tick(frame.tick);
            const specialRegenTimer = player.specEnergy.takeRegenTimerSync(frame.tick);
            if (specialRegenTimer) {
                this.svc.variableService.queueVarp(player.id, VARP_MAP_CLOCK, frame.tick);
                this.svc.broadcastService.queueClientScript(
                    player.id,
                    SCRIPT_SPEC_REGEN_TIMER,
                    specialRegenTimer.intervalTicks,
                    specialRegenTimer.startTick,
                );
            }
            if (!specialUpdated && player.specEnergy.hasUpdate?.()) {
                specialUpdated = true;
            }

            if (specialUpdated) {
                this.svc.variableService.queueVarp(
                    player.id,
                    VARP_SPECIAL_ENERGY,
                    player.specEnergy.getPercent() * 10,
                );
                this.svc.variableService.queueVarp(player.id, VARP_MAP_CLOCK, frame.tick);
                this.svc.broadcastService.queueClientScript(
                    player.id,
                    SCRIPT_ORBS_REDRAW,
                    frame.tick,
                );
                this.svc.queueCombatState(player);
            }
            const snap = (player.wasTeleported() ?? false) || player.consumePositionCorrection();
            const turned = player.didTurn() ?? false;
            const shouldSendMovement =
                summary.directions.length > 0 || snap || turned || player.shouldSendPos();
            if (shouldSendMovement) {
                player.markSent();
            }
            frame.playerViews.set(player.id, {
                id: player.id,
                x: summary.subX,
                y: summary.subY,
                level: summary.level,
                rot: summary.finalRot,
                orientation: summary.finalOrientation,
                running: summary.ran,
                name: this.svc.appearanceService.getAppearanceDisplayName(player),
                appearance: player.appearance,
                interactionIndex: interactionIndex >= 0 ? interactionIndex : undefined,
                interactionDirty: player.consumeInteractionDirty(),
                seq: summary.finalSeq,
                moved: moved || snap,
                turned,
                snap,
                directions: summary.directions.length > 0 ? summary.directions : undefined,
                traversals: summary.traversals.length > 0 ? summary.traversals : undefined,
                anim: this.svc.appearanceService.buildAnimPayload(player),
                shouldSendPos: shouldSendMovement,
                worldViewId: player.worldViewId >= 0 ? player.worldViewId : undefined,
            });
            if (snap) {
                try {
                    player.clearTeleportFlag();
                } catch (err) {
                    logger.warn("Failed to clear player teleport flag", err);
                }
            }
            const skillUpdate = player.skillSystem.takeSkillSync();
            if (skillUpdate) {
                this.svc.skillService.queueSkillSnapshot(player.id, skillUpdate);
            }
        }
        try {
            players.tickBots(frame.tick, movementProcessor);
        } catch (err) {
            logger.warn("Failed to tick bots", err);
        }
        players.forEachBot((bot) => {
            const botSteps = bot.drainStepPositions() as StepRecord[] | undefined;
            if (botSteps && botSteps.length > 0) {
                frame.playerSteps.set(bot.id, botSteps);
            }
            const summary = this.svc.movementService.summarizeSteps(bot, botSteps);
            const snap = bot.wasTeleported() ?? false;
            const moved = bot.didMove() ?? false;
            const turned = bot.didTurn() ?? false;
            try {
                this.svc.movementService.updateRunEnergy(
                    bot,
                    { ran: summary.ran, moved, runSteps: summary.runSteps },
                    frame.tick,
                );
            } catch (err) {
                logger.warn("Failed to update bot run energy", err);
            }
            frame.playerViews.set(bot.id, {
                id: bot.id,
                x: summary.subX,
                y: summary.subY,
                level: summary.level,
                rot: summary.finalRot,
                orientation: summary.finalOrientation,
                running: summary.ran,
                name: this.svc.appearanceService.getAppearanceDisplayName(bot),
                appearance: bot.appearance,
                interactionDirty: bot.consumeInteractionDirty(),
                seq: summary.finalSeq,
                moved: moved || snap,
                turned,
                snap,
                directions: summary.directions.length > 0 ? summary.directions : undefined,
                traversals: summary.traversals.length > 0 ? summary.traversals : undefined,
                anim: this.svc.appearanceService.buildAnimPayload(bot),
                shouldSendPos: false,
            });
            if (snap) {
                try {
                    bot.clearTeleportFlag();
                } catch (err) {
                    logger.warn("Failed to clear bot teleport flag", err);
                }
            }
        });
        try {
            this.svc.movementSystem?.runPostMovement(frame.tick);
        } catch (err) {
            logger.warn("Failed to run post-movement phase", err);
        }
    }

    private queueWorldMapTransmitData(player: PlayerState): void {
        if (!player.widgets.isOpen(WORLD_MAP_GROUP_ID)) {
            this.lastWorldMapCoordByPlayer.delete(player);
            return;
        }

        const packedCoord = packWorldMapPlayerCoord(player);
        if (this.lastWorldMapCoordByPlayer.get(player) === packedCoord) {
            return;
        }
        this.lastWorldMapCoordByPlayer.set(player, packedCoord);
        this.svc.broadcastService.queueClientScript(
            player.id,
            SCRIPT_WORLDMAP_TRANSMIT_DATA,
            ...getWorldMapTransmitDataArgs(packedCoord),
        );
    }

    runCombatPhase(frame: TickFrame): void {
        const tickResult = this.getCombatTickEngine()?.processTick(frame.tick);
        this.processPendingManualCombatSpells(frame.tick);
        const hitProcessor = this.getCombatHitProcessor();
        if (tickResult && hitProcessor) {
            const attacks = tickResult.preparedAttacks.filter((attack) => {
                if (attack.attacker.type !== "npc" || attack.target.type !== "player") return true;
                const npc = this.svc.npcManager?.getById(attack.attacker.id);
                const target = this.svc.players?.getById(attack.target.id);
                if (!npc || !target) return true;
                return !this.svc.scriptRuntime.runNpcAttack({ npc, target, attack, tick: frame.tick });
            });
            hitProcessor.processPreparedAttacks(attacks, frame.tick);
        }
        hitProcessor?.processDeferredHits(frame.tick, frame);
        this.refreshInteractionFacing(frame);
        this.processGamemodeTickCallbacks(frame);
    }

    private processPendingManualCombatSpells(currentMapClock: number): void {
        const handler = this.svc.spellActionHandler;
        const players = this.svc.players;
        if (!handler || !players) return;

        for (const player of players.getAllPlayersForSync()) {
            if (!player.combat.pendingManualCombatSpell) continue;
            const outcome = handler.processPendingManualCombatSpell(player, currentMapClock);
            // The original click already acknowledged a queued chase. Only
            // publish the eventual cast/failure result, not a result every
            // travel tick while the target remains outside casting range.
            if (outcome && outcome.reason !== "queued") {
                this.svc.broadcastService.queueSpellResult(player.id, outcome);
            }
        }
    }

    runScriptPhase(frame: TickFrame): void {
        this.svc.scriptRuntime.queueTick(frame.tick);
        this.svc.scriptScheduler.process(frame.tick);
    }

    /**
     * Executes queued player actions independently of the combat lifecycle.
     * Inventory, equipment, movement-adjacent, and combat actions all share
     * this scheduler, so its lifecycle remains owned by the action phase.
     */
    runActionPhase(frame: TickFrame): void {
        const effects = this.svc.actionScheduler.processTick(frame.tick);
        if (effects.length > 0) {
            frame.actionEffects.push(...effects);
        }
    }

    runDeathPhase(_frame: TickFrame): void {
        if (this.svc.playerDeathService) {
            this.svc.playerDeathService.tick();
        }
    }

    runPostScriptPhase(frame: TickFrame): void {
        this.svc.scriptScheduler.process(frame.tick);
    }

    runPostEffectsPhase(frame: TickFrame): void {
        if (this.svc.gatheringSystem) {
            this.svc.gatheringSystem.processTick(frame.tick);
        }
        this.svc.groundItems.tick(frame.tick);
        if (frame.actionEffects.length > 0) {
            this.svc.effectDispatcher!.dispatchActionEffects(frame.actionEffects, frame);
        }
        if (this.svc.players) {
            const nowMs = Date.now();
            this.svc.players.forEach((_, player) => {
                this.svc.accountSummary.syncPlayer(player, nowMs);
                this.svc.gamemode.onPlayerTick?.(player, nowMs);
                this.svc.reportGameTime.syncPlayer(player, nowMs);
                const seqData = player.popPendingSeq() as
                    | { seqId: number; delay: number }
                    | undefined;
                if (seqData && seqData.seqId >= -1) {
                    frame.pendingSequences.set(player.id, {
                        seqId: seqData.seqId,
                        delay: Math.max(0, seqData.delay),
                        startTick: frame.tick,
                    });
                    const view = frame.playerViews.get(player.id);
                    if (view) {
                        view.shouldSendPos = true;
                    }
                }
                this.svc.varpSyncService.syncCombatTargetPlayerVarp(player);
                player.combat.attackDelay = this.svc.playerCombatService!.pickAttackSpeed(player);
            });
            this.svc.players.forEachBot((bot) => {
                const seqData = bot.popPendingSeq() as { seqId: number; delay: number } | undefined;
                if (seqData && seqData.seqId >= 0) {
                    frame.pendingSequences.set(bot.id, {
                        seqId: seqData.seqId,
                        delay: Math.max(0, seqData.delay),
                        startTick: frame.tick,
                    });
                    const view = frame.playerViews.get(bot.id);
                    if (view) {
                        view.shouldSendPos = true;
                    }
                }
            });
        }
        this.svc.tradeManager?.tick(frame.tick);
    }

    runOrphanedPlayersPhase(frame: TickFrame): void {
        const { players } = this.svc;
        if (!players) return;

        players.processOrphanedPlayers(frame.tick, (player, saveKey) => {
            try {
                this.svc.playerPersistence.saveSnapshot(saveKey, player);
                logger.info(`[orphan] Saved and removed expired orphan: ${saveKey}`);
            } catch (err) {
                logger.warn(`[orphan] Failed to save expired orphan ${saveKey}:`, err);
            }
            this.svc.followerCombatManager?.resetPlayer(player.id);
            this.svc.followerManager?.despawnFollowerForPlayer(player.id, false);
            this.svc.instancedAreaManager?.dispose(player);
            this.svc.npcManager?.removeNpcsOwnedByPlayer(player.id);
            this.svc.locationService.clearTemporaryLocsOwnedByPlayer(player.id);
            this.svc.actionScheduler.unregisterPlayer(player.id);
        });
    }

    runScheduledScriptsPhase(frame: TickFrame): void {
        this.svc.scriptScheduler.process(frame.tick);
    }

    runBroadcastPhase(frame: TickFrame): void {
        this.svc.networkLayer.setBroadcastPhase(true);
        try {
            const ctx = this.buildBroadcastContext();
            if (this.svc.pendingDirectSends.size > 0) {
                const entries = Array.from(this.svc.pendingDirectSends.entries());
                this.svc.pendingDirectSends.clear();
                for (const [ws, queue] of entries) {
                    for (const entry of queue) {
                        try {
                            this.svc.networkLayer.sendWithGuard(ws, entry.message, entry.context);
                        } catch (err) {
                            logger.warn("Failed to flush pending direct send", err);
                        }
                    }
                }
            }
            this.svc.miscBroadcaster.flushLocChanges(frame, ctx);
            this.svc.widgetBroadcaster.flushCloseEvents(frame, ctx);
            this.svc.varBroadcaster.flush(frame, ctx);
            this.svc.skillBroadcaster.flush(frame, ctx);
            this.svc.combatBroadcaster.flush(frame, ctx);
            this.svc.actorSyncBroadcaster.flush(frame, ctx);
            this.svc.miscBroadcaster.flushLocAnimations(frame, ctx);
            this.svc.widgetBroadcaster.flushOpenEvents(frame, ctx);
            this.svc.miscBroadcaster.flushPostWidgetEvents(frame, ctx);
            this.svc.chatBroadcaster.flush(frame, ctx);
            this.svc.inventoryBroadcaster.flush(frame, ctx);
            this.flushPerPlayerDirtyState(frame);
            this.flushAnimSnapshots(frame, ctx);
        } finally {
            this.svc.networkLayer.flushAllMessageBatches();
            this.svc.networkLayer.setBroadcastPhase(false);
            this.svc.networkLayer.flushDirectSendWarnings("broadcast");
        }
    }

    runMusicPhase(_frame: TickFrame): void {
        this.svc.soundManager!.runMusicPhase(_frame);
    }

    checkAndSendSnapshots(player: PlayerState, sock?: WebSocket): void {
        if (this.svc.activeFrame) {
            return;
        }

        const ws = sock ?? this.svc.players?.getSocketByPlayerId(player.id);
        if (!ws || ws.readyState !== 1 /* WebSocket.OPEN */) return;

        if (player.hasInventoryUpdate()) {
            const snapshot = player.takeInventorySnapshot();
            if (snapshot) {
                this.svc.inventoryService.sendInventorySnapshotImmediate(ws, player);
            }
        }
        if (player.hasAppearanceUpdate()) {
            // Let the dirty flag remain for tick-based player sync.
        }
        if (player.hasCombatStateUpdate()) {
            player.takeCombatStateSnapshot();
            this.svc.queueCombatState(player);
        }
    }

    // --- Private helpers ---

    private getCombatTickEngine(): CombatTickEngine | undefined {
        if (this.combatTickEngine) return this.combatTickEngine;

        const { players, npcManager, pathService } = this.svc;
        if (!players || !npcManager || !pathService) return undefined;

        this.combatTickEngine = new CombatTickEngine({
            pathService,
            getPlayer: (id) => players.getById(id),
            getNpc: (id) => npcManager.getById(id),
            getCombatants: () => {
                const playerCombatants = players
                    .getAllPlayersForSync()
                    .sort((first, second) => first.getPidPriority() - second.getPidPriority());
                const npcCombatants: NpcState[] = [];
                npcManager.forEach((npc) => npcCombatants.push(npc));
                npcCombatants.sort((first, second) => first.id - second.id);
                return [...playerCombatants, ...npcCombatants];
            },
            resolveAttackTraits: (attacker, target) =>
                this.resolveCombatAttackTraits(attacker, target),
        });
        return this.combatTickEngine;
    }

    private getCombatHitProcessor(): CombatHitProcessor | undefined {
        if (this.combatHitProcessor) return this.combatHitProcessor;
        if (!this.svc.players || !this.svc.npcManager) return undefined;
        const retaliationEngine = this.getCombatRetaliationEngine();
        if (!retaliationEngine) return undefined;
        this.combatHitProcessor = new CombatHitProcessor(
            this.svc,
            undefined,
            retaliationEngine,
        );
        return this.combatHitProcessor;
    }

    private getCombatRetaliationEngine(): CombatRetaliationEngine | undefined {
        if (this.combatRetaliationEngine) return this.combatRetaliationEngine;
        const { players, npcManager, pathService } = this.svc;
        if (!players || !npcManager || !pathService) return undefined;

        this.combatRetaliationEngine = new CombatRetaliationEngine({
            pathService,
            getPlayer: (id) => players.getById(id),
            getNpc: (id) => npcManager.getById(id),
            resolveAttackTraits: (attacker, target) =>
                this.resolveCombatAttackTraits(attacker, target),
        });
        return this.combatRetaliationEngine;
    }

    private resolveCombatAttackTraits(
        attacker: CombatEntity,
        target: CombatEntity,
    ): CombatAttackTraits | null {
        if (attacker instanceof NpcState) {
            const type = attacker.getAttackType() ?? attacker.combat.attackType;
            const rangeTiles =
                type === AttackType.Magic
                    ? DEFAULT_NPC_MAGIC_RANGE
                    : type === AttackType.Ranged
                      ? DEFAULT_NPC_RANGED_RANGE
                      : 1;
            return {
                type,
                style: null,
                rangeTiles,
                speedTicks: Math.max(1, Math.trunc(attacker.attackSpeed)),
            };
        }

        const service = this.svc.playerCombatService;
        if (!service) return null;
        const type = service.deriveAttackTypeFromStyle(attacker.combat.styleSlot, attacker);
        const weaponId = attacker.combat.weaponItemId;
        if (weaponId === 12924) {
            attacker.combatAttributes.set(CombatAttributes.COMBAT_TARGET, null);
            this.svc.messagingService.queueChatMessage({
                messageType: "game",
                text: "You need to charge the toxic blowpipe before you can fire it.",
                targetPlayerIds: [attacker.id],
            });
            return null;
        }
        const spellId = attacker.combat.spellId;
        const style = this.resolvePlayerCombatAttackStyle(attacker);
        const autocastSpellId =
            attacker.combat.pendingManualCombatSpell === undefined
                ? attacker.combatAttributes.get(CombatAttributes.AUTOCAST_SPELL_ID)
                : null;
        if (autocastSpellId !== null && autocastSpellId > 0) {
            return {
                type: AttackType.Magic,
                style,
                rangeTiles: DEFAULT_PLAYER_MAGIC_RANGE,
                speedTicks: 5,
                weaponId: weaponId > 0 ? weaponId : undefined,
                spellId: autocastSpellId,
                specialAttack: attacker.specEnergy.isActivated(),
                autocast: true,
            };
        }
        const baseSpeedTicks = Math.max(1, Math.trunc(service.pickAttackSpeed(attacker)));
        const speedTicks =
            weaponId === 12926 && target instanceof PlayerState
                ? baseSpeedTicks + 1
                : baseSpeedTicks;
        return {
            type,
            style,
            rangeTiles: Math.max(1, Math.trunc(service.getPlayerAttackReach(attacker))),
            speedTicks,
            weaponId: weaponId > 0 ? weaponId : undefined,
            spellId: type === AttackType.Magic && spellId > 0 ? spellId : undefined,
            specialAttack: attacker.specEnergy.isActivated(),
            autocast: attacker.combat.autocastEnabled,
        };
    }

    private resolvePlayerCombatAttackStyle(player: PlayerState): CombatAttackStyle | null {
        try {
            const style = getWeaponAttackStyle(
                player.combat.weaponItemId > 0 ? player.combat.weaponItemId : 0,
                player.combat.styleSlot,
            );
            return Object.values(CombatAttackStyle).includes(style as CombatAttackStyle)
                ? (style as CombatAttackStyle)
                : null;
        } catch {
            return null;
        }
    }

    private flushPendingWalkCommands(currentTick: number, stage: "pre" | "movement" = "pre"): void {
        this.svc.movementService.flushPendingWalkCommands(currentTick, stage);
    }

    private refreshInteractionFacing(frame: TickFrame): void {
        const { players, npcManager } = this.svc;
        if (!players) return;
        const playerLookup = (id: number) => players.getById(id);
        const npcLookup = (npcId: number) => npcManager?.getById(npcId);

        const updateView = (player: PlayerState, interactionIndex: number | undefined) => {
            frame.interactionIndices.set(player.id, interactionIndex ?? -1);
            const view = frame.playerViews.get(player.id);
            if (view) {
                const previousOrientation = view.orientation;
                const updatedOrientation = player.getOrientation() & 2047;
                view.orientation = updatedOrientation;
                view.interactionIndex =
                    interactionIndex !== undefined && interactionIndex >= 0
                        ? interactionIndex
                        : undefined;
                if (previousOrientation !== updatedOrientation) {
                    player.markSent();
                }
            }
        };

        const collectFaceTile = (player: PlayerState) => {
            if (player.pendingFaceTile) {
                const ft = player.pendingFaceTile;
                const targetX = (ft.x << 7) + 64;
                const targetY = (ft.y << 7) + 64;
                const dir = faceAngleRs(player.x, player.y, targetX, targetY) & 2047;
                frame.pendingFaceDirs.set(player.id, dir);
                player.pendingFaceTile = undefined;
            }
        };

        players.forEach((sock, player) => {
            try {
                players.applyInteractionFacing(sock, player, npcLookup);
            } catch (err) {
                logger.warn("Failed to apply interaction facing", err);
            }
            collectFaceTile(player);
            const interactionState = players.getInteractionState(sock);
            const interactionIndex = deriveInteractionIndex({
                player,
                interaction: interactionState,
                playerLookup,
                npcLookup,
            });
            updateView(player, interactionIndex);
        });

        players.forEachBot((bot) => {
            const interactionState = (
                bot as PlayerState & {
                    botInteraction?: import("../interactions/types").PlayerInteractionState;
                }
            ).botInteraction;
            collectFaceTile(bot);
            const interactionIndex = deriveInteractionIndex({
                player: bot,
                interaction: interactionState,
                playerLookup,
                npcLookup,
            });
            updateView(bot, interactionIndex);
        });
    }

    private processGamemodeTickCallbacks(frame: TickFrame): void {
        for (const callback of this.svc.gamemodeTickCallbacks) {
            try {
                callback(frame.tick);
            } catch (err) {
                logger.warn("[gamemode-tick] Tick callback error", err);
            }
        }
    }

    private buildBroadcastContext(): BroadcastContext {
        const tickMs = Math.max(1, this.svc.tickMs);
        return {
            sendWithGuard: (sock, msg, context) =>
                this.svc.networkLayer.sendWithGuard(sock, msg, context),
            broadcast: (msg, context) => this.svc.broadcastService.broadcast(msg, context),
            broadcastToNearby: (x, y, level, radius, msg, context) =>
                this.svc.broadcastService.broadcastToNearby(x, y, level, radius, msg, context),
            getSocketByPlayerId: (id) => this.svc.players?.getSocketByPlayerId(id),
            cyclesPerTick: Math.max(1, Math.round(tickMs / 20)),
        };
    }

    private flushPerPlayerDirtyState(frame: TickFrame): void {
        const { players } = this.svc;
        if (!players) return;
        this.svc.locationService.processTemporaryLocs(frame.tick);
        players.forEach((_, player) => {
            player.clearTeleportFlag();
        });
        players.forEachBot((bot) => {
            bot.clearTeleportFlag();
        });
        players.forEach((sock, player) => {
            this.svc.locationService.maybeReplayDynamicLocState(sock, player, false);
        });
        players.forEach((sock, player) => {
            this.svc.groundItemHandler?.maybeSendGroundItemSnapshot(sock, player);
        });
        players.forEach((sock, player) => {
            if (player.hasInventoryUpdate()) {
                const snapshot = player.takeInventorySnapshot();
                if (snapshot) {
                    const inv = this.svc.inventoryService.getInventory(player);
                    const slots = inv.map((entry, idx) => ({
                        slot: idx,
                        itemId: entry.itemId,
                        quantity: entry.quantity,
                    }));
                    this.svc.networkLayer.sendWithGuard(
                        sock,
                        encodeMessage({
                            type: "inventory",
                            payload: { kind: "snapshot" as const, slots },
                        }),
                        "inventory_snapshot",
                    );
                }
            }
            const appearanceDirty = player.hasAppearanceUpdate();
            if (appearanceDirty) {
                player.takeAppearanceSnapshot();
                this.svc.playerAppearanceManager!.queueAppearanceSnapshot(player);
                this.svc.appearanceService.queueAnimSnapshot(
                    player.id,
                    this.svc.appearanceService.buildAnimPayload(player),
                );
            }
            const hasCombatUpdate = player.hasCombatStateUpdate();
            if (hasCombatUpdate) {
                player.takeCombatStateSnapshot();
                let specialEnergy: number | undefined;
                let specialActivated: boolean | undefined;
                let quickPrayers: string[] | undefined;
                let quickPrayersEnabled: boolean | undefined;
                try {
                    specialEnergy = player.specEnergy.getPercent();
                    specialActivated = player.specEnergy.isActivated();
                    player.specEnergy.markSynced();
                    const quickSet = player.prayer.getQuickPrayers();
                    quickPrayers = Array.from(quickSet);
                    quickPrayersEnabled = player.prayer.areQuickPrayersEnabled();
                } catch (err) {
                    logger.warn("Failed to read combat UI state", err);
                }
                this.svc.networkLayer.sendWithGuard(
                    sock,
                    encodeMessage({
                        type: "combat",
                        payload: {
                            weaponCategory: player.combat.weaponCategory,
                            weaponItemId: player.combat.weaponItemId,
                            autoRetaliate: !!player.combat.autoRetaliate,
                            activeStyle: player.combat.styleSlot,
                            activePrayers: Array.from(player.prayer.activePrayers ?? []),
                            activeSpellId:
                                player.combat.spellId > 0 ? player.combat.spellId : undefined,
                            specialEnergy,
                            specialActivated,
                            quickPrayers,
                            quickPrayersEnabled,
                        },
                    }),
                    "combat_state_dirty",
                );
            }
            if (
                (appearanceDirty || hasCombatUpdate) &&
                this.svc.interfaceManager.isWidgetGroupOpenInLedger(
                    player.id,
                    EQUIPMENT_STATS_GROUP_ID,
                )
            ) {
                this.svc.equipmentStatsUiService.queueEquipmentStatsWidgetTexts(player);
            }
        });
    }

    private flushAnimSnapshots(frame: TickFrame, ctx: BroadcastContext): void {
        if (!frame.animSnapshots || frame.animSnapshots.length === 0) return;
        for (const snapshot of frame.animSnapshots) {
            const sock = ctx.getSocketByPlayerId(snapshot.playerId);
            ctx.sendWithGuard(
                sock,
                encodeMessage({ type: "anim", payload: snapshot.anim }),
                "anim_snapshot",
            );
        }
    }

    applyAppearanceSnapshotsToViews(frame: TickFrame): void {
        if (!frame.appearanceSnapshots || frame.appearanceSnapshots.length === 0) return;
        for (const snapshot of frame.appearanceSnapshots) {
            const view = frame.playerViews.get(snapshot.playerId);
            if (view) {
                if (snapshot.payload.appearance) {
                    view.appearance = snapshot.payload.appearance;
                    // A shared frame is encoded once per observing session.
                    // Keep this flag on the frame so every observer receives
                    // the changed head icon, rather than relying only on a
                    // per-session appearance hash.
                    view.appearanceDirty = true;
                }
                if (snapshot.payload.snap) {
                    view.x = snapshot.payload.x;
                    view.y = snapshot.payload.y;
                    view.level = snapshot.payload.level;
                    view.snap = true;
                    view.moved = true;
                }
                if (snapshot.payload.anim) {
                    view.anim = snapshot.payload.anim;
                }
                if (snapshot.payload.worldViewId !== undefined) {
                    view.worldViewId = snapshot.payload.worldViewId;
                }
            }
        }
    }

    buildAndSendActorSync(
        sock: WebSocket,
        player: PlayerState,
        frame: TickFrame,
        ctx: BroadcastContext,
    ): void {
        let session = this.svc.playerSyncSessions.get(sock);
        if (!session) {
            session = new PlayerSyncSession();
            this.svc.playerSyncSessions.set(sock, session);
        }
        const playerFrame: PlayerTickFrameData = {
            tick: frame.tick,
            tickMs: this.svc.tickMs,
            playerViews: frame.playerViews,
            playerSteps: frame.playerSteps,
            hitsplats: frame.hitsplats,
            forcedChats: frame.forcedChats,
            forcedMovements: frame.forcedMovements,
            spotAnimations: frame.spotAnimations,
            chatMessages: frame.chatMessages,
            pendingSequences: frame.pendingSequences,
            interactionIndices: frame.interactionIndices,
            pendingFaceDirs: frame.pendingFaceDirs,
            colorOverrides: frame.colorOverrides,
        };
        const packet = this.svc.playerPacketEncoder!.buildPlayerSyncPacket(
            session,
            player,
            playerFrame,
        );
        session.activeIndices = packet.activeIndices;
        ctx.sendWithGuard(
            sock,
            encodeMessage({
                type: "player_sync",
                payload: {
                    baseX: packet.baseTileX,
                    baseY: packet.baseTileY,
                    localIndex: player.id,
                    loopCycle: frame.tick,
                    packet: Array.from(packet.bytes),
                },
            }),
            "player_sync",
        );

        if (this.svc.enableBinaryNpcSync && this.svc.npcManager) {
            try {
                let npcSession = this.svc.npcSyncSessions.get(sock);
                if (!npcSession) {
                    npcSession = new NpcSyncSession();
                    this.svc.npcSyncSessions.set(sock, npcSession);
                }
                const npcFrame = {
                    tick: frame.tick,
                    tickMs: this.svc.tickMs,
                    npcUpdates: frame.npcUpdates,
                    hitsplats: frame.hitsplats,
                    npcEffectEvents: frame.npcEffectEvents,
                    spotAnimations: frame.spotAnimations,
                    colorOverrides: frame.npcColorOverrides,
                };
                const built = this.svc.npcPacketEncoder!.buildNpcSyncPacket(
                    player,
                    npcFrame,
                    npcSession,
                );
                if (built.packet.length > 0) {
                    ctx.sendWithGuard(
                        sock,
                        encodeMessage({
                            type: "npc_info",
                            payload: {
                                loopCycle: frame.tick,
                                large: built.large,
                                packet: Array.from(built.packet),
                            },
                        }),
                        "npc_info",
                    );
                }
            } catch (err) {
                logger.warn("[npc_info] encode failed", err);
            }
        }
        if (this.svc.worldEntityInfoEncoder.needsUpdate(player.id)) {
            const wePacket = this.svc.worldEntityInfoEncoder.encode(player.id);
            if (wePacket) {
                ctx.sendWithGuard(sock, wePacket, "worldentity_info");
            }
        }
    }
}
