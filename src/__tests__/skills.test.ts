import { describe, it, expect } from "vitest";
import { SKILLS } from "../skills.js";

describe("SKILLS definitions", () => {
  it("has exactly 3 skills defined", () => {
    expect(SKILLS).toHaveLength(3);
  });

  it("each skill has a non-empty dirName", () => {
    for (const skill of SKILLS) {
      expect(skill.dirName).toBeTruthy();
      expect(typeof skill.dirName).toBe("string");
    }
  });

  it("each skill has a non-empty content", () => {
    for (const skill of SKILLS) {
      expect(skill.content).toBeTruthy();
      expect(typeof skill.content).toBe("string");
    }
  });

  it("dirNames are valid directory names (no special chars)", () => {
    for (const skill of SKILLS) {
      expect(skill.dirName).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("dirNames are unique", () => {
    const names = SKILLS.map((s) => s.dirName);
    expect(new Set(names).size).toBe(names.length);
  });

  describe("YAML frontmatter", () => {
    for (const skill of SKILLS) {
      describe(`skill: ${skill.dirName}`, () => {
        it("starts with YAML frontmatter delimiters", () => {
          expect(skill.content).toMatch(/^---\n/);
          expect(skill.content).toMatch(/\n---\n/);
        });

        it("has a 'name' field in frontmatter", () => {
          const frontmatter = skill.content.split("---\n")[1];
          expect(frontmatter).toMatch(/^name:\s+\S/m);
        });

        it("has a 'description' field in frontmatter", () => {
          const frontmatter = skill.content.split("---\n")[1];
          expect(frontmatter).toMatch(/^description:\s+\S/m);
        });

        it("has an 'allowed-tools' field in frontmatter", () => {
          const frontmatter = skill.content.split("---\n")[1];
          expect(frontmatter).toMatch(/^allowed-tools:\s+\S/m);
        });

        it("frontmatter name matches dirName", () => {
          const frontmatter = skill.content.split("---\n")[1];
          const nameMatch = frontmatter.match(/^name:\s+(.+)$/m);
          expect(nameMatch).not.toBeNull();
          expect(nameMatch![1].trim()).toBe(skill.dirName);
        });
      });
    }
  });

  describe("skill body content", () => {
    it("team-join skill references ~/.claude/teams/", () => {
      const teamJoin = SKILLS.find((s) => s.dirName === "team-join")!;
      expect(teamJoin.content).toContain("~/.claude/teams/");
    });

    it("team-join skill references leadSessionId", () => {
      const teamJoin = SKILLS.find((s) => s.dirName === "team-join")!;
      expect(teamJoin.content).toContain("leadSessionId");
    });

    it("team-join skill references session-env", () => {
      const teamJoin = SKILLS.find((s) => s.dirName === "team-join")!;
      expect(teamJoin.content).toContain("session-env");
    });

    it("team-list skill references session staleness", () => {
      const teamList = SKILLS.find((s) => s.dirName === "team-list")!;
      expect(teamList.content).toContain("stale");
    });

    it("team-members skill references re-spawning", () => {
      const teamMembers = SKILLS.find((s) => s.dirName === "team-members")!;
      expect(teamMembers.content).toContain("re-spawn");
    });

    it("team-members skill filters out team-lead", () => {
      const teamMembers = SKILLS.find((s) => s.dirName === "team-members")!;
      expect(teamMembers.content).toContain("team-lead");
    });
  });
});
