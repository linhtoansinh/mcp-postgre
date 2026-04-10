import { getToolDefinitions, callTool } from "./tools.js";

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "pg-mcp-server", version: "1.0.0" };

export async function handleMessage(message) {
  // Notifications have no id — no response needed
  if (message.method && message.id === undefined) {
    return null;
  }

  const { id, method, params } = message;

  try {
    switch (method) {
      case "initialize":
        return jsonrpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });

      case "ping":
        return jsonrpcResult(id, {});

      case "tools/list":
        return jsonrpcResult(id, { tools: getToolDefinitions() });

      case "tools/call": {
        const { name, arguments: args } = params;
        try {
          const text = await callTool(name, args || {});
          return jsonrpcResult(id, {
            content: [{ type: "text", text }],
            isError: false,
          });
        } catch (err) {
          return jsonrpcResult(id, {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true,
          });
        }
      }

      default:
        return jsonrpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    return jsonrpcError(id, -32603, `Internal error: ${err.message}`);
  }
}

function jsonrpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
