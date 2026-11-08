import type { DatabaseSync } from "node:sqlite";

import {
    FriendsChatRank,
    type FriendsChatAction,
    type FriendsChatSnapshot,
} from "../../../../client/common/social/FriendsChat";
import { encodeMessage } from "../../network/messages";
import { getClanChatTabUid, getMainmodalUid } from "../../widgets/viewport";
import type { ServerServices } from "../ServerServices";
import type { PlayerState } from "../player";
import { getSqliteDatabase } from "../state/SqliteDatabase";
import { normalizePlayerAccountName } from "../state/PlayerSessionKeys";

const MAX_CHANNEL_MEMBERS = 500;
const MAX_FRIENDS = 200;
const MAX_IGNORES = 100;
const KICK_BAN_MS = 60 * 60 * 1000;
const FRIENDS_CHAT_MESSAGE_TYPE = 9;
const FRIENDS_CHAT_NOTIFICATION_TYPE = 11;
const RANK_OPTIONS = [
    "Anyone",
    "Any friends",
    "Recruit+",
    "Corporal+",
    "Sergeant+",
    "Lieutenant+",
    "Captain+",
    "General+",
    "Only me",
] as const;

type ChannelSettings = {
    ownerKey: string;
    ownerName: string;
    channelName?: string;
    entryRank: number;
    talkRank: number;
    kickRank: number;
};

type RuntimeChannel = {
    ownerKey: string;
    members: Map<number, PlayerState>;
};

type PendingNameAction = "join" | "set_name";

function cleanName(value: string): string | undefined {
    const display = String(value ?? "")
        .trim()
        .replace(/\s+/g, " ");
    if (display.length < 1 || display.length > 12 || !/^[a-z0-9 _-]+$/i.test(display)) {
        return undefined;
    }
    return display;
}

function rankFromOption(option: string): number | undefined {
    const normalized = option.trim().toLowerCase();
    const ranks: Record<string, number> = {
        anyone: FriendsChatRank.Unranked,
        "any friends": FriendsChatRank.Friend,
        "recruit+": FriendsChatRank.Recruit,
        "corporal+": FriendsChatRank.Corporal,
        "sergeant+": FriendsChatRank.Sergeant,
        "lieutenant+": FriendsChatRank.Lieutenant,
        "captain+": FriendsChatRank.Captain,
        "general+": FriendsChatRank.General,
        "only me": FriendsChatRank.Owner,
    };
    return ranks[normalized];
}

function optionFromWidgetOp(
    groupId: number,
    componentId: number,
    opId: number,
): string | undefined {
    if (groupId === 7 && componentId === 20 && opId === 1) return "Setup";
    if (groupId !== 94) return undefined;

    if (componentId === 10) {
        return ["Set prefix", "Disable"][opId - 1];
    }
    if (componentId === 13 || componentId === 16) {
        return RANK_OPTIONS[opId - 1];
    }
    if (componentId === 19 && opId >= 4) {
        return RANK_OPTIONS[opId - 1];
    }
    return undefined;
}

function rankLabel(rank: number): string {
    return RANK_OPTIONS[Math.max(-1, Math.min(7, rank)) + 1] ?? "Anyone";
}

export class FriendsChatService {
    private readonly database: DatabaseSync;
    private readonly channels = new Map<string, RuntimeChannel>();
    private readonly membershipByPlayer = new Map<number, string>();
    private readonly temporaryBans = new Map<string, Map<string, number>>();
    private readonly pendingNameActions = new Map<number, PendingNameAction>();

    constructor(
        private readonly svc: ServerServices,
        dataDir: string,
        database?: DatabaseSync,
    ) {
        this.database = database ?? getSqliteDatabase({ dataDir }).connection;
    }

    start(): void {
        this.svc.eventBus.on("player:login", ({ player }) => this.handleLogin(player));
        this.svc.eventBus.on("player:logout", ({ playerId, username }) =>
            this.handleLogout(playerId, username),
        );
    }

    handleAction(player: PlayerState, action: FriendsChatAction): void {
        switch (action.action) {
            case "join":
                this.join(player, action.name);
                break;
            case "leave":
                this.leave(player, true);
                break;
            case "kick":
                this.kick(player, action.name);
                break;
            case "add_friend":
                this.addFriend(player, action.name);
                break;
            case "remove_friend":
                this.removeFriend(player, action.name);
                break;
            case "set_friend_rank":
                this.setFriendRank(player, action.name, action.rank);
                break;
            case "add_ignore":
                this.addIgnore(player, action.name);
                break;
            case "remove_ignore":
                this.removeIgnore(player, action.name);
                break;
        }
    }

    handleChat(player: PlayerState, text: string): boolean {
        const ownerKey = this.membershipByPlayer.get(player.id);
        const channel = ownerKey ? this.channels.get(ownerKey) : undefined;
        const settings = ownerKey ? this.getSettings(ownerKey) : undefined;
        if (!ownerKey || !channel || !settings?.channelName) {
            this.gameMessage(player, "You are not currently in a chat-channel.");
            return true;
        }
        const rank = this.getRank(ownerKey, player.name);
        if (rank < settings.talkRank) {
            this.gameMessage(player, "You are not a high enough rank to talk in this chat-channel.");
            return true;
        }
        const message = String(text ?? "").trim().slice(0, 160);
        if (!message) return true;
        this.svc.messagingService.queueChatMessage({
            messageType: "game",
            chatType: FRIENDS_CHAT_MESSAGE_TYPE,
            from: player.name,
            prefix: settings.channelName,
            text: message,
            playerId: player.id,
            targetPlayerIds: Array.from(channel.members.keys()),
        });
        return true;
    }

    handleWidgetAction(
        player: PlayerState,
        groupId: number,
        componentId: number,
        rawOption?: string,
        rawOpId: number = 1,
    ): boolean {
        const opId = Math.trunc(rawOpId);
        const option =
            String(rawOption ?? "").trim() ||
            optionFromWidgetOp(groupId, componentId, opId) ||
            "";
        const normalized = option.toLowerCase();
        if (groupId === 7) {
            if (normalized === "setup") {
                this.openSetup(player);
                return true;
            }
            if (normalized === "join") {
                this.pendingNameActions.set(player.id, "join");
                return true;
            }
            if (normalized === "leave") {
                this.leave(player, true);
                return true;
            }
            return false;
        }
        if (groupId !== 94) return false;

        if (normalized === "set prefix") {
            this.pendingNameActions.set(player.id, "set_name");
            this.svc.queueWidgetEvent(player.id, {
                action: "run_script",
                scriptId: 109,
                args: ["Enter a name for your chat-channel:"],
            });
            return true;
        }
        if (normalized === "disable") {
            this.disableOwnChannel(player);
            return true;
        }
        if (normalized === "back" || normalized === "close") {
            this.openChannelTab(player);
            return true;
        }

        const rank = rankFromOption(option);
        if (rank === undefined) return false;
        if (componentId === 13) this.updateOwnSetting(player, "entry_rank", rank);
        else if (componentId === 16) this.updateOwnSetting(player, "talk_rank", rank);
        else if (componentId === 19) this.updateOwnSetting(player, "kick_rank", rank);
        else return false;
        return true;
    }

    handleNameInput(player: PlayerState, value: string, allowJoinFallback = false): boolean {
        const action = this.pendingNameActions.get(player.id);
        if (!action && !allowJoinFallback) return false;
        this.pendingNameActions.delete(player.id);
        if (action === "set_name") this.setOwnChannelName(player, value);
        else this.join(player, value);
        return true;
    }

    sendSnapshot(player: PlayerState): void {
        const ownerKey = this.membershipByPlayer.get(player.id);
        const channel = ownerKey ? this.channels.get(ownerKey) : undefined;
        const settings = ownerKey ? this.getSettings(ownerKey) : undefined;
        const snapshot: FriendsChatSnapshot = {
            friends: this.getFriends(player.name),
            ignores: this.getIgnores(player.name),
        };
        if (ownerKey && channel && settings?.channelName) {
            snapshot.channel = {
                name: settings.channelName,
                owner: settings.ownerName,
                minKickRank: settings.kickRank,
                localRank: this.getRank(ownerKey, player.name),
                members: Array.from(channel.members.values())
                    .map((member) => ({
                        name: member.name,
                        world: 1,
                        rank: this.getRank(ownerKey, member.name),
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name)),
            };
        }
        const socket = this.svc.players?.getSocketByPlayerId(player.id);
        if (!socket) return;
        this.svc.networkLayer.withDirectSendBypass("friends_chat_snapshot", () =>
            this.svc.networkLayer.sendWithGuard(
                socket,
                encodeMessage({ type: "friends_chat", payload: snapshot }),
                "friends_chat_snapshot",
            ),
        );
    }

    private handleLogin(player: PlayerState): void {
        this.sendSnapshot(player);
        const accountKey = normalizePlayerAccountName(player.name);
        if (accountKey) {
            const row = this.database
                .prepare("SELECT owner_key FROM friends_chat_last_channels WHERE account_key = ?")
                .get(accountKey) as { owner_key?: string } | undefined;
            if (row?.owner_key) this.joinByOwnerKey(player, row.owner_key, false);
            this.refreshFriendWatchers(accountKey);
        }
    }

    private handleLogout(playerId: number, username: string): void {
        const channel = this.membershipByPlayer.get(playerId);
        if (channel) this.removeMember(channel, playerId);
        this.pendingNameActions.delete(playerId);
        const accountKey = normalizePlayerAccountName(username);
        if (accountKey) this.refreshFriendWatchers(accountKey);
    }

    private join(player: PlayerState, rawOwnerName: string): void {
        const ownerName = cleanName(rawOwnerName);
        const ownerKey = ownerName ? normalizePlayerAccountName(ownerName) : undefined;
        if (!ownerKey || !this.joinByOwnerKey(player, ownerKey, true)) {
            this.gameMessage(player, "The chat-channel you tried to join does not exist.");
        }
    }

    private joinByOwnerKey(player: PlayerState, ownerKey: string, notify: boolean): boolean {
        const settings = this.getSettings(ownerKey);
        if (!settings?.channelName) return false;
        const memberKey = normalizePlayerAccountName(player.name);
        if (!memberKey || this.isIgnored(ownerKey, memberKey)) {
            if (notify) this.gameMessage(player, "You are not allowed to join this chat-channel.");
            return false;
        }
        const bannedUntil = this.temporaryBans.get(ownerKey)?.get(memberKey) ?? 0;
        if (bannedUntil > Date.now()) {
            if (notify) this.gameMessage(player, "You are temporarily banned from this chat-channel.");
            return false;
        }
        const rank = this.getRank(ownerKey, player.name);
        if (rank < settings.entryRank) {
            if (notify) this.gameMessage(player, "You do not have a high enough rank to join this chat-channel.");
            return false;
        }

        const previous = this.membershipByPlayer.get(player.id);
        if (previous === ownerKey) {
            this.sendSnapshot(player);
            return true;
        }
        if (previous) this.removeMember(previous, player.id);

        let channel = this.channels.get(ownerKey);
        if (!channel) {
            channel = { ownerKey, members: new Map() };
            this.channels.set(ownerKey, channel);
        }
        if (channel.members.size >= MAX_CHANNEL_MEMBERS) {
            const candidate = Array.from(channel.members.values())
                .filter((member) => this.getRank(ownerKey, member.name) < rank)
                .sort(
                    (a, b) =>
                        this.getRank(ownerKey, a.name) - this.getRank(ownerKey, b.name),
                )[0];
            if (!candidate) {
                if (notify) this.gameMessage(player, "This chat-channel is currently full.");
                return false;
            }
            this.gameMessage(candidate, "You have been removed to make room for a higher-ranked player.");
            this.removeMember(ownerKey, candidate.id);
        }

        channel.members.set(player.id, player);
        this.membershipByPlayer.set(player.id, ownerKey);
        this.database
            .prepare(
                `INSERT INTO friends_chat_last_channels (account_key, owner_key) VALUES (?, ?)
                 ON CONFLICT(account_key) DO UPDATE SET owner_key = excluded.owner_key`,
            )
            .run(memberKey, ownerKey);
        if (notify) {
            this.notification(player, `Now talking in chat-channel ${settings.channelName}`);
            this.notification(player, "To talk, start each line of chat with the / symbol.");
        }
        this.broadcastChannel(ownerKey);
        return true;
    }

    private leave(player: PlayerState, notify: boolean): void {
        const ownerKey = this.membershipByPlayer.get(player.id);
        if (!ownerKey) return;
        this.removeMember(ownerKey, player.id);
        this.sendSnapshot(player);
        if (notify) this.notification(player, "You have left the chat-channel.");
    }

    private removeMember(ownerKey: string, playerId: number): void {
        const channel = this.channels.get(ownerKey);
        if (!channel) return;
        channel.members.delete(playerId);
        this.membershipByPlayer.delete(playerId);
        if (channel.members.size === 0) {
            this.channels.delete(ownerKey);
            this.temporaryBans.delete(ownerKey);
        } else {
            this.broadcastChannel(ownerKey);
        }
    }

    private kick(player: PlayerState, rawTargetName: string): void {
        const ownerKey = this.membershipByPlayer.get(player.id);
        const channel = ownerKey ? this.channels.get(ownerKey) : undefined;
        const settings = ownerKey ? this.getSettings(ownerKey) : undefined;
        if (!ownerKey || !channel || !settings) return;
        const kickerRank = this.getRank(ownerKey, player.name);
        if (kickerRank < Math.max(FriendsChatRank.Corporal, settings.kickRank)) {
            this.gameMessage(player, "You are not a high enough rank to kick from this chat-channel.");
            return;
        }
        const targetKey = normalizePlayerAccountName(rawTargetName);
        const target = Array.from(channel.members.values()).find(
            (member) => normalizePlayerAccountName(member.name) === targetKey,
        );
        if (!target || !targetKey) return;
        const targetRank = this.getRank(ownerKey, target.name);
        if (target.id === player.id || targetRank >= kickerRank) {
            this.gameMessage(player, "You can only kick chat-channel members with a lower rank.");
            return;
        }
        let bans = this.temporaryBans.get(ownerKey);
        if (!bans) {
            bans = new Map();
            this.temporaryBans.set(ownerKey, bans);
        }
        bans.set(targetKey, Date.now() + KICK_BAN_MS);
        this.removeMember(ownerKey, target.id);
        this.sendSnapshot(target);
        this.notification(target, "You have been kicked from the chat-channel.");
    }

    private addFriend(player: PlayerState, rawName: string): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        const displayName = cleanName(rawName);
        const friendKey = displayName ? normalizePlayerAccountName(displayName) : undefined;
        if (!ownerKey || !displayName || !friendKey || friendKey === ownerKey) return;
        const count = (
            this.database.prepare("SELECT COUNT(*) AS count FROM social_friends WHERE owner_key = ?").get(
                ownerKey,
            ) as { count: number }
        ).count;
        if (count >= MAX_FRIENDS) {
            this.gameMessage(player, "Your friends list is full.");
            return;
        }
        if (this.isIgnored(ownerKey, friendKey)) {
            this.gameMessage(player, "Please remove that player from your ignore list first.");
            return;
        }
        this.database
            .prepare(
                `INSERT INTO social_friends (owner_key, friend_key, friend_name, rank)
                 VALUES (?, ?, ?, 0)
                 ON CONFLICT(owner_key, friend_key) DO UPDATE SET friend_name = excluded.friend_name`,
            )
            .run(ownerKey, friendKey, displayName);
        this.sendSnapshot(player);
        this.broadcastChannel(ownerKey);
    }

    private removeFriend(player: PlayerState, rawName: string): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        const friendKey = normalizePlayerAccountName(rawName);
        if (!ownerKey || !friendKey) return;
        this.database
            .prepare("DELETE FROM social_friends WHERE owner_key = ? AND friend_key = ?")
            .run(ownerKey, friendKey);
        this.sendSnapshot(player);
        this.broadcastChannel(ownerKey);
    }

    private setFriendRank(player: PlayerState, rawName: string, rawRank: number): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        const friendKey = normalizePlayerAccountName(rawName);
        if (!ownerKey || !friendKey) return;
        const rank = Math.max(FriendsChatRank.Friend, Math.min(FriendsChatRank.General, rawRank | 0));
        this.database
            .prepare("UPDATE social_friends SET rank = ? WHERE owner_key = ? AND friend_key = ?")
            .run(rank, ownerKey, friendKey);
        this.sendSnapshot(player);
        this.broadcastChannel(ownerKey);
    }

    private addIgnore(player: PlayerState, rawName: string): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        const displayName = cleanName(rawName);
        const ignoredKey = displayName ? normalizePlayerAccountName(displayName) : undefined;
        if (!ownerKey || !displayName || !ignoredKey || ignoredKey === ownerKey) return;
        const count = (
            this.database.prepare("SELECT COUNT(*) AS count FROM social_ignores WHERE owner_key = ?").get(
                ownerKey,
            ) as { count: number }
        ).count;
        if (count >= MAX_IGNORES) {
            this.gameMessage(player, "Your ignore list is full.");
            return;
        }
        const isFriend = this.database
            .prepare("SELECT 1 FROM social_friends WHERE owner_key = ? AND friend_key = ?")
            .get(ownerKey, ignoredKey);
        if (isFriend) {
            this.gameMessage(player, "Please remove that player from your friends list first.");
            return;
        }
        this.database
            .prepare(
                `INSERT INTO social_ignores (owner_key, ignored_key, ignored_name) VALUES (?, ?, ?)
                 ON CONFLICT(owner_key, ignored_key) DO UPDATE SET ignored_name = excluded.ignored_name`,
            )
            .run(ownerKey, ignoredKey, displayName);
        const channel = this.channels.get(ownerKey);
        const member = channel
            ? Array.from(channel.members.values()).find(
                  (candidate) => normalizePlayerAccountName(candidate.name) === ignoredKey,
              )
            : undefined;
        if (member) {
            this.removeMember(ownerKey, member.id);
            this.sendSnapshot(member);
        }
        this.sendSnapshot(player);
    }

    private removeIgnore(player: PlayerState, rawName: string): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        const ignoredKey = normalizePlayerAccountName(rawName);
        if (!ownerKey || !ignoredKey) return;
        this.database
            .prepare("DELETE FROM social_ignores WHERE owner_key = ? AND ignored_key = ?")
            .run(ownerKey, ignoredKey);
        this.sendSnapshot(player);
    }

    private openSetup(player: PlayerState): void {
        player.widgets.open(94, {
            targetUid: getMainmodalUid(player.displayMode),
            type: 0,
            modal: true,
            scope: "modal",
        });
        this.syncSetupText(player);
    }

    private openChannelTab(player: PlayerState): void {
        player.widgets.open(7, {
            targetUid: getClanChatTabUid(player.displayMode),
            type: 1,
            modal: false,
        });
    }

    private setOwnChannelName(player: PlayerState, rawName: string): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        const channelName = cleanName(rawName);
        if (!ownerKey || !channelName) {
            this.gameMessage(player, "Chat-channel names must contain 1 to 12 valid characters.");
            return;
        }
        this.upsertSettings(player, channelName);
        this.gameMessage(player, `Your chat-channel is now named ${channelName}.`);
        this.syncSetupText(player);
        this.joinByOwnerKey(player, ownerKey, true);
    }

    private disableOwnChannel(player: PlayerState): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        if (!ownerKey) return;
        const settings = this.getSettings(ownerKey);
        if (!settings) this.upsertSettings(player, undefined);
        else {
            this.database
                .prepare(
                    "UPDATE friends_chat_settings SET channel_name = NULL, updated_at = ? WHERE owner_key = ?",
                )
                .run(new Date().toISOString(), ownerKey);
        }
        const channel = this.channels.get(ownerKey);
        if (channel) {
            for (const member of Array.from(channel.members.values())) {
                this.membershipByPlayer.delete(member.id);
                this.sendSnapshot(member);
                this.notification(member, "This chat-channel has been disabled.");
            }
            this.channels.delete(ownerKey);
            this.temporaryBans.delete(ownerKey);
        }
        this.syncSetupText(player);
    }

    private updateOwnSetting(player: PlayerState, column: string, rank: number): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        if (!ownerKey) return;
        if (!this.getSettings(ownerKey)) this.upsertSettings(player, undefined);
        const allowed = new Set(["entry_rank", "talk_rank", "kick_rank"]);
        if (!allowed.has(column)) return;
        this.database
            .prepare(
                `UPDATE friends_chat_settings SET ${column} = ?, updated_at = ? WHERE owner_key = ?`,
            )
            .run(rank, new Date().toISOString(), ownerKey);
        this.syncSetupText(player);
        this.broadcastChannel(ownerKey);
    }

    private syncSetupText(player: PlayerState): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        const settings = ownerKey ? this.getSettings(ownerKey) : undefined;
        const values = [
            { uid: (94 << 16) | 10, text: settings?.channelName ?? "Not set" },
            { uid: (94 << 16) | 13, text: rankLabel(settings?.entryRank ?? -1) },
            { uid: (94 << 16) | 16, text: rankLabel(settings?.talkRank ?? -1) },
            { uid: (94 << 16) | 19, text: rankLabel(settings?.kickRank ?? 2) },
        ];
        for (const value of values) {
            this.svc.queueWidgetEvent(player.id, { action: "set_text", ...value });
        }
    }

    private upsertSettings(player: PlayerState, channelName: string | undefined): void {
        const ownerKey = normalizePlayerAccountName(player.name);
        if (!ownerKey) return;
        this.database
            .prepare(
                `INSERT INTO friends_chat_settings
                    (owner_key, owner_name, channel_name, entry_rank, talk_rank, kick_rank, updated_at)
                 VALUES (?, ?, ?, -1, -1, 2, ?)
                 ON CONFLICT(owner_key) DO UPDATE SET
                    owner_name = excluded.owner_name,
                    channel_name = excluded.channel_name,
                    updated_at = excluded.updated_at`,
            )
            .run(ownerKey, player.name, channelName ?? null, new Date().toISOString());
    }

    private getSettings(ownerKey: string): ChannelSettings | undefined {
        const row = this.database
            .prepare(
                `SELECT owner_key, owner_name, channel_name, entry_rank, talk_rank, kick_rank
                 FROM friends_chat_settings WHERE owner_key = ?`,
            )
            .get(ownerKey) as
            | {
                  owner_key: string;
                  owner_name: string;
                  channel_name: string | null;
                  entry_rank: number;
                  talk_rank: number;
                  kick_rank: number;
              }
            | undefined;
        if (!row) return undefined;
        return {
            ownerKey: row.owner_key,
            ownerName: row.owner_name,
            channelName: row.channel_name ?? undefined,
            entryRank: row.entry_rank,
            talkRank: row.talk_rank,
            kickRank: row.kick_rank,
        };
    }

    private getRank(ownerKey: string, rawName: string): number {
        const memberKey = normalizePlayerAccountName(rawName);
        if (!memberKey) return FriendsChatRank.Unranked;
        if (memberKey === ownerKey) return FriendsChatRank.Owner;
        const row = this.database
            .prepare("SELECT rank FROM social_friends WHERE owner_key = ? AND friend_key = ?")
            .get(ownerKey, memberKey) as { rank?: number } | undefined;
        return row?.rank ?? FriendsChatRank.Unranked;
    }

    private isIgnored(ownerKey: string, memberKey: string): boolean {
        return (
            this.database
                .prepare("SELECT 1 FROM social_ignores WHERE owner_key = ? AND ignored_key = ?")
                .get(ownerKey, memberKey) !== undefined
        );
    }

    private getFriends(ownerName: string): FriendsChatSnapshot["friends"] {
        const ownerKey = normalizePlayerAccountName(ownerName);
        if (!ownerKey) return [];
        const rows = this.database
            .prepare(
                "SELECT friend_name, rank FROM social_friends WHERE owner_key = ? ORDER BY friend_name COLLATE NOCASE",
            )
            .all(ownerKey) as Array<{ friend_name: string; rank: number }>;
        return rows.map((row) => {
            const online = this.svc.players?.getConnectedPlayerByName(row.friend_name);
            return {
                name: online?.name ?? row.friend_name,
                previousName: "",
                world: online ? 1 : 0,
                rank: row.rank,
                isOnline: online !== undefined,
            };
        });
    }

    private getIgnores(ownerName: string): FriendsChatSnapshot["ignores"] {
        const ownerKey = normalizePlayerAccountName(ownerName);
        if (!ownerKey) return [];
        return (
            this.database
                .prepare(
                    "SELECT ignored_name FROM social_ignores WHERE owner_key = ? ORDER BY ignored_name COLLATE NOCASE",
                )
                .all(ownerKey) as Array<{ ignored_name: string }>
        ).map((row) => ({ name: row.ignored_name, previousName: "" }));
    }

    private broadcastChannel(ownerKey: string): void {
        const channel = this.channels.get(ownerKey);
        if (!channel) return;
        for (const member of channel.members.values()) this.sendSnapshot(member);
    }

    private refreshFriendWatchers(friendKey: string): void {
        const rows = this.database
            .prepare("SELECT owner_key FROM social_friends WHERE friend_key = ?")
            .all(friendKey) as Array<{ owner_key: string }>;
        for (const row of rows) {
            const owner = this.svc.players?.getConnectedPlayerByName(row.owner_key);
            if (owner) this.sendSnapshot(owner);
        }
    }

    private gameMessage(player: PlayerState, text: string): void {
        this.svc.messagingService.sendGameMessageToPlayer(player, text);
    }

    private notification(player: PlayerState, text: string): void {
        this.svc.messagingService.queueChatMessage({
            messageType: "game",
            chatType: FRIENDS_CHAT_NOTIFICATION_TYPE,
            text,
            targetPlayerIds: [player.id],
        });
    }
}
