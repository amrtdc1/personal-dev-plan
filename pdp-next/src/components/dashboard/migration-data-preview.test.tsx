// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Goal } from "@/lib/domain/types";

const {
  authState,
  getUserProfileMock,
  listGoalsMock,
  listChildGoalsMock,
  listTasksMock,
  listHabitsMock,
  listHabitCheckinsMock,
  saveHabitMock,
  saveHabitCheckinMock,
} = vi.hoisted(() => ({
  authState: {
    isLoading: false,
    user: { id: "user-1" },
    error: null,
  },
  getUserProfileMock: vi.fn(),
  listGoalsMock: vi.fn(),
  listChildGoalsMock: vi.fn(),
  listTasksMock: vi.fn(),
  listHabitsMock: vi.fn(),
  listHabitCheckinsMock: vi.fn(),
  saveHabitMock: vi.fn(),
  saveHabitCheckinMock: vi.fn(),
}));

vi.mock("@/lib/instantdb/client", () => ({
  db: {
    useAuth: () => authState,
  },
}));

vi.mock("@/lib/data/repository", () => ({
  dataRepository: {
    getUserProfile: getUserProfileMock,
    listGoals: listGoalsMock,
    listChildGoals: listChildGoalsMock,
    listTasks: listTasksMock,
    listHabits: listHabitsMock,
    listHabitCheckins: listHabitCheckinsMock,
    saveHabit: saveHabitMock,
    saveHabitCheckin: saveHabitCheckinMock,
  },
}));

import { MigrationDataPreview } from "@/components/dashboard/migration-data-preview";

function buildGoal(overrides: Partial<Goal>): Goal {
  return {
    id: "goal-1",
    ownerUid: "user-1",
    type: "professional",
    timeframeLevel: "quarterly",
    title: "Goal",
    description: "Desc",
    timeframe: "Q2",
    projectedStartDate: null,
    projectedEndDate: null,
    actualStartDate: null,
    actualEndDate: null,
    status: "not_started",
    percentComplete: 0,
    isFocus: false,
    themeColor: "#2563eb",
    orderIndex: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    purgeAt: null,
    ...overrides,
  };
}

describe("migration data preview timeline filtering", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getUserProfileMock.mockReset();
    listGoalsMock.mockReset();
    listChildGoalsMock.mockReset();
    listTasksMock.mockReset();

    getUserProfileMock.mockResolvedValue(null);
    listChildGoalsMock.mockResolvedValue([]);
    listTasksMock.mockResolvedValue([]);
    listHabitsMock.mockResolvedValue([
      {
        id: "habit-1",
        ownerUid: "user-1",
        title: "Daily review",
        cadence: "daily",
        targetCount: 1,
        status: "active",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);
    listHabitCheckinsMock.mockResolvedValue([
      {
        id: "checkin-1",
        ownerUid: "user-1",
        habitId: "habit-1",
        checkInDate: "2026-05-24",
        notes: null,
        createdAt: "2026-05-24T00:00:00.000Z",
        updatedAt: "2026-05-24T00:00:00.000Z",
      },
    ]);
    saveHabitMock.mockResolvedValue(undefined);
    saveHabitCheckinMock.mockResolvedValue(undefined);

    listGoalsMock.mockImplementation(async (_ownerUid: string, type: "professional" | "personal") => {
      if (type === "professional") {
        return [
          buildGoal({ id: "goal-weekly", title: "Weekly planning goal", timeframeLevel: "weekly", orderIndex: 0 }),
          buildGoal({ id: "goal-quarterly", title: "Quarterly roadmap goal", timeframeLevel: "quarterly", orderIndex: 1 }),
        ];
      }

      return [
        buildGoal({
          id: "goal-long-term",
          type: "personal",
          title: "Long-term personal goal",
          timeframeLevel: "vision_5y",
          orderIndex: 0,
        }),
      ];
    });
  });

  it("defaults to weekly goals and can switch filters", async () => {
    const user = userEvent.setup();

    render(<MigrationDataPreview />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Weekly (1)" })[0]?.className).toContain("bg-slate-900");
    });

    expect(screen.getAllByRole("button", { name: "Quarterly (1)" })[0]?.className).not.toContain("bg-slate-900");
    expect(screen.getAllByRole("button", { name: "All (3)" })[0]?.className).not.toContain("bg-slate-900");

    expect(screen.getAllByRole("button", { name: "Weekly (1)" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Quarterly (1)" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Long-term (1)" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "All (3)" }).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Quarterly (1)" })[0]);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Quarterly (1)" })[0]?.className).toContain("bg-slate-900");
    });

    expect(screen.getAllByRole("button", { name: "Weekly (1)" })[0]?.className).not.toContain("bg-slate-900");

    await user.click(screen.getAllByRole("button", { name: "All (3)" })[0]);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "All (3)" })[0]?.className).toContain("bg-slate-900");
    });

    expect(listGoalsMock).toHaveBeenCalledWith("user-1", "professional", { includeDeleted: true });
    expect(listGoalsMock).toHaveBeenCalledWith("user-1", "personal", { includeDeleted: true });
  });

  it("initializes filter from persisted preference", async () => {
    window.localStorage.setItem("pdp.goalTimelineFilter", "vision_5y");

    render(<MigrationDataPreview />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Long-term (1)" })[0]?.className).toContain("bg-slate-900");
    });

    expect(screen.getAllByRole("button", { name: "Weekly (1)" })[0]?.className).not.toContain("bg-slate-900");
  });

  it("renders habits and supports creating today check-in", async () => {
    const user = userEvent.setup();

    render(<MigrationDataPreview />);

    await waitFor(() => {
      expect(screen.getByText("Daily review")).not.toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Check in today" }));

    await waitFor(() => {
      expect(saveHabitCheckinMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid: "user-1",
          habitId: "habit-1",
          notes: null,
        }),
      );
    });
  });
});
