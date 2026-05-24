// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  authState,
  listGoalsMock,
  listSubgoalsMock,
  listTasksMock,
  listHabitsMock,
  listHabitCheckinsMock,
  updateTaskStatusMock,
  saveTaskMock,
  saveHabitCheckinMock,
} = vi.hoisted(() => ({
  authState: {
    isLoading: false,
    user: { id: "user-1" },
    error: null,
  },
  listGoalsMock: vi.fn(),
  listSubgoalsMock: vi.fn(),
  listTasksMock: vi.fn(),
  listHabitsMock: vi.fn(),
  listHabitCheckinsMock: vi.fn(),
  updateTaskStatusMock: vi.fn(),
  saveTaskMock: vi.fn(),
  saveHabitCheckinMock: vi.fn(),
}));

vi.mock("@/lib/instantdb/client", () => ({
  db: {
    useAuth: () => authState,
  },
}));

vi.mock("@/lib/data/repository", () => ({
  dataRepository: {
    listGoals: listGoalsMock,
    listSubgoals: listSubgoalsMock,
    listTasks: listTasksMock,
    listHabits: listHabitsMock,
    listHabitCheckins: listHabitCheckinsMock,
    updateTaskStatus: updateTaskStatusMock,
    saveTask: saveTaskMock,
    saveHabitCheckin: saveHabitCheckinMock,
  },
}));

import { DashboardInsights } from "@/components/dashboard/dashboard-insights";

describe("dashboard insights command center", () => {
  beforeEach(() => {
    window.localStorage.clear();
    listGoalsMock.mockReset();
    listSubgoalsMock.mockReset();
    listTasksMock.mockReset();
    listHabitsMock.mockReset();
    listHabitCheckinsMock.mockReset();
    updateTaskStatusMock.mockReset();
    saveTaskMock.mockReset();
    saveHabitCheckinMock.mockReset();

    listGoalsMock.mockImplementation(async (_ownerUid: string, type: "professional" | "personal") => {
      if (type === "professional") {
        return [
          {
            id: "goal-1",
            ownerUid: "user-1",
            type: "professional",
            horizon: "short_term",
            title: "Improve standups",
            description: "desc",
            timeframe: "Q2",
            projectedStartDate: null,
            projectedEndDate: null,
            actualStartDate: null,
            actualEndDate: null,
            status: "in_progress",
            percentComplete: 50,
            isFocus: true,
            themeColor: "#2563eb",
            orderIndex: 0,
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-20T00:00:00.000Z",
            deletedAt: null,
            deletedBy: null,
            restoreUntil: null,
            purgeAt: null,
          },
        ];
      }

      return [];
    });

    listSubgoalsMock.mockResolvedValue([
      {
        id: "subgoal-1",
        ownerUid: "user-1",
        goalId: "goal-1",
        title: "Ship weekly recap",
        description: "desc",
        timeframe: "Q2",
        projectedStartDate: null,
        projectedEndDate: null,
        actualStartDate: null,
        actualEndDate: null,
        status: "in_progress",
        percentComplete: 50,
        orderIndex: 0,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-20T00:00:00.000Z",
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);

    listTasksMock.mockResolvedValue([
      {
        id: "task-1",
        ownerUid: "user-1",
        subgoalId: "subgoal-1",
        title: "Post standup summary",
        notes: "",
        dueDate: tomorrowIso,
        status: "in_progress",
        percentComplete: 50,
        orderIndex: 0,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-20T00:00:00.000Z",
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
      {
        id: "task-2",
        ownerUid: "user-1",
        subgoalId: "subgoal-1",
        title: "Prepare retro notes",
        notes: "",
        dueDate: today,
        status: "not_started",
        percentComplete: 0,
        orderIndex: 1,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-19T00:00:00.000Z",
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);

    listHabitsMock.mockResolvedValue([
      {
        id: "habit-1",
        ownerUid: "user-1",
        title: "Daily review",
        cadence: "daily",
        targetCount: 1,
        status: "active",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-20T00:00:00.000Z",
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);

    listHabitCheckinsMock.mockResolvedValue([]);

    updateTaskStatusMock.mockResolvedValue({
      id: "task-1",
      ownerUid: "user-1",
      subgoalId: "subgoal-1",
      title: "Post standup summary",
      notes: "",
      dueDate: today,
      status: "done",
      percentComplete: 100,
      orderIndex: 0,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    });

    saveTaskMock.mockResolvedValue({
      id: "task-1",
      ownerUid: "user-1",
      subgoalId: "subgoal-1",
      title: "Post standup summary",
      notes: "",
      dueDate: "2026-05-25",
      status: "in_progress",
      percentComplete: 50,
      orderIndex: 0,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    });

    saveHabitCheckinMock.mockResolvedValue(undefined);
  });

  it("supports quick complete and quick check-in actions", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByText("Today Command Center")).not.toBeNull();
    });

    const taskRow = screen.getByTestId("quick-task-title-task-1").closest("li");
    expect(taskRow).not.toBeNull();
    await user.click(within(taskRow as HTMLElement).getByRole("button", { name: "+1d" }));

    await waitFor(() => {
      expect(saveTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid: "user-1",
          taskId: "task-1",
          dueDate: expect.any(String),
        }),
      );
    });

    await user.click(within(taskRow as HTMLElement).getByRole("button", { name: "Mark done" }));

    await waitFor(() => {
      expect(updateTaskStatusMock).toHaveBeenCalledWith("user-1", "task-1", "done");
    });

    await user.click(screen.getByRole("button", { name: "Check in" }));

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

  it("supports today/review tabs and persists selected mode", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByText("Today Command Center")).not.toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByText("Overview")).not.toBeNull();
    });

    expect(window.localStorage.getItem("pdp.dashboardInsightsView")).toBe("review");
  });

  it("supports urgent/quick wins queue sorting and persists selection", async () => {
    const user = userEvent.setup();

    const { container } = render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByText("Today Command Center")).not.toBeNull();
    });

    const urgentOrder = Array.from(container.querySelectorAll('[data-testid^="quick-task-title-"]')).map(
      (element) => element.textContent,
    );
    expect(urgentOrder.slice(0, 2)).toEqual(["Prepare retro notes", "Post standup summary"]);

    await user.click(screen.getByRole("button", { name: "Quick Wins" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("pdp.dashboardTodayQueueSort")).toBe("quick_wins");
    });

    const quickWinsOrder = Array.from(container.querySelectorAll('[data-testid^="quick-task-title-"]')).map(
      (element) => element.textContent,
    );
    expect(quickWinsOrder.slice(0, 2)).toEqual(["Post standup summary", "Prepare retro notes"]);
  });
});
