import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

import {
    ACCOUNT_NAME_PATTERN,
    MAX_ACCOUNT_NAME_LENGTH,
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
} from "../../../client/common/authentication";
import { type SqliteDatabase, getSqliteDatabase } from "../game/state/SqliteDatabase";
import {
    type PlayerPermission,
    normalizePlayerPermission,
} from "./PlayerPermission";

const PASSWORD_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
    cost: 1 << 14,
    blockSize: 8,
    parallelization: 1,
    maxmem: 64 * 1024 * 1024,
};

type StoredAccount = {
    passwordAlgorithm: "scrypt";
    passwordSalt: string;
    passwordHash: string;
    createdAt: string;
    passwordChangedAt: string;
};

export type AccountAuthenticationResult =
    | { ok: true; created: boolean; accountName: string }
    | { ok: false };

export interface AccountStoreOptions {
    dataDir: string;
    databasePath?: string;
}

/**
 * Normalizes the name used for account credentials and player persistence.
 * Account names remain compatible with the 12-character RuneScape display-name limit.
 */
export function normalizeAccountName(name: string | undefined): string | undefined {
    const normalized = (name ?? "").trim().toLowerCase();
    if (normalized.length < 1 || normalized.length > MAX_ACCOUNT_NAME_LENGTH) return undefined;
    if (!ACCOUNT_NAME_PATTERN.test(normalized)) return undefined;
    return normalized;
}

function isValidPassword(password: string | undefined): password is string {
    return (
        typeof password === "string" &&
        password.length >= MIN_PASSWORD_LENGTH &&
        password.length <= MAX_PASSWORD_LENGTH
    );
}

/**
 * Persistent SQLite credential store for a single gamemode.
 *
 * Only a random salt and an scrypt-derived hash are written to the database.
 * Passwords are never stored or logged in plaintext.
 */
export class AccountStore {
    private readonly database: SqliteDatabase;

    constructor(options: AccountStoreOptions) {
        this.database = getSqliteDatabase(options);
    }

    authenticate(
        username: string | undefined,
        password: string | undefined,
        allowRegistration: boolean,
    ): AccountAuthenticationResult {
        const accountName = normalizeAccountName(username);
        if (!accountName || !isValidPassword(password)) {
            return { ok: false };
        }

        const existing = this.getAccount(accountName);
        if (existing) {
            return this.verifyPassword(existing, password)
                ? { ok: true, created: false, accountName }
                : { ok: false };
        }

        if (!allowRegistration) {
            return { ok: false };
        }

        const now = new Date().toISOString();
        const salt = randomBytes(16);
        const account: StoredAccount = {
            passwordAlgorithm: "scrypt",
            passwordSalt: salt.toString("base64"),
            passwordHash: this.derivePasswordHash(password, salt),
            createdAt: now,
            passwordChangedAt: now,
        };
        try {
            this.database.connection
                .prepare(
                    `INSERT INTO accounts (
                        username,
                        password_algorithm,
                        password_salt,
                        password_hash,
                        created_at,
                        password_changed_at
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                )
                .run(
                    accountName,
                    account.passwordAlgorithm,
                    account.passwordSalt,
                    account.passwordHash,
                    account.createdAt,
                    account.passwordChangedAt,
                );
        } catch {
            return { ok: false };
        }
        return { ok: true, created: true, accountName };
    }

    hasAccount(username: string | undefined): boolean {
        const accountName = normalizeAccountName(username);
        if (!accountName) return false;
        return (
            this.database.connection
                .prepare("SELECT 1 FROM accounts WHERE username = ?")
                .get(accountName) !== undefined
        );
    }

    getPermissionLevel(username: string | undefined): PlayerPermission {
        const accountName = normalizeAccountName(username);
        if (!accountName) return "player";
        const row = this.database.connection
            .prepare("SELECT permission_level AS permissionLevel FROM accounts WHERE username = ?")
            .get(accountName) as { permissionLevel?: unknown } | undefined;
        return normalizePlayerPermission(row?.permissionLevel);
    }

    private derivePasswordHash(password: string, salt: Buffer): string {
        return scryptSync(password, salt, PASSWORD_KEY_LENGTH, SCRYPT_OPTIONS).toString("base64");
    }

    private verifyPassword(account: StoredAccount, password: string): boolean {
        try {
            if (account.passwordAlgorithm !== "scrypt") return false;
            const salt = Buffer.from(account.passwordSalt, "base64");
            const expected = Buffer.from(account.passwordHash, "base64");
            if (salt.length !== 16 || expected.length !== PASSWORD_KEY_LENGTH) return false;
            const actual = Buffer.from(this.derivePasswordHash(password, salt), "base64");
            return timingSafeEqual(expected, actual);
        } catch {
            return false;
        }
    }

    private isStoredAccount(value: unknown): value is StoredAccount {
        if (!value || typeof value !== "object") return false;
        const account = value as Partial<StoredAccount>;
        return (
            account.passwordAlgorithm === "scrypt" &&
            typeof account.passwordSalt === "string" &&
            typeof account.passwordHash === "string" &&
            typeof account.createdAt === "string" &&
            typeof account.passwordChangedAt === "string"
        );
    }

    private getAccount(accountName: string): StoredAccount | undefined {
        const row = this.database.connection
            .prepare(
                `SELECT
                    password_algorithm AS passwordAlgorithm,
                    password_salt AS passwordSalt,
                    password_hash AS passwordHash,
                    created_at AS createdAt,
                    password_changed_at AS passwordChangedAt
                 FROM accounts
                 WHERE username = ?`,
            )
            .get(accountName);
        return this.isStoredAccount(row) ? row : undefined;
    }
}
