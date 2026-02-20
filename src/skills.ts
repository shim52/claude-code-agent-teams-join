export interface SkillDefinition {
  dirName: string;
  content: string;
}

export const SKILLS: SkillDefinition[] = [
  {
    dirName: "team-join",
    content: `---
name: team-join
description: Rejoin an orphaned Claude Code agent team. Use when user says "rejoin team", "join team", "reconnect team", "resume team", "rejoin the <name> team", or wants to become the lead of an existing team.
allowed-tools: Read, Write, Bash, Glob
---

# Rejoin an Orphaned Claude Code Team

You are helping the user rejoin an orphaned Claude Code agent team. Follow these steps precisely.

## Step 1: Identify the team

If the user specified a team name, use that. Otherwise, list available teams:

\`\`\`bash
ls ~/.claude/teams/
\`\`\`

If multiple teams exist and none was specified, show the list and ask the user which team to rejoin.

If no teams exist, tell the user there are no teams to rejoin and stop.

## Step 2: Read the team config

Read the file \`~/.claude/teams/{team_name}/config.json\`.

If it doesn't exist or is unreadable, tell the user and stop.

## Step 3: Get the current session ID

Run:

\`\`\`bash
ls -t ~/.claude/session-env/ | head -1
\`\`\`

This returns the most recently modified session directory name, which is the current session ID.

If no session is found, tell the user the session could not be detected and stop.

## Step 4: Update the team config

Modify the config JSON:
1. Set \`leadSessionId\` to the current session ID from step 3
2. Set \`leadAgentId\` to \`team-lead@{team_name}\`
3. For every entry in the \`members\` array, set \`isActive\` to \`false\`

Write the updated JSON back to \`~/.claude/teams/{team_name}/config.json\` (pretty-printed with 4-space indent).

## Step 5: Report the result

Tell the user:
- The team has been rejoined
- How many teammates were reset to inactive
- List each non-"team-lead" member by name and role (agentType)
- Offer to re-spawn the teammates using the Task tool

Use the team-members skill or read the config directly to get teammate details for re-spawning.
`,
  },
  {
    dirName: "team-list",
    content: `---
name: team-list
description: List all Claude Code agent teams and their status. Use when user says "list teams", "show teams", "my teams", "orphaned teams", "team status".
allowed-tools: Read, Bash, Glob
---

# List Claude Code Agent Teams

You are listing all Claude Code agent teams and their status. Follow these steps.

## Step 1: Find all teams

List directories in \`~/.claude/teams/\`:

\`\`\`bash
ls ~/.claude/teams/
\`\`\`

If the directory doesn't exist or is empty, tell the user there are no teams and stop.

## Step 2: Read each team's config

For each team directory, read \`~/.claude/teams/{team_name}/config.json\`.

Skip any team whose config is missing or unreadable.

## Step 3: Check session staleness

For each team, determine the lead session status:

1. Get the team's \`leadSessionId\` from the config
2. Check if that session directory exists and its modification time:

\`\`\`bash
stat -f "%m" ~/.claude/session-env/{leadSessionId}/ 2>/dev/null
\`\`\`

3. Get the current time:

\`\`\`bash
date +%s
\`\`\`

4. If the session was modified less than 5 minutes ago (300 seconds), it is **active**. Otherwise it is **stale**.

Also determine the current session:

\`\`\`bash
ls -t ~/.claude/session-env/ | head -1
\`\`\`

If the team's \`leadSessionId\` matches the current session, status is **current**. If active but not current, status is **active-other**. Otherwise **stale**.

## Step 4: Present the results

For each team, show:
- **Team name**
- **Description** (or "no description" if missing)
- **Created at** (formatted from the \`createdAt\` timestamp)
- **Member count** and member names with roles
- **Lead session status**: current, active-other, or stale

Format as a clear, readable list. Highlight stale teams as candidates for rejoining.
`,
  },
  {
    dirName: "team-members",
    content: `---
name: team-members
description: Get teammate definitions from a Claude Code team for re-spawning. Use when user says "team members", "show teammates", "re-spawn teammates", "respawn agents".
allowed-tools: Read, Bash, Glob
---

# Get Team Member Definitions

You are retrieving teammate definitions from a Claude Code team so they can be re-spawned. Follow these steps.

## Step 1: Identify the team

If the user specified a team name, use that. Otherwise, list available teams:

\`\`\`bash
ls ~/.claude/teams/
\`\`\`

If multiple teams exist and none was specified, show the list and ask the user which team to inspect.

## Step 2: Read the team config

Read \`~/.claude/teams/{team_name}/config.json\`.

If it doesn't exist or is unreadable, tell the user and stop.

## Step 3: Extract teammate definitions

From the \`members\` array, filter out the entry with \`name\` equal to \`"team-lead"\` (that's the lead agent, not a spawnable teammate).

For each remaining member, present:
- **name**: The teammate's name
- **agentType**: Their role/subagent type (e.g., "general-purpose", "Explore")
- **model**: The model they were using (e.g., "sonnet", "opus")
- **prompt**: Whether they have a prompt defined (show the prompt content)
- **cwd**: Their working directory
- **planModeRequired**: Whether they require plan mode (default false)

## Step 4: Offer to re-spawn

Ask the user if they'd like to re-spawn these teammates. If yes, use the Task tool to spawn each one with their original configuration:

\`\`\`
Task tool parameters:
  - name: {member.name}
  - subagent_type: {member.agentType}
  - model: {member.model}
  - prompt: {member.prompt}
  - team_name: {team_name}
  - mode: "plan" (if planModeRequired is true)
\`\`\`

Spawn teammates in parallel when possible by making multiple Task tool calls in a single message.
`,
  },
];
