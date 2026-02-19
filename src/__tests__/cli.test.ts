import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { handleInstall, handleUninstall } from "../cli.js";

let tmpDir: string;
let configPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-cli-test-"));
  configPath = path.join(tmpDir, ".claude.json");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// --- handleInstall ---

describe("handleInstall", () => {
  it("creates .claude.json when it doesn't exist", () => {
    const result = handleInstall(configPath);
    expect(result.success).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.mcpServers["claude-team-join"]).toBeDefined();
  });

  it("adds entry to existing config, preserves other keys", () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ theme: "dark", mcpServers: {} }, null, 2)
    );

    const result = handleInstall(configPath);
    expect(result.success).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.theme).toBe("dark");
    expect(config.mcpServers["claude-team-join"]).toBeDefined();
  });

  it("adds entry alongside other mcpServers", () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          "other-server": { type: "stdio", command: "other" },
        },
      })
    );

    handleInstall(configPath);

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.mcpServers["other-server"]).toBeDefined();
    expect(config.mcpServers["claude-team-join"]).toBeDefined();
  });

  it("overwrites existing claude-team-join entry", () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          "claude-team-join": { type: "stdio", command: "old-command" },
        },
      })
    );

    handleInstall(configPath);

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.mcpServers["claude-team-join"].command).toBe("npx");
  });

  it("aborts with error if existing .claude.json has malformed JSON", () => {
    fs.writeFileSync(configPath, '{"bad": json,}');

    const result = handleInstall(configPath);
    expect(result.success).toBe(false);
    expect(result.message).toContain("malformed JSON");

    // Verify file was NOT overwritten
    const raw = fs.readFileSync(configPath, "utf-8");
    expect(raw).toBe('{"bad": json,}');
  });

  it("writes correct config shape", () => {
    handleInstall(configPath);

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const entry = config.mcpServers["claude-team-join"];
    expect(entry).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "claude-team-join"],
    });
  });
});

// --- handleUninstall ---

describe("handleUninstall", () => {
  it("removes entry, preserves other mcpServers", () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          "claude-team-join": { type: "stdio", command: "npx" },
          "other-server": { type: "stdio", command: "other" },
        },
      })
    );

    const result = handleUninstall(configPath);
    expect(result.success).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.mcpServers["claude-team-join"]).toBeUndefined();
    expect(config.mcpServers["other-server"]).toBeDefined();
  });

  it("handles missing file gracefully", () => {
    const result = handleUninstall(configPath);
    expect(result.success).toBe(true);
    expect(result.message).toContain("not configured");
  });

  it("handles config without the entry gracefully", () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ mcpServers: { other: {} } })
    );

    const result = handleUninstall(configPath);
    expect(result.success).toBe(true);
    expect(result.message).toContain("not configured");
  });
});
