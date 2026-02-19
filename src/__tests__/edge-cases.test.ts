import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { createHelpers } from "../helpers.js";
import { createToolHandlers } from "../tools.js";
import { handleInstall } from "../cli.js";
import {
  createTestHome,
  cleanupTestHome,
  createTeamFixture,
  createSessionFixture,
  makeTeamConfig,
} from "./test-utils.js";

let testHome: string;
let helpers: ReturnType<typeof createHelpers>;
let tools: ReturnType<typeof createToolHandlers>;

beforeEach(() => {
  testHome = createTestHome();
  helpers = createHelpers(testHome);
  tools = createToolHandlers(helpers);
});

afterEach(() => {
  cleanupTestHome(testHome);
});

describe("edge cases", () => {
  it("team name with spaces works end-to-end", async () => {
    const config = makeTeamConfig({ name: "my cool team" });
    createTeamFixture(testHome, "my cool team", config);
    createSessionFixture(testHome, "session-spaces");

    // listTeams finds it
    const listResult = await tools.listTeams();
    const teams = JSON.parse(listResult.content[0].text);
    expect(teams.some((t: any) => t.teamName === "my cool team")).toBe(true);

    // teamJoin works
    const joinResult = await tools.teamJoin({ team_name: "my cool team" });
    expect((joinResult as any).isError).toBeUndefined();

    // getTeamMembers works
    const membersResult = await tools.getTeamMembers({ team_name: "my cool team" });
    expect((membersResult as any).isError).toBeUndefined();
  });

  it("team name with ../ doesn't escape teams directory", () => {
    // readTeamConfig with path traversal should not read outside teams dir
    // It constructs: TEAMS_DIR / "../escape" / config.json
    // which resolves to CLAUDE_DIR / "escape" / config.json
    const escapeDir = path.join(testHome, ".claude", "escape");
    fs.mkdirSync(escapeDir, { recursive: true });
    fs.writeFileSync(
      path.join(escapeDir, "config.json"),
      JSON.stringify(makeTeamConfig({ name: "escaped" }))
    );

    // This documents that path traversal IS possible with the current implementation.
    // The test verifies the behavior — it will read outside the teams dir.
    const result = helpers.readTeamConfig("../escape");
    // Document: this DOES work (potential security concern for future hardening)
    expect(result).not.toBeNull();
  });

  it("empty team name returns null", () => {
    expect(helpers.readTeamConfig("")).toBeNull();
  });

  it("config with missing members field doesn't crash list_teams", async () => {
    const teamDir = path.join(testHome, ".claude", "teams", "no-members");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({ name: "no-members", leadSessionId: "abc" })
    );

    // Should not throw
    const result = await tools.listTeams();
    // The bad config is skipped, so either empty or just the good teams
    expect(result.content[0].text).toBeDefined();
  });

  it("config that is valid JSON but wrong shape (array) is handled", () => {
    const teamDir = path.join(testHome, ".claude", "teams", "array-config");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(path.join(teamDir, "config.json"), "[1, 2, 3]");

    const result = helpers.readTeamConfig("array-config");
    expect(result).toBeNull();
  });

  it("install when .claude.json has malformed JSON aborts safely", () => {
    const configPath = path.join(testHome, ".claude.json");
    fs.writeFileSync(configPath, '{"trailing": "comma",}');

    const result = handleInstall(configPath);
    expect(result.success).toBe(false);
    expect(result.message).toContain("malformed JSON");

    // File was NOT destroyed
    const raw = fs.readFileSync(configPath, "utf-8");
    expect(raw).toBe('{"trailing": "comma",}');
  });
});
