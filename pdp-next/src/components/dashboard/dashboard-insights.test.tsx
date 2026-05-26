// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  authState,
  listGoalsMock,
  listChildGoalsMock,
  listTasksMock,
  listHabitsMock,
  listHabitCheckinsMock,
  updateTaskStatusMock,
  saveTaskMock,
  saveHabitCheckinMock,
  saveJournalEntryMock,
} = vi.hoisted(() => ({
  authState: {
    isLoading: false,
    user: { id: "user-1" },
    error: null,
  },
  listGoalsMock: vi.fn(),
  listChildGoalsMock: vi.fn(),
  listTasksMock: vi.fn(),
  listHabitsMock: vi.fn(),
  listHabitCheckinsMock: vi.fn(),
  updateTaskStatusMock: vi.fn(),
  saveTaskMock: vi.fn(),
  saveHabitCheckinMock: vi.fn(),
  saveJournalEntryMock: vi.fn(),
}));

vi.mock("@/lib/instantdb/client", () => ({
  db: {
    useAuth: () => authState,
  },
}));

vi.mock("@/lib/data/repository", () => ({
  dataRepository: {
    listGoals: listGoalsMock,
    listChildGoals: listChildGoalsMock,
    listTasks: listTasksMock,
    listHabits: listHabitsMock,
    listHabitCheckins: listHabitCheckinsMock,
    updateTaskStatus: updateTaskStatusMock,
    saveTask: saveTaskMock,
    saveHabitCheckin: saveHabitCheckinMock,
    saveJournalEntry: saveJournalEntryMock,
  },
}));

import { DashboardInsights } from "@/components/dashboard/dashboard-insights";

describe("dashboard insights command center", () => {
  beforeEach(() => {
    window.localStorage.clear();
    listGoalsMock.mockReset();
    listChildGoalsMock.mockReset();
    listTasksMock.mockReset();
    listHabitsMock.mockReset();
    listHabitCheckinsMock.mockReset();
    updateTaskStatusMock.mockReset();
    saveTaskMock.mockReset();
    saveHabitCheckinMock.mockReset();
    saveJournalEntryMock.mockReset();

    listGoalsMock.mockImplementation(async (_ownerUid: string, type: "professional" | "personal") => {
      if (type === "professional") {
        return [
          {
            id: "goal-1",
            ownerUid: "user-1",
            type: "professional",
            timeframeLevel: "weekly",
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

    listChildGoalsMock.mockResolvedValue([
      {
        id: "childGoal-1",
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
        goalId: "childGoal-1",
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
        goalId: "childGoal-1",
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
      goalId: "childGoal-1",
      title: "Post standup summary",
      notes: "",
      dueDate: today,
      unplanned: false,
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

    saveTaskMock.mockImplementation(async (input: {
      taskId: string;
      ownerUid: string;
      goalId: string;
      title: string;
      notes: string;
      dueDate: string | null;
      unplanned?: boolean;
      existingTask?: {
        status?: "not_started" | "in_progress" | "done";
        percentComplete?: number;
        orderIndex?: number;
        createdAt?: string;
      };
    }) => ({
      id: input.taskId,
      ownerUid: input.ownerUid,
      goalId: input.goalId,
      title: input.title,
      notes: input.notes,
      dueDate: input.dueDate,
      unplanned: input.unplanned ?? false,
      status: input.existingTask?.status ?? "in_progress",
      percentComplete: input.existingTask?.percentComplete ?? 50,
      orderIndex: input.existingTask?.orderIndex ?? 0,
      createdAt: input.existingTask?.createdAt ?? "2026-05-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    }));

    saveHabitCheckinMock.mockResolvedValue(undefined);
    saveJournalEntryMock.mockResolvedValue({
      id: "journal-1",
      ownerUid: "user-1",
      title: "Daily closeout",
      content: "",
      mood: null,
      tags: [],
      relatedGoalId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    });
  });

  it("supports quick complete and quick check-in actions", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByText("Quick task actions")).not.toBeNull();
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

    await waitFor(() => {
      expect(screen.getByTestId("completed-task-title-task-1")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByTestId("planned-unplanned-summary").textContent).toContain("1 planned | 0 unplanned");
    });

    await user.click(screen.getByTestId("task-unplanned-checkbox-task-1"));

    await waitFor(() => {
      expect(screen.getByTestId("planned-unplanned-summary").textContent).toContain("0 planned | 1 unplanned");
    });

    await waitFor(() => {
      expect(saveTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid: "user-1",
          taskId: "task-1",
          unplanned: true,
        }),
      );
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

  it("supports dashboard mode navigation and persists selected mode", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByText("Quick task actions")).not.toBeNull();
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
      expect(screen.getByText("Quick task actions")).not.toBeNull();
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

  it("tracks unplanned completed tasks in today summary", async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    listTasksMock.mockResolvedValue([
      {
        id: "task-unplanned-1",
        ownerUid: "user-1",
        goalId: "childGoal-1",
        title: "Urgent incident follow-up",
        notes: "",
        dueDate: null,
        status: "done",
        percentComplete: 100,
        orderIndex: 0,
        createdAt: `${today}T08:00:00.000Z`,
        updatedAt: `${today}T12:00:00.000Z`,
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByText("Tasks completed")).not.toBeNull();
    });

    expect(screen.getByTestId("planned-unplanned-summary").textContent).toContain("0 planned | 1 unplanned");
  });

  it("saves guided close-day journal notes", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Close Day" }).length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByRole("button", { name: "Close Day" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Close day guided journal")).not.toBeNull();
    });

    await user.type(screen.getByTestId("close-day-right"), "Finished the top priority early.");
    await user.type(screen.getByTestId("close-day-wrong"), "Too many ad-hoc interruptions.");
    await user.type(screen.getByTestId("close-day-adjust"), "Block focus time in the morning.");
    await user.type(screen.getByTestId("close-day-freewrite"), "Need to coordinate dependencies sooner.");

    await user.click(screen.getByRole("button", { name: "Save close day note" }));

    await waitFor(() => {
      expect(saveJournalEntryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid: "user-1",
          title: expect.stringContaining("Daily closeout - "),
          tags: ["daily-closeout", "guided-journal"],
        }),
      );
    });

    const payload = saveJournalEntryMock.mock.calls[0]?.[0] as { content: string };
    expect(payload.content).toContain("## What went right");
    expect(payload.content).toContain("Finished the top priority early.");
    expect(payload.content).toContain("## What went wrong");
    expect(payload.content).toContain("## What to adjust tomorrow");
    expect(payload.content).toContain("## Additional thoughts");
  });

  it("surfaces overdue tasks with a quick review action", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayIso = yesterday.toISOString().slice(0, 10);
    const onOpenItem = vi.fn();

    listTasksMock.mockResolvedValue([
      {
        id: "task-overdue-1",
        ownerUid: "user-1",
        goalId: "childGoal-1",
        title: "Resolve dependency blocker",
        notes: "",
        dueDate: yesterdayIso,
        status: "in_progress",
        percentComplete: 40,
        orderIndex: 0,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-20T00:00:00.000Z",
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
      {
        id: "task-today-1",
        ownerUid: "user-1",
        goalId: "childGoal-1",
        title: "Prep standup",
        notes: "",
        dueDate: today,
        status: "not_started",
        percentComplete: 0,
        orderIndex: 1,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-20T00:00:00.000Z",
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);

    render(<DashboardInsights onOpenItem={onOpenItem} />);

    await waitFor(() => {
      expect(screen.getByText("Overdue now")).not.toBeNull();
    });

    const overdueCard = screen.getByText("Overdue now").closest("div");
    expect(overdueCard?.textContent).toContain("1");
    await user.click(screen.getByRole("button", { name: "Review overdue" }));

    expect(onOpenItem).toHaveBeenCalledWith("task", "task-overdue-1");
  });

  it("shows plan mode with due-this-week lane and quick task open", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();

    render(<DashboardInsights onOpenItem={onOpenItem} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Plan" })).not.toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Plan" }));

    await waitFor(() => {
      expect(screen.getByText("Due this week")).not.toBeNull();
    });

    await user.click(screen.getByTestId("due-week-task-title-task-2"));
    expect(onOpenItem).toHaveBeenCalledWith("task", "task-2");
  });

  it("shows stale in-progress lane in risks mode with quick task open", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const staleDate = new Date(now);
    staleDate.setDate(now.getDate() - 5);
    const staleIsoDate = staleDate.toISOString().slice(0, 10);
    const onOpenItem = vi.fn();

    listTasksMock.mockResolvedValue([
      {
        id: "task-stale-1",
        ownerUid: "user-1",
        goalId: "childGoal-1",
        title: "Deep dive unresolved blocker",
        notes: "",
        dueDate: staleIsoDate,
        status: "in_progress",
        percentComplete: 45,
        orderIndex: 0,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: `${staleIsoDate}T00:00:00.000Z`,
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);

    render(<DashboardInsights onOpenItem={onOpenItem} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Risks" })).not.toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Risks" }));

    await waitFor(() => {
      expect(screen.getByText("Stale in-progress")).not.toBeNull();
    });

    await user.click(screen.getByTestId("stale-task-title-task-stale-1"));
    expect(onOpenItem).toHaveBeenCalledWith("task", "task-stale-1");
  });

  it("shows parent inactivity blockers in risks mode with quick task open", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const staleDate = new Date(now);
    staleDate.setDate(now.getDate() - 7);
    const staleIsoDate = staleDate.toISOString().slice(0, 10);
    const staleIsoDateTime = `${staleIsoDate}T00:00:00.000Z`;
    const onOpenItem = vi.fn();

    listGoalsMock.mockImplementation(async (_ownerUid: string, type: "professional" | "personal") => {
      if (type === "professional") {
        return [
          {
            id: "goal-stale-1",
            ownerUid: "user-1",
            type: "professional",
            timeframeLevel: "weekly",
            title: "Q2 execution sprint",
            description: "",
            timeframe: "Q2",
            projectedStartDate: null,
            projectedEndDate: null,
            actualStartDate: null,
            actualEndDate: null,
            status: "in_progress",
            percentComplete: 55,
            isFocus: true,
            themeColor: "#2563eb",
            orderIndex: 0,
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: staleIsoDateTime,
            deletedAt: null,
            deletedBy: null,
            restoreUntil: null,
            purgeAt: null,
          },
        ];
      }

      return [];
    });

    listChildGoalsMock.mockResolvedValue([
      {
        id: "childGoal-stale-1",
        ownerUid: "user-1",
        goalId: "goal-stale-1",
        title: "Unblock platform dependency",
        description: "",
        timeframe: "Q2",
        projectedStartDate: null,
        projectedEndDate: null,
        actualStartDate: null,
        actualEndDate: null,
        status: "in_progress",
        percentComplete: 45,
        orderIndex: 0,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: staleIsoDateTime,
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);

    listTasksMock.mockResolvedValue([
      {
        id: "task-blocked-1",
        ownerUid: "user-1",
        goalId: "childGoal-stale-1",
        title: "Resolve API contract mismatch",
        notes: "",
        dueDate: staleIsoDate,
        status: "in_progress",
        percentComplete: 30,
        orderIndex: 0,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: staleIsoDateTime,
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);

    render(<DashboardInsights onOpenItem={onOpenItem} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Risks" })).not.toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Risks" }));

    await waitFor(() => {
      expect(screen.getByText("Blocked by parent inactivity")).not.toBeNull();
    });

    await user.click(screen.getByTestId("blocked-task-title-task-blocked-1"));
    expect(onOpenItem).toHaveBeenCalledWith("task", "task-blocked-1");
  });
});
