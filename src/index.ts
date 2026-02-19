#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as os from "os";

import { createHelpers } from "./helpers.js";
import { handleInstall, handleUninstall } from "./cli.js";
import { createToolHandlers } from "./tools.js";

// --- CLI: --install / --uninstall ---

const helpers = createHelpers(os.homedir());

const arg = process.argv[2];
if (arg === "--install" || arg === "install") {
  const result = handleInstall(helpers.CLAUDE_CONFIG_PATH);
  console.log(result.success ? `\u2713 ${result.message}` : result.message);
  process.exit(result.success ? 0 : 1);
}
if (arg === "--uninstall" || arg === "uninstall") {
  const result = handleUninstall(helpers.CLAUDE_CONFIG_PATH);
  console.log(result.success ? `\u2713 ${result.message}` : result.message);
  process.exit(result.success ? 0 : 1);
}

// --- MCP Server ---

const server = new McpServer({
  name: "claude-team-join",
  version: "1.1.0",
});

const toolHandlers = createToolHandlers(helpers);

server.tool(
  "list_teams",
  "List all Claude Code teams with their status, members, and whether the lead session is stale or current",
  {},
  toolHandlers.listTeams
);

server.tool(
  "team_join",
  "Rejoin an existing team by updating its config to point to the current session. This makes you the new team lead.",
  {
    team_name: z.string().describe("Name of the team to rejoin"),
  },
  toolHandlers.teamJoin
);

server.tool(
  "get_team_members",
  "Get full teammate definitions (name, role, prompt, model) so they can be re-spawned with the Task tool using identical configurations",
  {
    team_name: z.string().describe("Name of the team to get members from"),
  },
  toolHandlers.getTeamMembers
);

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
