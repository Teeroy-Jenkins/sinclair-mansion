import { VARP_AUTOCAST_SPELLPOS, VARP_SPECIAL_ATTACK } from "../../../../client/common/vars";
import { EquipmentSlot } from "../../../../client/rs/config/player/Equipment";
import {
    DEFAULT_WEAPON_CATEGORY,
    resolveWeaponCategoryFromObj,
} from "../../../../client/rs/config/player/WeaponCategory";
import { getItemDefinition } from "../../data/items";
import { logger } from "../../utils/logger";
import { DisplayMode, getDefaultInterfaces } from "../../widgets/WidgetManager";
import type { ServerServices } from "../ServerServices";
import { clearAutocastState } from "../combat/AutocastState";
import { getCategoryForWeaponInterface } from "../combat/WeaponInterfaces";
import { MagicStaffValidator } from "../combat/plugins/MagicStaffValidator";
import {
    ensureEquipArrayOn,
    ensureEquipQtyArrayOn,
    getSkillcapeSeqId,
    getSkillcapeSpotId,
    inferEquipSlot,
} from "../equipment";
import type { PlayerAppearance as PlayerAppearanceState, PlayerState } from "../player";

const EQUIP_SLOT_COUNT = 14;
const EQUIPMENT_STATS_BONUS_COUNT = 14;
const COMBAT_OPTIONS_GROUP_ID = 593;
const AUTOCAST_SELECTION_GROUP_ID = 201;
const AUTOCAST_CONTROL_COMPONENT_IDS = [23, 28] as const;
const TOXIC_BLOWPIPE_ITEM_ID = 12926;
const WEBWEAVER_BOW_ITEM_ID = 27655;
const RANGED_ATTACK_BONUS_INDEX = 4;
const RANGED_STRENGTH_BONUS_INDEX = 11;

/**
 * Manages equipment operations: equip/unequip, stat bonuses, weapon categories.
 * Extracted from WSServer.
 */
export class EquipmentService {
    constructor(private readonly services: ServerServices) {}

    ensureEquipArray(p: PlayerState): number[] {
        const handler = this.services.equipmentHandler;
        if (handler) {
            return handler.ensureEquipArray(p);
        }
        const appearance = this.services.appearanceService.getOrCreateAppearance(p);
        ensureEquipQtyArrayOn(appearance, EQUIP_SLOT_COUNT);
        return ensureEquipArrayOn(appearance, EQUIP_SLOT_COUNT);
    }

    ensureEquipQtyArray(p: PlayerState): number[] {
        const handler = this.services.equipmentHandler;
        if (handler) {
            return handler.ensureEquipQtyArray(p);
        }
        const appearance = this.services.appearanceService.getOrCreateAppearance(p);
        return ensureEquipQtyArrayOn(appearance, EQUIP_SLOT_COUNT);
    }

    getEquippedItemIds(p: PlayerState): number[] {
        const equip = this.ensureEquipArray(p);
        return equip.filter((itemId) => itemId > 0);
    }

    resolveEquipSlot(itemId: number): number | undefined {
        return inferEquipSlot(itemId, (id) => this.services.dataLoaderService.getObjType(id));
    }

    equipItem(
        p: PlayerState,
        slotIndex: number,
        itemId: number,
        equipSlot: number,
        opts?: { playSound?: boolean },
    ): { ok: boolean; reason?: string; categoryChanged: boolean; weaponItemChanged: boolean } {
        const handler = this.services.equipmentHandler;
        if (!handler) {
            return {
                ok: false,
                reason: "equipment_handler_missing",
                categoryChanged: false,
                weaponItemChanged: false,
            };
        }
        return handler.equipItem(p, slotIndex, itemId, equipSlot, opts);
    }

    refreshCombatWeaponCategory(p: PlayerState): {
        categoryChanged: boolean;
        weaponItemChanged: boolean;
    } {
        const equip = this.ensureEquipArray(p);
        const weaponId = equip[EquipmentSlot.WEAPON];
        const normalizedWeaponId = weaponId > 0 ? weaponId : -1;
        const previousWeaponId = p.combat.weaponItemId ?? -1;

        const weaponData = this.services.appearanceService.getWeaponData();
        const dataEntry = weaponData.get(normalizedWeaponId);
        const obj =
            normalizedWeaponId > 0
                ? this.services.dataLoaderService.getObjType(normalizedWeaponId)
                : undefined;
        const def = normalizedWeaponId > 0 ? getItemDefinition(normalizedWeaponId) : undefined;
        let derived: number | undefined = getCategoryForWeaponInterface(def?.weaponInterface);
        if (dataEntry?.combatCategory !== undefined) {
            derived = dataEntry.combatCategory;
        }
        if (derived === undefined) {
            const inferred = resolveWeaponCategoryFromObj(obj, {
                defaultCategory: DEFAULT_WEAPON_CATEGORY,
            });
            if (inferred !== undefined) derived = inferred;
        }
        const normalizedCategory = derived ?? DEFAULT_WEAPON_CATEGORY;
        const previousCategory = p.combat.weaponCategory;

        const categoryChanged = previousCategory !== normalizedCategory;
        const weaponItemChanged = previousWeaponId !== normalizedWeaponId;

        p.combat.weaponCategory = normalizedCategory;
        p.combat.weaponItemId = normalizedWeaponId;
        try {
            let baseRange = 0;
            if (normalizedWeaponId > 0) {
                const rawRange = obj?.params?.get(13) as number | undefined;
                if (rawRange !== undefined && rawRange > 0) {
                    baseRange = Math.max(1, rawRange);
                }
            }
            p.combat.weaponRange = baseRange;
        } catch {
            p.combat.weaponRange = 0;
        }
        if (categoryChanged) {
            const currentSlot = Math.max(0, Math.min(p.combat.styleSlot ?? 0, 3));
            p.setCombatStyle(currentSlot, normalizedCategory);
        } else if (p.combat.styleCategory !== normalizedCategory) {
            p.combat.styleCategory = normalizedCategory;
        }

        const combatCategoryData = this.services.combatCategoryData;
        if (combatCategoryData) {
            p.setCombatCategoryAttackTypes(combatCategoryData.getAttackTypes(normalizedCategory));
            p.setCombatCategoryMeleeBonusIndices(
                combatCategoryData.getMeleeBonusIndices(normalizedCategory),
            );
        } else {
            p.setCombatCategoryAttackTypes(undefined);
            p.setCombatCategoryMeleeBonusIndices(undefined);
        }

        return { categoryChanged, weaponItemChanged };
    }

    resetAutocast(p: PlayerState): void {
        clearAutocastState(p, {
            sendVarbit: (player: PlayerState, varbitId: number, value: number) =>
                this.services.variableService.queueVarbit(player.id, varbitId, value),
            queueCombatState: (player: PlayerState) => this.queueCombatState(player),
        });
        logger.info(`[autocast] Reset autocast for player=${p.id} due to weapon change`);
    }

    /**
     * Clears persistent and transient autocast state after a weapon-slot change.
     * The standard Combat Options interface is destructively rebound in the same
     * tick so its cache scripts can rebuild the weapon-specific style panel.
     */
    handleWeaponSlotChanged(p: PlayerState): void {
        if (p.combat.clearQueuedInstantSpecialAttacks() > 0) {
            p.specEnergy.setActivated(false);
            p.varps.setVarpValue(VARP_SPECIAL_ATTACK, 0);
            this.services.variableService.queueVarp(p.id, VARP_SPECIAL_ATTACK, 0);
            this.queueCombatState(p);
        }
        const chooserWasOpen =
            p.widgets.isOpen(AUTOCAST_SELECTION_GROUP_ID) ||
            this.services.interfaceManager.isWidgetGroupOpenInLedger(
                p.id,
                AUTOCAST_SELECTION_GROUP_ID,
            );
        const combatOptionsWereOpen =
            p.widgets.isOpen(COMBAT_OPTIONS_GROUP_ID) ||
            this.services.interfaceManager.isWidgetGroupOpenInLedger(p.id, COMBAT_OPTIONS_GROUP_ID);

        p.combat.pendingAutocastDefensive = undefined;
        p.combat.pendingAutocastWeaponId = undefined;
        this.resetAutocast(p);
        p.varps.setVarpValue(VARP_AUTOCAST_SPELLPOS, -1);
        this.services.variableService.queueVarp(p.id, VARP_AUTOCAST_SPELLPOS, -1);

        if (!chooserWasOpen && !combatOptionsWereOpen) return;

        const rawDisplayMode = Number.isFinite(p.displayMode) ? Math.trunc(p.displayMode) : 1;
        const displayMode =
            rawDisplayMode >= DisplayMode.FIXED && rawDisplayMode <= DisplayMode.MOBILE
                ? (rawDisplayMode as DisplayMode)
                : DisplayMode.RESIZABLE_NORMAL;
        const combatMount = getDefaultInterfaces(displayMode).find(
            (entry) => entry.groupId === COMBAT_OPTIONS_GROUP_ID,
        );
        const targetUid = combatMount?.targetUid ?? (161 << 16) | 76;

        p.widgets.closeByTargetUid(targetUid);
        p.widgets.open(COMBAT_OPTIONS_GROUP_ID, {
            targetUid,
            type: combatMount?.type ?? 1,
            modal: false,
        });
        const weaponId = this.ensureEquipArray(p)[EquipmentSlot.WEAPON] ?? -1;
        const spellbookCompatible = MagicStaffValidator.isCompatible(
            weaponId,
            p.getSpellbookType(),
        );
        for (const componentId of AUTOCAST_CONTROL_COMPONENT_IDS) {
            this.services.queueWidgetEvent(p.id, {
                action: "set_hidden",
                uid: (COMBAT_OPTIONS_GROUP_ID << 16) | componentId,
                hidden: false,
            });
        }
        logger.info(
            `[autocast] Refreshed combat tab after weapon change for player=${p.id} ` +
                `weapon=${weaponId} spellbook=${p.getSpellbookType()} ` +
                `spellbookCompatible=${spellbookCompatible}`,
        );
    }

    computeEquipmentStatBonuses(player: PlayerState): number[] {
        const totals = new Array<number>(EQUIPMENT_STATS_BONUS_COUNT).fill(0);
        const equip = this.ensureEquipArray(player);
        for (const rawItemId of equip) {
            if (!(rawItemId > 0)) continue;
            const def = getItemDefinition(rawItemId);
            const itemBonuses = def?.bonuses;
            if (!itemBonuses) continue;
            for (let i = 0; i < EQUIPMENT_STATS_BONUS_COUNT; i++) {
                const bonus = itemBonuses[i] ?? 0;
                if (!Number.isFinite(bonus)) continue;
                totals[i] = (totals[i] ?? 0) + bonus;
            }
        }

        if (equip[EquipmentSlot.WEAPON] === TOXIC_BLOWPIPE_ITEM_ID) {
            // The bundled cache predates the 2021 rebalance (+60 accuracy,
            // no strength). Charged blowpipes now provide +30/+20.
            totals[RANGED_ATTACK_BONUS_INDEX] -= 30;
            totals[RANGED_STRENGTH_BONUS_INDEX] += 20;

            // Blowpipe damage comes from its internal dart, never from an item
            // left in the ordinary ammunition equipment slot.
            const quiverBonuses = getItemDefinition(equip[EquipmentSlot.AMMO] ?? -1)?.bonuses;
            const quiverRangedStrength = quiverBonuses?.[RANGED_STRENGTH_BONUS_INDEX] ?? 0;
            if (Number.isFinite(quiverRangedStrength)) {
                totals[RANGED_STRENGTH_BONUS_INDEX] -= quiverRangedStrength;
            }

            const loadedDart = player.equipment.getBlowpipeChargeState();
            const dartBonuses = getItemDefinition(loadedDart.dartId)?.bonuses;
            if (loadedDart.dartCount > 0 && dartBonuses) {
                const rangedStrength = dartBonuses[RANGED_STRENGTH_BONUS_INDEX] ?? 0;
                if (Number.isFinite(rangedStrength)) {
                    totals[RANGED_STRENGTH_BONUS_INDEX] += rangedStrength;
                }
            }
        }

        if (equip[EquipmentSlot.WEAPON] === WEBWEAVER_BOW_ITEM_ID) {
            // This cache revision has no Webweaver definition. Preserve its
            // live +85 Ranged attack and +65 Ranged strength until regenerated.
            if (!getItemDefinition(WEBWEAVER_BOW_ITEM_ID)?.bonuses) {
                totals[RANGED_ATTACK_BONUS_INDEX] += 85;
                totals[RANGED_STRENGTH_BONUS_INDEX] += 65;
            }

            // The powered bow generates its own arrows; an equipped quiver
            // must never add ammunition Ranged Strength to its max hit.
            const quiverBonuses = getItemDefinition(equip[EquipmentSlot.AMMO] ?? -1)?.bonuses;
            const quiverRangedStrength = quiverBonuses?.[RANGED_STRENGTH_BONUS_INDEX] ?? 0;
            if (Number.isFinite(quiverRangedStrength)) {
                totals[RANGED_STRENGTH_BONUS_INDEX] -= quiverRangedStrength;
            }
        }
        return totals;
    }

    performEquipmentAction(
        player: PlayerState,
        action: { slot: number; itemId: number; optionLabel: string },
    ): boolean {
        const optionLower = action.optionLabel.toLowerCase();
        let handled = false;
        let deferredFallback: (() => boolean) | undefined;
        switch (optionLower) {
            case "operate":
                handled = this.tryHandleOperateAction(player, action.slot, action.itemId);
                break;
            case "check":
                deferredFallback = () =>
                    this.tryHandleCheckAction(player, action.slot, action.itemId);
                break;
            default:
                break;
        }
        if (!handled) {
            handled = this.tryDispatchEquipmentActionScript(player, action, optionLower);
        }
        if (!handled && deferredFallback) {
            handled = deferredFallback();
        }
        return handled;
    }

    private tryHandleOperateAction(player: PlayerState, slot: number, itemId: number): boolean {
        if (this.tryHandleSkillcapeOperate(player, slot, itemId)) {
            return true;
        }
        return false;
    }

    private tryHandleCheckAction(player: PlayerState, slot: number, itemId: number): boolean {
        const obj = this.services.dataLoaderService.getObjType(itemId);
        const name = obj?.name && obj.name.length > 0 ? obj.name : "item";
        const examine = obj?.examine && obj.examine.length > 0 ? obj.examine : "It looks ordinary.";
        this.services.messagingService.queueChatMessage({
            messageType: "game",
            text: `You check the ${name.toLowerCase()}. ${examine}`,
            targetPlayerIds: [player.id],
        });
        return true;
    }

    private tryHandleSkillcapeOperate(
        player: PlayerState,
        slot: number,
        capeItemId: number,
    ): boolean {
        if (slot !== EquipmentSlot.CAPE) return false;
        const seqId = getSkillcapeSeqId(capeItemId);
        const spotId = getSkillcapeSpotId(capeItemId);
        if (seqId === undefined && spotId === undefined) return false;
        if (seqId !== undefined && seqId >= 0) {
            try {
                player.queueOneShotSeq(seqId);
            } catch (err) {
                logger.warn(
                    `[equipment] failed to queue skillcape sequence player=${player.id} seq=${seqId}`,
                    err,
                );
            }
        }
        if (spotId !== undefined && spotId >= 0) {
            this.services.broadcastService.enqueueSpotAnimation({
                tick: this.services.ticker.currentTick(),
                playerId: player.id,
                spotId: spotId,
                delay: 0,
                height: 120,
            });
        }
        const obj = this.services.dataLoaderService.getObjType(capeItemId);
        const capeName = obj?.name && obj.name.length > 0 ? obj.name : "cape";
        this.services.messagingService.queueChatMessage({
            messageType: "game",
            text: `You operate the ${capeName}.`,
            targetPlayerIds: [player.id],
        });
        logger.info(
            `[equipment] player=${player.id} operated skillcape item=${capeItemId} seq=${
                seqId ?? -1
            } spot=${spotId ?? -1}`,
        );
        return true;
    }

    private tryDispatchEquipmentActionScript(
        player: PlayerState,
        action: { slot: number; itemId: number; optionLabel: string },
        optionLower: string,
    ): boolean {
        try {
            const tick = this.services.ticker.currentTick();
            return this.services.scriptRuntime.queueEquipmentAction({
                tick,
                player,
                slot: action.slot,
                itemId: action.itemId,
                option: optionLower,
                rawOption: action.optionLabel,
            });
        } catch (err) {
            logger.warn("[equipment] failed to dispatch equipment action to scripts", err);
            return false;
        }
    }

    private queueCombatState(player: PlayerState): void {
        this.services.queueCombatState(player);
    }

    // Format utilities
    formatEquipmentSignedInt(value: number): string {
        const safe = Number.isFinite(value) ? Math.trunc(value) : 0;
        return safe >= 0 ? `+${safe}` : String(safe);
    }

    formatEquipmentSignedPercent(value: number): string {
        const safe = Number.isFinite(value) ? value : 0;
        const sign = safe >= 0 ? "+" : "";
        return `${sign}${safe.toFixed(1)}%`;
    }

    formatEquipmentSignedIntPercent(value: number): string {
        return `${this.formatEquipmentSignedInt(value)}%`;
    }

    formatEquipmentAttackSpeedSeconds(ticks: number): string {
        const DEFAULT_ATTACK_SPEED = 4;
        const safeTicks = Math.max(1, Number.isFinite(ticks) ? ticks : DEFAULT_ATTACK_SPEED);
        return `${(safeTicks * 0.6).toFixed(1)}s`;
    }
}
