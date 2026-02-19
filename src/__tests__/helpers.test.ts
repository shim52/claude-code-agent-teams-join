import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { createHelpers } from "../helpers.js";
import {
  createTestHome,
  cleanupTestHome,
  createTeamFixture,
  createSessionFixture,
  makeTeamConfig,
} from "./test-utils.js";

let testHome: string;
let helpers: ReturnType<typeof createHelpers>;

beforeEach(() => {
  testHome = createTestHome();
  helpers = createHelpers(testHome);
});

afterEach(() => {
  cleanupTestHome(testHome);
  vi.useRealTimers();
});

// --- getTeamNames ---

describe("getTeamNames", () => {
  it("returns [] when teams dir doesn't exist", () => {
    fs.rmSync(path.join(testHome, ".claude", "teams"), { recursive: true });
    expect(helpers.getTeamNames()).toEqual([]);
  });

  it("returns [] when teams dir is empty", () => {
    expect(helpers.getTeamNames()).toEqual([]);
  });

  it("returns directory names, filters out files", () => {
    const teamsDir = path.join(testHome, ".claude", "teams");
    fs.mkdirSync(path.join(teamsDir, "alpha"));
    fs.mkdirSync(path.join(teamsDir, "beta"));
    fs.writeFileSync(path.join(teamsDir, "not-a-team.txt"), "file");

    const names = helpers.getTeamNames();
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
    expect(names).not.toContain("not-a-team.txt");
    expect(names).toHaveLength(2);
  });

  it("handles teams dir being a file (not a directory)", () => {
    const teamsDir = path.join(testHome, ".claude", "teams");
    fs.rmSync(teamsDir, { recursive: true });
    fs.writeFileSync(teamsDir, "not a directory");
    expect(helpers.getTeamNames()).toEqual([]);
  });
});

// --- readTeamConfig ---

describe("readTeamConfig", () => {
  it("returns parsed config for valid JSON", () => {
    const config = makeTeamConfig({ name: "my-team" });
    createTeamFixture(testHome, "my-team", config);

    const result = helpers.readTeamConfig("my-team");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("my-team");
    expect(result!.members).toHaveLength(2);
  });

  it("returns null for missing directory", () => {
    expect(helpers.readTeamConfig("nonexistent")).toBeNull();
  });

  it("returns null for missing config file", () => {
    fs.mkdirSync(path.join(testHome, ".claude", "teams", "empty-team"));
    expect(helpers.readTeamConfig("empty-team")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const teamDir = path.join(testHome, ".claude", "teams", "bad-json");
    fs.mkdirSync(teamDir);
    fs.writeFileSync(path.join(teamDir, "config.json"), "{invalid json,}");
    expect(helpers.readTeamConfig("bad-json")).toBeNull();
  });

  it("returns null for empty file", () => {
    const teamDir = path.join(testHome, ".claude", "teams", "empty-file");
    fs.mkdirSync(teamDir);
    fs.writeFileSync(path.join(teamDir, "config.json"), "");
    expect(helpers.readTeamConfig("empty-file")).toBeNull();
  });

  it("returns null for config missing required members field", () => {
    const teamDir = path.join(testHome, ".claude", "teams", "no-members");
    fs.mkdirSync(teamDir);
    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({ name: "no-members", leadSessionId: "abc" })
    );
    expect(helpers.readTeamConfig("no-members")).toBeNull();
  });

  it("returns null for config where members is not an array", () => {
    const teamDir = path.join(testHome, ".claude", "teams", "bad-members");
    fs.mkdirSync(teamDir);
    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({ name: "bad-members", members: "not-an-array" })
    );
    expect(helpers.readTeamConfig("bad-members")).toBeNull();
  });
});

// --- writeTeamConfig ---

describe("writeTeamConfig", () => {
  it("writes valid JSON to correct path", () => {
    const config = makeTeamConfig({ name: "write-test" });
    const teamDir = path.join(testHome, ".claude", "teams", "write-test");
    fs.mkdirSync(teamDir);

    helpers.writeTeamConfig("write-test", config);

    const raw = fs.readFileSync(path.join(teamDir, "config.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.name).toBe("write-test");
    expect(parsed.members).toHaveLength(2);
  });

  it("overwrites existing config", () => {
    const config = makeTeamConfig({ name: "overwrite-test" });
    createTeamFixture(testHome, "overwrite-test", config);

    config.description = "updated";
    helpers.writeTeamConfig("overwrite-test", config);

    const result = helpers.readTeamConfig("overwrite-test");
    expect(result!.description).toBe("updated");
  });

  it("throws when team directory doesn't exist", () => {
    const config = makeTeamConfig({ name: "no-dir" });
    expect(() => helpers.writeTeamConfig("no-dir", config)).toThrow();
  });
});

// --- getCurrentSessionId ---

describe("getCurrentSessionId", () => {
  it("returns null when session-env dir doesn't exist", () => {
    fs.rmSync(path.join(testHome, ".claude", "session-env"), { recursive: true });
    expect(helpers.getCurrentSessionId()).toBeNull();
  });

  it("returns null when session-env dir is empty", () => {
    expect(helpers.getCurrentSessionId()).toBeNull();
  });

  it("returns most recently modified directory name", () => {
    createSessionFixture(testHome, "old-session", Date.now() - 60000);
    createSessionFixture(testHome, "new-session", Date.now());

    expect(helpers.getCurrentSessionId()).toBe("new-session");
  });

  it("ignores files (only considers directories)", () => {
    const envDir = path.join(testHome, ".claude", "session-env");
    fs.writeFileSync(path.join(envDir, "a-file"), "not a dir");
    createSessionFixture(testHome, "real-session");

    expect(helpers.getCurrentSessionId()).toBe("real-session");
  });
});

// --- isSessionActive ---

describe("isSessionActive", () => {
  it("returns true for recently created session (< 5 min)", () => {
    createSessionFixture(testHome, "active-session");
    expect(helpers.isSessionActive("active-session")).toBe(true);
  });

  it("returns false for stale session (> 5 min)", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    createSessionFixture(testHome, "stale-session", now);

    // Advance time by 6 minutes
    vi.setSystemTime(now + 6 * 60 * 1000);
    expect(helpers.isSessionActive("stale-session")).toBe(false);
  });

  it("returns false for non-existent session", () => {
    expect(helpers.isSessionActive("ghost-session")).toBe(false);
  });

  it("returns false at exactly 5 minutes (strict less-than)", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    createSessionFixture(testHome, "boundary-session", now);

    // Advance time by exactly 5 minutes
    vi.setSystemTime(now + 5 * 60 * 1000);
    expect(helpers.isSessionActive("boundary-session")).toBe(false);
  });
});

// --- formatTimestamp ---

describe("formatTimestamp", () => {
  it("known timestamp produces expected UTC string", () => {
    // 2023-11-14T22:13:20.000Z
    const result = helpers.formatTimestamp(1700000000000);
    expect(result).toBe("2023-11-14 22:13:20 UTC");
  });

  it("epoch 0 returns 1970-01-01 00:00:00 UTC", () => {
    expect(helpers.formatTimestamp(0)).toBe("1970-01-01 00:00:00 UTC");
  });
});
