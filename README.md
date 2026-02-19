# claude-team-join

MCP server for listing, inspecting, and rejoining orphaned Claude Code agent teams.

## Problem

When a Claude Code session ends (terminal closed, crash, timeout), any teams created during that session become orphaned. The team config files persist in `~/.claude/teams/`, but the lead session ID points to a dead session — so no new agent can take over as team lead or re-spawn teammates.

This MCP server gives your Claude Code session the tools to discover those orphaned teams and rejoin them as the new lead.

## Tools

| Tool | Description |
|------|-------------|
| `list_teams` | List all teams in `~/.claude/teams/` with their status, members, and whether the lead session is stale or current |
| `team_join` | Rejoin an existing team by updating its config to point to the current session. Makes you the new team lead and resets all members to inactive |
| `get_team_members` | Get full teammate definitions (name, role, prompt, model) so they can be re-spawned with the Task tool using identical configurations |

## Installation

### One-liner (recommended)

```bash
npx claude-team-join --install
```

This automatically adds the MCP server config to your `~/.claude.json`. Restart Claude Code to pick it up.

To remove it later:

```bash
npx claude-team-join --uninstall
```

### Manual

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "claude-team-join": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "claude-team-join"]
    }
  }
}
```

## Usage

Once installed, Claude Code can use the tools directly. A typical workflow:

1. **List teams** to see what's available and which are orphaned:
   ```
   Use the list_teams tool to see all teams
   ```

2. **Join a team** to become its new lead:
   ```
   Use team_join with team_name "my-project" to rejoin
   ```

3. **Get member configs** to re-spawn teammates:
   ```
   Use get_team_members for "my-project" to get teammate definitions, then re-spawn them with the Task tool
   ```

## Development

```bash
git clone git@github.com:shim52/claude-code-agent-teams-join.git
cd claude-code-agent-teams-join
npm install
npm run build    # compile TypeScript to dist/
npm run dev      # run with tsx (hot reload)
npm start        # run compiled output
```

## License

MIT
