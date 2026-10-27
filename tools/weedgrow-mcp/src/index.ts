import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerEmulatorResetAndSeed } from "./tools/emulatorResetAndSeed.js";
import { registerDescribeCollection } from "./tools/describeCollection.js";
import { registerRunQuery } from "./tools/runQuery.js";
import { loadEnv } from "./env.js";

function logInfo(message: string) {
  console.log(`[weedgrow-mcp] ${message}`);
}

function parsePort(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) return fallback;
  return port;
}

async function main() {
  loadEnv();
  const host = process.env.WEEDGROW_MCP_HOST || "127.0.0.1";
  const port = parsePort(process.env.WEEDGROW_MCP_PORT, 8787);

  const server = new McpServer({
    name: "weedgrow-mcp",
    version: "0.1.0",
  });

  registerEmulatorResetAndSeed(server);
  registerDescribeCollection(server);
  registerRunQuery(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  const httpServer = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end("ok");
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404).end("Not found");
      return;
    }
    void transport.handleRequest(req, res);
  });

  httpServer.listen(port, host, () => {
    logInfo(`MCP server listening on http://${host}:${port}/mcp`);
  });

  const shutdown = () => {
    logInfo("Shutting down MCP server...");
    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[weedgrow-mcp] Failed to start:", error);
  process.exit(1);
});
