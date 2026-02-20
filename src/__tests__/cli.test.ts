import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { handleInstall, handleUninstall } from "../cli.js";
import { SKILLS } from "../skills.js";

let tmpDir: string;
let skillsDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-skills-test-"));
  skillsDir = path.join(tmpDir, ".claude", "skills");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// --- handleInstall ---

describe("handleInstall", () => {
  it("creates skills directory if it doesn't exist", () => {
    expect(fs.existsSync(skillsDir)).toBe(false);

    const result = handleInstall(skillsDir);
    expect(result.success).toBe(true);
    expect(fs.existsSync(skillsDir)).toBe(true);
  });

  it("creates a SKILL.md for each skill", () => {
    handleInstall(skillsDir);

    for (const skill of SKILLS) {
      const skillFile = path.join(skillsDir, skill.dirName, "SKILL.md");
      expect(fs.existsSync(skillFile)).toBe(true);
    }
  });

  it("writes correct content to each SKILL.md", () => {
    handleInstall(skillsDir);

    for (const skill of SKILLS) {
      const content = fs.readFileSync(
        path.join(skillsDir, skill.dirName, "SKILL.md"),
        "utf-8"
      );
      expect(content).toBe(skill.content);
    }
  });

  it("overwrites existing skill files on reinstall", () => {
    handleInstall(skillsDir);

    // Write different content to one skill file
    const firstSkill = SKILLS[0];
    const skillFile = path.join(skillsDir, firstSkill.dirName, "SKILL.md");
    fs.writeFileSync(skillFile, "old content", "utf-8");

    // Reinstall
    const result = handleInstall(skillsDir);
    expect(result.success).toBe(true);

    const content = fs.readFileSync(skillFile, "utf-8");
    expect(content).toBe(firstSkill.content);
  });

  it("lists installed skill names in the success message", () => {
    const result = handleInstall(skillsDir);
    expect(result.success).toBe(true);

    for (const skill of SKILLS) {
      expect(result.message).toContain(skill.dirName);
    }
  });

  it("does not remove other skill directories", () => {
    // Create a pre-existing unrelated skill
    const otherSkillDir = path.join(skillsDir, "some-other-skill");
    fs.mkdirSync(otherSkillDir, { recursive: true });
    fs.writeFileSync(path.join(otherSkillDir, "SKILL.md"), "other skill", "utf-8");

    handleInstall(skillsDir);

    expect(fs.existsSync(path.join(otherSkillDir, "SKILL.md"))).toBe(true);
    expect(fs.readFileSync(path.join(otherSkillDir, "SKILL.md"), "utf-8")).toBe("other skill");
  });
});

// --- handleUninstall ---

describe("handleUninstall", () => {
  it("removes skill directories that were installed", () => {
    handleInstall(skillsDir);

    const result = handleUninstall(skillsDir);
    expect(result.success).toBe(true);

    for (const skill of SKILLS) {
      expect(fs.existsSync(path.join(skillsDir, skill.dirName))).toBe(false);
    }
  });

  it("handles already-removed directories gracefully", () => {
    // Don't install first — directories don't exist
    const result = handleUninstall(skillsDir);
    expect(result.success).toBe(true);
  });

  it("does not touch other skill directories", () => {
    // Create unrelated skill alongside ours
    const otherSkillDir = path.join(skillsDir, "some-other-skill");
    fs.mkdirSync(otherSkillDir, { recursive: true });
    fs.writeFileSync(path.join(otherSkillDir, "SKILL.md"), "other skill", "utf-8");

    handleInstall(skillsDir);
    handleUninstall(skillsDir);

    expect(fs.existsSync(path.join(otherSkillDir, "SKILL.md"))).toBe(true);
  });

  it("lists removed skill names in the message", () => {
    handleInstall(skillsDir);

    const result = handleUninstall(skillsDir);

    for (const skill of SKILLS) {
      expect(result.message).toContain(skill.dirName);
    }
  });

  it("reports 'no skills found' when nothing to remove", () => {
    const result = handleUninstall(skillsDir);
    expect(result.message).toContain("No claude-team-join skills found");
  });
});
