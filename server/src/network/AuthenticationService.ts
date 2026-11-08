import { resolvePlayerDisplay } from "../../../client/rs/chat/PlayerType";
import { MIN_PASSWORD_LENGTH } from "../../../client/common/authentication";
import { VARBIT_ACCOUNT_TYPE } from "../../../client/common/vars";
import type { GamemodeDefinition } from "../game/gamemodes/GamemodeDefinition";
import type { PlayerState } from "../game/player";
import { logger } from "../utils/logger";
import { AccountStore, normalizeAccountName } from "./AccountStore";
import { type PlayerPermission, hasPermission } from "./PlayerPermission";

const ADMIN_USERNAMES_ENV = (
    process?.env?.ADMIN_USERNAMES ??
    process?.env?.ADMIN_PLAYERS ??
    process?.env?.ADMIN_NAMES ??
    "lol,bot"
).toString();

const ADMIN_USERNAMES = new Set(
    ADMIN_USERNAMES_ENV.split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
);
const MODERATOR_USERNAMES = usernamesFromEnv("MODERATOR_USERNAMES");
const DEVELOPER_USERNAMES = usernamesFromEnv("DEVELOPER_USERNAMES");

function usernamesFromEnv(name: string): Set<string> {
    return new Set(
        (process.env[name] ?? "")
            .split(",")
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
    );
}

export const ADMIN_CROWN_ICON = 1;

export interface PlayerLookup {
    hasConnectedPlayer(username: string): boolean;
    getTotalPlayerCount(): number;
}

export interface AuthenticationOptions {
    accountStore: AccountStore;
    allowAccountRegistration?: boolean;
    allowLegacyAccountClaim?: boolean;
}

export type CredentialAuthenticationResult =
    | { ok: true; created: boolean; accountName: string }
    | { ok: false; reason: "invalid_credentials" | "password_too_short" };

/**
 * Handles login rate limiting, admin detection, and account type normalization.
 * Extracted from WSServer.
 */
export class AuthenticationService {
    private loginAttempts = new Map<string, { count: number; resetTime: number }>();
    private readonly MAX_LOGIN_ATTEMPTS = 5;
    private readonly LOGIN_ATTEMPT_WINDOW_MS = 60000;

    constructor(
        private readonly playerLookup: PlayerLookup,
        private readonly gamemode: GamemodeDefinition,
        private readonly options: AuthenticationOptions,
    ) {}

    checkLoginRateLimit(ip: string): boolean {
        // This PC itself: its own player, and friends a host's browser relays in over WebRTC
        // (PeerJS), who all arrive from loopback. Limiting them would lock out a whole party.
        if (/^(127\.|::1$|::ffff:127\.)/.test(ip)) return false;
        const now = Date.now();
        const entry = this.loginAttempts.get(ip);

        if (!entry || now >= entry.resetTime) {
            this.loginAttempts.set(ip, {
                count: 1,
                resetTime: now + this.LOGIN_ATTEMPT_WINDOW_MS,
            });
            return false;
        }

        entry.count++;

        if (entry.count > this.MAX_LOGIN_ATTEMPTS) {
            return true;
        }

        return false;
    }

    isPlayerAlreadyLoggedIn(username: string): boolean {
        return this.playerLookup.hasConnectedPlayer(username);
    }

    isWorldFull(): boolean {
        return this.playerLookup.getTotalPlayerCount() >= 2047;
    }

    normalizePlayerNameForAuth(name: string | undefined): string {
        return (name ?? "").trim().toLowerCase();
    }

    authenticateCredentials(
        username: string | undefined,
        password: string | undefined,
        hasLegacyPlayerState: boolean,
    ): CredentialAuthenticationResult {
        const accountName = normalizeAccountName(username);
        if (!accountName) return { ok: false, reason: "invalid_credentials" };
        // Party-game gamemodes can opt out of passwords: the name alone logs you in.
        if (this.gamemode.passwordlessLogin) return { ok: true, created: false, accountName };
        if (typeof password === "string" && password.length < MIN_PASSWORD_LENGTH) {
            return { ok: false, reason: "password_too_short" };
        }

        const allowRegistration =
            this.options.allowAccountRegistration !== false &&
            (!hasLegacyPlayerState || this.options.allowLegacyAccountClaim === true);
        const authentication = this.options.accountStore.authenticate(
            username,
            password,
            allowRegistration,
        );
        return authentication.ok
            ? authentication
            : { ok: false, reason: "invalid_credentials" };
    }

    isAdminPlayer(player: PlayerState | undefined): boolean {
        return !!player && hasPermission(this.getPlayerPermission(player), "admin");
    }

    getPlayerPermission(player: PlayerState | undefined): PlayerPermission {
        if (!player) return "player";
        const name = this.normalizePlayerNameForAuth(player.name);
        if (DEVELOPER_USERNAMES.has(name)) return "developer";
        if (ADMIN_USERNAMES.has(name)) return "admin";
        if (MODERATOR_USERNAMES.has(name)) return "moderator";
        return this.options.accountStore.getPermissionLevel(name);
    }

    normalizeAccountType(value: number): number {
        const normalized = Number.isFinite(value) ? Math.floor(value) : 0;
        return normalized >= 0 && normalized <= 5 ? normalized : 0;
    }

    resolvePlayerDisplay(player: PlayerState): { playerType: number; displayName: string } {
        const types = this.gamemode.getPlayerTypes(player, this.isAdminPlayer(player));
        return resolvePlayerDisplay(types, player.name ?? "");
    }

    getPublicChatPlayerType(player: PlayerState): number {
        return this.resolvePlayerDisplay(player).playerType;
    }

    syncAccountTypeVarbit(
        player: PlayerState,
        sendFn: (varbitId: number, value: number) => void,
    ): void {
        const raw = player.varps.getVarbitValue(VARBIT_ACCOUNT_TYPE);
        const accountType = this.normalizeAccountType(raw);
        if (accountType !== raw) {
            player.varps.setVarbitValue(VARBIT_ACCOUNT_TYPE, accountType);
        }
        sendFn(VARBIT_ACCOUNT_TYPE, accountType);
    }
}
