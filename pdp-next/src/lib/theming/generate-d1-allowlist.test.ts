import { describe, expect, it } from "vitest";
import { isEligibleCollegeTeam } from "../../../scripts/generate-d1-allowlist.mjs";

describe("generate-d1-allowlist exclusion rules", () => {
  it("accepts normal school teams", () => {
    expect(
      isEligibleCollegeTeam({
        displayName: "Arizona State Sun Devils",
        abbreviation: "ASU",
        slug: "arizona-state-sun-devils",
      })
    ).toBe(true);
  });

  it("rejects all-star and placeholder entries", () => {
    expect(
      isEligibleCollegeTeam({
        displayName: "East All-Stars",
        abbreviation: "EAST",
        slug: "east-all-stars",
      })
    ).toBe(false);

    expect(
      isEligibleCollegeTeam({
        displayName: "Team Gaither",
        abbreviation: "GAI",
        slug: "team-gaither",
      })
    ).toBe(false);

    expect(
      isEligibleCollegeTeam({
        displayName: "TBA",
        abbreviation: "TBA",
        slug: "tba",
      })
    ).toBe(false);

    expect(
      isEligibleCollegeTeam({
        displayName: "American",
        abbreviation: "AMER",
        slug: "american",
      })
    ).toBe(false);

    expect(
      isEligibleCollegeTeam({
        displayName: "National",
        abbreviation: "NAT",
        slug: "national",
      })
    ).toBe(false);
  });
});
