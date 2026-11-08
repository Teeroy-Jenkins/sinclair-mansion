// Opens the game port on the home router (UPnP IGD) when someone hosts, so friends over the
// internet can connect, and asks the router for the public address to share with them. Many
// routers allow this; some have UPnP off, and carrier-grade NAT can't be opened at all (then
// it's a manual port forward, or a virtual LAN such as Radmin VPN / ZeroTier).
import dgram from "dgram";
import http from "http";

const SSDP_ADDR = "239.255.255.250";
const SSDP_PORT = 1900;
const SEARCH_MS = 3000;
const SERVICES = ["urn:schemas-upnp-org:service:WANIPConnection:2", "urn:schemas-upnp-org:service:WANIPConnection:1", "urn:schemas-upnp-org:service:WANPPPConnection:1"];

export type UpnpState =
    | { status: "off" | "working" }
    | { status: "open"; publicIp?: string }
    | { status: "failed"; reason: string; publicIp?: string; consecutiveFailures?: number };

interface Gateway {
    controlUrl: string;
    service: string;
}

/** Finds the router's description URL by SSDP. */
function discover(): Promise<string> {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket("udp4");
        const timer = setTimeout(() => {
            socket.close();
            reject(new Error("no UPnP router answered"));
        }, SEARCH_MS);
        socket.on("message", (msg) => {
            const location = /^location:\s*(.+)$/im.exec(msg.toString())?.[1]?.trim();
            if (!location) return;
            clearTimeout(timer);
            socket.close();
            resolve(location);
        });
        socket.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
        const search = (st: string) =>
            Buffer.from(`M-SEARCH * HTTP/1.1\r\nHOST: ${SSDP_ADDR}:${SSDP_PORT}\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${st}\r\n\r\n`);
        socket.bind(() => {
            for (const st of ["urn:schemas-upnp-org:device:InternetGatewayDevice:1", "urn:schemas-upnp-org:device:InternetGatewayDevice:2"]) {
                socket.send(search(st), SSDP_PORT, SSDP_ADDR);
            }
        });
    });
}

/** A small HTTP request; also says which local address reached the router. */
function request(url: string, body?: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string; localAddress?: string }> {
    // Send the body with a Content-Length: without one Node sends it chunked, and routers running
    // MiniUPnPd (and others) read a chunked SOAP body as empty and answer "402 Invalid Args".
    if (body) headers = { ...headers, "Content-Length": String(Buffer.byteLength(body)) };
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method: body ? "POST" : "GET", headers, timeout: 5000 }, (res) => {
            let text = "";
            res.setEncoding("utf8");
            res.on("data", (c) => (text += c));
            res.on("end", () => resolve({ status: res.statusCode ?? 0, text, localAddress: req.socket?.localAddress }));
        });
        req.on("timeout", () => req.destroy(new Error("router timed out")));
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

async function findGateway(): Promise<Gateway & { localAddress: string }> {
    const location = await discover();
    const desc = await request(location);
    for (const service of SERVICES) {
        const at = desc.text.indexOf(service);
        if (at < 0) continue;
        const control = /<controlURL>\s*([^<]+?)\s*<\/controlURL>/i.exec(desc.text.slice(at))?.[1];
        if (!control) continue;
        return { service, controlUrl: new URL(control, location).toString(), localAddress: (desc.localAddress ?? "").replace(/^::ffff:/, "") };
    }
    throw new Error("the router doesn't offer port mapping");
}

async function soap(gw: Gateway, action: string, args: Record<string, string | number>): Promise<string> {
    const params = Object.entries(args).map(([k, v]) => `<${k}>${v}</${k}>`).join("");
    const body =
        `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
        `<s:Body><u:${action} xmlns:u="${gw.service}">${params}</u:${action}></s:Body></s:Envelope>`;
    const res = await request(gw.controlUrl, body, { "Content-Type": 'text/xml; charset="utf-8"', SOAPAction: `"${gw.service}#${action}"` });
    if (res.status !== 200) {
        const why = /<errorDescription>([^<]*)<\/errorDescription>/i.exec(res.text)?.[1];
        throw new Error(why ? `the router said "${why}"` : `the router refused (${res.status})`);
    }
    return res.text;
}

/** One port mapping, renewed while the server runs and removed when it stops. */
export class PortMapper {
    state: UpnpState = { status: "off" };
    private gw?: Gateway;
    private renew?: NodeJS.Timeout;

    constructor(private readonly port: number, private readonly log: (msg: string) => void) {}

    /** Opens the port (once; later calls do nothing while it's open or being opened). */
    open(): void {
        if (this.state.status === "working" || this.state.status === "open") return;
        this.state = { status: "working" };
        void this.map()
            .then((publicIp) => {
                this.state = { status: "open", publicIp };
                this.log(`[sinclair] UPnP: opened TCP ${this.port} on the router; public address ${publicIp ?? "unknown"}`);
                // Renew every 30 minutes; after N consecutive failures, give up so the UI shows the issue.
                let failures = 0;
                const MAX_RENEW_FAILURES = 3;
                this.renew ??= setInterval(() => {
                    void this.map()
                        .then(() => { failures = 0; })
                        .catch(() => {
                            failures++;
                            if (failures >= MAX_RENEW_FAILURES) {
                                this.state = { status: "failed", reason: `port renewal failed after ${MAX_RENEW_FAILURES} attempts`, consecutiveFailures: failures };
                                this.log(`[sinclair] UPnP: port mapping likely lost after ${MAX_RENEW_FAILURES} failed renewals`);
                                clearInterval(this.renew);
                                this.renew = undefined;
                            }
                        });
                }, 30 * 60_000);
            })
            .catch(async (err: Error) => {
                // The router may still say what the public address is (for a manual port forward).
                const publicIp = this.gw ? await this.externalIp(this.gw) : undefined;
                this.state = { status: "failed", reason: err.message, publicIp };
                this.log(`[sinclair] UPnP: couldn't open the port (${err.message})`);
            });
    }

    private async map(): Promise<string | undefined> {
        const gw = await findGateway();
        this.gw = gw;
        const mapping = {
            NewRemoteHost: "",
            NewExternalPort: this.port,
            NewProtocol: "TCP",
            NewInternalPort: this.port,
            NewInternalClient: gw.localAddress,
            NewEnabled: 1,
            NewPortMappingDescription: "Murder at Sinclair Mansion",
        };
        // Some routers only take permanent mappings (lease 0) and answer anything else with
        // "OnlyPermanentLeasesSupported". close() removes it either way.
        await soap(gw, "AddPortMapping", { ...mapping, NewLeaseDuration: 3600 })
            .catch(() => soap(gw, "AddPortMapping", { ...mapping, NewLeaseDuration: 0 }));
        return this.externalIp(gw);
    }

    private async externalIp(gw: Gateway): Promise<string | undefined> {
        const ext = await soap(gw, "GetExternalIPAddress", {}).catch(() => "");
        return /<NewExternalIPAddress>([^<]*)<\/NewExternalIPAddress>/i.exec(ext)?.[1]?.trim() || undefined;
    }

    /** True if the current state means the port mapping is likely alive. */
    private get isAlive(): boolean {
        return this.state.status === "open";
    }

    close(): void {
        if (this.renew) clearInterval(this.renew);
        const gw = this.gw;
        if (!gw || this.state.status !== "open") return;
        this.state = { status: "off" };
        void soap(gw, "DeletePortMapping", { NewRemoteHost: "", NewExternalPort: this.port, NewProtocol: "TCP" }).catch(() => {});
    }
}

/** True for addresses the internet can't reach (CGNAT and private ranges). */
export function isPrivateIp(ip: string): boolean {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127) || a === 169;
}
