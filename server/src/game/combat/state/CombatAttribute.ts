/**
 * A typed key for a value stored in {@link CombatAttributeStore}.
 *
 * Keys are compared by object identity. The private type marker makes the value
 * type part of the key at compile time without adding runtime state.
 */
export class CombatAttribute<T> {
    declare private readonly valueType: (value: T) => T;

    constructor(
        readonly name: string,
        private readonly defaultValueFactory: () => T,
    ) {
        if (name.trim().length === 0) {
            throw new Error("Combat attribute names must not be empty");
        }
    }

    createDefaultValue(): T {
        return this.defaultValueFactory();
    }

    toString(): string {
        return `CombatAttribute(${this.name})`;
    }
}

/** Creates a typed combat attribute key with a lazily evaluated default value. */
export function combatAttribute<T>(name: string, defaultValueFactory: () => T): CombatAttribute<T> {
    return new CombatAttribute(name, defaultValueFactory);
}
