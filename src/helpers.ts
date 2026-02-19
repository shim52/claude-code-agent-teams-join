import * as fs from "fs";
import * as path from "path";

// --- Types ---

export interface TeamMember {
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

export interface TeamConfig {
  name: string;
  description?: string;
  createdAt: number;
  leadAgentId: string;
  leadSessionId: string;
  members: TeamMember[];
}

function isValidTeamName(name: string): boolean {
  return name.length > 0 && !/[\/\\]|\.\./.test(name);
}

export function createHelpers(homeDir: string) {
  const CLAUDE_DIR = path.join(homeDir, ".claude");
  const TEAMS_DIR = path.join(CLAUDE_DIR, "teams");
  const SESSION_ENV_DIR = path.join(CLAUDE_DIR, "session-env");
  const CLAUDE_CONFIG_PATH = path.join(homeDir, ".claude.json");

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
    if (!isValidTeamName(teamName)) {
      return null;
    }
    const configPath = path.join(TEAMS_DIR, teamName, "config.json");
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      // Validate required fields
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.members)) {
        return null;
      }
      return parsed as TeamConfig;
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      // Log non-ENOENT errors (e.g. permission denied) so they aren't silently lost
      process.stderr.write(`Warning: failed to read team config for "${teamName}": ${err instanceof Error ? err.message : String(err)}\n`);
      return null;
    }
  }

  function writeTeamConfig(teamName: string, config: TeamConfig): void {
    if (!isValidTeamName(teamName)) {
      throw new Error(`Invalid team name: "${teamName}"`);
    }
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

  return {
    getTeamNames,
    readTeamConfig,
    writeTeamConfig,
    getCurrentSessionId,
    isSessionActive,
    formatTimestamp,
    CLAUDE_CONFIG_PATH,
    TEAMS_DIR,
    SESSION_ENV_DIR,
  };
}

export type Helpers = ReturnType<typeof createHelpers>;
