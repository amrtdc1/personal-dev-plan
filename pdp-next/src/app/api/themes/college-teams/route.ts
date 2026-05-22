import { NextResponse } from "next/server";
import { fetchEspnCollegeTeams } from "@/lib/theming/providers/espn-college";

export async function GET() {
  try {
    const teams = await fetchEspnCollegeTeams();
    return NextResponse.json({ teams }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch live college teams.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
