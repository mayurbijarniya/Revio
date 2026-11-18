import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiKey, readBearerToken } from "@/lib/api-keys";
import { createRevioMcpServer } from "@/lib/mcp/server";

/**
 * /api/mcp - Revio MCP server (Streamable HTTP, stateless).
 *
 * Every request carries "Authorization: Bearer <Revio API key>" and gets its own server
 * instance, so nothing is shared between requests or serverless instances.
 */
export const dynamic = "force-dynamic";

function jsonRpcError(status: number, code: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function handleMcpRequest(request: Request): Promise<Response> {
  let identity: Awaited<ReturnType<typeof authenticateApiKey>>;
  try {
    identity = await authenticateApiKey(readBearerToken(request.headers.get("authorization")));
  } catch (error) {
    // e.g. the api_keys table has not been created yet
    console.error("[MCP] API key check failed:", error);
    return jsonRpcError(503, -32603, "Revio API keys are not available on this server yet. Please try again later.");
  }

  if (!identity) {
    return jsonRpcError(
      401,
      -32001,
      "Missing or invalid Revio API key. Create one in Revio → Settings → API & MCP and send it as 'Authorization: Bearer <key>'.",
      { "WWW-Authenticate": 'Bearer realm="revio"' }
    );
  }

  const server = createRevioMcpServer(identity);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    console.error("[MCP] Request failed:", error);
    return jsonRpcError(500, -32603, "Internal server error");
  } finally {
    await server.close().catch(() => undefined);
  }
}

export const POST = handleMcpRequest;
export const GET = handleMcpRequest;
export const DELETE = handleMcpRequest;
