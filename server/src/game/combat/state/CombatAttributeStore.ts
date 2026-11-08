import type { CombatAttribute } from "./CombatAttribute";

/**
 * Heterogeneous, type-safe storage for combat state.
 *
 * The attribute key carries the value type, so callers cannot read or write a
 * value using an incompatible type. Defaults are materialized on first read,
 * which also gives future mutable default values stable identity per entity.
 */
export class CombatAttributeStore {
    private readonly values = new Map<object, unknown>();

    get<T>(attribute: CombatAttribute<T>): T {
        if (this.values.has(attribute)) {
            return this.values.get(attribute) as T;
        }

        const defaultValue = attribute.createDefaultValue();
        this.values.set(attribute, defaultValue);
        return defaultValue;
    }

    set<T>(attribute: CombatAttribute<T>, value: NoInfer<T>): this {
        this.values.set(attribute, value);
        return this;
    }

    has<T>(attribute: CombatAttribute<T>): boolean {
        return this.values.has(attribute);
    }

    /** Returns the stored value without materializing the attribute's default. */
    getIfPresent<T>(attribute: CombatAttribute<T>): T | undefined {
        return this.values.get(attribute) as T | undefined;
    }

    /** Removes a stored value so the next read recreates its default. */
    reset<T>(attribute: CombatAttribute<T>): boolean {
        return this.values.delete(attribute);
    }

    clear(): void {
        this.values.clear();
    }

    get size(): number {
        return this.values.size;
    }
}
