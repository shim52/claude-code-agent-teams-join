#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// --- Types ---

interface TeamMember {
  agentId: string;
  name: string;
  agentType: string;
  model?: string;
  prompt?: string;
  color?: string;
  planModeRequired?: boolean;
  joinedAt: number;
  tmuxPaneId?: string;
  cwd?: string;
  subscriptions?: string[];
  backendType?: string;
  isActive?: boolean;
}

interface TeamConfig {
  name: string;
  description?: string;
  createdAt: number;
  leadAgentId: string;
  leadSessionId: string;
  members: TeamMember[];
}

// --- Helpers ---

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const TEAMS_DIR = path.join(CLAUDE_DIR, "teams");
const SESSION_ENV_DIR = path.join(CLAUDE_DIR, "session-env");

function getTeamNames(): string[] {
  try {
    return fs
      .readdirSync(TEAMS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function readTeamConfig(teamName: string): TeamConfig | null {
  const configPath = path.join(TEAMS_DIR, teamName, "config.json");
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as TeamConfig;
  } catch {
    return null;
  }
}

function writeTeamConfig(teamName: string, config: TeamConfig): void {
  const configPath = path.join(TEAMS_DIR, teamName, "config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf-8");
}

function getCurrentSessionId(): string | null {
  try {
    const entries = fs.readdirSync(SESSION_ENV_DIR, { withFileTypes: true });
    let newest: { name: string; mtimeMs: number } | null = null;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const stat = fs.statSync(path.join(SESSION_ENV_DIR, entry.name));
      if (!newest || stat.mtimeMs > newest.mtimeMs) {
        newest = { name: entry.name, mtimeMs: stat.mtimeMs };
      }
    }

    return newest?.name ?? null;
  } catch {
    return null;
  }
}

function isSessionActive(sessionId: string): boolean {
  const sessionDir = path.join(SESSION_ENV_DIR, sessionId);
  try {
    const stat = fs.statSync(sessionDir);
    const ageMs = Date.now() - stat.mtimeMs;
    // Consider a session "active" if modified in the last 5 minutes
    return ageMs < 5 * 60 * 1000;
  } catch {
    return false;
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

// --- MCP Server ---

const server = new McpServer({
  name: "claude-team-join",
  version: "1.0.0",
});

// Tool 1: list_teams
server.tool(
  "list_teams",
  "List all Claude Code teams with their status, members, and whether the lead session is stale or current",
  {},
  async () => {
    const teamNames = getTeamNames();

    if (teamNames.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No teams found in ~/.claude/teams/",
          },
        ],
      };
    }

    const currentSessionId = getCurrentSessionId();
    const teams = [];

    for (const name of teamNames) {
      const config = readTeamConfig(name);
      if (!config) continue;

      const isCurrentSession = config.leadSessionId === currentSessionId;
      const isActive = isSessionActive(config.leadSessionId);

      const members = config.members.map((m) => ({
        name: m.name,
        role: m.agentType,
        isActive: m.isActive ?? false,
      }));

      teams.push({
        teamName: name,
        description: config.description ?? "(no description)",
        createdAt: formatTimestamp(config.createdAt),
        memberCount: config.members.length,
        members,
        leadSessionId: config.leadSessionId,
        leadSessionStatus: isCurrentSession
          ? "current"
          : isActive
            ? "active-other"
            : "stale",
      });
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(teams, null, 2),
        },
      ],
    };
  }
);

// Tool 2: team_join
server.tool(
  "team_join",
  "Rejoin an existing team by updating its config to point to the current session. This makes you the new team lead.",
  {
    team_name: z.string().describe("Name of the team to rejoin"),
  },
  async ({ team_name }) => {
    const config = readTeamConfig(team_name);
    if (!config) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Team "${team_name}" not found. Use list_teams to see available teams.`,
          },
        ],
        isError: true,
      };
    }

    const currentSessionId = getCurrentSessionId();
    if (!currentSessionId) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: Could not detect current session ID from ~/.claude/session-env/",
          },
        ],
        isError: true,
      };
    }

    const previousSessionId = config.leadSessionId;

    // Update the lead session to current
    config.leadSessionId = currentSessionId;
    config.leadAgentId = `team-lead@${team_name}`;

    // Reset all members' isActive to false (they need to be re-spawned)
    for (const member of config.members) {
      member.isActive = false;
    }

    writeTeamConfig(team_name, config);

    const nonLeadMembers = config.members.filter(
      (m) => m.name !== "team-lead"
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              status: "joined",
              teamName: team_name,
              description: config.description,
              previousSessionId,
              newSessionId: currentSessionId,
              membersResetToInactive: config.members.length,
              teammatesReadyToRespawn: nonLeadMembers.map((m) => ({
                name: m.name,
                role: m.agentType,
                hasPrompt: !!m.prompt,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Tool 3: get_team_members
server.tool(
  "get_team_members",
  "Get full teammate definitions (name, role, prompt, model) so they can be re-spawned with the Task tool using identical configurations",
  {
    team_name: z.string().describe("Name of the team to get members from"),
  },
  async ({ team_name }) => {
    const config = readTeamConfig(team_name);
    if (!config) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Team "${team_name}" not found. Use list_teams to see available teams.`,
          },
        ],
        isError: true,
      };
    }

    // Return non-lead members with their full spawn configurations
    const teammates = config.members
      .filter((m) => m.name !== "team-lead")
      .map((m) => ({
        name: m.name,
        agentType: m.agentType,
        model: m.model,
        prompt: m.prompt,
        color: m.color,
        planModeRequired: m.planModeRequired ?? false,
        cwd: m.cwd,
        previousAgentId: m.agentId,
      }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              teamName: team_name,
              description: config.description,
              teammates,
            },
            null,
            2
          ),
        },
      ],
    };
  }
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
