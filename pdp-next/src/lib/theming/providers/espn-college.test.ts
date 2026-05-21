import {
  normalizeEspnCollegeTeams,
  sanitizeCollegeLogoUrl,
} from "@/lib/theming/providers/espn-college";

describe("espn college theming provider", () => {
  it("allows https logo URLs only for allowlisted hosts", () => {
    expect(sanitizeCollegeLogoUrl("https://a.espncdn.com/i/teamlogos/ncaa/500/9.png")).toBe(
      "https://a.espncdn.com/i/teamlogos/ncaa/500/9.png",
    );

    expect(sanitizeCollegeLogoUrl("http://a.espncdn.com/i/teamlogos/ncaa/500/9.png")).toBeNull();
    expect(sanitizeCollegeLogoUrl("https://evil.example.com/logo.png")).toBeNull();
    expect(sanitizeCollegeLogoUrl("javascript:alert(1)")).toBeNull();
  });

  it("normalizes only allowlisted D1 teams and filters unsafe logo URLs", () => {
    const normalized = normalizeEspnCollegeTeams({
      sports: [
        {
          leagues: [
            {
              teams: [
                {
                  team: {
                    id: "9",
                    displayName: "Arizona State Sun Devils",
                    abbreviation: "ASU",
                    slug: "arizona-state-sun-devils",
                    color: "8c1d40",
                    alternateColor: "ffc627",
                    logos: [
                      {
                        href: "https://a.espncdn.com/i/teamlogos/ncaa/500/9.png",
                        rel: ["full", "default"],
                      },
                    ],
                  },
                },
                {
                  team: {
                    id: "2",
                    displayName: "Auburn Tigers",
                    abbreviation: "AUB",
                    slug: "auburn-tigers",
                    logos: [
                      {
                        href: "https://evil.example.com/logo.png",
                        rel: ["full", "default"],
                      },
                    ],
                  },
                },
                {
                  team: {
                    id: "999999",
                    displayName: "Not D1",
                    abbreviation: "NOPE",
                    slug: "not-d1",
                    logos: [
                      {
                        href: "https://a.espncdn.com/i/teamlogos/ncaa/500/999999.png",
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(normalized).toHaveLength(2);

    const asu = normalized.find((team) => team.id === "9");
    expect(asu?.logoUrl).toBe("https://a.espncdn.com/i/teamlogos/ncaa/500/9.png");
    expect(asu?.colors.primary).toBe("#8c1d40");
    expect(asu?.colors.secondary).toBe("#ffc627");

    const auburn = normalized.find((team) => team.id === "2");
    expect(auburn?.logoUrl).toBeNull();
  });
});
