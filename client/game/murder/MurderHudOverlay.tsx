// RuneLite-style info panel for Murder at Sinclair Mansion: your role, the
// round timer and your chores (the Detective also sees their latest lifts).
import { useEffect, useState } from "react";

import type { OsrsClient } from "../OsrsClient";
import { getLastUrl, sendGamemodeMessage } from "../../network/ServerConnection";
import { setListedRoom } from "../../network/peer/PeerRoomList";
import { atHomeServer, LobbyWindow, type SwitchServer } from "./LobbyWindow";
import { setPeerHosting } from "./PeerHosting";
import { startProgressSync } from "./Progression";
import "./MurderHudOverlay.css";
import { getMurderHud, setSwitchServer, subscribeMurderHud, type MurderHud, type MurderHudState } from "./MurderHudStore";

/** Hide ground items with a GP value of 60 or lower during the Murder game. */
const LOW_VALUE_CONFIG = { hideUnderValue: 61 };


const ROLE: Record<string, { label: string; cls: string }> = {
    detective: { label: "Detective", cls: "mh-yellow" },
    murderer: { label: "Murderer", cls: "mh-red" },
    npc: { label: "Household", cls: "mh-green" },
};

function clock(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Row({ left, right, cls }: { left: string; right?: string; cls?: string }) {
    return (
        <div className="mh-row">
            <span>{left}</span>
            {right !== undefined && <span className={cls}>{right}</span>}
        </div>
    );
}

/**
 * The dinner-table vote: each person still alive with the votes against them so far (never who
 * cast them), and a button to vote for them; more than half arrests them.
 */
function VotePanel({ vote, canVote }: { vote: NonNullable<MurderHud["vote"]>; canVote: boolean }) {
    const cast = (target: string | null) => sendGamemodeMessage("sinclair_vote", { target });
    return (
        <div className="mh-vote">
            <div className="mh-hint">
                Vote to arrest: {vote.needed} of {vote.voters} needed. {vote.voted}/{vote.voters} voted.
            </div>
            {vote.tally.map((t) => (
                <div key={t.key} className={`mh-vote-row${vote.mine === t.key ? " mh-voted" : ""}`}>
                    <span className="mh-vote-name">{t.name}{t.you ? " (you)" : ""}</span>
                    <span className={t.votes >= vote.needed ? "mh-red" : t.votes > 0 ? "mh-yellow" : "mh-grey"}>{t.votes}</span>
                    {canVote && !t.you && (
                        <button onClick={() => cast(t.key)} disabled={vote.mine === t.key}>
                            {vote.mine === t.key ? "Voted" : "Vote"}
                        </button>
                    )}
                </div>
            ))}
            <div className={`mh-vote-row${vote.mine === null ? " mh-voted" : ""}`}>
                <span className="mh-vote-name">No arrest</span>
                <span className={vote.none > 0 ? "mh-yellow" : "mh-grey"}>{vote.none}</span>
                {canVote && (
                    <button onClick={() => cast(null)} disabled={vote.mine === null}>
                        {vote.mine === null ? "Voted" : "Vote"}
                    </button>
                )}
            </div>
            {vote.graceLeft !== undefined && (
                <div className="mh-hint mh-yellow">The table decides in {vote.graceLeft}s. You can still change your vote.</div>
            )}
            {!canVote && <div className="mh-hint">Ghosts don't vote.</div>}
        </div>
    );
}

export function MurderHudOverlay({ playerName = "", onSwitchServer, client }: { playerName?: string; onSwitchServer?: SwitchServer; client?: OsrsClient }) {
    const [state, setState] = useState<MurderHudState | undefined>(getMurderHud());
    const [, setNow] = useState(0);
    const [lobbyOpen, setLobbyOpen] = useState(false);
    const phase = state?.hud.phase;
    useEffect(() => setLobbyOpen(false), [phase]);

    useEffect(() => subscribeMurderHud(setState), []);
    useEffect(() => startProgressSync(), []);
    useEffect(() => {
        if (onSwitchServer) setSwitchServer(onSwitchServer);
    }, [onSwitchServer]);
    // Re-render for the countdown only while there is one (the lobby and menus have no timer).
    const counting = state?.hud.secondsLeft !== undefined;
    useEffect(() => {
        if (!counting) return;
        const id = window.setInterval(() => setNow((n) => n + 1), 250);
        return () => window.clearInterval(id);
    }, [counting]);

    // On your own copy with a room open: share it over PeerJS so friends anywhere can join with
    // the room code (this tab relays them to the game server), through lobby and games alike.
    const sharedRoom = state && atHomeServer() ? state.hud.lobby?.roomCode : undefined;
    useEffect(() => setPeerHosting(sharedRoom, getLastUrl()), [sharedRoom]);
    useEffect(() => () => setPeerHosting(undefined, ""), []);
    // ...and put it on the internet room list, so friends see it in their Join browser too.
    const shared = sharedRoom ? state?.hud.lobby : undefined;
    const listing = shared && sharedRoom
        ? { roomCode: sharedRoom, name: shared.name, host: shared.host, players: shared.players.length, maxPlayers: shared.maxPlayers, locked: shared.locked, inGame: shared.inGame }
        : undefined;
    const listingKey = listing ? JSON.stringify(listing) : "";
    useEffect(() => setListedRoom(listingKey ? JSON.parse(listingKey) : undefined), [listingKey]);
    useEffect(() => () => setListedRoom(undefined), []);

    // Apply low-value ground item filter when the Murder game is active (not in lobby).
    useEffect(() => {
        if (phase && phase !== "lobby" && client?.groundItemsPlugin) {
            client.groundItemsPlugin.setConfig(LOW_VALUE_CONFIG);
        }
    }, [phase, client]);

    if (!state) return null;
    const { hud, receivedAt } = state;
    // Before you've joined, and between games, it's the lobby window. Right after a game the
    // "Quest complete!" scroll is up, so the lobby waits behind a button.
    if (!hud.joined || hud.phase === "lobby" || (hud.phase === "gameover" && lobbyOpen)) {
        // The cosmetic store or bank (OSRS interfaces) is open: the lobby window steps aside until it closes.
        if (hud.browsing) return null;
        return <LobbyWindow hud={hud} playerName={playerName} onSwitchServer={onSwitchServer} />;
    }
    const left = hud.secondsLeft !== undefined ? hud.secondsLeft - (performance.now() - receivedAt) / 1000 : undefined;
    const role = !hud.alive ? { label: "Ghost", cls: "mh-grey" } : hud.role ? ROLE[hud.role] : undefined;
    // Only the chore you're on now; the rest wait their turn.
    const active = hud.tasks.find((t) => !t.done);

    return (
        <div className="murder-hud">
            <div className="mh-panel">
                <div className="mh-title">Sinclair Mansion</div>
                {role && <Row left="Role:" right={role.label} cls={role.cls} />}
                {hud.phase === "gameover" ? (
                    <>
                        {hud.winner && <Row left="Winner:" right={hud.winner === "detective" ? "Detective" : "Murderer"} cls={hud.winner === "detective" ? "mh-yellow" : "mh-red"} />}
                        <div className="mh-buttons mh-one">
                            <button className="mh-start" onClick={() => setLobbyOpen(true)}>
                                Lobby{hud.lobby ? ` (${hud.lobby.players.length}/${hud.lobby.maxPlayers})` : ""}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <Row left={hud.maxRounds > 0 ? `Round ${hud.round}/${hud.maxRounds}` : `Round ${hud.round}`} right={left !== undefined ? clock(left) : undefined} cls={left !== undefined && left < 30 ? "mh-red" : "mh-white"} />
                        {hud.hasFlypaper && hud.role === "murderer" && <Row left="Flypaper:" right="You're the Detective too" cls="mh-yellow" />}
                        <Row left="Players alive:" right={`${hud.living}/${hud.players}`} />
                        {hud.points > 0 && <Row left="Coins earned:" right={hud.points.toLocaleString()} cls="mh-yellow" />}
                        {hud.crimeScene && <Row left="Body found:" right={hud.crimeScene} cls="mh-cyan" />}
                        {hud.hasFlypaper && hud.weaponType && <Row left="Weapon type:" right={hud.weaponType} cls="mh-red" />}
                        {hud.hasFlypaper && (
                            <div className="mh-hint">
                                {hud.stopSearch ? "Stop and Search: right-click someone (once a round)." : "You've stopped and searched someone this round."}
                            </div>
                        )}
                        {hud.hasFlypaper && hud.clues && (
                            <>
                                <Row left="Clues:" right={`${hud.clues.have}/${hud.clues.need}`} cls="mh-yellow" />
                                <div className="mh-hint">
                                    {hud.clues.ready ? "Use flypaper on the body for this round's clue." : "Next clue from the body next round."}
                                    {hud.clues.have > 0 && ` Could be: ${hud.clues.possible.join(", ")}.`}
                                </div>
                            </>
                        )}
                        {hud.disturbed !== undefined && <Row left="Disturbed:" right={String(hud.disturbed)} cls="mh-yellow" />}
                        {hud.escapes && (
                            <>
                                {hud.escapes.map((e) => (
                                    <Row key={e.name} left={`${e.name}:`} right={`${e.have}/${e.need}${e.hasTool ? "" : ` (need ${e.tool.toLowerCase()})`}`} cls={e.hasTool ? "mh-red" : "mh-grey"} />
                                ))}
                                <div className="mh-hint">{hud.escapeReady ? "Escape: work at one way out once a round, unseen." : "You've worked on your escape this round."}</div>
                            </>
                        )}
                        {hud.phase === "arrest" && hud.vote && <VotePanel vote={hud.vote} canVote={hud.alive} />}
                        {hud.winner && <Row left="Winner:" right={hud.winner === "detective" ? "Detective" : "Murderer"} cls={hud.winner === "detective" ? "mh-yellow" : "mh-red"} />}
                    </>
                )}
            </div>

            {hud.tasks.length > 0 && (
                <div className="mh-panel">
                    <div className="mh-title">Chores ({hud.tasks.filter((t) => t.done).length}/{hud.tasks.length})</div>
                    {active ? (
                        <div className="mh-task">
                            <div className="mh-chore-name">{active.name}</div>
                            {active.next && (
                                <div className="mh-sub">
                                    {active.next} <span className="mh-cyan">({active.where})</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="mh-task mh-green">All done for this round.</div>
                    )}
                    {hud.role === "murderer" && <div className="mh-hint mh-red">Chores are your alibi.</div>}
                </div>
            )}

            {hud.notes.length > 0 && (
                <div className="mh-panel mh-notes">
                    <div className="mh-title">Notebook</div>
                    {hud.notes.map((n, i) => (
                        <div key={i} className="mh-note">{n}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
