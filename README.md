# claude-team-join

Rejoin orphaned Claude Code agent teams from a new session.

## The problem

When your Claude Code session ends - terminal closed, crash, timeout - any agent teams it created become orphaned.

The team files stay on disk (`~/.claude/teams/`), but no session can lead them anymore.

You lose your team setup, prompts, and member configs.

**claude-team-join** installs skills that let Claude Code discover those orphaned teams, take over as lead, and re-spawn the teammates exactly as they were.

## Requirements

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

## Install

Run this in your terminal:

```bash
npx claude-team-join --install
```

Then restart Claude Code (close and reopen, or run `claude` again).

That's it. The skills are now available in every Claude Code session.

To uninstall:

```bash
npx claude-team-join --uninstall
```

## What you get

Three skills are installed to `~/.claude/skills/`:

- **`team-join`** - Rejoins an orphaned team by making your current session the new lead.

- **`team-list`** - Shows all teams, their members, and whether the lead session is alive or stale.

- **`team-members`** - Returns the full config (name, role, prompt, model) for each teammate so they can be re-spawned identically.

## Usage

Once installed, just tell Claude Code what you need in plain English:

```
"Rejoin the my-project team"
"Show me my orphaned teams"
"Re-spawn all the teammates from my-project"
```

Claude Code will match the appropriate skill automatically.

## Contributing

```bash
git clone https://github.com/shim52/claude-code-agent-teams-join.git
cd claude-code-agent-teams-join
npm install
npm run build
```

Run tests:

```bash
npm test
```

To test locally:

```bash
node dist/index.js --install
```

Then restart Claude Code and try commands like "rejoin the my-team team".

## License

MIT - see [LICENSE](LICENSE) for details.
