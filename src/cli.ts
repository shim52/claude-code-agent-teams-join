import * as fs from "fs";
import * as path from "path";
import { SKILLS } from "./skills.js";

export function handleInstall(skillsDir: string): { success: boolean; message: string } {
  fs.mkdirSync(skillsDir, { recursive: true });

  const installed: string[] = [];

  for (const skill of SKILLS) {
    const dir = path.join(skillsDir, skill.dirName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), skill.content, "utf-8");
    installed.push(skill.dirName);
  }

  return {
    success: true,
    message: `Installed skills to ${skillsDir}: ${installed.join(", ")}\n  Restart Claude Code to pick up the new skills.`,
  };
}

export function handleUninstall(skillsDir: string): { success: boolean; message: string } {
  const removed: string[] = [];

  for (const skill of SKILLS) {
    const dir = path.join(skillsDir, skill.dirName);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      removed.push(skill.dirName);
    }
  }

  return {
    success: true,
    message: removed.length > 0
      ? `Removed skills from ${skillsDir}: ${removed.join(", ")}`
      : `No claude-team-join skills found in ${skillsDir}`,
  };
}
