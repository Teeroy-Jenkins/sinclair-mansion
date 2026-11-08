/**
 * Regression coverage for the authenticated-login-to-handshake reservation.
 *
 * Run with: npx tsx tests/login-reservation.test.ts
 */
import assert from "node:assert/strict";
import type { WebSocket } from "ws";

import type { ServerServices } from "../src/game/ServerServices";
import {
    LoginHandshakeService,
    PENDING_LOGIN_RESERVATION_MS,
} from "../src/network/LoginHandshakeService";

let now = 1_000;
const service = new LoginHandshakeService({} as ServerServices, () => now);
const firstSocket = {} as WebSocket;
const secondSocket = {} as WebSocket;
const isPendingForAnotherSocket = (
    service as unknown as {
        isLoginPendingForAnotherSocket(socket: WebSocket, username: string): boolean;
    }
).isLoginPendingForAnotherSocket.bind(service);

service.setPendingLoginName(firstSocket, "Alice");
assert.equal(isPendingForAnotherSocket(firstSocket, "alice"), false);
assert.equal(isPendingForAnotherSocket(secondSocket, "ALICE"), true);

now += PENDING_LOGIN_RESERVATION_MS;
assert.equal(
    isPendingForAnotherSocket(secondSocket, "alice"),
    false,
    "an abandoned socket must not reserve an account indefinitely",
);
assert.equal(
    service.consumePendingLoginName(firstSocket),
    undefined,
    "an expired login must not be accepted by a later handshake",
);

service.setPendingLoginName(firstSocket, "Alice");
assert.equal(service.consumePendingLoginName(firstSocket), "Alice");
assert.equal(isPendingForAnotherSocket(secondSocket, "alice"), false);
assert.equal(
    service.consumePendingLoginName(firstSocket),
    undefined,
    "a login reservation must only be consumable once",
);

console.log("login reservation regression test passed");
