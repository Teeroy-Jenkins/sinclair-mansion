// The main menu's Store and Bank: OSRS's own shop (interface 300, your pack in 301) and bank
// (interface 12, your pack in 15), run by the engine's ShopService and BankingManager from the
// dev gamemode, as VanillaGamemode wires them. Sinclair adds its rules on top:
//   * only between games (never while you're playing in one), and only from the menu: no booth
//     or shopkeeper in the mansion opens them;
//   * the bank takes only coins and cosmetics (game items stay in the game);
//   * bank and shop actions count only while that interface is open, as in OSRS.
// The same shop service runs the Demon butler's pantry (butler.ts): chore tokens, during a game.
import type { GamemodeServerServices } from "../../src/game/gamemodes/GamemodeDefinition";
import type { PlayerState } from "../../src/game/player";
import type { BankingServices, ShoppingServices } from "../../src/game/scripts/serviceInterfaces";
import type { IScriptRegistry, ScriptServices } from "../../src/game/scripts/types";
import { encodeMessage } from "../../src/network/messages";
import { BankingManager, registerBankInterfaceHooks, WidgetGroup } from "../dev/banking";
import { registerBankWidgetHandlers } from "../dev/banking/bankWidgets";
import type { BankingProviderServices, BankServerUpdate } from "../dev/banking/BankingProvider";
import { registerShopInterfaceHooks } from "../dev/shops";
import { SHOP_INTERFACE_ID } from "../dev/shops/shopConstants";
import { ShopService } from "../dev/shops/ShopService";
import { registerShopWidgetHandlers } from "../dev/shops/shopWidgets";
import { BUTLER_SHOP_ID, butlerShop, CHORE_TOKEN, RUNE_POUCH } from "./butler";
import { MURDER_CONFIG as C } from "./config";
import { COSMETIC_IDS, COSMETIC_SHOP, COSMETIC_SHOP_ID } from "./cosmetics";

export const COINS = 995;
export const BANK_INTERFACE_ID = WidgetGroup.BANK_MAIN;
export type StoreScreen = "store" | "bank";

export const isCosmetic = (itemId: number) => COSMETIC_IDS.has(itemId);
/** What the bank will take: your coins and your cosmetics. */
const isBankable = (itemId: number) => itemId === COINS || isCosmetic(itemId);

export class SinclairStore {
    private readonly bank: BankingManager;
    private readonly shop: ShopService;

    /**
     * @param canBrowse why this player can't open the store or bank right now (mid-game), or undefined
     */
    constructor(
        private readonly ss: GamemodeServerServices,
        private readonly canBrowse: (player: PlayerState) => string | undefined,
    ) {
        const bankingServices: BankingProviderServices = {
            ...ss,
            queueBankSnapshot: (playerId, payload) => ss.queueGamemodeSnapshot("bank", playerId, payload),
            sendBankSnapshot: (playerId, payload) => ss.queueGamemodeSnapshot("bank", playerId, payload),
        };
        this.bank = new BankingManager(bankingServices);
        const bm = this.bank;
        ss.registerSnapshotEncoder(
            "bank",
            (_playerId, payload) => ({ message: encodeMessage({ type: "bank", payload: payload as BankServerUpdate }), context: "bank_snapshot" }),
            (playerId) => {
                const player = ss.getPlayer(playerId);
                if (player) player.bank.setBankClientSlotMapping(bm.buildBankSlotMapping(player));
            },
        );
        this.shop = new ShopService({ serverServices: ss });
        this.shop.manager.registerDefinition(COSMETIC_SHOP);
        this.shop.manager.registerDefinition(butlerShop(this.pricedFor));
        const interfaceService = ss.getInterfaceService();
        if (interfaceService) {
            registerBankInterfaceHooks(interfaceService);
            registerShopInterfaceHooks(interfaceService);
        }
    }

    /** Which of the two is open for this player (the client hides the lobby window meanwhile). */
    openScreen(player: PlayerState): StoreScreen | undefined {
        const modal = this.ss.getInterfaceService()?.getCurrentModal(player);
        if (modal === SHOP_INTERFACE_ID) return this.shop.manager.getShopIdForPlayer(player) === COSMETIC_SHOP_ID ? "store" : undefined;
        return modal === BANK_INTERFACE_ID ? "bank" : undefined;
    }

    // ------------------------------------------------------------ the Demon butler
    /** Whether this player is looking at the Demon butler's pantry. */
    butlerOpen(player: PlayerState): boolean {
        return this.ss.getInterfaceService()?.getCurrentModal(player) === SHOP_INTERFACE_ID && this.atButler(player);
    }

    /** His Talk-to, during a game (index.ts decides when), priced for that game's household. */
    openButler(player: PlayerState, household: number): void {
        this.priceButler(household);
        this.shop.openShop(player, { shopId: BUTLER_SHOP_ID });
    }

    /** The household the pantry is priced for; a game of another size reprices it. */
    private pricedFor = 0;
    private priceButler(household: number): void {
        if (household === this.pricedFor) return;
        this.pricedFor = household;
        this.shop.manager.registerDefinition(butlerShop(household));
    }

    closeButler(player: PlayerState): void {
        if (this.butlerOpen(player)) this.shop.closeShop(player);
    }

    /**
     * A bot buys one of something by the shop's own rules (price, tokens, stock, pack space),
     * without the interface. True if it got it.
     */
    botBuy(player: PlayerState, itemId: number, household: number): boolean {
        this.priceButler(household);
        const slot = this.shop.manager.getShopSnapshot(BUTLER_SHOP_ID)?.stock.find((e) => e.itemId === itemId)?.slot;
        if (slot === undefined) return false;
        const before = this.tokens(player);
        this.shop.manager.openShopById(player, BUTLER_SHOP_ID);
        this.buyFromButler(player, { slotIndex: slot, quantity: 1 });
        this.shop.manager.closeShopForPlayer(player);
        return this.tokens(player) < before;
    }

    private atButler(player: PlayerState): boolean {
        return this.shop.manager.getShopIdForPlayer(player) === BUTLER_SHOP_ID;
    }

    private tokens(player: PlayerState): number {
        return this.ss.getInventory(player).reduce((n, e) => n + (e.itemId === CHORE_TOKEN ? e.quantity : 0), 0);
    }

    /** As many as asked for that the tokens cover (as OSRS shops do with coins), in tokens' words. */
    private buyFromButler(player: PlayerState, params: { slotIndex: number; quantity?: number }): void {
        const info = this.shop.manager.getShopSlotValue(player, params.slotIndex);
        if (!info) return this.shop.buyFromShop(player, params); // an empty slot: the shop says so
        const affordable = info.buyPrice > 0 ? Math.floor(this.tokens(player) / info.buyPrice) : Infinity;
        if (affordable < 1) return this.message(player, "You don't have enough IOUs. Finish a chore to earn more.");
        const wanted = params.quantity && params.quantity > 0 ? params.quantity : 1;
        if (info.itemId === RUNE_POUCH && !this.roomForRunes(player)) return this.message(player, "Not enough space in your inventory.");
        this.shop.buyFromShop(player, { slotIndex: params.slotIndex, quantity: Math.min(wanted, affordable) });
        this.emptyRunePouches(player);
        if (wanted > affordable) this.message(player, "You don't have enough IOUs for any more.");
    }

    /** The runes for Bind stack, so they need a pack slot only for each kind not already carried. */
    private roomForRunes(player: PlayerState): boolean {
        const pack = this.ss.getInventory(player);
        const needed = C.rewards.runes.filter(([id]) => !pack.some((e) => e.itemId === id && e.quantity > 0)).length;
        return pack.filter((e) => !(e.itemId > 0) || e.quantity <= 0).length >= Math.max(1, needed);
    }

    /** A bought rune pouch empties straight into the pack: the runes for one Bind. */
    private emptyRunePouches(player: PlayerState): void {
        const entries = player.getInventoryEntries();
        const pouches = entries.filter((e) => e.itemId === RUNE_POUCH);
        if (!pouches.length) return;
        for (const e of pouches) {
            e.itemId = -1;
            e.quantity = 0;
        }
        for (const [id, qty] of C.rewards.runes) this.ss.addItemToInventory(player, id, qty * pouches.length);
        this.ss.sendInventorySnapshot(player.id);
    }

    /** The shop buttons, with the butler's rules: tokens, no buying back. */
    private butlerShopping(shopping: ShoppingServices): ShoppingServices {
        const noSale = (player: PlayerState) => this.message(player, "The butler doesn't buy anything back.");
        const tokensText = (n: number) => (n === 1 ? "1 IOU" : `${n} IOUs`);
        return {
            ...shopping,
            buyFromShop: (player, params) => (this.atButler(player) ? this.buyFromButler(player, params) : shopping.buyFromShop?.(player, params)),
            sellToShop: (player, params) => (this.atButler(player) ? noSale(player) : shopping.sellToShop?.(player, params)),
            getShopSlotValue: (player, slotIndex) => {
                if (!this.atButler(player)) return shopping.getShopSlotValue?.(player, slotIndex);
                const info = this.shop.manager.getShopSlotValue(player, slotIndex);
                if (info) this.message(player, `${info.itemName}: currently costs ${tokensText(info.buyPrice)}.`);
                return undefined;
            },
            getInventoryItemSellValue: (player, itemId) => {
                if (!this.atButler(player)) return shopping.getInventoryItemSellValue?.(player, itemId);
                noSale(player);
                return undefined;
            },
        };
    }

    open(player: PlayerState, screen: StoreScreen): void {
        const why = this.canBrowse(player);
        if (why) {
            this.message(player, why);
            return;
        }
        if (screen === "store") this.shop.openShop(player, { shopId: COSMETIC_SHOP_ID });
        else this.bank.openBank(player, { mode: "bank" });
    }

    /** Shut whichever is open (a game starting). */
    close(player: PlayerState): void {
        const screen = this.openScreen(player);
        if (screen === "store") this.shop.closeShop(player);
        else if (screen === "bank") this.ss.getInterfaceService()?.closeModal(player);
    }

    /** The bank and shop services the OSRS interfaces' buttons call, with Sinclair's rules. */
    contributeScriptServices(services: ScriptServices): void {
        const bm = this.bank;
        const ss = this.ss;
        const bankOpen = (player: PlayerState) => this.openScreen(player) === "bank";
        const refuse = (player: PlayerState) => this.message(player, "The bank only keeps your coins and cosmetics.");
        const packItem = (player: PlayerState, slot: number) => ss.getInventory(player)[Math.trunc(slot)]?.itemId ?? -1;
        const banking: BankingServices = {
            openBank: (player) => this.open(player, "bank"),
            depositInventoryToBank: (player, tab) => {
                if (!bankOpen(player)) return false;
                let refused = false;
                ss.getInventory(player).forEach((entry, slot) => {
                    if (!(entry.itemId > 0)) return;
                    if (isBankable(entry.itemId)) bm.depositItem(player, slot, entry.quantity, entry.itemId, tab);
                    else refused = true;
                });
                if (refused) refuse(player);
                return true;
            },
            depositEquipmentToBank: (player, tab) => {
                if (!bankOpen(player)) return false;
                ss.getEquipArray(player).forEach((itemId, slot) => {
                    if (itemId > 0 && isBankable(itemId)) bm.depositEquipmentSlot(player, slot, tab);
                });
                return true;
            },
            depositEquipmentSlotToBank: (player, slot, tab) => {
                if (!bankOpen(player)) return false;
                if (!isBankable(ss.getEquipArray(player)[slot] ?? -1)) {
                    refuse(player);
                    return false;
                }
                return bm.depositEquipmentSlot(player, slot, tab);
            },
            removeEquipmentSlot: (player, slot) => bankOpen(player) && bm.removeEquipmentSlot(player, slot),
            depositInventoryItemToBank: (player, slot, quantity, opts) => {
                if (!bankOpen(player)) return { ok: false };
                if (!isBankable(packItem(player, slot))) return { ok: false, message: "The bank only keeps your coins and cosmetics." };
                return bm.depositItem(player, Math.trunc(slot), Math.trunc(quantity), opts?.itemIdHint, opts?.tab);
            },
            withdrawFromBankSlot: (player, slot, quantity, opts) =>
                bankOpen(player) ? bm.withdraw(player, slot, quantity, { overrideNoted: opts?.noted }) : { ok: false },
            getBankEntryAtClientSlot: (player, clientSlot) => bm.getBankEntryAtClientSlot(player, clientSlot),
            moveBankSlot: (player, from, to, opts) => bankOpen(player) && bm.moveBankSlot(player, from, to, opts),
            handleIfButtonD: (player, payload) => {
                if (!bankOpen(player)) return;
                // Dragging an item from your pack into the bank deposits it.
                const fromPack = payload.sourceWidgetId >>> 16 === WidgetGroup.BANK_SIDE;
                if (fromPack && !isBankable(packItem(player, payload.sourceSlot))) return refuse(player);
                bm.handleIfButtonD(player, payload);
            },
            queueBankSnapshot: (player) => bm.queueBankSnapshot(player),
            sendBankTabVarbits: (player) => bm.sendBankTabVarbits(player),
            setCurrentTab: (player, tabIndex) => bm.setCurrentTab(player, tabIndex),
            setTabDisplayMode: (player, mode) => bm.setTabDisplayMode(player, mode),
            collapseTab: (player, tabIndex) => bankOpen(player) && bm.collapseTab(player, tabIndex),
            releasePlaceholder: (player, slot, itemIdHint) => bankOpen(player) && bm.releasePlaceholder(player, slot, itemIdHint),
            releasePlaceholders: (player, tabIndex) => (bankOpen(player) ? bm.releasePlaceholders(player, tabIndex) : 0),
        };
        services.banking = banking;
        services.shopping = this.butlerShopping(this.shop.createScriptServices());
        // The close button (X) of each interface.
        const closeHandlers = services.widgetCloseHandlers ?? new Map();
        closeHandlers.set(SHOP_INTERFACE_ID, (player: PlayerState) => this.shop.closeShop(player));
        closeHandlers.set(BANK_INTERFACE_ID, (player: PlayerState) => ss.getInterfaceService()?.closeModal(player));
        services.widgetCloseHandlers = closeHandlers;
    }

    private message(player: PlayerState, text: string): void {
        this.ss.queueChatMessage({ messageType: "game", text, targetPlayerIds: [player.id] });
    }
}

/**
 * The interfaces' own buttons (buy, sell, deposit, withdraw, tabs...) and the menu's two buttons.
 * Registered before the gamemode is initialized, so everything goes through `services` and `open`.
 */
export function registerStoreHandlers(
    registry: IScriptRegistry,
    services: ScriptServices,
    open: (player: PlayerState, screen: StoreScreen) => void,
): void {
    registerBankWidgetHandlers(registry, services);
    registerShopWidgetHandlers(registry, services);
    // The bank interface's own drag-and-drop and deposit buttons arrive as client messages.
    registry.registerClientMessageHandler("bank_deposit_inventory", ({ player, payload, services }) => {
        const tab = typeof payload.tab === "number" && payload.tab > 0 ? payload.tab : undefined;
        services.banking?.depositInventoryToBank?.(player, tab);
    });
    registry.registerClientMessageHandler("bank_deposit_equipment", ({ player, payload, services }) => {
        const tab = typeof payload.tab === "number" && payload.tab > 0 ? payload.tab : undefined;
        services.banking?.depositEquipmentToBank?.(player, tab);
    });
    registry.registerClientMessageHandler("bank_deposit_item", ({ player, payload, services }) => {
        const slot = typeof payload.slot === "number" ? payload.slot : -1;
        const quantity = typeof payload.quantity === "number" ? payload.quantity : 0;
        const itemIdHint = typeof payload.itemId === "number" ? payload.itemId : undefined;
        const tab = typeof payload.tab === "number" && payload.tab > 0 ? payload.tab : undefined;
        const result = services.banking?.depositInventoryItemToBank?.(player, slot, quantity, { itemIdHint, tab });
        if (result && !result.ok && result.message) services.messaging.sendGameMessage(player, result.message);
    });
    registry.registerClientMessageHandler("bank_move", ({ player, payload, services }) => {
        const from = Number(payload.from);
        const to = Number(payload.to);
        const insert = payload.mode === "insert" ? true : payload.mode === "swap" ? false : player.bank.getBankInsertMode();
        const tab = typeof payload.tab === "number" ? payload.tab : undefined;
        if (!services.banking?.getBankEntryAtClientSlot?.(player, from)) return;
        services.banking?.moveBankSlot?.(player, from, to, { insert, tab });
    });
    registry.registerClientMessageHandler("if_buttond", ({ player, payload, services }) => {
        services.banking?.handleIfButtonD?.(player, {
            sourceWidgetId: Number(payload.sourceWidgetId),
            sourceSlot: Number(payload.sourceSlot),
            sourceItemId: Number(payload.sourceItemId),
            targetWidgetId: Number(payload.targetWidgetId),
            targetSlot: Number(payload.targetSlot),
            targetItemId: Number(payload.targetItemId),
        });
    });
    // The main menu's Store and Bank buttons.
    registry.registerClientMessageHandler("sinclair_store", ({ player, payload }) => {
        if (payload.open === "store" || payload.open === "bank") open(player, payload.open);
    });
}
