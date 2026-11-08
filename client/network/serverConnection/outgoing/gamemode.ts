import { send } from "../connection/send";
import { state } from "../state";

/** A message for the running gamemode's own handlers (GAMEMODE_MESSAGE), e.g. its lobby. */
export function sendGamemodeMessage(messageType: string, payload: Record<string, unknown> = {}): void {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;
    send({ type: "gamemode_message", payload: { messageType, payload } });
}
