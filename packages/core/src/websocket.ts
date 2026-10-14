import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { PROTOCOL_VERSION } from "@bit/protocol";
import { BitError } from "./errors.ts";
import { createLogger, type Logger } from "./logger.ts";
import { JsonRpcServer } from "./jsonrpc.ts";

export const DEFAULT_DEV_ORIGINS = [
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
] as const;

export function createDevToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokensEqual(presented: string, expected: string): boolean {
  const left = createHash("sha256").update(presented).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

type Rejection = "origin" | "token" | "protocol";

function authorize(request: IncomingMessage, token: string, allowedOrigins: ReadonlySet<string>): Rejection | undefined {
  const origin = request.headers.origin;
  if (typeof origin !== "string" || !allowedOrigins.has(origin)) {
    return "origin";
  }
  let url: URL;
  try {
    url = new URL(request.url ?? "/", "http://127.0.0.1");
  } catch {
    return "token";
  }
  const presented = url.searchParams.get("token");
  if (presented === null || !tokensEqual(presented, token)) {
    return "token";
  }
  const protocolVersion = url.searchParams.get("protocolVersion");
  if (protocolVersion !== null && protocolVersion !== PROTOCOL_VERSION) {
    return "protocol";
  }
  return undefined;
}

export class DevWebSocket {
  constructor(
    private readonly http: HttpServer,
    private readonly sockets: WebSocketServer,
    private readonly clients: Set<WebSocket>,
    readonly port: number,
    readonly token: string,
  ) {}

  endpoint(): string {
    return `ws://127.0.0.1:${this.port}/?token=${encodeURIComponent(this.token)}`;
  }

  async dispose(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    await new Promise<void>((resolve, reject) => {
      this.sockets.close((error) => (error ? reject(error) : resolve()));
    });
    if (this.http.listening) {
      await new Promise<void>((resolve, reject) => {
        this.http.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }
}

export async function startDevWebSocket(options: {
  rpc: JsonRpcServer;
  token?: string;
  allowedOrigins?: readonly string[];
  logger?: Logger;
}): Promise<DevWebSocket> {
  const token = options.token ?? createDevToken();
  const logger = options.logger ?? createLogger();
  const allowedOrigins = new Set(options.allowedOrigins ?? DEFAULT_DEV_ORIGINS);
  const http = createServer((_request, response) => {
    response.writeHead(404);
    response.end();
  });
  const sockets = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  http.on("upgrade", (request, socket, head) => {
    const rejection = authorize(request, token, allowedOrigins);
    if (rejection) {
      logger.warn("dev websocket rejected", { reason: rejection });
      const status = rejection === "origin" ? 403 : rejection === "protocol" ? 400 : 401;
      const reason = rejection === "origin" ? "Forbidden" : rejection === "protocol" ? "Bad Request" : "Unauthorized";
      socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => {
      clients.add(client);
      client.on("message", (data, isBinary) => {
        if (isBinary) {
          client.close(1003, "unsupported data");
          return;
        }
        void options.rpc.handleRaw(data.toString()).then((response) => {
          if (response !== undefined && client.readyState === client.OPEN) {
            client.send(response);
          }
        }).catch((error: unknown) => {
          logger.error("dev websocket failed", { detail: error instanceof Error ? error.message : "unknown" });
        });
      });
      client.on("close", () => {
        clients.delete(client);
      });
    });
  });

  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(0, "127.0.0.1", () => resolve());
  });
  const address = http.address();
  if (!address || typeof address === "string" || address.address !== "127.0.0.1") {
    http.close();
    throw new BitError("websocket.bind", "dev transport must bind to 127.0.0.1");
  }
  return new DevWebSocket(http, sockets, clients, address.port, token);
}
