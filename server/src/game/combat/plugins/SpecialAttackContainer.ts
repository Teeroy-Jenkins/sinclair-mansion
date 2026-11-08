import fs from "node:fs";
import path from "node:path";

import type { WeaponSpecialAttackScript } from "./WeaponSpecialAttackScript";

type SpecialAttackModule = Record<string, unknown>;

/**
 * Item-ID registry for decoupled weapon special-attack scripts.
 *
 * initialize() scans the sibling special-attacks directory at startup and
 * registers every exported WeaponSpecialAttackScript instance it finds. New
 * weapon files therefore require no edits to this container or a central list.
 */
export class SpecialAttackContainer {
    private static readonly scripts = new Map<number, WeaponSpecialAttackScript>();
    private static initialized = false;

    static initialize(): void {
        if (this.initialized) return;

        this.initialized = true;
        try {
            const directory = path.join(__dirname, "special-attacks");
            const modulePaths = this.discoverModulePaths(directory);
            for (const modulePath of modulePaths) {
                const loaded = require(modulePath) as SpecialAttackModule;
                this.registerExportedValues(Object.values(loaded));
            }
        } catch (error) {
            this.scripts.clear();
            this.initialized = false;
            throw error;
        }
    }

    static register(script: WeaponSpecialAttackScript): void {
        const itemId = this.normalizeItemId(script.itemId);
        const energyCost = this.normalizeEnergyCost(script.energyCost);
        const existing = this.scripts.get(itemId);
        if (existing === script) return;
        if (existing) {
            throw new Error(`Special attack script already registered for item ${itemId}`);
        }
        if (energyCost !== script.energyCost) {
            throw new RangeError(
                `Special attack energy cost for item ${itemId} must be an integer from 0 to 100`,
            );
        }
        this.scripts.set(itemId, script);
    }

    static get(itemId: number): WeaponSpecialAttackScript | undefined {
        this.initialize();
        if (!Number.isFinite(itemId)) return undefined;
        return this.scripts.get(Math.trunc(itemId));
    }

    static has(itemId: number): boolean {
        return this.get(itemId) !== undefined;
    }

    static getAll(): readonly WeaponSpecialAttackScript[] {
        this.initialize();
        return Object.freeze([...this.scripts.values()]);
    }

    private static discoverModulePaths(directory: string): readonly string[] {
        const filesByStem = new Map<string, string>();
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            if (entry.name === "index.ts" || entry.name === "index.js") continue;
            if (entry.name.endsWith(".d.ts")) continue;
            if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".js")) continue;

            const extension = path.extname(entry.name);
            const stem = entry.name.slice(0, -extension.length);
            const existing = filesByStem.get(stem);
            if (!existing || extension === ".js") {
                filesByStem.set(stem, path.join(directory, entry.name));
            }
        }
        return Object.freeze([...filesByStem.values()].sort());
    }

    private static registerExportedValues(values: readonly unknown[]): void {
        for (const value of values) {
            if (Array.isArray(value)) {
                this.registerExportedValues(value);
                continue;
            }
            if (this.isWeaponSpecialAttackScript(value)) {
                this.register(value);
            }
        }
    }

    private static isWeaponSpecialAttackScript(value: unknown): value is WeaponSpecialAttackScript {
        if (!value || typeof value !== "object") return false;
        const candidate = value as Partial<WeaponSpecialAttackScript>;
        return (
            typeof candidate.itemId === "number" &&
            typeof candidate.energyCost === "number" &&
            typeof candidate.modifyAttackTraits === "function" &&
            typeof candidate.onHitApplied === "function"
        );
    }

    private static normalizeItemId(itemId: number): number {
        if (!Number.isFinite(itemId) || itemId < 0 || Math.trunc(itemId) !== itemId) {
            throw new RangeError(`Special attack item id must be a non-negative integer`);
        }
        return itemId;
    }

    private static normalizeEnergyCost(energyCost: number): number {
        if (!Number.isFinite(energyCost)) return -1;
        return Math.max(0, Math.min(100, Math.trunc(energyCost)));
    }
}
