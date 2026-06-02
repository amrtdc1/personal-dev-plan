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
  softDeleteTaskMock,
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
  softDeleteTaskMock: vi.fn(),
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
    softDeleteTask: softDeleteTaskMock,
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
    softDeleteTaskMock.mockReset();
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

    updateTaskStatusMock.mockImplementation(async (_ownerUid: string, taskId: string) => ({
      id: taskId,
      ownerUid: "user-1",
      goalId: "childGoal-1",
      title: taskId === "task-2" ? "Prepare retro notes" : "Post standup summary",
      notes: "",
      dueDate: today,
      unplanned: false,
      status: "done",
      percentComplete: 100,
      orderIndex: taskId === "task-2" ? 1 : 0,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    }));

    saveTaskMock.mockImplementation(async (input: {
      taskId: string;
      ownerUid: string;
      parentGoalId: string | null;
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
      parentGoalId: input.parentGoalId,
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
      expect(screen.getAllByTestId(/^quick-task-title-/).length).toBeGreaterThan(0);
    });

    const quickTaskButton =
      (screen.queryByTestId("quick-task-title-task-1") as HTMLButtonElement | null) ??
      (screen.getAllByTestId(/^quick-task-title-/)[0] as HTMLButtonElement);
    const quickTaskId = quickTaskButton.dataset.testid?.replace("quick-task-title-", "") ?? "";
    const taskRow = quickTaskButton.closest("li");
    expect(taskRow).not.toBeNull();
    await user.click(within(taskRow as HTMLElement).getByRole("button", { name: "+1d" }));

    await waitFor(() => {
      expect(saveTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid: "user-1",
          taskId: quickTaskId,
          dueDate: expect.any(String),
        }),
      );
    });

    await user.click(within(taskRow as HTMLElement).getByRole("button", { name: "Mark done" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(updateTaskStatusMock).toHaveBeenCalledWith("user-1", quickTaskId, "done");
    });

    await waitFor(() => {
      expect(screen.getAllByTestId(/^completed-task-title-/).length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(screen.getByTestId("planned-unplanned-summary").textContent).toContain("1 planned | 0 unplanned");
    });

    await user.click(screen.getAllByTestId(/^task-unplanned-checkbox-/)[0]);

    await waitFor(() => {
      expect(saveTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid: "user-1",
          unplanned: true,
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Check in" }));
    await user.click(screen.getByRole("button", { name: "Confirm Check-in" }));

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
      expect(screen.getAllByRole("button", { name: "Close Day" }).length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByRole("button", { name: "Close Day" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Close day guided journal")).not.toBeNull();
    });

    expect(window.localStorage.getItem("pdp.dashboardInsightsView")).toBe("close_day");
  });

  it("supports urgent/quick wins queue sorting and persists selection", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Quick Wins" })).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getAllByTestId(/^quick-task-title-/).length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: "Quick Wins" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("pdp.dashboardTodayQueueSort")).toBe("quick_wins");
    });

    expect(screen.getByRole("button", { name: "Quick Wins" }).className).toContain("bg-slate-900");
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

  it("creates an unplanned task without requiring a parent goal", async () => {
    const user = userEvent.setup();

    saveTaskMock.mockImplementationOnce(async (input: {
      ownerUid: string;
      goalId: string;
      title: string;
      notes: string;
      dueDate: string | null;
      unplanned?: boolean;
    }) => ({
      id: "task-unplanned-created",
      ownerUid: input.ownerUid,
      goalId: input.goalId,
      title: input.title,
      notes: input.notes,
      dueDate: input.dueDate,
      unplanned: input.unplanned ?? false,
      status: "not_started",
      percentComplete: 0,
      orderIndex: 99,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    }));

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByText("Quick task actions")).not.toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "+ Task" }));

    await waitFor(() => {
      expect(screen.getByText("Quick Add Task")).not.toBeNull();
    });

    await user.type(screen.getByLabelText("Task title"), "Inbox triage");

    const createButton = screen.getByRole("button", { name: "Create Task" });
    expect((createButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(createButton);

    await waitFor(() => {
      expect(saveTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid: "user-1",
          parentGoalId: null,
          title: "Inbox triage",
          unplanned: true,
        }),
      );
    });
  });

  it("edits a visible task in the Today modal", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getAllByTestId(/^quick-task-title-/).length).toBeGreaterThan(0);
    });

    const quickTaskButton = screen.getAllByTestId(/^quick-task-title-/)[0] as HTMLButtonElement;
    const quickTaskId = quickTaskButton.dataset.testid?.replace("quick-task-title-", "") ?? "";
    await user.click(quickTaskButton);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: quickTaskButton.textContent ?? "" })).not.toBeNull();
    });

    const titleInput = screen.getByLabelText("Task title") as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, "Updated standup summary");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(saveTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: quickTaskId,
          ownerUid: "user-1",
          parentGoalId: "childGoal-1",
          title: "Updated standup summary",
        }),
      );
    });
  });

  it("deletes a visible task from the Today modal", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getAllByTestId(/^quick-task-title-/).length).toBeGreaterThan(0);
    });

    const quickTaskButton = screen.getAllByTestId(/^quick-task-title-/)[0] as HTMLButtonElement;
    const quickTaskId = quickTaskButton.dataset.testid?.replace("quick-task-title-", "") ?? "";
    await user.click(quickTaskButton);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: quickTaskButton.textContent ?? "" })).not.toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Delete task" }));

    await waitFor(() => {
      expect(softDeleteTaskMock).toHaveBeenCalledWith("user-1", quickTaskId);
    });
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
          tags: expect.arrayContaining(["daily-closeout", "guided-journal"]),
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

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByText("Overdue now")).not.toBeNull();
    });

    const overdueCard = screen.getByText("Overdue now").closest("div");
    expect(overdueCard?.textContent).toContain("1");
    await user.click(screen.getByRole("button", { name: "Review overdue" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Overdue only" })).not.toBeNull();
    });

    expect(screen.getByTestId("quick-task-title-task-overdue-1")).not.toBeNull();
  });

  it("opens quick task modal from the today queue", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getAllByTestId(/^quick-task-title-/).length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByTestId(/^quick-task-title-/)[0]);

    await waitFor(() => {
      expect(screen.getByText("Snooze task")).not.toBeNull();
    });
  });

  it("shows close day content when switching modes", async () => {
    const user = userEvent.setup();

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Close Day" }).length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByRole("button", { name: "Close Day" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Close day guided journal")).not.toBeNull();
    });
  });

  it("shows empty quick-task state when there are no open tasks", async () => {
    listTasksMock.mockResolvedValue([
      {
        id: "task-done-1",
        ownerUid: "user-1",
        goalId: "childGoal-1",
        title: "Already complete",
        notes: "",
        dueDate: null,
        status: "done",
        percentComplete: 100,
        orderIndex: 0,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);

    render(<DashboardInsights />);

    await waitFor(() => {
      expect(screen.getByText("No immediate task actions.")).not.toBeNull();
    });
  });
});
