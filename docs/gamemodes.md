# Gamemodes

A gamemode defines the **identity of a server**. It controls the rules, progression, and feel of the game. Each server runs exactly one gamemode.

Gamemodes live in `server/gamemodes/{id}/` and export a `createGamemode()` function that returns a `GamemodeDefinition`.

## What a gamemode controls

- XP multipliers and drop rates
- Spawn location and tutorial flow
- Player initialization and state serialization
- Login handshake (varps, varbits, feature flags)
- Per-tick hooks and interaction restrictions
- Handler registration (banking, shops, equipment, UI widgets, content interactions)
- Display name formatting and chat player types
- Custom content data packets
- Service providers exposed to script handlers

## Inheritance Chain

```
BaseGamemode (abstract — sensible OSRS defaults, no content)
  └─ SinclairBase (lean engine hooks — combat providers, login varbits, door/NPC handlers)
       └─ SinclairMansionGamemode (Among Us-style murder mystery rules)
       └─ YourGamemode (your customizations on top of SinclairBase)
```

There are two paths for creating a gamemode:

| Base class        | When to use                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BaseGamemode`    | Building from scratch. You get valid defaults but no content — no banking, no shops, no skills. Suitable for minigame servers or highly custom experiences. |
| `SinclairBase`    | Most common. You inherit combat providers, login varbits, door/NPC handlers, and engine hooks. Extend this for your gamemode.                            |

## Bundled Gamemodes

| Gamemode           | Base              | Description                                                                                                    |
| ------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `sinclair-mansion` | `SinclairBase`    | Among Us-style murder mystery — roles, chores, evidence, arrest phase                                          |
| `dev`              | `BaseGamemode`    | XRSPS's dev gamemode for engine testing; Sinclair Mansion reuses its combat data, shops and bank               |

## Creating a Gamemode

### 1. Create the directory

```
server/gamemodes/my-gamemode/
  index.ts
```

The `GamemodeRegistry` discovers gamemodes by scanning `server/gamemodes/` for directories containing an `index.ts` or `index.js` that exports `createGamemode()`.

### 2. Write the gamemode class

#### Extending SinclairBase (recommended)

```typescript
// server/gamemodes/my-gamemode/index.ts
import type {
    GamemodeDefinition,
    GamemodeInitContext,
} from "../../src/game/gamemodes/GamemodeDefinition";
import type { PlayerState } from "../../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../../src/game/scripts/types";
import { SinclairBase } from "../sinclair-mansion/sinclair-base";

class MyGamemode extends SinclairBase {
    override readonly id = "my-gamemode";
    override readonly name = "My Gamemode";

    override getSkillXpMultiplier(): number {
        return 10;
    }

    override getDropRateMultiplier(): number {
        return 3;
    }

    override initializePlayer(player: PlayerState): void {
        player.energy.drainEnabled = false;
    }

    override registerHandlers(registry: IScriptRegistry, services: ScriptServices): void {
        super.registerHandlers(registry, services); // inherit engine hooks
        // register your own handlers here
    }

    override initialize(context: GamemodeInitContext): void {
        super.initialize(context); // register combat providers, login varbits
        // initialize your own systems here
    }
}

export function createGamemode(): GamemodeDefinition {
    return new MyGamemode();
}
```

This gives you combat providers, login varbits, door/NPC handlers, and engine hooks with 10x XP and 3x drop rates.

#### Extending BaseGamemode (from scratch)

```typescript
// server/gamemodes/my-gamemode/index.ts
import { BaseGamemode } from "../../src/game/gamemodes/BaseGamemode";
import type { GamemodeDefinition } from "../../src/game/gamemodes/GamemodeDefinition";

class MyGamemode extends BaseGamemode {
    readonly id = "my-gamemode";
    readonly name = "My Gamemode";

    override getSkillXpMultiplier(): number {
        return 5; // 5x XP
    }
}

export function createGamemode(): GamemodeDefinition {
    return new MyGamemode();
}
```

This gives you a working gamemode with 5x XP and all other OSRS defaults (Lumbridge spawn, no tutorial, standard drop rates). It won't have banking, shops, or skills — you'd register those yourself.

### 3. Run your gamemode

Set the gamemode ID in your server configuration:

- **config.json:** `{ "gamemode": "my-gamemode" }`
- **Environment variable:** `GAMEMODE=my-gamemode`

The default gamemode is `sinclair-mansion`.

## Where Logic Should Live

| Logic type                                            | Location                                                                   | Example                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Engine systems (ticks, networking, player sync)       | `server/src/`                                                              | Collision, pathfinding, packet routing             |
| Pluggable data providers (combat formulas, spells)    | `server/src/game/providers/` interfaces, `sinclair-mansion/` implementations | CombatFormulaProvider, SpellDataProvider           |
| Reusable services (shop orchestration, banking)       | Service classes in the gamemode (`dev/shops/ShopService.ts`)              | ShopService wraps ShopManager + server integration |
| Gamemode-specific rules (XP rates, tutorials)         | `server/gamemodes/{id}/index.ts` overrides                                 | Custom XP multiplier, role logic                   |
| Universal tools (debug commands, admin)               | `server/extrascripts/{id}/`                                                | item-spawner                                       |

Keep gamemode `index.ts` files thin — they should wire systems together, not implement them. Extract complex logic into dedicated service classes (like `ShopService`) so the gamemode just instantiates and connects them.

## Structure

```
server/gamemodes/sinclair-mansion/
├── index.ts                    # SinclairMansionGamemode (extends SinclairBase)
├── sinclair-base.ts            # Lean base class — combat providers, login varbits, engine hooks
├── MurderGame.ts               # Game rules: roles, phases, evidence, arrest
├── mansion.ts                  # Map data: rooms, containers, tasks, spawns
├── bots.ts                     # Bot AI: roles, plans, weapons, listening to chat, voting
├── botLooks.ts                 # Each bot's look, seeded by name
├── botChat.ts                  # Bot personas and every line they say
├── hud.ts                      # HUD state management
├── rooms.ts                    # Rooms: codes, host / join / leave, host hand-over
├── butler.ts                   # The Demon butler: wares and token prices
├── store.ts                    # Main-menu Store and Bank (engine's OSRS shop + bank), the butler's shop
├── cosmetics.ts                # Cosmetic store stock and prices, toy handlers
├── progression.ts              # Coins, cosmetics and bank saved in the player's browser
├── config.ts                   # Every gameplay tunable (times, coins, stats, bots)
├── discovery.ts                # Server discovery (LAN/remote)
├── upnp.ts                     # Optional UPnP port forwarding (SINCLAIR_UPNP=1)
└── room-map.json               # Mansion layout data
```

## Handler Registration

Gamemodes register interaction handlers via `registerHandlers()`. The `IScriptRegistry` supports 86+ handler types including NPC interactions, loc interactions, item actions, widget buttons, commands, and more.

```typescript
override registerHandlers(registry: IScriptRegistry, services: ScriptServices): void {
    super.registerHandlers(registry, services); // inherit parent handlers
    registerMyNpcHandlers(registry, services);
    registerMyWidgetHandlers(registry, services);
}
```

Handlers registered by the gamemode run first. Extrascript handlers are loaded after.

## Service Providers

Gamemodes can create stateful managers and expose them to script handlers via `contributeScriptServices()`:

```typescript
override initialize(context: GamemodeInitContext): void {
    super.initialize(context);
    this.bankingManager = new BankingManager(context.serverServices);
}

contributeScriptServices(services: ScriptServices): void {
    services.banking = {
        openBank: (player, opts) => this.bankingManager.openBank(player, opts),
        // ...
    };
}
```

Handlers then access these via `services.banking.openBank(player)` without knowing about the underlying manager.

## Global Providers

SinclairBase registers 13 global data providers during `initialize()` that power the core combat and spell systems. Each provider is a singleton registered to the `ProviderRegistry` — the last call wins, so you can replace any provider after `super.initialize()`.

| Provider                        | Create function                         | Source file                                       |
| ------------------------------- | --------------------------------------- | ------------------------------------------------- |
| `CombatFormulaProvider`         | `createCombatFormulaProvider()`         | `sinclair-mansion/../dev/combat/CombatFormulas.ts` |
| `WeaponDataProvider`            | `createWeaponDataProvider()`            | `sinclair-mansion/../dev/data/weapons.ts`     |
| `SpecialAttackProvider`         | `createSpecialAttackProvider()`         | `sinclair-mansion/../dev/combat/SpecialAttackRegistry.ts` |
| `EquipmentBonusProvider`        | `createEquipmentBonusProvider()`        | `sinclair-mansion/../dev/combat/EquipmentBonuses.ts` |
| `SpellDataProvider`             | `createSpellDataProvider()`             | `sinclair-mansion/../dev/data/spells.ts`      |
| `SpellXpProvider`               | `createSpellXpProvider()`               | `sinclair-mansion/../dev/combat/SpellXpData.ts` |
| `RuneDataProvider`              | `createRuneDataProvider()`              | `sinclair-mansion/../dev/data/runes.ts`       |
| `ProjectileParamsProvider`      | `createProjectileParamsProvider()`      | `sinclair-mansion/../dev/data/projectileParams.ts` |
| `SkillConfigurationProvider`    | `createSkillConfiguration()`            | `sinclair-mansion/../dev/combat/SkillConfiguration.ts` |
| `CombatStyleSequenceProvider`   | `createCombatStyleSequenceProvider()`   | `sinclair-mansion/../dev/combat/CombatStyleSequences.ts` |
| `SpecialAttackVisualProvider`   | `createSpecialAttackVisualProvider()`   | `sinclair-mansion/../dev/combat/SpecialAttackVisuals.ts` |
| `InstantUtilitySpecialProvider` | `createInstantUtilitySpecialProvider()` | `sinclair-mansion/../dev/combat/RockKnockerSpecial.ts` |
| `AmmoDataProvider`              | `createDefaultAmmoDataProvider()`       | `server/src/game/combat/AmmoSystem.ts`            |

Gamemodes extending SinclairBase inherit all of these via `super.initialize()`. Gamemodes extending BaseGamemode directly must register their own providers if they need combat.

### Customizing a provider

To override a specific provider while keeping the rest, call `super.initialize()` then re-register just the one you want to change. The last `register` call wins.

**Replace entirely** — write your own implementation of the interface:

```typescript
import { getProviderRegistry } from "../../src/game/providers/ProviderRegistry";

// inside your gamemode class:
override initialize(context: GamemodeInitContext): void {
    super.initialize(context); // registers all 13 dev providers

    // Replace combat formulas with custom ones
    const registry = getProviderRegistry();
    registry.combatFormula = {
        maxHit: (player, target) => 99,  // everyone hits 99s
        hitChance: () => 1.0,            // never miss
        // ... implement remaining CombatFormulaProvider methods
    };
}
```

**Wrap SinclairBase's provider** — import the create function, spread it, and override specific methods:

```typescript
import { getProviderRegistry } from "../../src/game/providers/ProviderRegistry";
import { createCombatFormulaProvider } from "../sinclair-mansion/../dev/combat/CombatFormulas";

// inside your gamemode class:
override initialize(context: GamemodeInitContext): void {
    super.initialize(context);

    const registry = getProviderRegistry();
    const base = createCombatFormulaProvider();
    registry.combatFormula = {
        ...base,
        maxHit: (player, target) => base.maxHit(player, target) * 2, // double max hit
    };
}
```

**Reuse providers from BaseGamemode** — if you extend BaseGamemode but still want standard OSRS combat:

```typescript
import { getProviderRegistry } from "../../src/game/providers/ProviderRegistry";
import { createCombatFormulaProvider } from "../sinclair-mansion/../dev/combat/CombatFormulas";
import { createWeaponDataProvider } from "../sinclair-mansion/../dev/data/weapons";

// inside your gamemode class:
override initialize(context: GamemodeInitContext): void {
    // No super.initialize() — BaseGamemode's is a no-op

    // Cherry-pick the providers you need
    const registry = getProviderRegistry();
    registry.combatFormula = createCombatFormulaProvider();
    registry.weaponData = createWeaponDataProvider();
    // ... register only the providers you need
}
```

### Provider lifecycle

Providers are cleaned up when `dispose()` is called on the gamemode. SinclairBase's `dispose()` calls `resetProviderRegistry()` which clears all providers at once. If your gamemode extends SinclairBase, call `super.dispose()` at the end of your own `dispose()`:

```typescript
override dispose(): void {
    // Clean up your own state first
    this.myManager = undefined;
    super.dispose(); // resets all providers
}
```

## GamemodeDefinition Interface

The full interface is defined in `server/src/game/gamemodes/GamemodeDefinition.ts`. Required methods that BaseGamemode provides defaults for:

| Method                     | Default                   |
| -------------------------- | ------------------------- |
| `getSkillXpMultiplier()`   | `1`                       |
| `getDropRateMultiplier()`  | `1`                       |
| `transformDropItemId()`    | passthrough               |
| `canInteract()`            | `true`                    |
| `initializePlayer()`       | no-op                     |
| `serializePlayerState()`   | `undefined`               |
| `deserializePlayerState()` | no-op                     |
| `onNpcKill()`              | no-op                     |
| `isTutorialActive()`       | `false`                   |
| `getSpawnLocation()`       | Lumbridge (3222, 3218, 0) |
| `onPlayerHandshake()`      | no-op                     |
| `onPlayerLogin()`          | no-op                     |
| `getPlayerTypes()`         | `[PlayerType.Normal]`     |
| `registerHandlers()`       | no-op                     |
| `initialize()`             | no-op                     |

Optional hooks (not required, return `undefined` if absent):

`getDefaultSkillXp`, `getSkillXpAward`, `getDropTable`, `getSupplementalDrops`, `getLootDistributionConfig`, `canInteractWithNpc`, `onItemCraft`, `getLoginVarbits`, `getLoginVarps`, `isTutorialPreStart`, `onPlayerRestore`, `onPostDesignComplete`, `resolveAccountStage`, `onVarpTransmit`, `onWidgetOpen`, `onResumePauseButton`, `onPlayerTick`, `onPlayerDisconnect`, `getGamemodeServices`, `contributeScriptServices`, `createUiController`, `getContentDataPacket`, `dispose`
