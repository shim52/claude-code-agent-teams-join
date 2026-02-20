#!/usr/bin/env node

import * as os from "os";
import * as path from "path";
import { handleInstall, handleUninstall } from "./cli.js";

const skillsDir = path.join(os.homedir(), ".claude", "skills");
const arg = process.argv[2];

if (arg === "--install" || arg === "install") {
  const result = handleInstall(skillsDir);
  console.log(result.success ? `\u2713 ${result.message}` : result.message);
  process.exit(result.success ? 0 : 1);
}

if (arg === "--uninstall" || arg === "uninstall") {
  const result = handleUninstall(skillsDir);
  console.log(result.success ? `\u2713 ${result.message}` : result.message);
  process.exit(result.success ? 0 : 1);
}

console.log("Usage: claude-team-join --install | --uninstall");
process.exit(0);
