import * as fs from "fs";

const MCP_SERVER_KEY = "claude-team-join";

export function handleInstall(configPath: string): { success: boolean; message: string } {
  let config: Record<string, any>;

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    try {
      config = JSON.parse(raw);
    } catch {
      // File exists but contains malformed JSON — do NOT overwrite
      return {
        success: false,
        message: `Error: ${configPath} contains malformed JSON. Fix it manually before running --install.`,
      };
    }
  } catch {
    // File doesn't exist — start fresh
    config = {};
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers[MCP_SERVER_KEY] = {
    type: "stdio",
    command: "npx",
    args: ["-y", "claude-team-join"],
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  return {
    success: true,
    message: "Added claude-team-join to ~/.claude.json\n  Restart Claude Code to pick up the new MCP server.",
  };
}

export function handleUninstall(configPath: string): { success: boolean; message: string } {
  let config: Record<string, any>;

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(raw);
  } catch {
    return {
      success: true,
      message: "claude-team-join is not configured in ~/.claude.json",
    };
  }

  if (config.mcpServers?.[MCP_SERVER_KEY]) {
    delete config.mcpServers[MCP_SERVER_KEY];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    return {
      success: true,
      message: "Removed claude-team-join from ~/.claude.json",
    };
  }

  return {
    success: true,
    message: "claude-team-join is not configured in ~/.claude.json",
  };
}
