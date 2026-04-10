#!/usr/bin/env node

import { createInterface } from "readline";
import { handleMessage } from "./mcp-server.js";
import { init, close } from "./db.js";

// Parse CLI args
const args = process.argv.slice(2);
let connectionString;
let readOnly = true;
let statementTimeout = 30000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--read-only") {
    readOnly = true;
  } else if (args[i] === "--no-read-only") {
    readOnly = false;
  } else if (args[i] === "--timeout" && args[i + 1]) {
    statementTimeout = parseInt(args[++i]);
  } else if (!args[i].startsWith("--")) {
    connectionString = args[i];
  }
}

init({ connectionString, readOnly, statementTimeout });

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  if (!line.trim()) return;

  let message;
  try {
    message = JSON.parse(line);
  } catch {
    const error = {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    };
    process.stdout.write(JSON.stringify(error) + "\n");
    return;
  }

  const response = await handleMessage(message);
  if (response) {
    process.stdout.write(JSON.stringify(response) + "\n");
  }
});

rl.on("close", async () => {
  await close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await close();
  process.exit(0);
});
