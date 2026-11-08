/**
 * Regression coverage for account registration, verification, and legacy claims.
 *
 * Run with: npx tsx tests/authentication.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { getSqliteDatabase } from "../src/game/state/SqliteDatabase";
import { AccountStore } from "../src/network/AccountStore";
import { AuthenticationService } from "../src/network/AuthenticationService";
import { LoginState } from "../../client/game/login/LoginState";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sinclair-auth-test-"));
const accountStore = new AccountStore({ dataDir });
const playerLookup = {
    hasConnectedPlayer: () => false,
    getTotalPlayerCount: () => 0,
};
const gamemode = {} as GamemodeDefinition;

const authentication = new AuthenticationService(playerLookup, gamemode, {
    accountStore,
    allowAccountRegistration: true,
    allowLegacyAccountClaim: false,
});

assert.deepEqual(authentication.authenticateCredentials("Alice", "hunter123", false), {
    ok: true,
    created: true,
    accountName: "alice",
});
assert.deepEqual(authentication.authenticateCredentials("ALICE", "hunter123", false), {
    ok: true,
    created: false,
    accountName: "alice",
});
assert.deepEqual(authentication.authenticateCredentials("Alice", "incorrect", false), {
    ok: false,
    reason: "invalid_credentials",
});
assert.deepEqual(authentication.authenticateCredentials("alice@example.com", "hunter123", false), {
    ok: false,
    reason: "invalid_credentials",
});
assert.deepEqual(authentication.authenticateCredentials("Legacy", "hunter123", true), {
    ok: false,
    reason: "invalid_credentials",
});

const legacyClaimAuthentication = new AuthenticationService(playerLookup, gamemode, {
    accountStore,
    allowAccountRegistration: true,
    allowLegacyAccountClaim: true,
});
assert.deepEqual(legacyClaimAuthentication.authenticateCredentials("Legacy", "legacy123", true), {
    ok: true,
    created: true,
    accountName: "legacy",
});

const stored = getSqliteDatabase({ dataDir })
    .connection.prepare(
        `SELECT password_algorithm AS algorithm, password_salt AS salt, password_hash AS hash
         FROM accounts
         WHERE username = ?`,
    )
    .get("alice") as { algorithm: string; salt: string; hash: string };
assert.equal(stored.algorithm, "scrypt");
assert.notEqual(stored.salt, "hunter123");
assert.notEqual(stored.hash, "hunter123");

const loginState = new LoginState();
loginState.username = "alice@example.com";
loginState.password = "hunter123";
assert.match(loginState.getCredentialValidationMessage() ?? "", /1-12 characters/);
loginState.username = "Alice";
assert.equal(loginState.getCredentialValidationMessage(), undefined);
loginState.password = "x".repeat(21);
assert.match(loginState.getCredentialValidationMessage() ?? "", /no more than 20 characters/);

console.log("authentication regression test passed");
