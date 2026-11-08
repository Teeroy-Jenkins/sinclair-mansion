import { send } from "../connection/send";
import { state } from "../state";

export function sendTeleport(to: { x: number; y: number }, level?: number): void {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;
    send({ type: "teleport", payload: { to: { x: to.x | 0, y: to.y | 0 }, level } } as any);
}

export function isServerConnected(): boolean {
    return !!state.socket && state.socket.readyState === WebSocket.OPEN;
}

export function getLastUrl(): string {
    return state.lastUrl;
}

export function setServerUrl(url: string): void {
    state.lastUrl = url;
}
