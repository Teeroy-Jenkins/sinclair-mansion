import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

import { logger } from "../../utils/logger";

const DEFAULT_DATABASE_FILENAME = "game.sqlite";
const LEGACY_ACCOUNTS_MIGRATION = "legacy-accounts-json-v1";
const LEGACY_PLAYER_STATES_MIGRATION = "legacy-player-states-json-v1";

type JsonRecord = Record<string, unknown>;

type LegacyAccount = {
    passwordAlgorithm: "scrypt";
    passwordSalt: string;
    passwordHash: string;
    createdAt: string;
    passwordChangedAt: string;
};

function isJsonRecord(value: unknown): value is JsonRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeLegacyAccountName(name: string): string | undefined {
    const normalized = name.trim().toLowerCase();
    if (normalized.length < 1 || normalized.length > 12) return undefined;
    return /^[a-z0-9 _-]+$/.test(normalized) ? normalized : undefined;
}

function isLegacyAccount(value: unknown): value is LegacyAccount {
    if (!isJsonRecord(value)) return false;
    return (
        value.passwordAlgorithm === "scrypt" &&
        typeof value.passwordSalt === "string" &&
        typeof value.passwordHash === "string" &&
        typeof value.createdAt === "string" &&
        typeof value.passwordChangedAt === "string"
    );
}

export interface SqliteDatabaseOptions {
    dataDir: string;
    databasePath?: string;
}

/**
 * Shared SQLite connection for a gamemode's durable game data.
 *
 * Account credentials and player state intentionally use separate tables, but
 * live in the same SQLite file so a local server only needs one database to
 * back up and manage.
 */
export class SqliteDatabase {
    readonly databasePath: string;
    readonly connection: DatabaseSync;

    constructor(options: SqliteDatabaseOptions) {
        this.databasePath = options.databasePath
            ? path.resolve(options.databasePath)
            : path.resolve(options.dataDir, DEFAULT_DATABASE_FILENAME);

        fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
        this.connection = new DatabaseSync(this.databasePath);
        this.connection.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
            PRAGMA synchronous = NORMAL;

            CREATE TABLE IF NOT EXISTS accounts (
                username TEXT PRIMARY KEY,
                password_algorithm TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                permission_level TEXT NOT NULL DEFAULT 'player',
                created_at TEXT NOT NULL,
                password_changed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS player_states (
                account_name TEXT PRIMARY KEY,
                state_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS schema_migrations (
                migration_id TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pending_trade_refunds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_name TEXT NOT NULL,
                item_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_pending_trade_refunds_account
                ON pending_trade_refunds (account_name, id);

            CREATE TABLE IF NOT EXISTS active_trade_escrows (
                session_id TEXT NOT NULL,
                account_name TEXT NOT NULL,
                item_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (session_id, account_name, item_id)
            );

            CREATE INDEX IF NOT EXISTS idx_active_trade_escrows_account
                ON active_trade_escrows (account_name, session_id);

            CREATE TABLE IF NOT EXISTS friends_chat_settings (
                owner_key TEXT PRIMARY KEY,
                owner_name TEXT NOT NULL,
                channel_name TEXT,
                entry_rank INTEGER NOT NULL DEFAULT -1,
                talk_rank INTEGER NOT NULL DEFAULT -1,
                kick_rank INTEGER NOT NULL DEFAULT 2,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS social_friends (
                owner_key TEXT NOT NULL,
                friend_key TEXT NOT NULL,
                friend_name TEXT NOT NULL,
                rank INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (owner_key, friend_key)
            );

            CREATE TABLE IF NOT EXISTS social_ignores (
                owner_key TEXT NOT NULL,
                ignored_key TEXT NOT NULL,
                ignored_name TEXT NOT NULL,
                PRIMARY KEY (owner_key, ignored_key)
            );

            CREATE TABLE IF NOT EXISTS friends_chat_last_channels (
                account_key TEXT PRIMARY KEY,
                owner_key TEXT NOT NULL
            );

            CREATE TRIGGER IF NOT EXISTS validate_pending_trade_refund_insert
            BEFORE INSERT ON pending_trade_refunds
            WHEN NEW.item_id <= 0
                OR NEW.quantity <= 0
                OR NEW.quantity > 2147483647
            BEGIN
                SELECT RAISE(ABORT, 'invalid pending trade refund');
            END;

            CREATE TRIGGER IF NOT EXISTS validate_pending_trade_refund_update
            BEFORE UPDATE OF item_id, quantity ON pending_trade_refunds
            WHEN NEW.item_id <= 0
                OR NEW.quantity <= 0
                OR NEW.quantity > 2147483647
            BEGIN
                SELECT RAISE(ABORT, 'invalid pending trade refund');
            END;

            CREATE TRIGGER IF NOT EXISTS validate_active_trade_escrow_insert
            BEFORE INSERT ON active_trade_escrows
            WHEN NEW.item_id <= 0
                OR NEW.quantity <= 0
                OR NEW.quantity > 2147483647
            BEGIN
                SELECT RAISE(ABORT, 'invalid active trade escrow');
            END;

            CREATE TRIGGER IF NOT EXISTS validate_active_trade_escrow_update
            BEFORE UPDATE OF item_id, quantity ON active_trade_escrows
            WHEN NEW.item_id <= 0
                OR NEW.quantity <= 0
                OR NEW.quantity > 2147483647
            BEGIN
                SELECT RAISE(ABORT, 'invalid active trade escrow');
            END;

            PRAGMA user_version = 1;
        `);
        const accountColumns = this.connection.prepare("PRAGMA table_info(accounts)").all() as Array<{
            name: string;
        }>;
        if (!accountColumns.some((column) => column.name === "permission_level")) {
            this.connection.exec(
                "ALTER TABLE accounts ADD COLUMN permission_level TEXT NOT NULL DEFAULT 'player'",
            );
        }
        this.migrateLegacyJsonFiles(options.dataDir);
    }

    /**
     * Imports the pre-SQLite account and character files once, preserving the
     * JSON sources as a rollback backup. SQLite always wins on key conflicts.
     */
    private migrateLegacyJsonFiles(dataDir: string): void {
        this.migrateLegacyAccounts(path.resolve(dataDir, "accounts.json"));
        this.migrateLegacyPlayerStates(path.resolve(dataDir, "player-state.json"));
    }

    private migrateLegacyAccounts(filePath: string): void {
        if (this.isMigrationApplied(LEGACY_ACCOUNTS_MIGRATION) || !fs.existsSync(filePath)) {
            return;
        }

        const parsed = this.readLegacyJson(filePath);
        if (!isJsonRecord(parsed) || parsed.version !== 1 || !isJsonRecord(parsed.accounts)) {
            throw new Error(`Invalid legacy account store: ${filePath}`);
        }

        let imported = 0;
        this.connection.exec("BEGIN IMMEDIATE");
        try {
            const insertAccount = this.connection.prepare(
                `INSERT INTO accounts (
                    username,
                    password_algorithm,
                    password_salt,
                    password_hash,
                    created_at,
                    password_changed_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(username) DO NOTHING`,
            );
            for (const [rawName, rawAccount] of Object.entries(parsed.accounts)) {
                const accountName = normalizeLegacyAccountName(rawName);
                if (!accountName || !isLegacyAccount(rawAccount)) continue;
                const result = insertAccount.run(
                    accountName,
                    rawAccount.passwordAlgorithm,
                    rawAccount.passwordSalt,
                    rawAccount.passwordHash,
                    rawAccount.createdAt,
                    rawAccount.passwordChangedAt,
                ) as { changes?: number };
                if (result.changes === 1) imported++;
            }
            this.recordMigration(LEGACY_ACCOUNTS_MIGRATION);
            this.connection.exec("COMMIT");
        } catch (err) {
            this.rollbackMigration();
            throw err;
        }

        logger.info(
            `[persistence] Imported ${imported} legacy account record(s) from accounts.json`,
        );
    }

    private migrateLegacyPlayerStates(filePath: string): void {
        if (this.isMigrationApplied(LEGACY_PLAYER_STATES_MIGRATION) || !fs.existsSync(filePath)) {
            return;
        }

        const parsed = this.readLegacyJson(filePath);
        if (!isJsonRecord(parsed)) {
            throw new Error(`Invalid legacy player state store: ${filePath}`);
        }

        let imported = 0;
        const updatedAt = new Date().toISOString();
        this.connection.exec("BEGIN IMMEDIATE");
        try {
            const insertState = this.connection.prepare(
                `INSERT INTO player_states (account_name, state_json, updated_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(account_name) DO NOTHING`,
            );
            for (const [rawName, state] of Object.entries(parsed)) {
                const accountName = normalizeLegacyAccountName(rawName);
                if (!accountName || !isJsonRecord(state)) continue;
                const result = insertState.run(accountName, JSON.stringify(state), updatedAt) as {
                    changes?: number;
                };
                if (result.changes === 1) imported++;
            }
            this.recordMigration(LEGACY_PLAYER_STATES_MIGRATION);
            this.connection.exec("COMMIT");
        } catch (err) {
            this.rollbackMigration();
            throw err;
        }

        logger.info(
            `[persistence] Imported ${imported} legacy player state record(s) from player-state.json`,
        );
    }

    private readLegacyJson(filePath: string): unknown {
        try {
            return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
        } catch (err) {
            throw new Error(
                `Could not read legacy JSON file ${filePath}: ${
                    err instanceof Error ? err.message : String(err)
                }`,
            );
        }
    }

    private isMigrationApplied(migrationId: string): boolean {
        return (
            this.connection
                .prepare("SELECT 1 FROM schema_migrations WHERE migration_id = ?")
                .get(migrationId) !== undefined
        );
    }

    private recordMigration(migrationId: string): void {
        this.connection
            .prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)")
            .run(migrationId, new Date().toISOString());
    }

    private rollbackMigration(): void {
        try {
            this.connection.exec("ROLLBACK");
        } catch {
            // The migration error is more useful to callers than a rollback error.
        }
    }
}

const databaseInstances = new Map<string, SqliteDatabase>();

/** Return one shared connection for each database file in this server process. */
export function getSqliteDatabase(options: SqliteDatabaseOptions): SqliteDatabase {
    const databasePath = options.databasePath
        ? path.resolve(options.databasePath)
        : path.resolve(options.dataDir, DEFAULT_DATABASE_FILENAME);
    let database = databaseInstances.get(databasePath);
    if (!database) {
        database = new SqliteDatabase({ ...options, databasePath });
        databaseInstances.set(databasePath, database);
    }
    return database;
}
