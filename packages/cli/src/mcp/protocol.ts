import { toolVersion } from "../version.js";
import { callTool, TOOLS } from "./tools.js";
import type { CommandIo } from "../io.js";

/** The version of the protocol the server speaks; a client naming another one is answered with this one. */
export const PROTOCOL_VERSION = "2025-06-18";

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

type Id = string | number | null;

interface Request {
  id?: Id;
  method: string;
  params?: Record<string, unknown>;
}

interface Response {
  jsonrpc: "2.0";
  id: Id;
  result?: unknown;
  error?: { code: number; message: string };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A message read as a request, or nothing for what is not one. */
export function parseRequest(line: string): Request | { parseError: true } | undefined {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return { parseError: true };
  }
  if (!isObject(message) || typeof message["method"] !== "string") return undefined;
  const id = message["id"];
  return {
    ...(typeof id === "string" || typeof id === "number" || id === null ? { id } : {}),
    method: message["method"],
    ...(isObject(message["params"]) ? { params: message["params"] } : {}),
  };
}

function reply(id: Id, result: unknown): Response {
  return { jsonrpc: "2.0", id, result };
}

function refuse(id: Id, code: number, message: string): Response {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** The server over one model: what each request is answered with, or nothing for a notification. */
export class Server {
  constructor(
    private readonly io: CommandIo,
    private readonly model: readonly string[],
  ) {}

  async handle(line: string): Promise<Response | undefined> {
    if (line.trim() === "") return undefined;
    const request = parseRequest(line);
    if (request === undefined) return refuse(null, INVALID_REQUEST, "not a request");
    if ("parseError" in request) return refuse(null, PARSE_ERROR, "not JSON");
    const { id } = request;
    if (id === undefined) return undefined;
    switch (request.method) {
      case "initialize":
        return reply(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "concordance", version: toolVersion() },
        });
      case "ping":
        return reply(id, {});
      case "tools/list":
        return reply(id, { tools: TOOLS });
      case "tools/call": {
        const name = request.params?.["name"];
        const args = request.params?.["arguments"];
        if (typeof name !== "string") return refuse(id, INVALID_PARAMS, "the call names no tool");
        const result = await callTool(this.io, this.model, name, isObject(args) ? args : {});
        if (result === undefined) return refuse(id, INVALID_PARAMS, `no tool named ${name}`);
        return reply(id, {
          content: [{ type: "text", text: result.text }],
          isError: result.isError,
        });
      }
      default:
        return refuse(id, METHOD_NOT_FOUND, `no method ${request.method}`);
    }
  }
}
