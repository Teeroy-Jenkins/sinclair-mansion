import path from "path";

/** Absolute path to the `@sinclair-mansion/server` package root. */
export const SERVER_ROOT = path.resolve(__dirname, "..");

/** Absolute path to the sibling `@sinclair-mansion/client` package. */
export const CLIENT_ROOT = path.resolve(SERVER_ROOT, "../client");

export function serverPath(...parts: string[]): string {
    return path.join(SERVER_ROOT, ...parts);
}

export function clientPath(...parts: string[]): string {
    return path.join(CLIENT_ROOT, ...parts);
}
