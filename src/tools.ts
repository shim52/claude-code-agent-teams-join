import type { Helpers } from "./helpers.js";

export function createToolHandlers(helpers: Helpers) {
  return {
    listTeams: async () => {
      const teamNames = helpers.getTeamNames();

      if (teamNames.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No teams found in ${helpers.TEAMS_DIR}`,
            },
          ],
        };
      }

      const currentSessionId = helpers.getCurrentSessionId();
      const teams = [];

      for (const name of teamNames) {
        const config = helpers.readTeamConfig(name);
        if (!config) continue;

        const isCurrentSession = config.leadSessionId === currentSessionId;
        const isActive = helpers.isSessionActive(config.leadSessionId);

        const members = config.members.map((m) => ({
          name: m.name,
          role: m.agentType,
          isActive: m.isActive ?? false,
        }));

        teams.push({
          teamName: name,
          description: config.description ?? "(no description)",
          createdAt: helpers.formatTimestamp(config.createdAt),
          memberCount: config.members.length,
          members,
          leadSessionId: config.leadSessionId,
          leadSessionStatus: isCurrentSession
            ? "current"
            : isActive
              ? "active-other"
              : "stale",
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(teams, null, 2),
          },
        ],
      };
    },

    teamJoin: async ({ team_name }: { team_name: string }) => {
      const config = helpers.readTeamConfig(team_name);
      if (!config) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Team "${team_name}" not found. Use list_teams to see available teams.`,
            },
          ],
          isError: true,
        };
      }

      const currentSessionId = helpers.getCurrentSessionId();
      if (!currentSessionId) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Could not detect current session ID from ${helpers.SESSION_ENV_DIR}`,
            },
          ],
          isError: true,
        };
      }

      const previousSessionId = config.leadSessionId;

      // Update the lead session to current
      config.leadSessionId = currentSessionId;
      config.leadAgentId = `team-lead@${team_name}`;

      // Reset all members' isActive to false (they need to be re-spawned)
      for (const member of config.members) {
        member.isActive = false;
      }

      try {
        helpers.writeTeamConfig(team_name, config);
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Failed to write team config: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }

      const nonLeadMembers = config.members.filter(
        (m) => m.name !== "team-lead"
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "joined",
                teamName: team_name,
                description: config.description,
                previousSessionId,
                newSessionId: currentSessionId,
                membersResetToInactive: config.members.length,
                teammatesReadyToRespawn: nonLeadMembers.map((m) => ({
                  name: m.name,
                  role: m.agentType,
                  hasPrompt: !!m.prompt,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    },

    getTeamMembers: async ({ team_name }: { team_name: string }) => {
      const config = helpers.readTeamConfig(team_name);
      if (!config) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Team "${team_name}" not found. Use list_teams to see available teams.`,
            },
          ],
          isError: true,
        };
      }

      // Return non-lead members with their full spawn configurations
      const teammates = config.members
        .filter((m) => m.name !== "team-lead")
        .map((m) => ({
          name: m.name,
          agentType: m.agentType,
          model: m.model,
          prompt: m.prompt,
          color: m.color,
          planModeRequired: m.planModeRequired ?? false,
          cwd: m.cwd,
          previousAgentId: m.agentId,
        }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                teamName: team_name,
                description: config.description,
                teammates,
              },
              null,
              2
            ),
          },
        ],
      };
    },
  };
}
