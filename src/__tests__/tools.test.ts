import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { createHelpers } from "../helpers.js";
import { createToolHandlers } from "../tools.js";
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

function parseToolText(result: { content: { type: string; text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

// --- listTeams ---

describe("listTeams", () => {
  it('returns "No teams found" when empty', async () => {
    const result = await tools.listTeams();
    expect(result.content[0].text).toContain("No teams found");
  });

  it("lists teams with correct structure", async () => {
    const config = makeTeamConfig({ name: "alpha", description: "Team Alpha" });
    createTeamFixture(testHome, "alpha", config);
    // Create a stale session so we get a predictable status
    createSessionFixture(testHome, config.leadSessionId, Date.now() - 10 * 60 * 1000);

    const result = await tools.listTeams();
    const teams = parseToolText(result);

    expect(teams).toHaveLength(1);
    expect(teams[0].teamName).toBe("alpha");
    expect(teams[0].description).toBe("Team Alpha");
    expect(teams[0].memberCount).toBe(2);
    expect(teams[0].members).toHaveLength(2);
    expect(teams[0]).toHaveProperty("leadSessionStatus");
  });

  it("skips teams with unreadable config", async () => {
    // Good team
    createTeamFixture(testHome, "good", makeTeamConfig({ name: "good" }));

    // Bad team — malformed JSON
    const badDir = path.join(testHome, ".claude", "teams", "bad");
    fs.mkdirSync(badDir);
    fs.writeFileSync(path.join(badDir, "config.json"), "{nope}");

    const result = await tools.listTeams();
    const teams = parseToolText(result);
    expect(teams).toHaveLength(1);
    expect(teams[0].teamName).toBe("good");
  });

  it("reports correct leadSessionStatus: stale", async () => {
    const config = makeTeamConfig({ leadSessionId: "old-session" });
    createTeamFixture(testHome, "stale-team", config);
    createSessionFixture(testHome, "old-session", Date.now() - 10 * 60 * 1000);

    // Create a different "current" session
    createSessionFixture(testHome, "current-session");

    const result = await tools.listTeams();
    const teams = parseToolText(result);
    expect(teams[0].leadSessionStatus).toBe("stale");
  });

  it("reports correct leadSessionStatus: current", async () => {
    // The "current" session is the newest in session-env
    createSessionFixture(testHome, "my-session");

    const config = makeTeamConfig({ leadSessionId: "my-session" });
    createTeamFixture(testHome, "current-team", config);

    const result = await tools.listTeams();
    const teams = parseToolText(result);
    expect(teams[0].leadSessionStatus).toBe("current");
  });

  it("reports correct leadSessionStatus: active-other", async () => {
    // Team's lead session is active but not the newest
    createSessionFixture(testHome, "other-active", Date.now() - 1000);
    createSessionFixture(testHome, "newest-session");

    const config = makeTeamConfig({ leadSessionId: "other-active" });
    createTeamFixture(testHome, "active-team", config);

    const result = await tools.listTeams();
    const teams = parseToolText(result);
    expect(teams[0].leadSessionStatus).toBe("active-other");
  });
});

// --- teamJoin ---

describe("teamJoin", () => {
  it("returns error for non-existent team", async () => {
    const result = await tools.teamJoin({ team_name: "ghost" });
    expect((result as any).isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("returns error when no current session detected", async () => {
    createTeamFixture(testHome, "orphan", makeTeamConfig());
    // Remove session-env so no session is detected
    fs.rmSync(path.join(testHome, ".claude", "session-env"), { recursive: true });

    const result = await tools.teamJoin({ team_name: "orphan" });
    expect((result as any).isError).toBe(true);
    expect(result.content[0].text).toContain("Could not detect");
  });

  it("updates leadSessionId and leadAgentId in config on disk", async () => {
    createTeamFixture(testHome, "join-test", makeTeamConfig());
    createSessionFixture(testHome, "new-session-123");

    await tools.teamJoin({ team_name: "join-test" });

    const updated = helpers.readTeamConfig("join-test")!;
    expect(updated.leadSessionId).toBe("new-session-123");
    expect(updated.leadAgentId).toBe("team-lead@join-test");
  });

  it("resets all members' isActive to false", async () => {
    const config = makeTeamConfig();
    config.members[0].isActive = true;
    config.members[1].isActive = true;
    createTeamFixture(testHome, "reset-test", config);
    createSessionFixture(testHome, "sess-1");

    await tools.teamJoin({ team_name: "reset-test" });

    const updated = helpers.readTeamConfig("reset-test")!;
    for (const m of updated.members) {
      expect(m.isActive).toBe(false);
    }
  });

  it("excludes team-lead from teammatesReadyToRespawn", async () => {
    createTeamFixture(testHome, "filter-test", makeTeamConfig());
    createSessionFixture(testHome, "sess-2");

    const result = await tools.teamJoin({ team_name: "filter-test" });
    const data = parseToolText(result);

    expect(data.teammatesReadyToRespawn).toHaveLength(1);
    expect(data.teammatesReadyToRespawn[0].name).toBe("researcher");
  });

  it("preserves all other config fields", async () => {
    const config = makeTeamConfig({
      description: "important team",
      createdAt: 1700000000000,
    });
    createTeamFixture(testHome, "preserve-test", config);
    createSessionFixture(testHome, "sess-3");

    await tools.teamJoin({ team_name: "preserve-test" });

    const updated = helpers.readTeamConfig("preserve-test")!;
    expect(updated.description).toBe("important team");
    expect(updated.createdAt).toBe(1700000000000);
    expect(updated.members).toHaveLength(2);
  });

  it("returns isError when writeTeamConfig fails", async () => {
    createTeamFixture(testHome, "write-fail", makeTeamConfig());
    createSessionFixture(testHome, "sess-4");

    // Remove the team directory so write fails
    fs.rmSync(path.join(testHome, ".claude", "teams", "write-fail"), { recursive: true });
    // But we need readTeamConfig to succeed, so recreate just the config in-memory
    // Actually, the read happens before the delete, so we need a different approach:
    // Create the fixture, then make the directory read-only
    createTeamFixture(testHome, "write-fail2", makeTeamConfig());
    createSessionFixture(testHome, "sess-5");

    // Remove the team dir after read will succeed but before write
    // Since we can't intercept, we'll just test the non-existent team path
    // which is already covered. Let's test by making the config file read-only.
    const configFile = path.join(testHome, ".claude", "teams", "write-fail2", "config.json");
    fs.chmodSync(configFile, 0o444);
    // Make directory read-only too
    fs.chmodSync(path.join(testHome, ".claude", "teams", "write-fail2"), 0o555);

    const result = await tools.teamJoin({ team_name: "write-fail2" });
    expect((result as any).isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to write");

    // Restore permissions for cleanup
    fs.chmodSync(path.join(testHome, ".claude", "teams", "write-fail2"), 0o755);
    fs.chmodSync(configFile, 0o644);
  });
});

// --- getTeamMembers ---

describe("getTeamMembers", () => {
  it("returns error for non-existent team", async () => {
    const result = await tools.getTeamMembers({ team_name: "nope" });
    expect((result as any).isError).toBe(true);
  });

  it("excludes team-lead from results", async () => {
    createTeamFixture(testHome, "members-test", makeTeamConfig());

    const result = await tools.getTeamMembers({ team_name: "members-test" });
    const data = parseToolText(result);

    expect(data.teammates).toHaveLength(1);
    expect(data.teammates[0].name).toBe("researcher");
  });

  it("returns all expected fields per teammate", async () => {
    createTeamFixture(testHome, "fields-test", makeTeamConfig());

    const result = await tools.getTeamMembers({ team_name: "fields-test" });
    const data = parseToolText(result);
    const mate = data.teammates[0];

    expect(mate).toHaveProperty("name");
    expect(mate).toHaveProperty("agentType");
    expect(mate).toHaveProperty("model");
    expect(mate).toHaveProperty("prompt");
    expect(mate).toHaveProperty("color");
    expect(mate).toHaveProperty("planModeRequired");
    expect(mate).toHaveProperty("cwd");
    expect(mate).toHaveProperty("previousAgentId");
  });

  it("defaults planModeRequired to false when undefined", async () => {
    const config = makeTeamConfig();
    delete config.members[1].planModeRequired;
    createTeamFixture(testHome, "default-plan", config);

    const result = await tools.getTeamMembers({ team_name: "default-plan" });
    const data = parseToolText(result);
    expect(data.teammates[0].planModeRequired).toBe(false);
  });
});
