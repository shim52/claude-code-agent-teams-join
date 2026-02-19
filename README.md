# claude-team-join

Rejoin orphaned Claude Code agent teams from a new session.

## The problem

When your Claude Code session ends — terminal closed, crash, timeout — any agent teams it created become orphaned. The team files stay on disk (`~/.claude/teams/`), but no session can lead them anymore. You lose your team setup, prompts, and member configs.

**claude-team-join** is an MCP server that lets Claude Code discover those orphaned teams, take over as lead, and re-spawn the teammates exactly as they were.

## Install

Run this in your terminal:

```bash
npx claude-team-join --install
```

Then restart Claude Code (close and reopen, or run `claude` again).

That's it. The tools are now available in every Claude Code session.

> To uninstall: `npx claude-team-join --uninstall`

## What you get

Three tools become available to Claude Code:

| Tool | What it does |
|---|---|
| **list_teams** | Shows all teams, their members, and whether the lead session is alive or stale |
| **team_join** | Makes your current session the new lead of an orphaned team |
| **get_team_members** | Returns the full config (name, role, prompt, model) for each teammate so they can be re-spawned identically |

## How to use

Once installed, just tell Claude Code what you need in plain English:

```
"Show me my orphaned teams"
"Rejoin the my-project team"
"Re-spawn all the teammates from my-project"
```

Claude Code will use the tools automatically.

## Contributing

```bash
git clone https://github.com/shim52/claude-code-agent-teams-join.git
cd claude-code-agent-teams-join
npm install
npm run build
```

To test locally, point your `~/.claude.json` at the local build:

```json
{
  "mcpServers": {
    "claude-team-join": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/claude-code-agent-teams-join/dist/index.js"]
    }
  }
}
```

## License

MIT
