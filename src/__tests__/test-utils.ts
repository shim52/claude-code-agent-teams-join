import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { TeamConfig } from "../helpers.js";

export function createTestHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-team-join-test-"));
  fs.mkdirSync(path.join(dir, ".claude", "teams"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".claude", "session-env"), { recursive: true });
  return dir;
}

export function cleanupTestHome(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function createTeamFixture(
  home: string,
  teamName: string,
  config: TeamConfig
): void {
  const teamDir = path.join(home, ".claude", "teams", teamName);
  fs.mkdirSync(teamDir, { recursive: true });
  fs.writeFileSync(
    path.join(teamDir, "config.json"),
    JSON.stringify(config, null, 4),
    "utf-8"
  );
}

export function createSessionFixture(
  home: string,
  sessionId: string,
  mtimeMs?: number
): void {
  const sessionDir = path.join(home, ".claude", "session-env", sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  if (mtimeMs !== undefined) {
    const time = new Date(mtimeMs);
    fs.utimesSync(sessionDir, time, time);
  }
}

export function makeTeamConfig(overrides: Partial<TeamConfig> = {}): TeamConfig {
  return {
    name: "test-team",
    createdAt: 1700000000000,
    leadAgentId: "agent-123",
    leadSessionId: "session-abc",
    members: [
      {
        agentId: "agent-123",
        name: "team-lead",
        agentType: "general-purpose",
        joinedAt: 1700000000000,
        isActive: true,
      },
      {
        agentId: "agent-456",
        name: "researcher",
        agentType: "Explore",
        joinedAt: 1700000001000,
        prompt: "Research the codebase",
        model: "sonnet",
        color: "blue",
        cwd: "/tmp",
        isActive: true,
      },
    ],
    ...overrides,
  };
}
